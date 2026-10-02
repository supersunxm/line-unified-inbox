import { createHash } from "node:crypto";

export const EXACT_MIRROR_MANIFEST_MAX_ROWS = 490;
export const APPROVED_EXACT_MIRROR_MANIFEST_SHA256 = "62728708a1bf2a9500f03d4a750c9f8b59ce4045c4de7003e59014587630846d";
export const APPROVED_ADDITIONAL_MIRROR_MANIFEST_SHA256 = "59eb6af927714169c2a3bb51bfdb52c03a82c996cc584497fbd479800e13a55c";
export const APPROVED_DIRECT_CROSSWALK_MIRROR_MANIFEST_SHA256 = "944ed62b6bf00092f9bd9dcacee5a552d565cc7d2187c45f80170c022d7ffbde";

/** Immutable proof sets; callers cannot supply their own digest or expand execution scope. */
export function approvedExactMirrorManifest(bytes: Uint8Array): { sha256: string; rows: number; stores: number } {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 === APPROVED_EXACT_MIRROR_MANIFEST_SHA256) return { sha256, rows: 490, stores: 24 };
  if (sha256 === APPROVED_ADDITIONAL_MIRROR_MANIFEST_SHA256) return { sha256, rows: 4, stores: 2 };
  if (sha256 === APPROVED_DIRECT_CROSSWALK_MIRROR_MANIFEST_SHA256) return { sha256, rows: 19, stores: 6 };
  throw new Error("EXACT_MIRROR_MANIFEST_DIGEST_MISMATCH");
}

export const POST_LIVE_AUDIT_START_AT = new Date("2026-08-31T17:00:00.000Z");
export const POST_LIVE_AUDIT_FREEZE_AT = new Date("2026-10-01T15:57:00.000Z");

const MANIFEST_COLUMNS = [
  "store_code",
  "store_id",
  "line_official_account_id",
  "line_chat_user_id",
  "canonical_conversation_id",
  "source_event_id",
  "sent_at_utc",
  "sent_at_bangkok",
  "direction",
  "event_type",
  "message_type",
  "text_sha256",
  "text_bytes",
  "prior_reconcile_status",
  "prior_attempts",
  "canonical_near_identity_count",
  "historical_near_identity_count",
  "raw_source_id_oa_count",
] as const;

export type ExactMirrorManifestRow = {
  storeCode: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  canonicalConversationId: string;
  sourceEventId: string;
  sentAt: Date;
  direction: "OUTBOUND";
  eventType: "messageSent";
  messageType: "text";
  textSha256: string;
  textBytes: number;
  priorReconcileStatus: "PENDING";
  priorAttempts: 0;
  canonicalNearIdentityCount: 0;
  historicalNearIdentityCount: 0;
  rawSourceIdOaCount: 1;
};

export type ParsedExactMirrorManifest = {
  sha256: string;
  rows: ExactMirrorManifestRow[];
  storeCount: number;
};

export type ExactMirrorRawIdentity = Pick<
  ExactMirrorManifestRow,
  "lineOfficialAccountId" | "sourceEventId"
>;

export type ExactMirrorRawRow = {
  lineOfficialAccountId: string;
  lineChatUserId: string;
  managerMessageId: string;
  eventType: string;
  direction: string;
  messageType: string | null;
  text: string | null;
  sentAt: Date;
  reconcileStatus: string;
  reconcileAttempts: number;
};

function fail(reason: string): never {
  throw new Error(`EXACT_MIRROR_MANIFEST_${reason}`);
}

function required(value: string | undefined, column: string): string {
  if (!value?.trim()) fail(`EMPTY_${column.toUpperCase()}`);
  return value;
}

export function exactMirrorIdentityKey(identity: ExactMirrorRawIdentity): string {
  return `${identity.lineOfficialAccountId}\u0000${identity.sourceEventId}`;
}

export function exactMirrorIdentityWhere(rows: readonly ExactMirrorRawIdentity[]): {
  OR: Array<{ lineOfficialAccountId: string; managerMessageId: string }>;
} {
  return {
    OR: rows.map((row) => ({
      lineOfficialAccountId: row.lineOfficialAccountId,
      managerMessageId: row.sourceEventId,
    })),
  };
}

export function parseExactMirrorManifestCsv(
  bytes: Uint8Array,
  expectedSha256: string,
): ParsedExactMirrorManifest {
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256)) fail("EXPECTED_DIGEST_INVALID");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== expectedSha256) fail("DIGEST_MISMATCH");

  const content = Buffer.from(bytes).toString("utf8");
  if (content.includes("\uFFFD")) fail("INVALID_UTF8");
  const lines = content.split(/\r?\n/u);
  if (lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0 || lines[0] !== MANIFEST_COLUMNS.join(",")) fail("HEADER_MISMATCH");
  if (lines.length - 1 > EXACT_MIRROR_MANIFEST_MAX_ROWS) fail("ROW_LIMIT_EXCEEDED");

  const rows: ExactMirrorManifestRow[] = [];
  const identities = new Set<string>();
  const stores = new Set<string>();
  for (const line of lines.slice(1)) {
    if (!line || line.includes('"')) fail("CSV_FORMAT_UNSUPPORTED");
    const cells = line.split(",");
    if (cells.length !== MANIFEST_COLUMNS.length) fail("COLUMN_COUNT_MISMATCH");
    const values = Object.fromEntries(MANIFEST_COLUMNS.map((column, index) => [column, cells[index]]));
    const storeCode = required(values.store_code, "store_code");
    const storeId = required(values.store_id, "store_id");
    const lineOfficialAccountId = required(values.line_official_account_id, "line_official_account_id");
    const lineChatUserId = required(values.line_chat_user_id, "line_chat_user_id");
    const canonicalConversationId = required(values.canonical_conversation_id, "canonical_conversation_id");
    const sourceEventId = required(values.source_event_id, "source_event_id");
    const sentAtRaw = required(values.sent_at_utc, "sent_at_utc");
    const sentAt = new Date(sentAtRaw);
    if (!Number.isFinite(sentAt.getTime()) || sentAt.toISOString() !== sentAtRaw) fail("TIMESTAMP_INVALID");
    const bangkokAt = new Date(required(values.sent_at_bangkok, "sent_at_bangkok"));
    if (!Number.isFinite(bangkokAt.getTime()) || bangkokAt.getTime() !== sentAt.getTime()) fail("BANGKOK_TIMESTAMP_MISMATCH");
    if (sentAt < POST_LIVE_AUDIT_START_AT || sentAt > POST_LIVE_AUDIT_FREEZE_AT) fail("OUTSIDE_FROZEN_WINDOW");
    if (values.direction !== "OUTBOUND" || values.event_type !== "messageSent" || values.message_type !== "text") {
      fail("NON_TEXT_OUTBOUND_ROW");
    }
    if (!/^[a-f0-9]{64}$/u.test(values.text_sha256)) fail("TEXT_HASH_INVALID");
    const textBytes = Number(values.text_bytes);
    if (!Number.isSafeInteger(textBytes) || textBytes < 1) fail("TEXT_BYTE_COUNT_INVALID");
    if (values.prior_reconcile_status !== "PENDING" || values.prior_attempts !== "0") fail("PRIOR_RECONCILE_STATE_CHANGED");
    if (values.canonical_near_identity_count !== "0" || values.historical_near_identity_count !== "0") {
      fail("PRIOR_REPRESENTATION_EVIDENCE_CHANGED");
    }
    if (values.raw_source_id_oa_count !== "1") fail("PRIOR_OA_IDENTITY_COUNT_INVALID");

    const row: ExactMirrorManifestRow = {
      storeCode,
      storeId,
      lineOfficialAccountId,
      lineChatUserId,
      canonicalConversationId,
      sourceEventId,
      sentAt,
      direction: "OUTBOUND",
      eventType: "messageSent",
      messageType: "text",
      textSha256: values.text_sha256,
      textBytes,
      priorReconcileStatus: "PENDING",
      priorAttempts: 0,
      canonicalNearIdentityCount: 0,
      historicalNearIdentityCount: 0,
      rawSourceIdOaCount: 1,
    };
    const key = exactMirrorIdentityKey(row);
    if (identities.has(key)) fail("DUPLICATE_OA_SOURCE_IDENTITY");
    identities.add(key);
    stores.add(storeCode);
    rows.push(row);
  }
  if (stores.size > 24) fail("STORE_LIMIT_EXCEEDED");
  return { sha256, rows, storeCount: stores.size };
}

export function exactMirrorRawRowMatches(
  raw: ExactMirrorRawRow,
  expected: ExactMirrorManifestRow,
): boolean {
  if (raw.text === null) return false;
  const rawTextBytes = Buffer.byteLength(raw.text, "utf8");
  const rawTextSha256 = createHash("sha256").update(raw.text, "utf8").digest("hex");
  return raw.lineOfficialAccountId === expected.lineOfficialAccountId
    && raw.lineChatUserId === expected.lineChatUserId
    && raw.managerMessageId === expected.sourceEventId
    && raw.eventType === expected.eventType
    && raw.direction === expected.direction
    && raw.messageType?.trim().toLowerCase() === expected.messageType
    && raw.sentAt.getTime() === expected.sentAt.getTime()
    && rawTextBytes === expected.textBytes
    && rawTextSha256 === expected.textSha256;
}

export function exactMirrorRawRowMatchesPriorState(
  raw: ExactMirrorRawRow,
  expected: ExactMirrorManifestRow,
): boolean {
  return raw.reconcileStatus === expected.priorReconcileStatus
    && raw.reconcileAttempts === expected.priorAttempts;
}
