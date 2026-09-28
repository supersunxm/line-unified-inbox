import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { MessageDirection, MessageType, Prisma, PrismaClient } from "@prisma/client";
import { classifyHistoricalSourceCandidate, type HistoricalCanonicalSource } from "../src/historical-source-classifier";
import { canonicalId, exactHistoricalMatch, resolveMappings, stableUniqueIdentity } from "./historical-timeline-backfill";

const APPROVAL_ID = "SUNN-HISTORICAL-FINAL-COMPLETION-20260927";
const STORE_CODE = "30606";
const EXPECTED_ROWS = 738;
const TARGET_START = Date.parse("2026-08-31T17:00:00.000Z");
const ROOT = path.resolve(__dirname, "../local-data/mirror-historical");
const ARCHIVE_ROOT = path.resolve(ROOT, "../mirror-historical-20260925-evidence");
const COMPLETION_ROOT = path.join(ROOT, "final-completion");
const LEDGER_PATH = path.join(ROOT, "FULL_FLEET_ARCHIVE_HASH_LEDGER.json");
const REGISTRY_PATH = path.join(ROOT, "full-fleet-registry.json");
const BATCH_SIZE = 250;

type JsonRecord = Record<string, unknown>;
type ArchiveStore = {
  storeCode: string;
  storeId: string;
  storeName: string;
  basicId: string;
  managerWorkspaceId: string;
  historicalStatus: string;
  classification?: string;
  stableMatchEvidence?: string[];
  productionLineOfficialAccountId?: string;
  productionBasicIdRaw?: string;
};
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
type Candidate = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  sourceEventId: string;
  sourceEventType: string;
  direction: MessageDirection;
  text: string;
  sentAt: Date;
  senderBizId: string | null;
  sourceArchiveKey: string;
  sourceArchiveSha256: string;
  sourcePageIdentity: string | null;
};
type CanonicalRow = HistoricalCanonicalSource & {
  direction: MessageDirection;
  messageType: MessageType;
};
type Ledger = {
  archives: Array<{
    storeCode: string;
    archiveKey: string;
    files: Record<string, { bytes: number; sha256: string }>;
  }>;
};

const HISTORICAL_SELECT = {
  id: true,
  storeId: true,
  lineOfficialAccountId: true,
  lineChatUserId: true,
  sourceEventId: true,
  sourceEventType: true,
  direction: true,
  text: true,
  sentAt: true,
  senderBizId: true,
  sourceArchiveKey: true,
  sourceArchiveSha256: true,
  sourcePageIdentity: true,
} satisfies Prisma.HistoricalTimelineMessageSelect;

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceIds(candidate: Candidate): string[] {
  return [candidate.sourceEventId, `line-chat-manager:${candidate.sourceEventId}`];
}

async function* readNdjson(file: string): AsyncGenerator<ArchiveEvent> {
  const stream = createReadStream(file, { encoding: "utf8" });
  let remainder = "";
  let lineNumber = 0;
  for await (const chunk of stream) {
    const lines = `${remainder}${chunk}`.split("\n");
    remainder = lines.pop() ?? "";
    for (const raw of lines) {
      lineNumber += 1;
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch {
        throw new Error(`INVALID_HASHED_ARCHIVE_NDJSON_LINE_${lineNumber}`);
      }
      if (!isRecord(parsed)) throw new Error(`HASHED_ARCHIVE_ROW_NOT_OBJECT_${lineNumber}`);
      yield parsed as ArchiveEvent;
    }
  }
  if (remainder) {
    lineNumber += 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(remainder) as unknown;
    } catch {
      throw new Error(`INVALID_HASHED_ARCHIVE_NDJSON_LINE_${lineNumber}`);
    }
    if (!isRecord(parsed)) throw new Error(`HASHED_ARCHIVE_ROW_NOT_OBJECT_${lineNumber}`);
    yield parsed as ArchiveEvent;
  }
}

function senderBizId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const raw = value.bizId;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return typeof raw === "number" && Number.isFinite(raw) ? String(raw) : null;
}

async function buildCandidates(): Promise<{
  candidates: Candidate[];
  store: ArchiveStore;
  archiveKey: string;
  archiveEventSha256: string;
  validationCoverage: string;
  partialConversationCount: number;
  failureCount: number;
  fileHashes: Record<string, string>;
}> {
  const registry = readJson<{ stores: ArchiveStore[] }>(REGISTRY_PATH);
  const store = registry.stores.find((row) => row.storeCode === STORE_CODE);
  if (!store) throw new Error("STORE_30606_REGISTRY_ENTRY_MISSING");
  const ledger = readJson<Ledger>(LEDGER_PATH);
  const archiveLedger = ledger.archives.find((row) => row.storeCode === STORE_CODE);
  if (!archiveLedger) throw new Error("STORE_30606_LEDGER_ENTRY_MISSING");
  const archivePath = path.join(ARCHIVE_ROOT, `store-${STORE_CODE}`);
  const requiredFiles = ["manifest.json", "inventory.ndjson", "conversations.ndjson", "events.ndjson", "checkpoints.json", "validation.json", "run-summary.json"];
  const fileHashes: Record<string, string> = {};
  for (const filename of requiredFiles) {
    const bytes = readFileSync(path.join(archivePath, filename));
    const approved = archiveLedger.files[filename];
    const digest = sha256(bytes);
    if (!approved || approved.bytes !== bytes.length || approved.sha256 !== digest) {
      throw new Error(`STORE_30606_HASH_MISMATCH_${filename}`);
    }
    fileHashes[filename] = digest;
  }
  const manifest = readJson<JsonRecord>(path.join(archivePath, "manifest.json"));
  const validation = readJson<JsonRecord>(path.join(archivePath, "validation.json"));
  if (manifest.storeCode !== STORE_CODE || manifest.storeId !== store.storeId
    || manifest.managerWorkspaceId !== store.managerWorkspaceId
    || manifest.collectionMode !== "LOCAL_READ_ONLY_HISTORICAL_ARCHIVE"
    || manifest.targetTimezone !== "Asia/Bangkok"
    || Date.parse(String(manifest.targetStart)) !== TARGET_START) {
    throw new Error("STORE_30606_HASHED_ARCHIVE_SCOPE_MISMATCH");
  }
  if (validation.invalidEvents !== 0 || validation.conflictingDuplicates !== 0) {
    throw new Error("STORE_30606_HASHED_ARCHIVE_EVENT_INTEGRITY_FAILURE");
  }
  const eventsPath = path.join(archivePath, "events.ndjson");
  const archiveEventSha256 = sha256(readFileSync(eventsPath));
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for await (const event of readNdjson(eventsPath)) {
    const eventType = event.type.trim().toLowerCase();
    const messageType = event.messageType?.trim().toLowerCase();
    if (!["message", "messagesent", "messagereceived"].includes(eventType)
      || messageType !== "text" || typeof event.text !== "string" || !event.text.trim()) continue;
    const sentAtMs = Date.parse(event.timestamp);
    if (!Number.isFinite(sentAtMs) || sentAtMs < TARGET_START) continue;
    const direction = event.direction === MessageDirection.INBOUND
      ? MessageDirection.INBOUND
      : event.direction === MessageDirection.OUTBOUND ? MessageDirection.OUTBOUND : null;
    if (event.storeId !== store.storeId || !/^U[a-f0-9]{32}$/iu.test(event.conversationId)
      || !event.sourceEventId.trim() || event.deterministicIdentity !== `line-chat-manager:${event.sourceEventId}`
      || direction === null
      || !isRecord(event.rawMetadata)
      || (event.rawMetadata.sourceChatId !== undefined && event.rawMetadata.sourceChatId !== event.conversationId)) {
      throw new Error("STORE_30606_HASHED_TEXT_EVENT_IDENTITY_INVALID");
    }
    const identity = `${store.storeId}\u0000${event.sourceEventId}`;
    if (seen.has(identity)) throw new Error("STORE_30606_DUPLICATE_TARGET_TEXT_SOURCE_ID");
    seen.add(identity);
    candidates.push({
      id: "",
      storeId: store.storeId,
      lineOfficialAccountId: "",
      lineChatUserId: event.conversationId,
      sourceEventId: event.sourceEventId,
      sourceEventType: event.type,
      direction,
      text: event.text,
      sentAt: new Date(sentAtMs),
      senderBizId: senderBizId(event.rawMetadata),
      sourceArchiveKey: archiveLedger.archiveKey,
      sourceArchiveSha256: archiveEventSha256,
      sourcePageIdentity: event.sourcePageIdentity ?? null,
    });
  }
  if (candidates.length !== EXPECTED_ROWS) throw new Error(`STORE_30606_TARGET_TEXT_ROW_COUNT_${candidates.length}`);
  for (const candidate of candidates) candidate.id = canonicalId(candidate);
  const validationCoverage = typeof validation.coverage === "string" ? validation.coverage : "UNKNOWN";
  const historicalValidation = isRecord(validation.historical) ? validation.historical : {};
  const partialConversationCount = typeof historicalValidation.INCOMPLETE === "number" ? historicalValidation.INCOMPLETE : 0;
  const failureCount = typeof validation.failures === "number" ? validation.failures : 0;
  return { candidates, store, archiveKey: archiveLedger.archiveKey, archiveEventSha256, validationCoverage, partialConversationCount, failureCount, fileHashes };
}

async function readAndClassify(tx: Prisma.TransactionClient, candidates: Candidate[]) {
  const historicalByIdentity = new Map<string, Candidate>();
  const historicalIds = new Set<string>();
  const canonicalBySourceId = new Map<string, CanonicalRow[]>();
  const directByIdentity = new Map<string, string[]>();
  const linkSafeByIdentity = new Map<string, string[]>();
  const safeMissing: Candidate[] = [];
  const alreadyHistorical: Candidate[] = [];
  const canonicalClasses = { exact: 0, timeDrift: 0, crosswalk: 0 };
  const noDestination: Candidate[] = [];
  const conflicts: Array<{ sourceEventId: string; reason: string }> = [];

  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    const identityClauses = batch.map((row) => ({
      storeId: row.storeId,
      lineOfficialAccountId: row.lineOfficialAccountId,
      lineChatUserId: row.lineChatUserId,
      sourceEventId: row.sourceEventId,
    }));
    const [historicalRows, idRows, canonicalRows, conversations, crosswalks] = await Promise.all([
      tx.historicalTimelineMessage.findMany({ where: { OR: identityClauses }, select: HISTORICAL_SELECT }),
      tx.historicalTimelineMessage.findMany({ where: { id: { in: batch.map((row) => row.id) } }, select: { id: true } }),
      tx.message.findMany({
        where: { externalMessageId: { in: [...new Set(batch.flatMap(sourceIds))] } },
        select: {
          id: true,
          conversationId: true,
          externalMessageId: true,
          direction: true,
          messageType: true,
          originalText: true,
          sentAt: true,
          conversation: { select: { storeId: true, lineOfficialAccountId: true, lineChatUserId: true } },
        },
      }),
      tx.conversation.findMany({
        where: { OR: batch.map((row) => ({ storeId: row.storeId, lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId })) },
        select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true },
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
    for (const row of historicalRows) historicalByIdentity.set(stableUniqueIdentity(row), row);
    for (const row of idRows) historicalIds.add(row.id);
    for (const row of canonicalRows) {
      if (!row.externalMessageId) continue;
      const mapped: CanonicalRow = {
        id: row.id,
        conversationId: row.conversationId,
        externalMessageId: row.externalMessageId,
        storeId: row.conversation.storeId,
        lineOfficialAccountId: row.conversation.lineOfficialAccountId,
        lineChatUserId: row.conversation.lineChatUserId,
        direction: row.direction,
        messageType: row.messageType,
        text: row.originalText,
        sentAt: row.sentAt,
      };
      canonicalBySourceId.set(row.externalMessageId, [...(canonicalBySourceId.get(row.externalMessageId) ?? []), mapped]);
    }
    for (const row of conversations) {
      if (!row.storeId || !row.lineChatUserId) continue;
      const key = `${row.storeId}\u0000${row.lineOfficialAccountId}\u0000${row.lineChatUserId}`;
      directByIdentity.set(key, [...(directByIdentity.get(key) ?? []), row.id]);
    }
    for (const row of crosswalks) {
      if (!row.canonicalConversationId) continue;
      const key = `${row.storeId}\u0000${row.lineOfficialAccountId}\u0000${row.historicalLineChatUserId}`;
      linkSafeByIdentity.set(key, [...(linkSafeByIdentity.get(key) ?? []), row.canonicalConversationId]);
    }
  }

  for (const candidate of candidates) {
    const key = stableUniqueIdentity(candidate);
    const prior = historicalByIdentity.get(key);
    if (prior) {
      if (exactHistoricalMatch(prior, candidate)) alreadyHistorical.push(candidate);
      else conflicts.push({ sourceEventId: candidate.sourceEventId, reason: "HISTORICAL_IDENTITY_PAYLOAD_CONFLICT" });
      continue;
    }
    if (historicalIds.has(candidate.id)) {
      conflicts.push({ sourceEventId: candidate.sourceEventId, reason: "HISTORICAL_DETERMINISTIC_ID_COLLISION" });
      continue;
    }
    const matches = [...new Map(sourceIds(candidate)
      .flatMap((id) => canonicalBySourceId.get(id) ?? [])
      .map((row) => [row.id, row])).values()];
    const destinationKey = `${candidate.storeId}\u0000${candidate.lineOfficialAccountId}\u0000${candidate.lineChatUserId}`;
    const result = classifyHistoricalSourceCandidate({
      candidate: { ...candidate, messageType: "TEXT" },
      canonicalMatches: matches,
      directConversationIds: directByIdentity.get(destinationKey) ?? [],
      safeCrosswalkConversationIds: linkSafeByIdentity.get(destinationKey) ?? [],
      archiveApproved: true,
    });
    if (result.classification === "CANONICAL_EXACT") canonicalClasses.exact += 1;
    else if (result.classification === "CANONICAL_EQUIVALENT_WITH_TIME_DRIFT") canonicalClasses.timeDrift += 1;
    else if (result.classification === "CANONICAL_EQUIVALENT_VIA_SAFE_CROSSWALK") canonicalClasses.crosswalk += 1;
    else if (result.classification === "SAFE_HISTORICAL_MISSING") safeMissing.push(candidate);
    else if (result.classification === "NO_PROVABLE_DESTINATION") noDestination.push(candidate);
    else conflicts.push({ sourceEventId: candidate.sourceEventId, reason: result.classification });
  }
  return { safeMissing, alreadyHistorical, canonicalClasses, noDestination, conflicts };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const approvalIndex = process.argv.indexOf("--approval-id");
  const targetIndex = process.argv.indexOf("--target-environment");
  if (apply && process.argv[approvalIndex + 1] !== APPROVAL_ID) throw new Error("PRODUCTION_WRITE_REQUIRES_EXACT_APPROVAL_ID");
  if (apply && process.argv[targetIndex + 1] !== "production") throw new Error("PRODUCTION_WRITE_REQUIRES_EXPLICIT_PRODUCTION_TARGET");

  const archive = await buildCandidates();
  const prisma = new PrismaClient();
  try {
    const mapping = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return resolveMappings(tx, [archive.store]);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 });
    const oaId = mapping.get(archive.store.storeId);
    if (!oaId) throw new Error("STORE_30606_PRODUCTION_OA_MAPPING_NOT_UNIQUE");
    for (const candidate of archive.candidates) {
      candidate.lineOfficialAccountId = oaId;
      candidate.id = canonicalId(candidate);
    }
    const first = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return readAndClassify(tx, archive.candidates);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 180_000, maxWait: 30_000 });
  const summary = {
      event: "HISTORICAL_30606_ARCHIVE_RECOVERY_PREFLIGHT",
      mode: apply ? "APPLY_PROVEN_ROWS" : "DRY_RUN",
      archiveStoreRows: archive.candidates.length,
      provenArchiveRows: archive.candidates.length,
      validationCoverage: archive.validationCoverage,
      partialConversationCount: archive.partialConversationCount,
      collectionFailureCount: archive.failureCount,
      canonicalExact: first.canonicalClasses.exact,
      canonicalTimeDrift: first.canonicalClasses.timeDrift,
      canonicalViaLinkSafe: first.canonicalClasses.crosswalk,
      alreadyHistorical: first.alreadyHistorical.length,
      safeHistoricalMissing: first.safeMissing.length,
      heldNoProvenDestination: first.noDestination.length,
      heldConflicts: first.conflicts.length,
      heldConflictReasons: Object.fromEntries(first.conflicts.reduce((counts, row) => {
        counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())),
      target: "HistoricalTimelineMessage",
      writesToCanonicalOrOperationalTables: 0,
      archiveKey: archive.archiveKey,
      archiveEventSha256: archive.archiveEventSha256,
      fileHashes: archive.fileHashes,
    };
    if (first.conflicts.length > 0) {
      writePrivateReport({
        ...summary,
        conflictDetails: first.conflicts,
        noDestinationDetails: first.noDestination.map((row) => ({ sourceEventId: row.sourceEventId, storeId: row.storeId, lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId })),
        status: "PARTIALLY_PROVEN_WITH_EXPLICIT_CONFLICTS",
        releasedRows: 0,
        heldRows: first.safeMissing.length + first.noDestination.length + first.conflicts.length,
      });
      console.log(JSON.stringify({ ...summary, status: "HELD_CONFLICTS_PRESENT" }));
      if (apply) throw new Error("STORE_30606_PREFLIGHT_HAS_CONFLICTS");
      return;
    }
    if (!apply) {
      writePrivateReport({
        ...summary,
        noDestinationDetails: first.noDestination.map((row) => ({ sourceEventId: row.sourceEventId, storeId: row.storeId, lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId })),
        status: "DRY_RUN_COMPLETE",
        releasedRows: 0,
        heldRows: first.safeMissing.length + first.noDestination.length,
      });
      console.log(JSON.stringify({ ...summary, status: "DRY_RUN_COMPLETE" }));
      return;
    }

    let inserted = 0;
    for (let offset = 0; offset < archive.candidates.length; offset += BATCH_SIZE) {
      const batch = archive.candidates.slice(offset, offset + BATCH_SIZE);
      const count = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${APPROVAL_ID}))`);
        const fresh = await readAndClassify(tx, batch);
        if (fresh.conflicts.length > 0) throw new Error("STORE_30606_SOURCE_CHANGED_AFTER_PREFLIGHT");
        return (await tx.historicalTimelineMessage.createMany({ data: fresh.safeMissing, skipDuplicates: true })).count;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
      inserted += count;
    }
    const second = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return readAndClassify(tx, archive.candidates);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 180_000, maxWait: 30_000 });
    if (second.safeMissing.length > 0 || second.conflicts.length > 0) throw new Error("STORE_30606_POSTWRITE_ACCEPTANCE_FAILED");
    writePrivateReport({ ...summary, status: "APPLIED_AND_VERIFIED", inserted, releasedRows: inserted + second.alreadyHistorical.length, heldRows: second.noDestination.length, secondDryRunSafeInserts: second.safeMissing.length });
    console.log(JSON.stringify({
      event: "HISTORICAL_30606_ARCHIVE_RECOVERY_COMPLETE",
      inserted,
      alreadyHistorical: second.alreadyHistorical.length,
      alreadyCanonical: second.canonicalClasses.exact + second.canonicalClasses.timeDrift + second.canonicalClasses.crosswalk,
      heldNoProvenDestination: second.noDestination.length,
      secondDryRunSafeInserts: second.safeMissing.length,
      archiveEventSha256: archive.archiveEventSha256,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

function writePrivateReport(value: JsonRecord): void {
  mkdirSync(COMPLETION_ROOT, { recursive: true, mode: 0o700 });
  const file = path.join(COMPLETION_ROOT, "HISTORICAL_30606_PRODUCTION_ROW_CLASSIFICATION_PRIVATE.json");
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error && error.message.trim() ? error.message : error instanceof Error ? error.constructor.name : "UNKNOWN_FAILURE";
  const safeMessage = message.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? "UNKNOWN_FAILURE";
  console.error(JSON.stringify({ event: "HISTORICAL_30606_ARCHIVE_RECOVERY_FAILED", code: safeMessage }));
  process.exitCode = 1;
});
