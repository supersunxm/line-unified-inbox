import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { classifyHistoricalConversationIdentity, indexCanonicalSourceMessages, selectSafeHistoricalCrosswalkRows, type CanonicalCrosswalkMessage, type HistoricalCrosswalkIdentity, type HistoricalCrosswalkMessage, type HistoricalCrosswalkResult } from "../src/historical-conversation-crosswalk";
import { verifyArchiveSnapshot } from "./historical-timeline-backfill";

const APPROVAL_ID = "SUNN-HISTORICAL-FINAL-COMPLETION-20260927";
const BATCH_SIZE = 500;
const WRITE_BATCH_SIZE = 200;

type Db = PrismaClient | Prisma.TransactionClient;
type Oa = { id: string; storeId: string | null; basicId: string | null; accountType: string };
type Candidate = ReturnType<typeof verifyArchiveSnapshot>["candidates"][number] & { lineOfficialAccountId: string };
type IdentityRecord = HistoricalCrosswalkIdentity & { messages: HistoricalCrosswalkMessage[] };
type StoredHistoricalIdentity = HistoricalCrosswalkIdentity & { lineChatUserId: string; sourceEventId: string };
type DirectConversation = HistoricalCrosswalkIdentity & { id: string };
type CrosswalkWrite = HistoricalCrosswalkResult & { storeId: string; lineOfficialAccountId: string; historicalLineChatUserId: string };

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function key(identity: HistoricalCrosswalkIdentity): string {
  return JSON.stringify([identity.storeId, identity.lineOfficialAccountId, identity.lineChatUserId]);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function resolveOaIds(stores: ReturnType<typeof verifyArchiveSnapshot>["stores"], oas: Oa[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const store of stores) {
    const scoped = oas.filter((oa) => oa.storeId === store.storeId && oa.accountType === "STORE");
    const exact = scoped.filter((oa) => oa.basicId === store.basicId);
    if (exact.length === 1) {
      result.set(store.storeId, exact[0].id);
      continue;
    }
    const aliasProven = store.classification === "ELIGIBLE_MAPPED"
      && store.stableMatchEvidence?.includes("PRODUCTION_LINE_OFFICIAL_ACCOUNT_BASIC_ID_TYPO_NORMALIZATION") === true
      && Boolean(store.productionLineOfficialAccountId)
      && Boolean(store.productionBasicIdRaw)
      && store.productionBasicIdRaw !== store.basicId;
    const alias = aliasProven ? scoped.filter((oa) => oa.id === store.productionLineOfficialAccountId && oa.basicId === store.productionBasicIdRaw) : [];
    if (exact.length > 1 || alias.length !== 1) throw new Error(`PRODUCTION_OA_MAPPING_NOT_UNIQUE_${store.storeCode}`);
    result.set(store.storeId, alias[0].id);
  }
  return result;
}

async function discover(db: Db, archive: ReturnType<typeof verifyArchiveSnapshot>) {
  const storeIds = archive.stores.map((store) => store.storeId);
  const activeOas = await db.lineOfficialAccount.findMany({
    where: { storeId: { in: storeIds }, accountType: "STORE", isActive: true, archivedAt: null },
    select: { id: true, storeId: true, basicId: true, accountType: true },
  }) as Oa[];
  const oaByStore = resolveOaIds(archive.stores, activeOas);
  const candidates: Candidate[] = archive.candidates.map((candidate) => {
    const lineOfficialAccountId = oaByStore.get(candidate.storeId);
    if (!lineOfficialAccountId) throw new Error("ARCHIVE_CANDIDATE_OA_MAPPING_MISSING");
    return { ...candidate, lineOfficialAccountId };
  });
  if (candidates.length !== 42_587) throw new Error("VERIFIED_ARCHIVE_CANDIDATE_COUNT_DRIFT");

  const canonicalMessages: CanonicalCrosswalkMessage[] = [];
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    const externalIds = [...new Set(batch.flatMap((candidate) => [candidate.sourceEventId, `line-chat-manager:${candidate.sourceEventId}`]))];
    const rows = await db.message.findMany({
      where: { externalMessageId: { in: externalIds } },
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
    });
    for (const row of rows) {
      canonicalMessages.push({
        id: row.id,
        conversationId: row.conversationId,
        externalMessageId: row.externalMessageId,
        direction: row.direction,
        messageType: row.messageType,
        text: row.originalText,
        sentAt: row.sentAt,
        storeId: row.conversation.storeId,
        lineOfficialAccountId: row.conversation.lineOfficialAccountId,
        lineChatUserId: row.conversation.lineChatUserId,
      });
    }
  }

  const identities = new Map<string, IdentityRecord>();
  for (const candidate of candidates) {
    const identity = { storeId: candidate.storeId, lineOfficialAccountId: candidate.lineOfficialAccountId, lineChatUserId: candidate.lineChatUserId };
    const identityKey = key(identity);
    const record = identities.get(identityKey) ?? { ...identity, messages: [] };
    record.messages.push({
      ...identity,
      sourceEventId: candidate.sourceEventId,
      direction: candidate.direction,
      messageType: "TEXT",
      text: candidate.text,
      sentAt: candidate.sentAt,
    });
    identities.set(identityKey, record);
  }

  const directRows = await db.conversation.findMany({
    where: { storeId: { in: storeIds }, lineOfficialAccountId: { in: [...oaByStore.values()] }, lineChatUserId: { not: null } },
    select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true },
  });
  const directByIdentity = new Map<string, DirectConversation[]>();
  for (const row of directRows) {
    if (!row.storeId || !row.lineChatUserId) continue;
    const identity = { storeId: row.storeId, lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId };
    const matches = directByIdentity.get(key(identity)) ?? [];
    matches.push({ ...identity, id: row.id });
    directByIdentity.set(key(identity), matches);
  }

  const canonicalSourceIndex = indexCanonicalSourceMessages(canonicalMessages);
  const results = [...identities.values()].map((record) => classifyHistoricalConversationIdentity({
    identity: record,
    historicalMessages: record.messages,
    canonicalMessages,
    canonicalSourceIndex,
    directConversationIds: directByIdentity.get(key(record))?.map((conversation) => conversation.id),
  }));

  const importedRows = await db.historicalTimelineMessage.findMany({
    select: { storeId: true, lineOfficialAccountId: true, lineChatUserId: true, sourceEventId: true },
  }) as StoredHistoricalIdentity[];
  const classificationByIdentity = new Map(results.map((result) => [key(result.identity), result.classification]));
  const importedRowsByClass: Record<string, number> = {};
  for (const row of importedRows) {
    const classification = classificationByIdentity.get(key(row));
    if (!classification) throw new Error("IMPORTED_HISTORICAL_IDENTITY_NOT_IN_VERIFIED_ARCHIVE");
    importedRowsByClass[classification] = (importedRowsByClass[classification] ?? 0) + 1;
  }

  const counts: Record<string, number> = {};
  const candidateRowsByClass: Record<string, number> = {};
  const safeAnchors: number[] = [];
  const writes: CrosswalkWrite[] = results.map((result) => {
    counts[result.classification] = (counts[result.classification] ?? 0) + 1;
    const record = identities.get(key(result.identity));
    candidateRowsByClass[result.classification] = (candidateRowsByClass[result.classification] ?? 0) + (record?.messages.length ?? 0);
    if (result.classification === "LINK_SAFE") safeAnchors.push(result.anchorCount);
    return {
      ...result,
      storeId: result.identity.storeId,
      lineOfficialAccountId: result.identity.lineOfficialAccountId,
      historicalLineChatUserId: result.identity.lineChatUserId,
    };
  });
  counts.LINK_AMBIGUOUS ??= 0;
  counts.LINK_CONFLICT ??= 0;
  const validDrifts: number[] = [];
  const canonicalByExternalId = new Map(canonicalMessages.map((message) => [message.externalMessageId, message]));
  for (const candidate of candidates) {
    const matches = new Map<string, CanonicalCrosswalkMessage>();
    for (const externalId of [candidate.sourceEventId, `line-chat-manager:${candidate.sourceEventId}`]) {
      const message = canonicalByExternalId.get(externalId);
      if (message) matches.set(message.id, message);
    }
    if (matches.size !== 1) continue;
    const [message] = matches.values();
    if (message.storeId === candidate.storeId
      && message.lineOfficialAccountId === candidate.lineOfficialAccountId
      && message.direction === candidate.direction
      && message.messageType === "TEXT"
      && message.text === candidate.text) {
      validDrifts.push(Math.abs(message.sentAt.getTime() - candidate.sentAt.getTime()));
    }
  }
  const canaryChatId = argument("canary-line-chat-user-id");
  const canaryConversationId = argument("canary-conversation-id");
  const saraburiStore = archive.stores.find((store) => store.storeCode === "30282");
  const saraburiOa = saraburiStore ? oaByStore.get(saraburiStore.storeId) : undefined;
  const canaryIdentityKey = saraburiStore && saraburiOa && canaryChatId
    ? key({ storeId: saraburiStore.storeId, lineOfficialAccountId: saraburiOa, lineChatUserId: canaryChatId })
    : null;
  const canaryResult = canaryIdentityKey ? results.find((result) => key(result.identity) === canaryIdentityKey) : undefined;
  const canaryRecord = canaryIdentityKey ? identities.get(canaryIdentityKey) : undefined;
  const canaryArchiveRows = canaryIdentityKey
    ? candidates.filter((candidate) => key({ storeId: candidate.storeId, lineOfficialAccountId: candidate.lineOfficialAccountId, lineChatUserId: candidate.lineChatUserId }) === canaryIdentityKey)
    : [];
  const canaryImportedSourceIds = new Set(canaryIdentityKey
    ? importedRows.filter((row) => key(row) === canaryIdentityKey).map((row) => row.sourceEventId)
    : []);
  const canarySourceRows = canaryRecord?.messages.map((historical) => {
    const matches = new Map<string, CanonicalCrosswalkMessage>();
    for (const externalId of [historical.sourceEventId, `line-chat-manager:${historical.sourceEventId}`]) {
      for (const message of canonicalSourceIndex.get(externalId) ?? []) matches.set(message.id, message);
    }
    return {
      sourceEventId: historical.sourceEventId,
      direction: historical.direction,
      sentAt: historical.sentAt.toISOString(),
      importedInHistoricalTimeline: canaryImportedSourceIds.has(historical.sourceEventId),
      canonicalMatchCount: matches.size,
      canonicalConversationIds: [...new Set([...matches.values()].map((message) => message.conversationId))],
    };
  }) ?? [];
  const canarySourceAnchors = canaryRecord?.messages.flatMap((historical) => {
    const matches = new Map<string, CanonicalCrosswalkMessage>();
    for (const externalId of [historical.sourceEventId, `line-chat-manager:${historical.sourceEventId}`]) {
      for (const message of canonicalSourceIndex.get(externalId) ?? []) matches.set(message.id, message);
    }
    if (matches.size === 0) return [];
    return [{
      sourceEventId: historical.sourceEventId,
      direction: historical.direction,
      messageType: historical.messageType,
      text: historical.text,
      sentAt: historical.sentAt.toISOString(),
      canonicalMatches: [...matches.values()].map((message) => ({
        id: message.id,
        externalMessageId: message.externalMessageId,
        conversationId: message.conversationId,
        storeId: message.storeId,
        lineOfficialAccountId: message.lineOfficialAccountId,
        lineChatUserId: message.lineChatUserId ?? null,
        direction: message.direction,
        messageType: message.messageType,
        text: message.text,
        textMatches: message.text === historical.text,
        sentAt: message.sentAt.toISOString(),
        timestampDriftMs: Math.abs(message.sentAt.getTime() - historical.sentAt.getTime()),
      })),
    }];
  }) ?? [];

  return {
    results,
    writes,
    report: {
      candidateTextRows: candidates.length,
      historicalChatIdentitiesExamined: results.length,
      classificationCounts: counts,
      candidateTextRowsByClassification: candidateRowsByClass,
      importedHistoricalTextRowsByClassification: importedRowsByClass,
      safeAnchorDistribution: safeAnchors.length ? {
        chats: safeAnchors.length,
        min: Math.min(...safeAnchors),
        p50: percentile(safeAnchors, 0.5),
        p95: percentile(safeAnchors, 0.95),
        max: Math.max(...safeAnchors),
        mean: Math.round(safeAnchors.reduce((sum, value) => sum + value, 0) / safeAnchors.length * 100) / 100,
      } : { chats: 0, min: null, p50: null, p95: null, max: null, mean: null },
      sourceAnchorTimeDrift: validDrifts.length ? {
        compatibleUniqueSourceMatches: validDrifts.length,
        maxAbsMs: Math.max(...validDrifts),
        p50AbsMs: percentile(validDrifts, 0.5),
        p95AbsMs: percentile(validDrifts, 0.95),
        p99AbsMs: percentile(validDrifts, 0.99),
        overOneSecond: validDrifts.filter((value) => value > 1_000).length,
      } : { compatibleUniqueSourceMatches: 0, maxAbsMs: null, p50AbsMs: null, p95AbsMs: null, p99AbsMs: null, overOneSecond: 0 },
      canary: {
        storeCode: "30282",
        identitySupplied: Boolean(canaryChatId),
        historicalLineChatUserId: canaryResult?.identity.lineChatUserId ?? null,
        sourcePageIdentities: [...new Set(canaryArchiveRows.map((candidate) => candidate.sourcePageIdentity).filter((value): value is string => Boolean(value)))],
        classification: canaryResult?.classification ?? (canaryChatId ? "NOT_FOUND" : "IDENTITY_REQUIRED"),
        canonicalConversationId: canaryResult?.canonicalConversationId ?? null,
        candidateTextCount: canaryRecord?.messages.length ?? 0,
        importedHistoricalTextCount: canaryIdentityKey ? importedRows.filter((row) => key(row) === canaryIdentityKey).length : 0,
        expectedConversationMatches: Boolean(canaryConversationId && canaryResult?.canonicalConversationId === canaryConversationId),
        anchorCount: canaryResult?.anchorCount ?? 0,
        maxDriftMs: canaryResult?.maxDriftMs ?? null,
        reasons: canaryResult?.reasons ?? [],
        sourceRows: canarySourceRows,
        sourceAnchors: canarySourceAnchors,
      },
      archiveSha256: { registry: archive.registrySha256, ledger: archive.ledgerSha256 },
    },
  };
}

async function persist(db: Prisma.TransactionClient, rows: CrosswalkWrite[]): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += WRITE_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + WRITE_BATCH_SIZE);
    const values = batch.map((row) => Prisma.sql`(
      ${randomUUID()}, ${row.storeId}, ${row.lineOfficialAccountId}, ${row.historicalLineChatUserId},
      ${row.classification}, ${row.canonicalConversationId}, ${row.evidenceType}, ${row.anchorCount}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )`);
    await db.$executeRaw(Prisma.sql`
      INSERT INTO public."HistoricalConversationCrosswalk" (
        "id", "storeId", "lineOfficialAccountId", "historicalLineChatUserId", "classification",
        "canonicalConversationId", "evidenceType", "anchorCount", "createdAt", "updatedAt"
      ) VALUES ${Prisma.join(values)}
      ON CONFLICT ("storeId", "lineOfficialAccountId", "historicalLineChatUserId")
      DO NOTHING
    `);
  }
}

async function assertStoredSafeCrosswalkMatches(db: Prisma.TransactionClient, expected: CrosswalkWrite[]): Promise<boolean> {
  const stored = await db.historicalConversationCrosswalk.findMany({
    select: {
      storeId: true,
      lineOfficialAccountId: true,
      historicalLineChatUserId: true,
      classification: true,
      canonicalConversationId: true,
      evidenceType: true,
      anchorCount: true,
    },
  });
  if (stored.length === 0) return false;
  if (stored.length !== expected.length) throw new Error("STORED_CROSSWALK_ROW_COUNT_MISMATCH");
  const expectedByIdentity = new Map(expected.map((row) => [key({
    storeId: row.storeId,
    lineOfficialAccountId: row.lineOfficialAccountId,
    lineChatUserId: row.historicalLineChatUserId,
  }), row]));
  for (const row of stored) {
    const source = expectedByIdentity.get(key({
      storeId: row.storeId,
      lineOfficialAccountId: row.lineOfficialAccountId,
      lineChatUserId: row.historicalLineChatUserId,
    }));
    if (!source
      || row.classification !== "LINK_SAFE"
      || row.canonicalConversationId !== source.canonicalConversationId
      || row.evidenceType !== "SOURCE_EVENT_ID"
      || row.anchorCount !== source.anchorCount) {
      throw new Error("STORED_CROSSWALK_EVIDENCE_MISMATCH");
    }
  }
  return true;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const approvalId = argument("approval-id");
  const canaryChatId = argument("canary-line-chat-user-id");
  const canaryConversationId = argument("canary-conversation-id");
  if (apply) {
    if (approvalId !== APPROVAL_ID) throw new Error("APPROVAL_ID_REQUIRED_FOR_CROSSWALK_PERSISTENCE");
    if (process.env.RAILWAY_ENVIRONMENT_NAME !== "production") throw new Error("PRODUCTION_RAILWAY_ENVIRONMENT_REQUIRED");
    if (!canaryChatId || !canaryConversationId) throw new Error("CANARY_IDENTITY_AND_CONVERSATION_REQUIRED_FOR_PERSISTENCE");
  }
  const archive = verifyArchiveSnapshot();
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      if (!apply) await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
      const discovery = await discover(tx, archive);
      console.log(JSON.stringify({ event: "HISTORICAL_CONVERSATION_CROSSWALK_DISCOVERY", approvalId: APPROVAL_ID, ...discovery.report }));
      if (!apply) return;
      if (discovery.report.canary.classification !== "LINK_SAFE" || !discovery.report.canary.expectedConversationMatches) {
        throw new Error("CANARY_NOT_LINK_SAFE_TO_APPROVED_CANONICAL_CONVERSATION");
      }
      if ((discovery.report.classificationCounts.LINK_AMBIGUOUS ?? 0) > 0
        || (discovery.report.classificationCounts.LINK_CONFLICT ?? 0) > 0) {
        throw new Error("CROSSWALK_FLEET_HAS_AMBIGUOUS_OR_CONFLICTING_IDENTITIES");
      }
      const safeWrites = selectSafeHistoricalCrosswalkRows(discovery.writes);
      if (safeWrites.length !== (discovery.report.classificationCounts.LINK_SAFE ?? 0)
        || safeWrites.length !== discovery.writes.filter((row) => row.classification === "LINK_SAFE").length) {
        throw new Error("SAFE_CROSSWALK_WRITE_SET_INVALID");
      }
      const alreadyPersisted = await assertStoredSafeCrosswalkMatches(tx, safeWrites);
      let rowsInserted = 0;
      if (!alreadyPersisted) {
        await persist(tx, safeWrites);
        rowsInserted = safeWrites.length;
        const postwriteMatches = await assertStoredSafeCrosswalkMatches(tx, safeWrites);
        if (!postwriteMatches) throw new Error("CROSSWALK_POSTWRITE_VERIFICATION_FAILED");
      }
      console.log(JSON.stringify({ event: "HISTORICAL_CONVERSATION_CROSSWALK_PERSISTED", identities: safeWrites.length, safeLinks: safeWrites.length, rowsInserted }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "UNKNOWN_FAILURE";
    console.error(JSON.stringify({ event: "HISTORICAL_CONVERSATION_CROSSWALK_FAILED", code: message.split("\n")[0] }));
    process.exitCode = 1;
  });
}
