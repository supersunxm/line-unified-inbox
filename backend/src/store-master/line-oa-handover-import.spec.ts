import assert from "node:assert/strict";
import test from "node:test";
import { inspect } from "node:util";
import {
  buildHandoverPlan,
  HANDOVER_CSV_HEADERS,
  HandoverSecret,
  HandoverSnapshot,
  parseHandoverCsv,
  redactHandoverSecrets,
  webhookKeysetSha256,
} from "../line-official-accounts/line-oa-handover-import";
import { parseLineOaHandoverCliArgs } from "../line-official-accounts/line-oa-handover-import-cli-args";

const HOST = "inbox.example.test";

type Row = { store: string; basic: string; channel: string; key: string; name?: string };

function key(seed: string) {
  return `${seed}${"k".repeat(32)}`.slice(0, 32);
}

function csv(rows: Row[], options: { host?: string } = {}) {
  const lines = rows.map((row, index) => [
    row.store,
    `Store ${row.store}`,
    row.name ?? `OA ${row.store}`,
    `'${row.basic}`,
    row.channel,
    `secret-${index}-abcdefgh`,
    `token-${index}-abcdefghijkl`,
    `https://${options.host ?? HOST}/webhook/${row.key}`,
    "CONNECTED",
    "Enabled",
    "COMPLETE",
  ].join(","));
  return [HANDOVER_CSV_HEADERS.join(","), ...lines].join("\n");
}

function snapshot(overrides: Partial<HandoverSnapshot> = {}): HandoverSnapshot {
  return {
    oas: [{ id: "oa-restored", webhookKey: key("restored"), basicId: "@100aaaa", channelId: null, storeId: "store-100", storeCode: "100", isActive: true, archivedAt: null }],
    storeMasters: [
      { id: "master-100", externalStoreId: "100", lineId: "@100aaaa", isActive: true, linkedStoreIds: ["store-100"] },
      { id: "master-200", externalStoreId: "200", lineId: "@200bbbb", isActive: true, linkedStoreIds: [] },
      { id: "master-300", externalStoreId: "300", lineId: "@300cccc", isActive: false, linkedStoreIds: [] },
    ],
    storeCodes: ["100"],
    ...overrides,
  };
}

const none = { updateLines: new Set<number>(), allowClosedStoreCodes: new Set<string>() };

void test("parses handover rows, strips the spreadsheet apostrophe and keeps credentials wrapped", () => {
  const { rows, issues } = parseHandoverCsv(`${String.fromCharCode(0xfeff)}${csv([{ store: "200", basic: "@200bbbb", channel: "2000000001", key: key("new200") }])}`, HOST);
  assert.equal(issues.length, 0);
  assert.equal(rows[0].line, 2);
  assert.equal(rows[0].basicId, "@200bbbb");
  assert.equal(rows[0].webhookKey.reveal(), key("new200"));
  assert.equal(rows[0].channelSecret.reveal(), "secret-0-abcdefgh");
  assert.equal(JSON.stringify(rows[0]).includes("secret-0-abcdefgh"), false);
  assert.equal(inspect(rows[0]).includes("token-0-abcdefghijkl"), false);
  assert.equal(JSON.stringify(rows[0]).includes(key("new200")), false);
});

void test("rejects webhook URLs on another host and missing columns", () => {
  const { rows, issues } = parseHandoverCsv(csv([{ store: "200", basic: "@200bbbb", channel: "1", key: key("x") }], { host: "evil.example" }), HOST);
  assert.equal(rows.length, 0);
  assert.match(issues[0].reason, /canonical webhook URL/u);
  assert.throws(() => parseHandoverCsv("Store ID,Store Name\n1,a", HOST), /exactly one "LINE OA Account Name" column/u);
});

void test("classifies present, create, skip and closed rows", () => {
  const { rows, issues } = parseHandoverCsv(csv([
    { store: "100", basic: "@100aaaa", channel: "1000000001", key: key("restored") },
    { store: "200", basic: "@200bbbb", channel: "2000000001", key: key("new200") },
    { store: "300", basic: "@300cccc", channel: "3000000001", key: key("new300") },
    { store: "400", basic: "@400dddd", channel: "4000000001", key: key("new400") },
  ]), HOST);
  const plan = buildHandoverPlan(rows, issues, snapshot(), none);
  assert.deepEqual(plan.actions.map((action) => action.kind), ["PRESENT", "CREATE", "CONFLICT", "SKIP_NO_STORE_MASTER"]);
  assert.deepEqual(plan.summary, { PRESENT: 1, CREATE: 1, UPDATE_EXISTING: 0, SKIP_NO_STORE_MASTER: 1, CONFLICT: 1 });

  const allowed = buildHandoverPlan(rows, issues, snapshot(), { ...none, allowClosedStoreCodes: new Set(["300"]) });
  const closed = allowed.actions.find((action) => action.line === 4);
  assert.equal(closed?.kind, "CREATE");
  assert.equal(closed?.kind === "CREATE" && closed.storeMasterClosed, true);
  assert.notEqual(allowed.planSha256, plan.planSha256);
});

void test("a new key for an existing Basic ID is a conflict unless named with --update-line", () => {
  const { rows, issues } = parseHandoverCsv(csv([{ store: "100", basic: "@100AAAA", channel: "1000000001", key: key("rotated") }]), HOST);
  const conflict = buildHandoverPlan(rows, issues, snapshot(), none);
  assert.equal(conflict.actions[0].kind, "CONFLICT");

  const update = buildHandoverPlan(rows, issues, snapshot(), { ...none, updateLines: new Set([2]) });
  assert.equal(update.actions[0].kind, "UPDATE_EXISTING");
  assert.equal(update.actions[0].kind === "UPDATE_EXISTING" && update.actions[0].oaId, "oa-restored");
  assert.deepEqual(update.optionErrors, []);

  const otherStore = parseHandoverCsv(csv([{ store: "999", basic: "@100aaaa", channel: "1", key: key("rotated") }]), HOST);
  const mismatch = buildHandoverPlan(otherStore.rows, otherStore.issues, snapshot(), { ...none, updateLines: new Set([2]) });
  assert.equal(mismatch.actions[0].kind, "CONFLICT");
  assert.match(mismatch.optionErrors[0], /--update-line=2/u);
});

void test("rows that would touch existing Stores, mismatched identities or duplicates are conflicts", () => {
  const { rows, issues } = parseHandoverCsv(csv([
    { store: "200", basic: "@wrong", channel: "2000000001", key: key("a") },
    { store: "500", basic: "@500eeee", channel: "5000000001", key: key("b") },
    { store: "600", basic: "@600ffff", channel: "6000000001", key: key("c") },
    { store: "700", basic: "@700gggg", channel: "6000000001", key: key("d") },
  ]), HOST);
  const plan = buildHandoverPlan(rows, issues, snapshot({
    storeMasters: [
      ...snapshot().storeMasters,
      { id: "master-500", externalStoreId: "500", lineId: "@500eeee", isActive: true, linkedStoreIds: ["store-500"] },
      { id: "master-600", externalStoreId: "600", lineId: "@600ffff", isActive: true, linkedStoreIds: [] },
    ],
  }), none);
  assert.deepEqual(plan.actions.map((action) => action.kind), ["CONFLICT", "CONFLICT", "CONFLICT", "CONFLICT"]);
  const reasons = plan.actions.flatMap((action) => (action.kind === "CONFLICT" ? action.reasons : []));
  assert.ok(reasons.some((reason) => reason.includes("Store Master LINE ID")));
  assert.ok(reasons.some((reason) => reason.includes("already exists")));
  assert.ok(reasons.some((reason) => reason.includes("Channel ID is duplicated")));
});

void test("unused --allow-closed-store values are reported as option errors", () => {
  const { rows, issues } = parseHandoverCsv(csv([{ store: "200", basic: "@200bbbb", channel: "1", key: key("x") }]), HOST);
  const plan = buildHandoverPlan(rows, issues, snapshot(), { ...none, allowClosedStoreCodes: new Set(["200"]) });
  assert.match(plan.optionErrors[0], /--allow-closed-store=200/u);
});

void test("plan output never contains credentials or full webhook keys", () => {
  const { rows, issues } = parseHandoverCsv(csv([
    { store: "100", basic: "@100aaaa", channel: "1", key: key("restored") },
    { store: "200", basic: "@200bbbb", channel: "2", key: key("new200") },
  ]), HOST);
  const output = JSON.stringify(buildHandoverPlan(rows, issues, snapshot(), none));
  for (const row of rows) {
    for (const secret of [row.channelSecret, row.channelAccessToken, row.webhookKey]) assert.equal(output.includes(secret.reveal()), false);
  }
  assert.equal(output.includes(`${key("new200").slice(0, 8)}…`), true);
});

void test("redaction removes CSV secrets from error messages", () => {
  const { rows } = parseHandoverCsv(csv([{ store: "200", basic: "@200bbbb", channel: "1", key: key("new200") }]), HOST);
  const message = redactHandoverSecrets(`failed for secret-0-abcdefgh and ${key("new200")}`, rows);
  assert.equal(message, "failed for [redacted] and [redacted]");
  assert.equal(String(new HandoverSecret("abc")), "[redacted]");
});

void test("webhook keyset hash is order-independent", () => {
  const a = webhookKeysetSha256([{ id: "1", webhookKey: "a" }, { id: "2", webhookKey: "b" }]);
  const b = webhookKeysetSha256([{ id: "2", webhookKey: "b" }, { id: "1", webhookKey: "a" }]);
  assert.equal(a, b);
  assert.notEqual(a, webhookKeysetSha256([{ id: "1", webhookKey: "a" }]));
});

void test("CLI arguments require explicit approvals for apply and activation", () => {
  const sha = "a".repeat(64);
  const base = ["--csv=-", `--webhook-host=${HOST}`];
  assert.deepEqual(parseLineOaHandoverCliArgs(["preview", ...base, "--update-line=50", "--allow-closed-store=31754"]), {
    command: "preview", csvPath: "-", webhookHost: HOST, updateLines: new Set([50]), allowClosedStoreCodes: new Set(["31754"]),
  });
  assert.throws(() => parseLineOaHandoverCliArgs(["apply", ...base, `--expected-sha256=${sha}`]), /--expected-plan-sha256/u);
  assert.throws(() => parseLineOaHandoverCliArgs(["preview", ...base, `--expected-sha256=${sha}`]), /Unsupported option/u);
  assert.throws(() => parseLineOaHandoverCliArgs(["activate", ...base, `--expected-sha256=${sha}`, "--expected-count=2"]), /exactly one/u);
  assert.throws(() => parseLineOaHandoverCliArgs(["activate", ...base, `--expected-sha256=${sha}`, "--expected-count=2", "--all-imported", "--store-codes=1"]), /exactly one/u);
  const activation = parseLineOaHandoverCliArgs(["activate", ...base, `--expected-sha256=${sha}`, "--expected-count=2", "--store-codes=27349,29737"]);
  assert.equal(activation.command === "activate" && "storeCodes" in activation.selection && activation.selection.storeCodes.size, 2);
  assert.throws(() => parseLineOaHandoverCliArgs(["preview", ...base, "--update-line=1"]), /2 or greater/u);
  assert.throws(() => parseLineOaHandoverCliArgs(["preview", "--csv=-", "--csv=x", `--webhook-host=${HOST}`]), /Duplicate option/u);
});
