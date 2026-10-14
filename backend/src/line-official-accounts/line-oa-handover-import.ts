import { createHash } from "node:crypto";
import { inspect } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseCsv } from "../store-master/store-master.utils";
import type { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import type { LineOfficialAccountsService } from "./line-official-accounts.service";

/**
 * Disaster-recovery importer for the LINE OA handover CSV export. It only creates LINE OAs that
 * are missing from the database (keeping the webhook key that is already registered in the LINE
 * Developers Console), starts them disabled, and never writes to existing accounts or Stores
 * except for explicitly named --update-line exceptions.
 */

export const HANDOVER_CSV_HEADERS = [
  "Store ID",
  "Store Name",
  "LINE OA Account Name",
  "LINE OA Basic ID",
  "Channel ID",
  "Channel Secret",
  "Channel Access Token",
  "Webhook URL",
  "Connection Status",
  "Enabled / Disabled",
  "Credential Export Status",
] as const;

const WEBHOOK_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const REDACTED = "[redacted]";

/** Holds a credential or webhook key; it never serializes or prints its value. */
export class HandoverSecret {
  readonly #value: string;
  constructor(value: string) { this.#value = value; }
  reveal() { return this.#value; }
  sha256() { return sha256(this.#value); }
  prefix() { return `${this.#value.slice(0, 8)}…`; }
  toJSON() { return REDACTED; }
  toString() { return REDACTED; }
  [inspect.custom]() { return REDACTED; }
}

export type HandoverRow = {
  line: number;
  storeCode: string;
  accountName: string;
  basicId: string | null;
  channelId: string | null;
  channelSecret: HandoverSecret;
  channelAccessToken: HandoverSecret;
  webhookKey: HandoverSecret;
};

export type HandoverParseIssue = { line: number; storeCode: string | null; reason: string };

export type HandoverExistingOa = {
  id: string;
  webhookKey: string;
  basicId: string | null;
  channelId: string | null;
  storeId: string | null;
  storeCode: string | null;
  isActive: boolean;
  archivedAt: Date | null;
};

export type HandoverStoreMaster = {
  id: string;
  externalStoreId: string;
  lineId: string | null;
  isActive: boolean;
  linkedStoreIds: string[];
};

export type HandoverSnapshot = {
  oas: HandoverExistingOa[];
  storeMasters: HandoverStoreMaster[];
  storeCodes: string[];
};

export type HandoverPlanOptions = {
  updateLines: ReadonlySet<number>;
  allowClosedStoreCodes: ReadonlySet<string>;
};

export type HandoverAction =
  | { kind: "PRESENT"; line: number; storeCode: string; keyPrefix: string; oaId: string; basicIdDiffers: boolean }
  | { kind: "CREATE"; line: number; storeCode: string; keyPrefix: string; basicId: string | null; storeMasterId: string; storeMasterClosed: boolean }
  | { kind: "UPDATE_EXISTING"; line: number; storeCode: string; keyPrefix: string; oaId: string; previousKeyPrefix: string }
  | { kind: "SKIP_NO_STORE_MASTER"; line: number; storeCode: string; keyPrefix: string }
  | { kind: "CONFLICT"; line: number; storeCode: string | null; keyPrefix: string | null; reasons: string[] };

export type HandoverPlan = {
  actions: HandoverAction[];
  optionErrors: string[];
  planSha256: string;
  summary: Record<HandoverAction["kind"], number>;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cell(value: string | undefined) {
  // Spreadsheet exports guard text cells with a leading apostrophe; it is not part of the value.
  const trimmed = (value ?? "").trim();
  return (trimmed.startsWith("'") ? trimmed.slice(1) : trimmed).trim();
}

function normalizedIdentifier(value: string | null | undefined) {
  const result = value?.trim().toLocaleLowerCase("en-US");
  return result || null;
}

function webhookKeyFromUrl(raw: string, expectedHost: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== expectedHost || url.username || url.password || url.search || url.hash) return null;
    const match = /^\/webhook\/([^/]+)\/?$/u.exec(url.pathname);
    return match && WEBHOOK_KEY_PATTERN.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}

export function parseHandoverCsv(text: string, expectedWebhookHost: string): { rows: HandoverRow[]; issues: HandoverParseIssue[] } {
  const [header, ...records] = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  if (!header) throw new Error("Handover CSV is empty");
  const normalizedHeader = header.map((value) => value.trim());
  const indexes = new Map<string, number>();
  for (const name of HANDOVER_CSV_HEADERS) {
    const positions = normalizedHeader.flatMap((value, index) => (value === name ? [index] : []));
    if (positions.length !== 1) throw new Error(`Handover CSV must contain exactly one "${name}" column`);
    indexes.set(name, positions[0]);
  }
  const read = (record: string[], name: (typeof HANDOVER_CSV_HEADERS)[number]) => cell(record[indexes.get(name) ?? -1]);

  const rows: HandoverRow[] = [];
  const issues: HandoverParseIssue[] = [];
  records.forEach((record, index) => {
    const line = index + 2;
    const storeCode = read(record, "Store ID");
    const reasons: string[] = [];
    if (!storeCode) reasons.push("Store ID is empty");
    const accountName = read(record, "LINE OA Account Name");
    if (!accountName) reasons.push("LINE OA Account Name is empty");
    const channelSecret = read(record, "Channel Secret");
    if (!channelSecret) reasons.push("Channel Secret is empty");
    const channelAccessToken = read(record, "Channel Access Token");
    if (!channelAccessToken) reasons.push("Channel Access Token is empty");
    const webhookKey = webhookKeyFromUrl(read(record, "Webhook URL"), expectedWebhookHost);
    if (!webhookKey) reasons.push("Webhook URL is not a canonical webhook URL on the expected host");
    if (reasons.length > 0 || !webhookKey) {
      issues.push({ line, storeCode: storeCode || null, reason: reasons.join("; ") });
      return;
    }
    rows.push({
      line,
      storeCode,
      accountName,
      basicId: read(record, "LINE OA Basic ID") || null,
      channelId: read(record, "Channel ID") || null,
      channelSecret: new HandoverSecret(channelSecret),
      channelAccessToken: new HandoverSecret(channelAccessToken),
      webhookKey: new HandoverSecret(webhookKey),
    });
  });
  return { rows, issues };
}

function countBy<T>(values: readonly T[], key: (value: T) => string | null) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const id = key(value);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function buildHandoverPlan(
  rows: readonly HandoverRow[],
  issues: readonly HandoverParseIssue[],
  snapshot: HandoverSnapshot,
  options: HandoverPlanOptions,
): HandoverPlan {
  const oaByKey = new Map(snapshot.oas.map((oa) => [oa.webhookKey, oa]));
  const mastersByCode = new Map(snapshot.storeMasters.map((master) => [master.externalStoreId, master]));
  const storeCodes = new Set(snapshot.storeCodes);
  const keyCounts = countBy(rows, (row) => row.webhookKey.reveal());
  const channelCounts = countBy(rows, (row) => row.channelId);
  const basicCounts = countBy(rows, (row) => normalizedIdentifier(row.basicId));

  const actions: HandoverAction[] = issues.map((issue) => ({
    kind: "CONFLICT", line: issue.line, storeCode: issue.storeCode, keyPrefix: null, reasons: [issue.reason],
  }));

  for (const row of rows) {
    const key = row.webhookKey.reveal();
    const keyPrefix = row.webhookKey.prefix();
    const basicId = normalizedIdentifier(row.basicId);
    const reasons: string[] = [];
    if ((keyCounts.get(key) ?? 0) > 1) reasons.push("webhook key is duplicated in the CSV");
    if (row.channelId && (channelCounts.get(row.channelId) ?? 0) > 1) reasons.push("Channel ID is duplicated in the CSV");
    if (basicId && (basicCounts.get(basicId) ?? 0) > 1) reasons.push("Basic ID is duplicated in the CSV");
    const conflict = (extra: string[] = []) => actions.push({ kind: "CONFLICT", line: row.line, storeCode: row.storeCode, keyPrefix, reasons: [...reasons, ...extra] });
    const isUpdateLine = options.updateLines.has(row.line);

    const sameKey = oaByKey.get(key);
    if (sameKey) {
      if (isUpdateLine) reasons.push("--update-line target already uses this webhook key");
      if (sameKey.channelId && row.channelId && sameKey.channelId !== row.channelId) reasons.push(`webhook key belongs to OA ${sameKey.id} with a different Channel ID`);
      if (reasons.length > 0) { conflict(); continue; }
      actions.push({
        kind: "PRESENT", line: row.line, storeCode: row.storeCode, keyPrefix, oaId: sameKey.id,
        basicIdDiffers: normalizedIdentifier(sameKey.basicId) !== basicId,
      });
      continue;
    }

    const identityMatches = snapshot.oas.filter((oa) =>
      (row.channelId && oa.channelId === row.channelId) || (basicId && normalizedIdentifier(oa.basicId) === basicId));
    if (isUpdateLine) {
      const [target] = identityMatches;
      if (identityMatches.length !== 1) reasons.push(`--update-line requires exactly one existing OA with this Basic ID or Channel ID (found ${identityMatches.length})`);
      else if (target.archivedAt) reasons.push(`--update-line target OA ${target.id} is archived`);
      else if (target.storeCode !== row.storeCode) reasons.push(`--update-line target OA ${target.id} belongs to a different Store ID`);
      if (reasons.length > 0 || !target) { conflict(); continue; }
      actions.push({
        kind: "UPDATE_EXISTING", line: row.line, storeCode: row.storeCode, keyPrefix, oaId: target.id,
        previousKeyPrefix: `${target.webhookKey.slice(0, 8)}…`,
      });
      continue;
    }
    if (identityMatches.length > 0) {
      reasons.push(`Basic ID or Channel ID already belongs to existing OA ${identityMatches.map(({ id }) => id).join(", ")}`);
    }

    const master = mastersByCode.get(row.storeCode);
    if (reasons.length > 0) { conflict(); continue; }
    if (!master) {
      actions.push({ kind: "SKIP_NO_STORE_MASTER", line: row.line, storeCode: row.storeCode, keyPrefix });
      continue;
    }
    if (!master.isActive && !options.allowClosedStoreCodes.has(row.storeCode)) reasons.push("Store Master record is closed (not listed in --allow-closed-store)");
    if (master.lineId && normalizedIdentifier(master.lineId) !== basicId) reasons.push("Basic ID does not match the Store Master LINE ID");
    if (storeCodes.has(row.storeCode) || master.linkedStoreIds.length > 0) reasons.push("a Store with this Store ID already exists; the importer only creates new Stores");
    if (reasons.length > 0) { conflict(); continue; }
    actions.push({
      kind: "CREATE", line: row.line, storeCode: row.storeCode, keyPrefix, basicId: row.basicId,
      storeMasterId: master.id, storeMasterClosed: !master.isActive,
    });
  }
  actions.sort((left, right) => left.line - right.line);

  const optionErrors: string[] = [];
  for (const line of options.updateLines) {
    if (!actions.some((action) => action.line === line && action.kind === "UPDATE_EXISTING")) optionErrors.push(`--update-line=${line} does not resolve to an UPDATE_EXISTING action`);
  }
  for (const code of options.allowClosedStoreCodes) {
    if (!actions.some((action) => action.kind === "CREATE" && action.storeCode === code && action.storeMasterClosed)) {
      optionErrors.push(`--allow-closed-store=${code} does not match a CREATE row with a closed Store Master record`);
    }
  }

  const keyHashes = new Map(rows.map((row) => [row.line, row.webhookKey.sha256()]));
  const fingerprint = actions.map((action) => ({
    kind: action.kind,
    line: action.line,
    storeCode: action.storeCode,
    webhookKeySha256: keyHashes.get(action.line) ?? null,
    oaId: "oaId" in action ? action.oaId : null,
    storeMasterId: action.kind === "CREATE" ? action.storeMasterId : null,
  }));
  const summary = { PRESENT: 0, CREATE: 0, UPDATE_EXISTING: 0, SKIP_NO_STORE_MASTER: 0, CONFLICT: 0 };
  for (const action of actions) summary[action.kind] += 1;
  return {
    actions,
    optionErrors,
    planSha256: sha256(JSON.stringify({ fingerprint, updateLines: [...options.updateLines].sort((a, b) => a - b), allowClosedStoreCodes: [...options.allowClosedStoreCodes].sort() })),
    summary,
  };
}

type HandoverDbClient = Prisma.TransactionClient;

export async function loadHandoverSnapshot(client: HandoverDbClient): Promise<HandoverSnapshot> {
  const [oas, masters, stores] = await Promise.all([
    client.lineOfficialAccount.findMany({
      select: { id: true, webhookKey: true, basicId: true, channelId: true, storeId: true, isActive: true, archivedAt: true, store: { select: { code: true } } },
    }),
    client.storeMaster.findMany({
      where: { externalStoreId: { not: null } },
      select: { id: true, externalStoreId: true, lineId: true, isActive: true, stores: { select: { id: true } } },
    }),
    client.store.findMany({ where: { code: { not: null } }, select: { code: true } }),
  ]);
  return {
    oas: oas.map((oa) => ({
      id: oa.id, webhookKey: oa.webhookKey, basicId: oa.basicId, channelId: oa.channelId, storeId: oa.storeId,
      storeCode: oa.store?.code ?? null, isActive: oa.isActive, archivedAt: oa.archivedAt,
    })),
    storeMasters: masters.flatMap((master) => master.externalStoreId
      ? [{ id: master.id, externalStoreId: master.externalStoreId, lineId: master.lineId, isActive: master.isActive, linkedStoreIds: master.stores.map(({ id }) => id) }]
      : []),
    storeCodes: stores.flatMap((store) => (store.code ? [store.code] : [])),
  };
}

/** sha256 over every LINE OA's id and webhook key, sorted. Never prints the keys themselves. */
export function webhookKeysetSha256(oas: ReadonlyArray<{ id: string; webhookKey: string }>) {
  return sha256(oas.map((oa) => `${oa.id}:${oa.webhookKey}`).sort().join("\n"));
}

async function protectedRowsFingerprint(client: HandoverDbClient, oaIds: readonly string[], storeIds: readonly string[]) {
  const [oas, stores] = await Promise.all([
    client.lineOfficialAccount.findMany({
      where: { id: { in: [...oaIds] } },
      orderBy: { id: "asc" },
      select: {
        id: true, webhookKey: true, storeId: true, accountType: true, name: true, basicId: true, channelId: true, destinationId: true,
        encryptedChannelSecret: true, encryptedChannelAccessToken: true, isActive: true, archivedAt: true, connectionStatus: true, updatedAt: true,
      },
    }),
    client.store.findMany({
      where: { id: { in: [...storeIds] } },
      orderBy: { id: "asc" },
      select: { id: true, code: true, name: true, region: true, area: true, storeMasterId: true, isActive: true, archivedAt: true, updatedAt: true },
    }),
  ]);
  return { oaCount: oas.length, storeCount: stores.length, sha256: sha256(JSON.stringify({ oas, stores })) };
}

export type HandoverApplyOptions = HandoverPlanOptions & {
  expectedPlanSha256: string;
  expectedExistingKeysetSha256: string;
};

export type HandoverApplyResult = {
  created: Array<{ line: number; storeCode: string; keyPrefix: string; oaId: string; storeId: string | null; isActive: boolean }>;
  updated: Array<{ line: number; storeCode: string; oaId: string; before: { keyPrefix: string; keySha16: string; updatedAt: string }; after: { keyPrefix: string; keySha16: string; updatedAt: string; credentialsReplaced: boolean } }>;
  skipped: Array<{ line: number; storeCode: string; reason: "PRESENT" | "SKIP_NO_STORE_MASTER" }>;
  protectedRows: { oaCount: number; storeCount: number; unchanged: true };
  existingKeysetSha256: string;
};

export async function applyHandoverPlan(input: {
  prisma: PrismaClient;
  service: Pick<LineOfficialAccountsService, "createWithExistingWebhookKeyInTransaction">;
  encryption: Pick<CredentialEncryptionService, "encrypt" | "decrypt">;
  rows: readonly HandoverRow[];
  issues: readonly HandoverParseIssue[];
  options: HandoverApplyOptions;
}): Promise<HandoverApplyResult> {
  const { prisma, service, encryption, rows, issues, options } = input;
  const rowsByLine = new Map(rows.map((row) => [row.line, row]));
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('line_oa_handover_import'))`;
    const snapshot = await loadHandoverSnapshot(tx);
    const existingKeysetSha256 = webhookKeysetSha256(snapshot.oas);
    if (existingKeysetSha256 !== options.expectedExistingKeysetSha256) throw new Error("Existing LINE OA webhook keyset does not match --expected-existing-keyset-sha256; no data was changed");
    const plan = buildHandoverPlan(rows, issues, snapshot, options);
    if (plan.planSha256 !== options.expectedPlanSha256) throw new Error("Handover plan does not match --expected-plan-sha256; no data was changed");
    if (plan.summary.CONFLICT > 0 || plan.optionErrors.length > 0) throw new Error(`Handover plan has ${plan.summary.CONFLICT} conflict(s) and ${plan.optionErrors.length} option error(s); no data was changed`);

    const updateTargets = new Set(plan.actions.flatMap((action) => (action.kind === "UPDATE_EXISTING" ? [action.oaId] : [])));
    const protectedOaIds = snapshot.oas.filter((oa) => !updateTargets.has(oa.id)).map((oa) => oa.id);
    const protectedStoreIds = (await tx.store.findMany({ select: { id: true } })).map(({ id }) => id);
    const before = await protectedRowsFingerprint(tx, protectedOaIds, protectedStoreIds);

    const result: HandoverApplyResult = { created: [], updated: [], skipped: [], protectedRows: { oaCount: before.oaCount, storeCount: before.storeCount, unchanged: true }, existingKeysetSha256 };
    for (const action of plan.actions) {
      const row = rowsByLine.get(action.line);
      if (action.kind === "PRESENT" || action.kind === "SKIP_NO_STORE_MASTER") {
        result.skipped.push({ line: action.line, storeCode: action.storeCode, reason: action.kind });
        continue;
      }
      if (!row || action.kind === "CONFLICT") throw new Error(`Handover line ${action.line} cannot be applied; no data was changed`);
      if (action.kind === "UPDATE_EXISTING") {
        const current = await tx.lineOfficialAccount.findUniqueOrThrow({ where: { id: action.oaId }, select: { webhookKey: true, updatedAt: true } });
        const encryptedChannelSecret = encryption.encrypt(row.channelSecret.reveal());
        const encryptedChannelAccessToken = encryption.encrypt(row.channelAccessToken.reveal());
        if (encryption.decrypt(encryptedChannelSecret) !== row.channelSecret.reveal() || encryption.decrypt(encryptedChannelAccessToken) !== row.channelAccessToken.reveal()) {
          throw new Error(`Credential encryption round-trip failed for line ${action.line}; no data was changed`);
        }
        const saved = await tx.lineOfficialAccount.update({
          where: { id: action.oaId },
          data: { webhookKey: row.webhookKey.reveal(), encryptedChannelSecret, encryptedChannelAccessToken, lastConnectionError: null },
          select: { webhookKey: true, updatedAt: true },
        });
        result.updated.push({
          line: action.line, storeCode: action.storeCode, oaId: action.oaId,
          before: { keyPrefix: `${current.webhookKey.slice(0, 8)}…`, keySha16: sha256(current.webhookKey).slice(0, 16), updatedAt: current.updatedAt.toISOString() },
          after: { keyPrefix: `${saved.webhookKey.slice(0, 8)}…`, keySha16: sha256(saved.webhookKey).slice(0, 16), updatedAt: saved.updatedAt.toISOString(), credentialsReplaced: true },
        });
        continue;
      }
      const created = await service.createWithExistingWebhookKeyInTransaction(tx, {
        storeMasterId: action.storeMasterId,
        name: row.accountName,
        basicId: row.basicId ?? undefined,
        channelId: row.channelId ?? undefined,
        channelSecret: row.channelSecret.reveal(),
        channelAccessToken: row.channelAccessToken.reveal(),
        isActive: false,
      }, row.webhookKey.reveal(), { allowClosedStoreCodes: options.allowClosedStoreCodes });
      if (created.isActive) throw new Error(`Imported OA for line ${action.line} is unexpectedly active; no data was changed`);
      if (!created.encryptedChannelSecret || encryption.decrypt(created.encryptedChannelSecret) !== row.channelSecret.reveal()) {
        throw new Error(`Imported channel secret for line ${action.line} does not decrypt; no data was changed`);
      }
      result.created.push({ line: action.line, storeCode: action.storeCode, keyPrefix: action.keyPrefix, oaId: created.id, storeId: created.storeId, isActive: created.isActive });
    }

    const after = await protectedRowsFingerprint(tx, protectedOaIds, protectedStoreIds);
    if (after.sha256 !== before.sha256 || after.oaCount !== before.oaCount || after.storeCount !== before.storeCount) {
      throw new Error("Protected existing LINE OAs or Stores changed during import; no data was changed");
    }
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 300000 });
}

export type HandoverActivationTarget = { line: number; storeCode: string; keyPrefix: string; oaId: string };

/** Resolves imported (disabled) OAs from the CSV. Read-only. */
export async function findActivationTargets(
  client: HandoverDbClient,
  rows: readonly HandoverRow[],
  selection: { storeCodes: ReadonlySet<string> } | { allImported: true },
): Promise<HandoverActivationTarget[]> {
  const selected = "allImported" in selection ? rows : rows.filter((row) => selection.storeCodes.has(row.storeCode));
  if ("storeCodes" in selection) {
    for (const code of selection.storeCodes) {
      if (!selected.some((row) => row.storeCode === code)) throw new Error(`Store ID ${code} is not in the handover CSV`);
    }
  }
  const byKey = new Map(selected.map((row) => [row.webhookKey.reveal(), row]));
  const accounts = await client.lineOfficialAccount.findMany({
    where: { webhookKey: { in: [...byKey.keys()] }, isActive: false, archivedAt: null, accountType: "STORE" },
    select: { id: true, webhookKey: true },
  });
  return accounts
    .map((account) => {
      const row = byKey.get(account.webhookKey);
      if (!row) throw new Error("Activation target lookup returned an unexpected account");
      return { line: row.line, storeCode: row.storeCode, keyPrefix: row.webhookKey.prefix(), oaId: account.id };
    })
    .sort((left, right) => left.line - right.line);
}

export async function activateHandoverAccounts(
  service: Pick<LineOfficialAccountsService, "setStatus">,
  targets: readonly HandoverActivationTarget[],
) {
  const activated: HandoverActivationTarget[] = [];
  for (const target of targets) {
    try {
      await service.setStatus(target.oaId, true);
    } catch (error) {
      return { activated, failed: { ...target, message: error instanceof Error ? error.message : "Activation failed" } };
    }
    activated.push(target);
  }
  return { activated, failed: null };
}

/** Replaces any CSV credential or webhook key that appears in a message. */
export function redactHandoverSecrets(message: string, rows: readonly HandoverRow[]) {
  let result = message;
  for (const row of rows) {
    for (const secret of [row.channelSecret, row.channelAccessToken, row.webhookKey]) {
      const value = secret.reveal();
      if (value.length >= 8) result = result.split(value).join(REDACTED);
    }
  }
  return result;
}
