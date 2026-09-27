import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LineAccountType, MessageDirection, MessageType, Prisma, PrismaClient } from "@prisma/client";

const APPROVAL_ID = "SUNN-HISTORICAL-FINAL-COMPLETION-20260927";
const TARGET_START = new Date("2026-08-31T17:00:00.000Z");
const EXPECTED_STRICT_STORES = 139;
const EXPECTED_VERIFIED_STORES = 137;
const EXPECTED_TEXT_MESSAGES = 42_587;
const REQUIRED_ARCHIVE_FILES = [
  "manifest.json",
  "inventory.ndjson",
  "conversations.ndjson",
  "events.ndjson",
  "checkpoints.json",
  "validation.json",
  "run-summary.json",
] as const;
const ROOT = path.resolve(__dirname, "../local-data/mirror-historical");
const COMPLETION_ROOT = path.join(ROOT, "final-completion");
const REGISTRY_PATH = path.join(ROOT, "full-fleet-registry.json");
const LEDGER_PATH = path.join(ROOT, "FULL_FLEET_ARCHIVE_HASH_LEDGER.json");
const INVENTORY_PATH = path.join(ROOT, "production-import/WAVE1A_FULL_CHATREAD_INVENTORY.json");
const AUDIT_PATH = path.join(COMPLETION_ROOT, "HISTORICAL_TIMELINE_BACKFILL_AUDIT.ndjson");
const STATE_PATH = path.join(COMPLETION_ROOT, "HISTORICAL_TIMELINE_BACKFILL_STATE.json");
const BATCH_SIZE = 500;

type JsonRecord = Record<string, unknown>;
type RegistryStore = {
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
  rawMetadata: JsonRecord;
  sourcePageIdentity?: string;
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
type HistoricalExisting = Candidate;
type CanonicalExisting = {
  externalMessageId: string | null;
  direction: MessageDirection;
  messageType: MessageType;
  originalText: string;
  sentAt: Date;
  conversation: {
    storeId: string | null;
    lineOfficialAccountId: string;
    lineChatUserId: string | null;
  };
};
type OaRow = { id: string; storeId: string | null; basicId: string | null; accountType: LineAccountType };
type ArchiveLedger = {
  archives: Array<{
    storeCode: string;
    archiveKey: string;
    priorDigest: string;
    files: Record<string, { bytes: number; sha256: string }>;
  }>;
};
type PreviousInventory = {
  registrySha256: string;
  ledgerSha256: string;
  strictStoresScanned: number;
  stores: Array<{
    storeCode: string;
    storeId: string;
    archiveKey: string;
    archiveState: string;
    requiredFilesMatchLedger: boolean;
    structureValid: boolean;
    realPath: string;
  }>;
};

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStrictImportCandidate(storeCode: string, historicalStatus: string): boolean {
  return historicalStatus === "COMPLETE_TO_TARGET" && storeCode !== "28375";
}

function resolveOaMapping(store: RegistryStore, activeOas: readonly OaRow[]): { oaId: string; count: number } {
  const exact = activeOas.filter((oa) => oa.storeId === store.storeId && oa.basicId === store.basicId);
  if (exact.length > 0) return { oaId: exact.length === 1 ? exact[0].id : "", count: exact.length };
  const hasRecordedCrosswalk = store.classification === "ELIGIBLE_MAPPED"
    && store.stableMatchEvidence?.includes("PRODUCTION_LINE_OFFICIAL_ACCOUNT_BASIC_ID_TYPO_NORMALIZATION") === true
    && Boolean(store.productionLineOfficialAccountId)
    && Boolean(store.productionBasicIdRaw)
    && store.productionBasicIdRaw !== store.basicId;
  if (!hasRecordedCrosswalk) return { oaId: "", count: 0 };
  const alias = activeOas.filter((oa) => oa.storeId === store.storeId
    && oa.id === store.productionLineOfficialAccountId
    && oa.basicId === store.productionBasicIdRaw);
  return { oaId: alias.length === 1 ? alias[0].id : "", count: alias.length };
}

function canonicalId(candidate: Pick<Candidate, "storeId" | "lineOfficialAccountId" | "lineChatUserId" | "sourceEventId">): string {
  return `historical:${sha256(`${candidate.storeId}\u0000${candidate.lineOfficialAccountId}\u0000${candidate.lineChatUserId}\u0000${candidate.sourceEventId}`)}`;
}

function stableUniqueIdentity(candidate: Pick<Candidate, "lineOfficialAccountId" | "lineChatUserId" | "sourceEventId">): string {
  return `${candidate.lineOfficialAccountId}\u0000${candidate.lineChatUserId}\u0000${candidate.sourceEventId}`;
}

function readNdjson(filePath: string): ArchiveEvent[] {
  const rows = readFileSync(filePath, "utf8").split(/\r?\n/u).filter((line) => line.length > 0);
  return rows.map((line, index) => {
    const parsed: unknown = JSON.parse(line);
    if (!isRecord(parsed)) throw new Error(`ARCHIVE_ROW_NOT_OBJECT_${path.basename(filePath)}_${index + 1}`);
    return parsed as ArchiveEvent;
  });
}

function isTextMessage(event: ArchiveEvent): boolean {
  const type = event.type.trim().toLowerCase();
  return ["message", "messagereceived", "messagesent"].includes(type)
    && event.messageType?.trim().toLowerCase() === "text"
    && typeof event.text === "string"
    && event.text.trim().length > 0;
}

function verifyArchiveSnapshot(): { stores: RegistryStore[]; ledger: ArchiveLedger; candidates: Candidate[]; registrySha256: string; ledgerSha256: string } {
  const registryBytes = readFileSync(REGISTRY_PATH);
  const ledgerBytes = readFileSync(LEDGER_PATH);
  const registry = readJson<{ stores: RegistryStore[] }>(REGISTRY_PATH);
  const ledger = readJson<ArchiveLedger>(LEDGER_PATH);
  const inventory = readJson<PreviousInventory>(INVENTORY_PATH);
  const registrySha256 = sha256(registryBytes);
  const ledgerSha256 = sha256(ledgerBytes);
  const strictStores = registry.stores.filter((store) => isStrictImportCandidate(store.storeCode, store.historicalStatus));
  if (strictStores.length !== EXPECTED_STRICT_STORES || inventory.strictStoresScanned !== EXPECTED_STRICT_STORES) {
    throw new Error("STRICT_STORE_COUNT_DRIFT");
  }
  if (inventory.registrySha256 !== registrySha256 || inventory.ledgerSha256 !== ledgerSha256) {
    throw new Error("FLEET_REGISTRY_OR_LEDGER_CHANGED_SINCE_APPROVED_ARCHIVE_SCAN");
  }

  const previousByCode = new Map(inventory.stores.map((store) => [store.storeCode, store]));
  const candidates: Candidate[] = [];
  const identities = new Set<string>();
  let verifiedCount = 0;
  for (const store of strictStores) {
    const previous = previousByCode.get(store.storeCode);
    const entry = ledger.archives.find((item) => item.storeCode === store.storeCode);
    const archivePath = path.join(ROOT, `store-${store.storeCode}`);
    if (!previous || !entry || previous.storeId !== store.storeId || previous.archiveKey !== entry.archiveKey) {
      throw new Error(`ARCHIVE_REGISTRY_MAPPING_DRIFT_${store.storeCode}`);
    }
    if (previous.archiveState !== "VERIFIED" || !previous.requiredFilesMatchLedger || !previous.structureValid) continue;
    verifiedCount += 1;
    for (const file of REQUIRED_ARCHIVE_FILES) {
      const bytes = readFileSync(path.join(archivePath, file));
      const approved = entry.files[file];
      if (!approved || bytes.length !== approved.bytes || sha256(bytes) !== approved.sha256) {
        throw new Error(`ARCHIVE_FILE_HASH_MISMATCH_${store.storeCode}_${file}`);
      }
    }
    const manifest = readJson<JsonRecord>(path.join(archivePath, "manifest.json"));
    const validation = readJson<JsonRecord>(path.join(archivePath, "validation.json"));
    const runSummary = readJson<JsonRecord>(path.join(archivePath, "run-summary.json"));
    const checkpoint = readJson<JsonRecord>(path.join(archivePath, "checkpoints.json"));
    const checkpointIntegrity = isRecord(checkpoint.integrity) ? checkpoint.integrity : {};
    if (manifest.storeCode !== store.storeCode || manifest.storeId !== store.storeId
      || manifest.managerWorkspaceId !== store.managerWorkspaceId
      || manifest.collectionMode !== "LOCAL_READ_ONLY_HISTORICAL_ARCHIVE"
      || manifest.targetTimezone !== "Asia/Bangkok"
      || Date.parse(String(manifest.targetStart)) !== TARGET_START.getTime()
      || validation.coverage !== "COMPLETE_TO_TARGET"
      || validation.inventoryStatus !== "INVENTORY_COMPLETE"
      || validation.invalidEvents !== 0 || validation.conflictingDuplicates !== 0
      || validation.unresolvedAnomalies instanceof Array && validation.unresolvedAnomalies.length !== 0
      || (validation.historical as JsonRecord | undefined)?.INCOMPLETE !== 0
      || runSummary.status !== "COMPLETE"
      || checkpoint.inventoryStatus !== "INVENTORY_COMPLETE"
      || checkpointIntegrity.conflictingEventDuplicates !== 0
      || manifest.productionWrite !== false || runSummary.productionDbWrites !== false) {
      throw new Error(`ARCHIVE_STRUCTURE_OR_SCOPE_DRIFT_${store.storeCode}`);
    }
    const eventPath = path.join(archivePath, "events.ndjson");
    const eventBytes = readFileSync(eventPath);
    const archiveSha256 = sha256(eventBytes);
    for (const event of readNdjson(eventPath)) {
      if (!isTextMessage(event)) continue;
      const timestamp = Date.parse(event.timestamp);
      if (!Number.isFinite(timestamp) || timestamp < TARGET_START.getTime()) continue;
      const direction = event.direction === MessageDirection.INBOUND
        ? MessageDirection.INBOUND
        : event.direction === MessageDirection.OUTBOUND
          ? MessageDirection.OUTBOUND
          : null;
      if (event.storeId !== store.storeId || !/^U[a-f0-9]{32}$/iu.test(event.conversationId)
        || !event.sourceEventId?.trim()
        || event.deterministicIdentity !== `line-chat-manager:${event.sourceEventId}`
        || direction === null
        || !isRecord(event.rawMetadata)
        || (event.rawMetadata.sourceChatId !== undefined && event.rawMetadata.sourceChatId !== event.conversationId)) {
        throw new Error(`TEXT_EVENT_IDENTITY_INVALID_${store.storeCode}`);
      }
      const sourceIdentity = `${store.storeId}\u0000${event.sourceEventId}`;
      if (identities.has(sourceIdentity)) throw new Error(`DUPLICATE_TEXT_SOURCE_IDENTITY_${store.storeCode}`);
      identities.add(sourceIdentity);
      const rawBizId = event.rawMetadata.bizId;
      const senderBizId = typeof rawBizId === "string" && rawBizId.trim()
        ? rawBizId.trim()
        : typeof rawBizId === "number" && Number.isFinite(rawBizId)
          ? String(rawBizId)
          : null;
      const candidate = {
        id: "",
        storeId: store.storeId,
        lineOfficialAccountId: "",
        lineChatUserId: event.conversationId,
        sourceEventId: event.sourceEventId,
        sourceEventType: event.type,
        direction,
        text: event.text as string,
        sentAt: new Date(timestamp),
        senderBizId,
        sourceArchiveKey: entry.archiveKey,
        sourceArchiveSha256: archiveSha256,
        sourcePageIdentity: typeof event.sourcePageIdentity === "string" ? event.sourcePageIdentity : null,
      } satisfies Candidate;
      candidates.push(candidate);
    }
  }
  if (verifiedCount !== EXPECTED_VERIFIED_STORES) throw new Error(`VERIFIED_ARCHIVE_COUNT_${verifiedCount}`);
  if (candidates.length !== EXPECTED_TEXT_MESSAGES) throw new Error(`TARGET_TEXT_MESSAGE_COUNT_${candidates.length}`);
  return { stores: strictStores.filter((store) => previousByCode.get(store.storeCode)?.archiveState === "VERIFIED"), ledger, candidates, registrySha256, ledgerSha256 };
}

async function resolveMappings(prisma: PrismaClient | Prisma.TransactionClient, stores: RegistryStore[]): Promise<Map<string, string>> {
  const ids = stores.map((store) => store.storeId);
  const [storeRows, oaRows] = await Promise.all([
    prisma.store.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } }),
    prisma.lineOfficialAccount.findMany({
      where: { storeId: { in: ids }, accountType: "STORE", isActive: true, archivedAt: null },
      select: { id: true, storeId: true, basicId: true, accountType: true },
    }),
  ]);
  const storesById = new Map(storeRows.map((store) => [store.id, store]));
  if (storesById.size !== stores.length) throw new Error("PRODUCTION_STORE_MAPPING_MISSING_OR_DUPLICATE");
  const oas = oaRows.filter((oa): oa is OaRow & { storeId: string } => Boolean(oa.storeId));
  const result = new Map<string, string>();
  for (const store of stores) {
    const productionStore = storesById.get(store.storeId);
    if (!productionStore || productionStore.code !== store.storeCode) throw new Error(`PRODUCTION_STORE_CODE_MISMATCH_${store.storeCode}`);
    const resolved = resolveOaMapping(store, oas);
    if (!resolved.oaId || resolved.count !== 1) throw new Error(`PRODUCTION_OA_MAPPING_NOT_UNIQUE_${store.storeCode}`);
    const target = oas.filter((oa) => oa.id === resolved.oaId && oa.storeId === store.storeId && oa.accountType === "STORE");
    if (target.length !== 1) throw new Error(`PRODUCTION_OA_OWNER_MISMATCH_${store.storeCode}`);
    result.set(store.storeId, target[0].id);
  }
  return result;
}

function exactHistoricalMatch(existing: HistoricalExisting, candidate: Candidate): boolean {
  return existing.id === candidate.id
    && existing.storeId === candidate.storeId
    && existing.lineOfficialAccountId === candidate.lineOfficialAccountId
    && existing.lineChatUserId === candidate.lineChatUserId
    && existing.sourceEventId === candidate.sourceEventId
    && existing.sourceEventType === candidate.sourceEventType
    && existing.direction === candidate.direction
    && existing.text === candidate.text
    && existing.sentAt.getTime() === candidate.sentAt.getTime()
    && existing.senderBizId === candidate.senderBizId
    && existing.sourceArchiveKey === candidate.sourceArchiveKey
    && existing.sourceArchiveSha256 === candidate.sourceArchiveSha256
    && existing.sourcePageIdentity === candidate.sourcePageIdentity;
}

function canonicalSourceIds(candidate: Candidate): string[] {
  return [candidate.sourceEventId, `line-chat-manager:${candidate.sourceEventId}`];
}

function exactCanonicalMatch(existing: CanonicalExisting, candidate: Candidate): boolean {
  return canonicalSourceIds(candidate).includes(existing.externalMessageId ?? "")
    && existing.conversation.storeId === candidate.storeId
    && existing.conversation.lineOfficialAccountId === candidate.lineOfficialAccountId
    && existing.conversation.lineChatUserId === candidate.lineChatUserId
    && existing.direction === candidate.direction
    && existing.messageType === MessageType.TEXT
    && existing.originalText === candidate.text
    && existing.sentAt.getTime() === candidate.sentAt.getTime();
}

async function readExisting(prisma: PrismaClient | Prisma.TransactionClient, candidates: Candidate[]): Promise<{
  historicalByIdentity: Map<string, HistoricalExisting>;
  historicalById: Map<string, HistoricalExisting>;
  canonicalBySourceId: Map<string, CanonicalExisting>;
}> {
  const historicalByIdentity = new Map<string, HistoricalExisting>();
  const historicalById = new Map<string, HistoricalExisting>();
  const canonicalBySourceId = new Map<string, CanonicalExisting>();
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    const [historicalRows, idRows, canonicalRows] = await Promise.all([
      prisma.historicalTimelineMessage.findMany({
        where: { OR: batch.map((candidate) => ({
          lineOfficialAccountId: candidate.lineOfficialAccountId,
          lineChatUserId: candidate.lineChatUserId,
          sourceEventId: candidate.sourceEventId,
        })) },
      }) as Promise<HistoricalExisting[]>,
      prisma.historicalTimelineMessage.findMany({ where: { id: { in: batch.map((candidate) => candidate.id) } } }) as Promise<HistoricalExisting[]>,
      prisma.message.findMany({
        where: { externalMessageId: { in: [...new Set(batch.flatMap(canonicalSourceIds))] } },
        select: {
          externalMessageId: true,
          direction: true,
          messageType: true,
          originalText: true,
          sentAt: true,
          conversation: { select: { storeId: true, lineOfficialAccountId: true, lineChatUserId: true } },
        },
      }) as Promise<CanonicalExisting[]>,
    ]);
    for (const row of historicalRows) {
      historicalByIdentity.set(stableUniqueIdentity(row), row);
      historicalById.set(row.id, row);
    }
    for (const row of idRows) historicalById.set(row.id, row);
    for (const row of canonicalRows) if (row.externalMessageId) canonicalBySourceId.set(row.externalMessageId, row);
  }
  return { historicalByIdentity, historicalById, canonicalBySourceId };
}

function classifyCandidates(candidates: Candidate[], existing: Awaited<ReturnType<typeof readExisting>>) {
  const insert: Candidate[] = [];
  let alreadyHistorical = 0;
  let alreadyCanonical = 0;
  for (const candidate of candidates) {
    const prior = existing.historicalByIdentity.get(stableUniqueIdentity(candidate));
    if (prior) {
      if (!exactHistoricalMatch(prior, candidate)) throw new Error("HISTORICAL_IDENTITY_PAYLOAD_CONFLICT");
      alreadyHistorical += 1;
      continue;
    }
    const idCollision = existing.historicalById.get(candidate.id);
    if (idCollision) throw new Error("HISTORICAL_DETERMINISTIC_ID_COLLISION");
    const canonicalRows = canonicalSourceIds(candidate)
      .map((sourceId) => existing.canonicalBySourceId.get(sourceId))
      .filter((row): row is CanonicalExisting => Boolean(row));
    if (canonicalRows.length > 1) throw new Error("CANONICAL_SOURCE_ID_NOT_UNIQUE");
    if (canonicalRows.length === 1) {
      if (!exactCanonicalMatch(canonicalRows[0], candidate)) throw new Error("CANONICAL_SOURCE_ID_PAYLOAD_OR_SCOPE_CONFLICT");
      alreadyCanonical += 1;
      continue;
    }
    insert.push(candidate);
  }
  return { insert, alreadyHistorical, alreadyCanonical };
}

function writeState(value: JsonRecord): void {
  const temp = `${STATE_PATH}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, STATE_PATH);
  chmodSync(STATE_PATH, 0o600);
}

function appendAudit(record: JsonRecord): void {
  appendFileSync(AUDIT_PATH, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  chmodSync(AUDIT_PATH, 0o600);
}

async function applyBatch(
  prisma: PrismaClient,
  batch: Candidate[],
  approvalId: string,
  batchNumber: number,
  totalBatches: number,
  approvedOaByStoreId: Map<string, string>,
  registryByStoreId: Map<string, RegistryStore>,
): Promise<number> {
  const auditBase = {
    event: "HISTORICAL_TIMELINE_BACKFILL_BATCH",
    approvalId,
    batchNumber,
    totalBatches,
    candidateRows: batch.length,
    expectedTable: "HistoricalTimelineMessage",
    customerConversationCanonicalWrites: 0,
    operationalStateWrites: 0,
    queueJobWrites: 0,
    lineSends: 0,
  };
  appendAudit({ ...auditBase, outcome: "PREPARED" });
  let result: { inserted: number; alreadyHistorical: number; alreadyCanonical: number };
  try {
    result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${approvalId}))`);
    const batchStoreIds = [...new Set(batch.map((candidate) => candidate.storeId))];
    const batchStores = batchStoreIds.map((storeId) => registryByStoreId.get(storeId)).filter((store): store is RegistryStore => Boolean(store));
    if (batchStores.length !== batchStoreIds.length) throw new Error("BATCH_STORE_REGISTRY_MAPPING_MISSING");
    const freshOaByStoreId = await resolveMappings(tx, batchStores);
    for (const storeId of batchStoreIds) {
      if (freshOaByStoreId.get(storeId) !== approvedOaByStoreId.get(storeId)) throw new Error("PRODUCTION_STORE_OA_MAPPING_DRIFT");
    }
    const existing = await readExisting(tx, batch);
    const classification = classifyCandidates(batch, existing);
    const inserted = classification.insert.length === 0
      ? 0
      : (await tx.historicalTimelineMessage.createMany({ data: classification.insert, skipDuplicates: true })).count;
    const after = await readExisting(tx, batch);
    for (const candidate of batch) {
      const persisted = after.historicalByIdentity.get(stableUniqueIdentity(candidate));
      if (persisted) {
        if (!exactHistoricalMatch(persisted, candidate)) throw new Error("BATCH_POSTWRITE_VERIFICATION_FAILED");
        continue;
      }
      const canonicalRows = canonicalSourceIds(candidate)
        .map((sourceId) => after.canonicalBySourceId.get(sourceId))
        .filter((row): row is CanonicalExisting => Boolean(row));
      if (canonicalRows.length !== 1 || !exactCanonicalMatch(canonicalRows[0], candidate)) {
        throw new Error("BATCH_POSTWRITE_VERIFICATION_FAILED");
      }
    }
      return {
      inserted,
      alreadyHistorical: classification.alreadyHistorical,
      alreadyCanonical: classification.alreadyCanonical,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
  } catch (error) {
    const code = error instanceof Error ? error.name : "UNKNOWN_FAILURE";
    appendAudit({ ...auditBase, outcome: "ABORTED_OR_ROLLED_BACK", errorCode: code });
    throw error;
  }
  appendAudit({
    ...auditBase,
    outcome: "COMMITTED_AFTER_EXACT_READBACK",
    insertedRows: result.inserted,
    alreadyHistoricalRows: result.alreadyHistorical,
    alreadyCanonicalRows: result.alreadyCanonical,
  });
  return result.inserted;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const approvalIndex = process.argv.indexOf("--approval-id");
  const suppliedApproval = approvalIndex >= 0 ? process.argv[approvalIndex + 1] : "";
  if (apply && suppliedApproval !== APPROVAL_ID) throw new Error("PRODUCTION_WRITE_REQUIRES_EXACT_APPROVAL_ID");
  const targetEnvironmentIndex = process.argv.indexOf("--target-environment");
  if (apply && process.argv[targetEnvironmentIndex + 1] !== "production") throw new Error("PRODUCTION_WRITE_REQUIRES_EXPLICIT_PRODUCTION_TARGET");

  const archive = verifyArchiveSnapshot();
  const candidates = archive.candidates;
  const prisma = new PrismaClient();
  const startedAt = new Date().toISOString();
  try {
    const oaByStoreId = await resolveMappings(prisma, archive.stores);
    for (const candidate of candidates) {
      const oaId = oaByStoreId.get(candidate.storeId);
      if (!oaId) throw new Error("CANDIDATE_STORE_HAS_NO_PROVEN_OA_MAPPING");
      candidate.lineOfficialAccountId = oaId;
      candidate.id = canonicalId(candidate);
    }
    const identitySet = new Set(candidates.map(stableUniqueIdentity));
    if (identitySet.size !== candidates.length) throw new Error("PRODUCTION_IDENTITY_IS_NOT_UNIQUE");
    const existing = await readExisting(prisma, candidates);
    const classification = classifyCandidates(candidates, existing);
    const plan = {
      approvalId: apply ? suppliedApproval : null,
      mode: apply ? "APPLY_INSERT_ONLY" : "DRY_RUN",
      startedAt,
      strictStores: EXPECTED_STRICT_STORES,
      verifiedStores: archive.stores.length,
      heldStores: EXPECTED_STRICT_STORES - archive.stores.length,
      targetTextMessages: candidates.length,
      mappedStoreOaPairs: oaByStoreId.size,
      alreadyHistoricalRows: classification.alreadyHistorical,
      alreadyCanonicalRows: classification.alreadyCanonical,
      plannedInserts: classification.insert.length,
      writeTarget: "HistoricalTimelineMessage",
      otherProductionTablesWritten: [],
      destructiveDdl: false,
      sourceRegistrySha256: archive.registrySha256,
      sourceArchiveLedgerSha256: archive.ledgerSha256,
    };
    console.log(JSON.stringify({ event: "HISTORICAL_TIMELINE_BACKFILL_PREFLIGHT", ...plan }));
    if (!apply) return;

    let insertedTotal = 0;
    const batches = Math.ceil(candidates.length / BATCH_SIZE);
    const registryByStoreId = new Map(archive.stores.map((store) => [store.storeId, store]));
    for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
      const batch = candidates.slice(offset, offset + BATCH_SIZE);
      const inserted = await applyBatch(prisma, batch, suppliedApproval, Math.floor(offset / BATCH_SIZE) + 1, batches, oaByStoreId, registryByStoreId);
      insertedTotal += inserted;
      writeState({
        approvalId: suppliedApproval,
        status: "RUNNING",
        startedAt,
        updatedAt: new Date().toISOString(),
        strictStores: EXPECTED_STRICT_STORES,
        verifiedStores: archive.stores.length,
        targetTextMessages: candidates.length,
        batchesTotal: batches,
        batchesCompleted: Math.floor(offset / BATCH_SIZE) + 1,
        insertedThisRun: insertedTotal,
        writeTarget: "HistoricalTimelineMessage",
        archiveLedgerSha256: archive.ledgerSha256,
      });
      console.log(JSON.stringify({
        event: "HISTORICAL_TIMELINE_BACKFILL_PROGRESS",
        batchNumber: Math.floor(offset / BATCH_SIZE) + 1,
        totalBatches: batches,
        candidateRows: batch.length,
        insertedRows: inserted,
        insertedThisRun: insertedTotal,
      }));
    }
    const finalExisting = await readExisting(prisma, candidates);
    const finalClassification = classifyCandidates(candidates, finalExisting);
    if (finalClassification.insert.length !== 0) throw new Error("FINAL_DRY_RUN_REMAINS_INSERTABLE");
    writeState({
      approvalId: suppliedApproval,
      status: "COMPLETE",
      startedAt,
      completedAt: new Date().toISOString(),
      strictStores: EXPECTED_STRICT_STORES,
      verifiedStores: archive.stores.length,
      targetTextMessages: candidates.length,
      insertedThisRun: insertedTotal,
      alreadyHistoricalAfter: finalClassification.alreadyHistorical,
      alreadyCanonicalAfter: finalClassification.alreadyCanonical,
      plannedInsertsAfter: 0,
      writeTarget: "HistoricalTimelineMessage",
      archiveLedgerSha256: archive.ledgerSha256,
    });
    console.log(JSON.stringify({
      event: "HISTORICAL_TIMELINE_BACKFILL_COMPLETE",
      insertedThisRun: insertedTotal,
      alreadyHistoricalAfter: finalClassification.alreadyHistorical,
      alreadyCanonicalAfter: finalClassification.alreadyCanonical,
      secondDryRunPlannedInserts: 0,
      stores: archive.stores.length,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "UNKNOWN_FAILURE";
    console.error(JSON.stringify({ event: "HISTORICAL_TIMELINE_BACKFILL_FAILED", code: message.split("\n")[0] }));
    process.exitCode = 1;
  });
}

export {
  canonicalId,
  exactCanonicalMatch,
  exactHistoricalMatch,
  isTextMessage,
  stableUniqueIdentity,
  verifyArchiveSnapshot,
};
