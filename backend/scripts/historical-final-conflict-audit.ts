import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MessageType, Prisma, PrismaClient } from "@prisma/client";
import {
  classifyHistoricalSourceCandidate,
  historicalExternalMessageIds,
  type HistoricalCanonicalSource,
  type HistoricalSourceCandidate,
} from "../src/historical-source-classifier";
import { resolveMappings, verifyArchiveSnapshot } from "./historical-timeline-backfill";

const ROOT = path.resolve(__dirname, "../local-data/mirror-historical/final-completion");
const DETAIL_PATH = path.join(ROOT, "H1_CONFLICT_CLASSIFICATION_PRIVATE.json");
const SUMMARY_PATH = path.join(ROOT, "H1_CONFLICT_CLASSIFICATION_SUMMARY.json");
const QUERY_BATCH = 500;

type Candidate = HistoricalSourceCandidate & {
  sourceEventType: string;
  sourceArchiveKey: string;
  sourceArchiveSha256: string;
  sourcePageIdentity: string | null;
};

type MatchedCanonical = HistoricalCanonicalSource & { externalMessageId: string | null };
type DestinationRecord = { storeId: string; lineOfficialAccountId: string; lineChatUserId: string };

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function identityKey(storeId: string, oaId: string, chatId: string): string {
  return `${storeId}\u0000${oaId}\u0000${chatId}`;
}

function exactCanonical(candidate: Candidate, canonical: MatchedCanonical): boolean {
  return canonical.storeId === candidate.storeId
    && canonical.lineOfficialAccountId === candidate.lineOfficialAccountId
    && canonical.lineChatUserId === candidate.lineChatUserId
    && canonical.direction === candidate.direction
    && canonical.messageType === MessageType.TEXT
    && canonical.text === candidate.text
    && canonical.sentAt.getTime() === candidate.sentAt.getTime();
}

async function queryInBatches<T>(
  values: readonly T[],
  read: (batch: readonly T[]) => Promise<void>,
): Promise<void> {
  for (let offset = 0; offset < values.length; offset += QUERY_BATCH) {
    await read(values.slice(offset, offset + QUERY_BATCH));
  }
}

function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function main(): Promise<void> {
  const archive = verifyArchiveSnapshot();
  const candidates = archive.candidates.map((candidate) => ({ ...candidate, messageType: "TEXT" })) as Candidate[];
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const oaByStoreId = await resolveMappings(tx, archive.stores);
      for (const candidate of candidates) {
        const oaId = oaByStoreId.get(candidate.storeId);
        if (!oaId) throw new Error("APPROVED_SOURCE_STORE_HAS_NO_UNIQUE_OA_MAPPING");
        candidate.lineOfficialAccountId = oaId;
      }

      const canonicalBySourceId = new Map<string, MatchedCanonical[]>();
      const uniqueSourceIds = [...new Set(candidates.flatMap((candidate) => historicalExternalMessageIds(candidate.sourceEventId)))];
      await queryInBatches(uniqueSourceIds, async (sourceIds) => {
        const rows = await tx.message.findMany({
          where: { externalMessageId: { in: [...sourceIds] } },
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
          if (!row.externalMessageId) continue;
          const list = canonicalBySourceId.get(row.externalMessageId) ?? [];
          list.push({
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
          });
          canonicalBySourceId.set(row.externalMessageId, list);
        }
      });

      const identities = new Map<string, DestinationRecord>();
      for (const candidate of candidates) {
        const key = identityKey(candidate.storeId, candidate.lineOfficialAccountId, candidate.lineChatUserId);
        identities.set(key, {
          storeId: candidate.storeId,
          lineOfficialAccountId: candidate.lineOfficialAccountId,
          lineChatUserId: candidate.lineChatUserId,
        });
      }
      const identityRows = [...identities.values()];
      const directByIdentity = new Map<string, string[]>();
      const crosswalkByIdentity = new Map<string, string[]>();
      await queryInBatches(identityRows, async (batch) => {
        const clauses = batch.map((row) => ({
          storeId: row.storeId,
          lineOfficialAccountId: row.lineOfficialAccountId,
          lineChatUserId: row.lineChatUserId,
        }));
        const [directRows, crosswalkRows] = await Promise.all([
          tx.conversation.findMany({
            where: { OR: clauses },
            select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true },
          }),
          tx.historicalConversationCrosswalk.findMany({
            where: {
              classification: "LINK_SAFE",
              canonicalConversationId: { not: null },
              OR: batch.map((row) => ({
                storeId: row.storeId,
                lineOfficialAccountId: row.lineOfficialAccountId,
                historicalLineChatUserId: row.lineChatUserId,
              })),
            },
            select: { storeId: true, lineOfficialAccountId: true, historicalLineChatUserId: true, canonicalConversationId: true },
          }),
        ]);
        for (const row of directRows) {
          if (!row.storeId || !row.lineChatUserId) continue;
          const key = identityKey(row.storeId, row.lineOfficialAccountId, row.lineChatUserId);
          directByIdentity.set(key, [...(directByIdentity.get(key) ?? []), row.id]);
        }
        for (const row of crosswalkRows) {
          if (!row.canonicalConversationId) continue;
          const key = identityKey(row.storeId, row.lineOfficialAccountId, row.historicalLineChatUserId);
          crosswalkByIdentity.set(key, [...(crosswalkByIdentity.get(key) ?? []), row.canonicalConversationId]);
        }
      });

      const classifications: Array<Record<string, unknown>> = [];
      const conflictRows: Array<Record<string, unknown>> = [];
      const classificationCounts: Record<string, number> = {};
      const conflictPopulationCounts: Record<string, number> = {};
      const drift: number[] = [];
      let canonicalSourceMatches = 0;
      let strictCanonicalExact = 0;
      let duplicateCanonicalRows = 0;
      for (const candidate of candidates) {
        const sourceRows = [...new Map(historicalExternalMessageIds(candidate.sourceEventId)
          .flatMap((sourceId) => canonicalBySourceId.get(sourceId) ?? [])
          .map((row) => [row.id, row])).values()];
        if (sourceRows.length > 0) canonicalSourceMatches += 1;
        if (sourceRows.length > 1) duplicateCanonicalRows += 1;
        if (sourceRows.length === 1 && exactCanonical(candidate, sourceRows[0])) strictCanonicalExact += 1;
        const key = identityKey(candidate.storeId, candidate.lineOfficialAccountId, candidate.lineChatUserId);
        const classification = classifyHistoricalSourceCandidate({
          candidate,
          canonicalMatches: sourceRows,
          directConversationIds: directByIdentity.get(key) ?? [],
          safeCrosswalkConversationIds: crosswalkByIdentity.get(key) ?? [],
          archiveApproved: true,
        });
        classificationCounts[classification.classification] = (classificationCounts[classification.classification] ?? 0) + 1;
        if (sourceRows.length > 0 && !(sourceRows.length === 1 && exactCanonical(candidate, sourceRows[0]))) {
          conflictPopulationCounts[classification.classification] = (conflictPopulationCounts[classification.classification] ?? 0) + 1;
          const canonical = sourceRows.length === 1 ? sourceRows[0] : null;
          if (canonical) drift.push(canonical.sentAt.getTime() - candidate.sentAt.getTime());
          const record = {
            storeId: candidate.storeId,
            lineOfficialAccountId: candidate.lineOfficialAccountId,
            historicalLineChatUserId: candidate.lineChatUserId,
            sourceEventId: candidate.sourceEventId,
            direction: candidate.direction,
            messageType: "TEXT",
            historicalText: candidate.text,
            historicalTextSha256: sha256(candidate.text),
            historicalSentAt: candidate.sentAt.toISOString(),
            canonicalMatchCount: sourceRows.length,
            canonical: sourceRows.map((row) => ({
              id: row.id,
              conversationId: row.conversationId,
              externalMessageId: row.externalMessageId,
              storeId: row.storeId,
              lineOfficialAccountId: row.lineOfficialAccountId,
              lineChatUserId: row.lineChatUserId,
              direction: row.direction,
              messageType: row.messageType,
              text: row.text,
              textSha256: sha256(row.text),
              sentAt: row.sentAt.toISOString(),
            })),
            directConversationIds: directByIdentity.get(key) ?? [],
            linkSafeConversationIds: crosswalkByIdentity.get(key) ?? [],
            sourceArchiveKey: candidate.sourceArchiveKey,
            sourceArchiveSha256: candidate.sourceArchiveSha256,
            sourcePageIdentity: candidate.sourcePageIdentity,
            classification: classification.classification,
            reason: classification.reason,
            timestampDriftMs: classification.timestampDriftMs,
          };
          conflictRows.push(record);
        }
        classifications.push({
          storeId: candidate.storeId,
          sourceEventId: candidate.sourceEventId,
          sourceTextSha256: sha256(candidate.text),
          classification: classification.classification,
          canonicalMatchCount: sourceRows.length,
          canonicalConversationId: classification.canonicalConversationId,
          timestampDriftMs: classification.timestampDriftMs,
          reason: classification.reason,
        });
      }
      const absoluteDrift = drift.map(Math.abs);
      const summary = {
        auditedAt: new Date().toISOString(),
        transactionIsolation: "REPEATABLE READ READ ONLY",
        registrySha256: archive.registrySha256,
        archiveLedgerSha256: archive.ledgerSha256,
        approvedStores: archive.stores.length,
        candidateRows: candidates.length,
        canonicalSourceMatches,
        strictCanonicalExact,
        conflictPopulation: candidates.length - (candidates.length - canonicalSourceMatches) - strictCanonicalExact,
        duplicateCanonicalSourceRows: duplicateCanonicalRows,
        classifications: classificationCounts,
        conflictPopulationClassifications: conflictPopulationCounts,
        timestampDrift: {
          rowsWithSingleCanonicalMatch: drift.length,
          negative: drift.filter((value) => value < 0).length,
          zero: drift.filter((value) => value === 0).length,
          positive: drift.filter((value) => value > 0).length,
          minimumMs: drift.length === 0 ? null : Math.min(...drift),
          maximumMs: drift.length === 0 ? null : Math.max(...drift),
          absoluteMedianMs: percentile(absoluteDrift, 0.5),
          absoluteP95Ms: percentile(absoluteDrift, 0.95),
        },
        accounting: {
          classifiedRows: classifications.length,
          unexplainedRows: candidates.length - classifications.length,
          conflictRows: conflictRows.length,
          canonicalMatchesThatAreNotStrictExact: conflictRows.length,
        },
      };
      return { summary, classifications, conflictRows };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 300_000, maxWait: 30_000 });

    mkdirSync(ROOT, { recursive: true, mode: 0o700 });
    writeFileSync(DETAIL_PATH, `${JSON.stringify({ summary: result.summary, conflicts: result.conflictRows, classifications: result.classifications }, null, 2)}\n`, { mode: 0o600 });
    chmodSync(DETAIL_PATH, 0o600);
    writeFileSync(SUMMARY_PATH, `${JSON.stringify(result.summary, null, 2)}\n`, { mode: 0o600 });
    chmodSync(SUMMARY_PATH, 0o600);
    console.log(JSON.stringify({ event: "HISTORICAL_FINAL_CONFLICT_AUDIT_COMPLETE", summary: result.summary, privateDetailPath: DETAIL_PATH }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message.split("\n")[0] : "UNKNOWN_FAILURE";
  console.error(JSON.stringify({ event: "HISTORICAL_FINAL_CONFLICT_AUDIT_FAILED", code }));
  process.exitCode = 1;
});
