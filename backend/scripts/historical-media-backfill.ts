import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { MessageType, Prisma, PrismaClient } from "@prisma/client";
import { mapHistoricalMediaEvent, type HistoricalMediaRecord } from "../src/historical-media";
import { canonicalId, resolveMappings, verifyArchiveSnapshot } from "./historical-timeline-backfill";

const APPROVAL_ID = "SUNN-HISTORICAL-FINAL-COMPLETION-20260927";
const ROOT = path.resolve(__dirname, "../local-data/mirror-historical");
const REPORT_ROOT = path.join(ROOT, "final-completion");
const REPORT_PATH = path.join(REPORT_ROOT, "HISTORICAL_MEDIA_BACKFILL_LAST_RUN.json");
const TARGET_START = new Date("2026-08-31T17:00:00.000Z");
const BATCH_SIZE = 300;

type JsonRecord = Record<string, unknown>;
type ArchiveEvent = {
  storeId: string;
  conversationId: string;
  sourceEventId: string;
  deterministicIdentity: string;
  timestamp: string;
  type: string;
  direction: string;
  messageType: string | null;
  text: string | null;
  rawMetadata: unknown;
  sourcePageIdentity?: string | null;
};
type Candidate = HistoricalMediaRecord & { id: string };
type CanonicalRow = {
  id: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: string;
  messageType: MessageType;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
};

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function* readNdjson(filePath: string): AsyncGenerator<ArchiveEvent> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  let remainder = "";
  let line = 0;
  for await (const chunk of stream) {
    const chunks = `${remainder}${chunk}`.split("\n");
    remainder = chunks.pop() ?? "";
    for (const raw of chunks) {
      line += 1;
      const value = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (!value) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value) as ArchiveEvent;
      } catch {
        throw new Error(`INVALID_APPROVED_ARCHIVE_NDJSON_${path.basename(filePath)}_${line}`);
      }
      yield parsed as ArchiveEvent;
    }
  }
  if (remainder) {
    line += 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(remainder) as ArchiveEvent;
    } catch {
      throw new Error(`INVALID_APPROVED_ARCHIVE_NDJSON_${path.basename(filePath)}_${line}`);
    }
    yield parsed as ArchiveEvent;
  }
}

function sourceIds(candidate: Candidate): string[] {
  return [candidate.sourceEventId, `line-chat-manager:${candidate.sourceEventId}`];
}

function identityKey(candidate: Pick<Candidate, "lineOfficialAccountId" | "lineChatUserId" | "sourceEventId">): string {
  return `${candidate.lineOfficialAccountId}\u0000${candidate.lineChatUserId}\u0000${candidate.sourceEventId}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  const fields = Object.keys(record).sort().map((key) => JSON.stringify(key) + ":" + stableJson(record[key]));
  return "{" + fields.join(",") + "}";
}

function exactHistorical(existing: Candidate, candidate: Candidate): boolean {
  return existing.id === candidate.id
    && existing.storeId === candidate.storeId
    && existing.lineOfficialAccountId === candidate.lineOfficialAccountId
    && existing.lineChatUserId === candidate.lineChatUserId
    && existing.sourceEventId === candidate.sourceEventId
    && existing.sourceEventType === candidate.sourceEventType
    && existing.messageType === candidate.messageType
    && existing.direction === candidate.direction
    && existing.text === ""
    && stableJson(existing.mediaMetadata) === stableJson(candidate.mediaMetadata)
    && existing.fileName === candidate.fileName
    && existing.sentAt.getTime() === candidate.sentAt.getTime()
    && existing.senderBizId === candidate.senderBizId
    && existing.sourceArchiveKey === candidate.sourceArchiveKey
    && existing.sourceArchiveSha256 === candidate.sourceArchiveSha256
    && existing.sourcePageIdentity === candidate.sourcePageIdentity;
}

async function buildCandidates(): Promise<{ candidates: Candidate[]; archive: ReturnType<typeof verifyArchiveSnapshot> }> {
  const archive = verifyArchiveSnapshot();
  const ledgerByCode = new Map(archive.ledger.archives.map((entry) => [entry.storeCode, entry]));
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const store of archive.stores) {
    const ledger = ledgerByCode.get(store.storeCode);
    if (!ledger) throw new Error(`APPROVED_ARCHIVE_LEDGER_ENTRY_MISSING_${store.storeCode}`);
    const eventsPath = path.join(ROOT, `store-${store.storeCode}/events.ndjson`);
    const eventBytesSha256 = sha256(readFileSync(eventsPath));
    for await (const event of readNdjson(eventsPath)) {
      if (!event.messageType || Date.parse(event.timestamp) < TARGET_START.getTime()) continue;
      const lowerType = event.messageType.toLowerCase();
      if (!["image", "video", "file", "sticker"].includes(lowerType)) continue;
      const lineOfficialAccountId = "";
      const mapped = mapHistoricalMediaEvent({
        event,
        storeId: store.storeId,
        lineOfficialAccountId,
        sourceArchiveKey: ledger.archiveKey,
        sourceArchiveSha256: eventBytesSha256,
      });
      if (seen.has(`${store.storeId}\u0000${mapped.sourceEventId}`)) throw new Error(`DUPLICATE_APPROVED_MEDIA_SOURCE_ID_${store.storeCode}`);
      seen.add(`${store.storeId}\u0000${mapped.sourceEventId}`);
      candidates.push({ ...mapped, id: "" });
    }
  }
  return { candidates, archive };
}

async function readAndClassify(tx: Prisma.TransactionClient, candidates: Candidate[]) {
  const historicalByIdentity = new Map<string, Candidate>();
  const historicalById = new Map<string, { id: string; storeId: string; lineOfficialAccountId: string; lineChatUserId: string; sourceEventId: string }>();
  const canonicalByExternalId = new Map<string, CanonicalRow[]>();
  const linkSafeByIdentity = new Map<string, string[]>();
  const safeMissing: Candidate[] = [];
  const alreadyHistorical: Candidate[] = [];
  const alreadyCanonical: Candidate[] = [];
  const conflicts: Array<{ sourceEventId: string; storeId: string; reason: string }> = [];

  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    const [historicalRows, historicalIdRows, canonicalRows, crosswalkRows] = await Promise.all([
      tx.historicalTimelineMessage.findMany({
        where: { OR: batch.map((row) => ({ lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId, sourceEventId: row.sourceEventId })) },
      }) as Promise<Candidate[]>,
      tx.historicalTimelineMessage.findMany({
        where: { id: { in: batch.map((row) => row.id) } },
        select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true, sourceEventId: true },
      }),
      tx.message.findMany({
        where: { externalMessageId: { in: [...new Set(batch.flatMap(sourceIds))] } },
        select: {
          id: true, conversationId: true, externalMessageId: true, direction: true, messageType: true,
          conversation: { select: { storeId: true, lineOfficialAccountId: true, lineChatUserId: true } },
        },
      }),
      tx.historicalConversationCrosswalk.findMany({
        where: {
          classification: "LINK_SAFE",
          canonicalConversationId: { not: null },
          OR: batch.map((row) => ({ storeId: row.storeId, lineOfficialAccountId: row.lineOfficialAccountId, historicalLineChatUserId: row.lineChatUserId })),
        },
        select: { storeId: true, lineOfficialAccountId: true, historicalLineChatUserId: true, canonicalConversationId: true },
      }),
    ]);
    for (const row of historicalRows) historicalByIdentity.set(identityKey(row), row);
    for (const row of historicalIdRows) historicalById.set(row.id, row);
    for (const row of canonicalRows) {
      const externalId = row.externalMessageId;
      if (!externalId) continue;
      const mapped: CanonicalRow = {
        id: row.id,
        conversationId: row.conversationId,
        externalMessageId: externalId,
        direction: row.direction,
        messageType: row.messageType,
        storeId: row.conversation.storeId,
        lineOfficialAccountId: row.conversation.lineOfficialAccountId,
        lineChatUserId: row.conversation.lineChatUserId,
      };
      canonicalByExternalId.set(externalId, [...(canonicalByExternalId.get(externalId) ?? []), mapped]);
    }
    for (const row of crosswalkRows) {
      if (!row.canonicalConversationId) continue;
      const key = `${row.storeId}\u0000${row.lineOfficialAccountId}\u0000${row.historicalLineChatUserId}`;
      linkSafeByIdentity.set(key, [...(linkSafeByIdentity.get(key) ?? []), row.canonicalConversationId]);
    }
  }

  for (const candidate of candidates) {
    const prior = historicalByIdentity.get(identityKey(candidate));
    if (prior) {
      if (exactHistorical(prior, candidate)) alreadyHistorical.push(candidate);
      else conflicts.push({ sourceEventId: candidate.sourceEventId, storeId: candidate.storeId, reason: "HISTORICAL_IDENTITY_PAYLOAD_CONFLICT" });
      continue;
    }
    if (historicalById.has(candidate.id)) {
      conflicts.push({ sourceEventId: candidate.sourceEventId, storeId: candidate.storeId, reason: "HISTORICAL_DETERMINISTIC_ID_COLLISION" });
      continue;
    }
    const existingCanonical = [...new Map(sourceIds(candidate).flatMap((id) => canonicalByExternalId.get(id) ?? []).map((row) => [row.id, row])).values()];
    if (existingCanonical.length > 1) {
      conflicts.push({ sourceEventId: candidate.sourceEventId, storeId: candidate.storeId, reason: "AMBIGUOUS_CANONICAL_SOURCE_ID" });
      continue;
    }
    if (existingCanonical.length === 1) {
      const canonical = existingCanonical[0];
      const linkedConversationIds = linkSafeByIdentity.get(`${candidate.storeId}\u0000${candidate.lineOfficialAccountId}\u0000${candidate.lineChatUserId}`) ?? [];
      const sameDestination = canonical.lineChatUserId === candidate.lineChatUserId
        || (linkedConversationIds.length === 1 && linkedConversationIds[0] === canonical.conversationId);
      const compatible = canonical.storeId === candidate.storeId
        && canonical.lineOfficialAccountId === candidate.lineOfficialAccountId
        && sameDestination
        && canonical.direction === candidate.direction
        && canonical.messageType === candidate.messageType;
      if (compatible) alreadyCanonical.push(candidate);
      else conflicts.push({ sourceEventId: candidate.sourceEventId, storeId: candidate.storeId, reason: "CANONICAL_SOURCE_ID_SCOPE_OR_TYPE_CONFLICT" });
      continue;
    }
    safeMissing.push(candidate);
  }
  return { safeMissing, alreadyHistorical, alreadyCanonical, conflicts };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const approvalIndex = process.argv.indexOf("--approval-id");
  const suppliedApproval = approvalIndex >= 0 ? process.argv[approvalIndex + 1] : "";
  const targetIndex = process.argv.indexOf("--target-environment");
  if (apply && suppliedApproval !== APPROVAL_ID) throw new Error("PRODUCTION_MEDIA_WRITE_REQUIRES_EXACT_APPROVAL_ID");
  if (apply && process.argv[targetIndex + 1] !== "production") throw new Error("PRODUCTION_MEDIA_WRITE_REQUIRES_EXPLICIT_PRODUCTION_TARGET");

  const { candidates, archive } = await buildCandidates();
  if (candidates.length !== 10_852) throw new Error(`APPROVED_MEDIA_EVENT_COUNT_DRIFT_${candidates.length}`);
  const prisma = new PrismaClient();
  try {
    const mapping = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return resolveMappings(tx, archive.stores);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 });
    for (const candidate of candidates) {
      const oaId = mapping.get(candidate.storeId);
      if (!oaId) throw new Error("APPROVED_MEDIA_STORE_HAS_NO_UNIQUE_OA_MAPPING");
      candidate.lineOfficialAccountId = oaId;
      candidate.id = canonicalId(candidate);
    }
    const first = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return readAndClassify(tx, candidates);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 300_000, maxWait: 30_000 });
    const preflight = {
      mode: apply ? "APPLY_AFTER_FRESH_DRY_RUN" : "DRY_RUN",
      startedAt: new Date().toISOString(),
      approvedStores: archive.stores.length,
      candidateMediaEvents: candidates.length,
      classification: {
        safeHistoricalMissing: first.safeMissing.length,
        alreadyHistorical: first.alreadyHistorical.length,
        alreadyCanonical: first.alreadyCanonical.length,
        ambiguousOrConflicting: first.conflicts.length,
      },
      safeWriteTarget: "HistoricalTimelineMessage",
      writesToCanonicalOrOperationalTables: 0,
      sourceRegistrySha256: archive.registrySha256,
      sourceArchiveLedgerSha256: archive.ledgerSha256,
    };
    if (first.conflicts.length > 0) throw new Error(`HISTORICAL_MEDIA_PREFLIGHT_HAS_CONFLICTS_${first.conflicts.length}`);
    if (!apply) {
      writeReport({ ...preflight, status: "DRY_RUN_COMPLETE", inserted: 0 });
      console.log(JSON.stringify({ event: "HISTORICAL_MEDIA_DRY_RUN_COMPLETE", ...preflight, privateReportPath: REPORT_PATH }));
      return;
    }

    let inserted = 0;
    for (let offset = 0; offset < first.safeMissing.length; offset += BATCH_SIZE) {
      const batch = first.safeMissing.slice(offset, offset + BATCH_SIZE);
      const count = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${APPROVAL_ID}))`);
        const fresh = await readAndClassify(tx, batch);
        if (fresh.conflicts.length > 0 || fresh.alreadyCanonical.length > 0) throw new Error("HISTORICAL_MEDIA_SOURCE_CHANGED_AFTER_DRY_RUN");
        return (await tx.historicalTimelineMessage.createMany({ data: fresh.safeMissing, skipDuplicates: true })).count;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
      inserted += count;
    }
    const second = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return readAndClassify(tx, candidates);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 300_000, maxWait: 30_000 });
    if (second.safeMissing.length > 0 || second.conflicts.length > 0) throw new Error("HISTORICAL_MEDIA_POSTWRITE_ACCEPTANCE_FAILED");
    writeReport({ ...preflight, status: "APPLIED_AND_VERIFIED", inserted, secondDryRunSafeInserts: second.safeMissing.length, completedAt: new Date().toISOString() });
    console.log(JSON.stringify({ event: "HISTORICAL_MEDIA_BACKFILL_COMPLETE", inserted, alreadyHistorical: second.alreadyHistorical.length, alreadyCanonical: second.alreadyCanonical.length, secondDryRunSafeInserts: second.safeMissing.length, privateReportPath: REPORT_PATH }));
  } finally {
    await prisma.$disconnect();
  }
}

function writeReport(value: JsonRecord): void {
  mkdirSync(REPORT_ROOT, { recursive: true, mode: 0o700 });
  writeFileSync(REPORT_PATH, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(REPORT_PATH, 0o600);
}

void main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message.split("\n")[0] : "UNKNOWN_FAILURE";
  console.error(JSON.stringify({ event: "HISTORICAL_MEDIA_BACKFILL_FAILED", code }));
  process.exitCode = 1;
});
