import { createHash } from "node:crypto";

export const EXACT_MIRROR_MANIFEST_MAX_ROWS = 490;
export const APPROVED_EXACT_MIRROR_MANIFEST_SHA256 = "62728708a1bf2a9500f03d4a750c9f8b59ce4045c4de7003e59014587630846d";
export const APPROVED_ADDITIONAL_MIRROR_MANIFEST_SHA256 = "59eb6af927714169c2a3bb51bfdb52c03a82c996cc584497fbd479800e13a55c";
export const APPROVED_DIRECT_CROSSWALK_MIRROR_MANIFEST_SHA256 = "944ed62b6bf00092f9bd9dcacee5a552d565cc7d2187c45f80170c022d7ffbde";

const APPROVED_EXACT_MEDIA_MANIFESTS = new Map<string, { rows: number; stores: number }>([
  ["eaff87a8919c5a87961efa73035350d05f3fb7335be794db571e212193bb3730", { rows: 490, stores: 63 }],
  ["19c53a0e21035fa3da667171c6bd029d73f4bd25b7e72bc4c1532fa769b6774c", { rows: 61, stores: 9 }],
]);

/** Immutable proof sets; callers cannot supply their own digest or expand execution scope. */
export function approvedExactMirrorManifest(bytes: Uint8Array): {
  sha256: string;
  rows: number;
  stores: number;
  kind: "TEXT" | "MEDIA";
} {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 === APPROVED_EXACT_MIRROR_MANIFEST_SHA256) return { sha256, rows: 490, stores: 24, kind: "TEXT" };
  if (sha256 === APPROVED_ADDITIONAL_MIRROR_MANIFEST_SHA256) return { sha256, rows: 4, stores: 2, kind: "TEXT" };
  if (sha256 === APPROVED_DIRECT_CROSSWALK_MIRROR_MANIFEST_SHA256) return { sha256, rows: 19, stores: 6, kind: "TEXT" };
  const media = APPROVED_EXACT_MEDIA_MANIFESTS.get(sha256);
  if (media) return { sha256, ...media, kind: "MEDIA" };
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

const MEDIA_MANIFEST_COLUMNS = [
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
  "source_payload_sha256",
  "text_sha256",
  "text_bytes",
  "file_name_sha256",
  "file_name_bytes",
  "biz_id_sha256",
  "actor_class",
  "prior_reconcile_status",
  "prior_attempts",
  "raw_source_id_oa_count",
  "link_type",
] as const;

export type ExactMirrorManifestRow = {
  kind: "TEXT" | "MEDIA";
  storeCode: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  canonicalConversationId: string;
  sourceEventId: string;
  sentAt: Date;
  direction: "OUTBOUND";
  eventType: "messageSent";
  messageType: "text" | "image" | "sticker" | "file";
  textSha256: string;
  textBytes: number;
  priorReconcileStatus: "PENDING";
  priorAttempts: 0;
  canonicalNearIdentityCount: 0;
  historicalNearIdentityCount: 0;
  rawSourceIdOaCount: 1;
  sourcePayloadSha256?: string;
  fileNameSha256?: string;
  fileNameBytes?: number;
  bizIdSha256?: string;
  actorClass?: "HUMAN_STAFF";
  linkType?: "DIRECT" | "LINK_SAFE";
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
  fileName?: string | null;
  bizId?: string | null;
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
  if (lines[0] === MEDIA_MANIFEST_COLUMNS.join(",")) {
    return parseExactMirrorMediaManifestLines(lines, sha256);
  }
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
      kind: "TEXT",
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

function parseExactMirrorMediaManifestLines(lines: string[], sha256: string): ParsedExactMirrorManifest {
  const linesToParse = [...lines];
  if (!linesToParse.length || linesToParse[0] !== MEDIA_MANIFEST_COLUMNS.join(",")) fail("HEADER_MISMATCH");
  if (linesToParse.length - 1 > EXACT_MIRROR_MANIFEST_MAX_ROWS) fail("ROW_LIMIT_EXCEEDED");

  const rows: ExactMirrorManifestRow[] = [];
  const identities = new Set<string>();
  const stores = new Set<string>();
  for (const line of linesToParse.slice(1)) {
    if (!line || line.includes('"')) fail("CSV_FORMAT_UNSUPPORTED");
    const cells = line.split(",");
    if (cells.length !== MEDIA_MANIFEST_COLUMNS.length) fail("COLUMN_COUNT_MISMATCH");
    const values = Object.fromEntries(MEDIA_MANIFEST_COLUMNS.map((column, index) => [column, cells[index]]));
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
    const messageType = required(values.message_type, "message_type").toLowerCase();
    if (!(["image", "sticker", "file"] as string[]).includes(messageType)) fail("MEDIA_TYPE_UNSUPPORTED");
    if (values.direction !== "OUTBOUND" || values.event_type !== "messageSent") fail("NON_OUTBOUND_MEDIA_ROW");

    const sourcePayloadSha256 = required(values.source_payload_sha256, "source_payload_sha256");
    const textSha256 = required(values.text_sha256, "text_sha256");
    const fileNameSha256 = required(values.file_name_sha256, "file_name_sha256");
    const bizIdSha256 = required(values.biz_id_sha256, "biz_id_sha256");
    if (![sourcePayloadSha256, textSha256, fileNameSha256, bizIdSha256].every((value) => /^[a-f0-9]{64}$/u.test(value))) {
      fail("PAYLOAD_HASH_INVALID");
    }
    const textBytes = Number(values.text_bytes);
    const fileNameBytes = Number(values.file_name_bytes);
    if (!Number.isSafeInteger(textBytes) || textBytes < 0) fail("TEXT_BYTE_COUNT_INVALID");
    if (!Number.isSafeInteger(fileNameBytes) || fileNameBytes < 0) fail("FILE_NAME_BYTE_COUNT_INVALID");
    if (values.actor_class !== "HUMAN_STAFF") fail("MEDIA_ACTOR_NOT_PROVEN");
    if (values.prior_reconcile_status !== "PENDING" || values.prior_attempts !== "0") fail("PRIOR_RECONCILE_STATE_CHANGED");
    if (values.raw_source_id_oa_count !== "1") fail("PRIOR_OA_IDENTITY_COUNT_INVALID");
    if (values.link_type !== "DIRECT" && values.link_type !== "LINK_SAFE") fail("DESTINATION_LINK_TYPE_INVALID");

    const row: ExactMirrorManifestRow = {
      kind: "MEDIA",
      storeCode,
      storeId,
      lineOfficialAccountId,
      lineChatUserId,
      canonicalConversationId,
      sourceEventId,
      sentAt,
      direction: "OUTBOUND",
      eventType: "messageSent",
      messageType: messageType as "image" | "sticker" | "file",
      textSha256,
      textBytes,
      priorReconcileStatus: "PENDING",
      priorAttempts: 0,
      canonicalNearIdentityCount: 0,
      historicalNearIdentityCount: 0,
      rawSourceIdOaCount: 1,
      sourcePayloadSha256,
      fileNameSha256,
      fileNameBytes,
      bizIdSha256,
      actorClass: "HUMAN_STAFF",
      linkType: values.link_type,
    };
    const key = exactMirrorIdentityKey(row);
    if (identities.has(key)) fail("DUPLICATE_OA_SOURCE_IDENTITY");
    identities.add(key);
    stores.add(storeCode);
    rows.push(row);
  }
  if (stores.size > 80) fail("STORE_LIMIT_EXCEEDED");
  return { sha256, rows, storeCount: stores.size };
}

export function exactMirrorRawRowMatches(
  raw: ExactMirrorRawRow,
  expected: ExactMirrorManifestRow,
): boolean {
  if (expected.kind === "MEDIA") {
    if (!expected.sourcePayloadSha256 || !expected.fileNameSha256 || !expected.bizIdSha256) return false;
    const rawType = raw.messageType?.trim().toLowerCase();
    const actorClass = raw.bizId && raw.bizId !== "__AUTO_RESPONSE" ? "HUMAN_STAFF" : "UNPROVEN";
    const textSha256 = createHash("sha256").update(raw.text ?? "", "utf8").digest("hex");
    const fileNameSha256 = createHash("sha256").update(raw.fileName ?? "", "utf8").digest("hex");
    const bizIdSha256 = createHash("sha256").update(raw.bizId ?? "", "utf8").digest("hex");
    const sourcePayloadSha256 = createHash("sha256").update(JSON.stringify({
      oaId: expected.lineOfficialAccountId,
      storeId: expected.storeId,
      chatUserId: expected.lineChatUserId,
      sourceEventId: expected.sourceEventId,
      sentAt: raw.sentAt.toISOString(),
      direction: raw.direction,
      eventType: raw.eventType,
      messageType: raw.messageType,
      textSha256,
      fileNameSha256,
      bizIdSha256,
      actorClass,
    })).digest("hex");
    return raw.lineOfficialAccountId === expected.lineOfficialAccountId
      && raw.lineChatUserId === expected.lineChatUserId
      && raw.managerMessageId === expected.sourceEventId
      && raw.eventType === expected.eventType
      && raw.direction === expected.direction
      && rawType === expected.messageType
      && raw.sentAt.getTime() === expected.sentAt.getTime()
      && Buffer.byteLength(raw.text ?? "", "utf8") === expected.textBytes
      && textSha256 === expected.textSha256
      && Buffer.byteLength(raw.fileName ?? "", "utf8") === expected.fileNameBytes
      && fileNameSha256 === expected.fileNameSha256
      && bizIdSha256 === expected.bizIdSha256
      && actorClass === expected.actorClass
      && sourcePayloadSha256 === expected.sourcePayloadSha256;
  }
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
