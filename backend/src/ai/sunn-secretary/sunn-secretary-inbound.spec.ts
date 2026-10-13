import assert from "node:assert/strict";
import test from "node:test";
import { classifySunnInbound, parseInboundPlan, prepareSunnReadOnlyCommand, senderHash } from "./sunn-secretary-inbound";
import { SunnSecretaryInboundService } from "./sunn-secretary-inbound.service";
import { PrismaService } from "../../prisma.service";
import { SunnSecretaryEventReceiptService } from "./sunn-secretary-event-receipt";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import { SunnSecretaryCommandPreparation } from "./sunn-secretary-inbound.service";

const bot = "U" + "a".repeat(32), owner = "U" + "b".repeat(32);
const now = new Date("2026-09-30T18:00:00Z");
const event = () => ({ type: "message", webhookEventId: "event-1", timestamp: now.getTime(), source: { type: "group", groupId: "C" + "c".repeat(32), userId: owner }, message: { type: "text", text: "@เลขาซันน์ เดือนตุลาคม LINE OA ไหนยังค้างตอบลูกค้าบ้าง", mention: { mentionees: [{ type: "user", userId: bot }] } } });

test("authorized commands in any valid group reuse deterministic Thai parser and Bangkok year", () => {
  for (const group of ["c", "d"]) {
    const input = event(); input.source.groupId = "C" + group.repeat(32);
    const { plan } = classifySunnInbound(input, bot, [owner], now);
    assert.equal(plan.classification, "AUTHORIZED");
    assert.deepEqual(plan.intent, { kind: "UNANSWERED_BY_STORE", month: "2026-10" });
    assert.equal(plan.senderHash, senderHash(owner));
    assert.ok(!JSON.stringify(plan).includes(owner));
    assert.ok(!JSON.stringify(plan).includes(input.source.groupId));
    assert.ok(!JSON.stringify(plan).includes(input.message.text));
    assert.deepEqual(parseInboundPlan(JSON.stringify(plan)), plan);
  }
});
test("actual sender authorization and real mention metadata are mandatory", () => {
  assert.equal(classifySunnInbound(event(), bot, [], now).plan.classification, "UNAUTHORIZED");
  const input = event(); input.message.mention.mentionees = [];
  assert.equal(classifySunnInbound(input, bot, [owner], now).plan.classification, "UNAUTHORIZED");
  input.message.mention.mentionees = [{ type: "user", userId: owner }];
  assert.equal(classifySunnInbound(input, bot, [owner], now).plan.classification, "UNAUTHORIZED");
  input.source.type = "user";
  assert.equal(classifySunnInbound(input, bot, [owner], now).plan.classification, "UNAUTHORIZED");
});
test("unsupported messages never become commands", () => {
  const input = event(); input.message.text = "@เลขาซันน์ สวัสดี";
  assert.equal(classifySunnInbound(input, bot, [owner], now).plan.classification, "UNSUPPORTED");
  input.message.type = "image";
  assert.equal(classifySunnInbound(input, bot, [owner], now).plan.classification, "UNSUPPORTED");
});
test("malformed source, text, event ID and nested mention shapes are bounded", () => {
  for (const input of [null, 1, [], {}, { ...event(), source: null }, { ...event(), timestamp: -1 }, { ...event(), webhookEventId: "x".repeat(257) }, { ...event(), message: { type: "text", text: "x".repeat(5001) } }, { ...event(), message: { type: "text", text: "ok", mention: null } }]) {
    assert.equal(classifySunnInbound(input, bot, [owner], now).plan.classification, "MALFORMED");
  }
});
test("explicit nonempty store scope required; revoked user fails on recovery", () => {
  const { plan } = classifySunnInbound(event(), bot, [owner], now);
  for (const scopes of [null, {}, { [owner]: [] }, { [owner]: ["*"] }]) assert.equal(prepareSunnReadOnlyCommand(plan, [owner], scopes), "BLOCKED_SCOPE");
  const scopes = { [owner]: ["11111111-1111-4111-8111-111111111111"] };
  assert.equal(prepareSunnReadOnlyCommand(plan, [owner], scopes), "PREPARED");
  assert.equal(prepareSunnReadOnlyCommand(plan, [], scopes), "UNAUTHORIZED");
});
test("corrupt plans fail closed", () => {
  for (const value of [null, "{}", "bad-json", JSON.stringify({ version: 1, classification: "AUTHORIZED", attempts: 0 }), JSON.stringify({ version: 1, classification: "MALFORMED", attempts: 4 })]) assert.throws(() => parseInboundPlan(value));
});
test("disabled intake and recovery perform no dependency calls", async () => {
  const old = process.env.SUNN_SECRETARY_WEBHOOK_ENABLED;
  process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = "false";
  try {
    const service = new SunnSecretaryInboundService({} as PrismaService, {} as SunnSecretaryEventReceiptService, {} as SunnSecretaryCredentialsService, {} as SunnSecretaryCommandPreparation);
    await service.accept(bot, [event()]); await service.recoverAndPrepare();
  } finally { if (old === undefined) delete process.env.SUNN_SECRETARY_WEBHOOK_ENABLED; else process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = old; }
});
