import { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "../src/auth/auth.guard";
import { ConversationsService } from "../src/conversations.service";
import { classifyHistoricalConversationIdentity, indexCanonicalSourceMessages, type CanonicalCrosswalkMessage, type HistoricalCrosswalkIdentity, type HistoricalCrosswalkMessage } from "../src/historical-conversation-crosswalk";
import { buildHistoricalVirtualConversationId, HistoricalTimelineService } from "../src/historical-timeline.service";
import { PrismaService } from "../src/prisma.service";
import { verifyArchiveSnapshot } from "./historical-timeline-backfill";

const BATCH_SIZE = 500;
const PAGE_SIZE = 100;
const CANARY_LINE_CHAT_USER_ID = "Udbf1776bbad5d0095a7cc5f3273cbf1e";
const CANARY_CONVERSATION_ID = "e9f88a82-ffc4-45c0-b755-20a847fa6ef4";
const NAMED_STORES = [
  { code: "29113", label: "Central Pinklao" },
  { code: "25610", label: "Central World" },
  { code: "27627", label: "The Mall Bangkapi" },
  { code: "30282", label: "Saraburi" },
] as const;

type Archive = ReturnType<typeof verifyArchiveSnapshot>;
type Candidate = Archive["candidates"][number];
type RegistryStore = Archive["stores"][number] & { localProfile?: string };
type Oa = { id: string; storeId: string | null; basicId: string | null; accountType: string };
type HistoricalRow = HistoricalCrosswalkMessage & { id: string; sourceEventType: string };
type DirectConversation = HistoricalCrosswalkIdentity & { id: string };
type StoredLink = HistoricalCrosswalkIdentity & { classification: string; canonicalConversationId: string | null; evidenceType: string | null; anchorCount: number };
type TimelineItem = { id: string; sentAt: Date | string; historical?: boolean; sourceEventId?: string | null; externalMessageId?: string | null; messageType: string; originalText?: string };
type AcceptanceCaseResult = { storeCode: string; canonicalConversationId: string; [key: string]: unknown };
type AcceptanceIdentity = { identity: HistoricalCrosswalkIdentity; sourceRows: number; store: RegistryStore | undefined };

function key(identity: HistoricalCrosswalkIdentity): string {
  return JSON.stringify([identity.storeId, identity.lineOfficialAccountId, identity.lineChatUserId]);
}

function sourceIds(sourceEventId: string): string[] {
  return [sourceEventId, `line-chat-manager:${sourceEventId}`];
}

function pickOas(stores: RegistryStore[], oas: Oa[]): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const store of stores) {
    const scoped = oas.filter((oa) => oa.storeId === store.storeId && oa.accountType === "STORE");
    const exact = scoped.filter((oa) => oa.basicId === store.basicId);
    if (exact.length === 1) {
      resolved.set(store.storeId, exact[0].id);
      continue;
    }
    const aliasProven = store.classification === "ELIGIBLE_MAPPED"
      && store.stableMatchEvidence?.includes("PRODUCTION_LINE_OFFICIAL_ACCOUNT_BASIC_ID_TYPO_NORMALIZATION") === true
      && Boolean(store.productionLineOfficialAccountId)
      && Boolean(store.productionBasicIdRaw)
      && store.productionBasicIdRaw !== store.basicId;
    const alias = aliasProven
      ? scoped.filter((oa) => oa.id === store.productionLineOfficialAccountId && oa.basicId === store.productionBasicIdRaw)
      : [];
    if (exact.length > 1 || alias.length !== 1) throw new Error(`PRODUCTION_OA_MAPPING_NOT_UNIQUE_${store.storeCode}`);
    resolved.set(store.storeId, alias[0].id);
  }
  return resolved;
}

function toCandidateIdentity(candidate: Candidate, oaByStore: Map<string, string>): HistoricalCrosswalkIdentity {
  const lineOfficialAccountId = oaByStore.get(candidate.storeId);
  if (!lineOfficialAccountId) throw new Error("ARCHIVE_CANDIDATE_OA_MAPPING_MISSING");
  return { storeId: candidate.storeId, lineOfficialAccountId, lineChatUserId: candidate.lineChatUserId };
}

function assertStoredCrosswalk(stored: StoredLink[], expected: Map<string, { canonicalConversationId: string; anchorCount: number }>): void {
  if (stored.length !== expected.size) throw new Error("PERSISTED_CROSSWALK_COUNT_DIFFERS_FROM_FRESH_PREFLIGHT");
  for (const row of stored) {
    const match = expected.get(key(row));
    if (!match || row.classification !== "LINK_SAFE" || row.evidenceType !== "SOURCE_EVENT_ID"
      || row.canonicalConversationId !== match.canonicalConversationId || row.anchorCount !== match.anchorCount) {
      throw new Error("PERSISTED_CROSSWALK_DIFFERS_FROM_FRESH_PREFLIGHT");
    }
  }
}

function sourceEventId(item: TimelineItem): string | null {
  if (item.sourceEventId) return item.sourceEventId;
  const id = item.externalMessageId;
  if (!id) return null;
  return id.startsWith("line-chat-manager:") ? id.slice("line-chat-manager:".length) : id;
}

async function readApiTimeline(prisma: Prisma.TransactionClient, conversationId: string) {
  const service = new ConversationsService(prisma as unknown as PrismaService, {
    getOperationalConversationFilter: () => Promise.resolve({}),
    getLatestResetAt: () => Promise.resolve(null),
  } as never);
  service.get = (id: string) => prisma.conversation.findUnique({ where: { id } }) as never;
  const pages: Array<Awaited<ReturnType<ConversationsService["messages"]>>> = [];
  for (let page = 1; page <= 5000; page += 1) {
    const result = await service.messages(conversationId, page, PAGE_SIZE);
    pages.push(result);
    if (!result.hasEarlier) break;
    if (page === 5000) throw new Error("ACCEPTANCE_TIMELINE_PAGE_LIMIT_REACHED");
  }
  const chronological: TimelineItem[] = [...pages].reverse().flatMap((page) => page.items as unknown as TimelineItem[]);
  const orderingValid = chronological.every((item, index) => {
    if (index === 0) return true;
    const previous = chronological[index - 1];
    const previousTime = new Date(previous.sentAt).getTime();
    const currentTime = new Date(item.sentAt).getTime();
    return previousTime < currentTime || (previousTime === currentTime && previous.id.localeCompare(item.id) <= 0);
  });
  if (!orderingValid) throw new Error(`ACCEPTANCE_TIMELINE_ORDERING_FAILED_${conversationId}`);
  return chronological;
}

async function main(): Promise<void> {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "production") throw new Error("PRODUCTION_RAILWAY_ENVIRONMENT_REQUIRED");
  const archive = verifyArchiveSnapshot();
  const stores = archive.stores as RegistryStore[];
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
      const storeIds = stores.map((store) => store.storeId);
      const activeOas = await tx.lineOfficialAccount.findMany({
        where: { storeId: { in: storeIds }, accountType: "STORE", isActive: true, archivedAt: null },
        select: { id: true, storeId: true, basicId: true, accountType: true },
      }) as Oa[];
      const oaByStore = pickOas(stores, activeOas);
      const candidates = archive.candidates.map((candidate) => ({ ...candidate, ...toCandidateIdentity(candidate, oaByStore) }));
      const identities = new Map<string, { identity: HistoricalCrosswalkIdentity; messages: HistoricalCrosswalkMessage[]; candidates: Candidate[] }>();
      for (const candidate of candidates) {
        const identity: HistoricalCrosswalkIdentity = {
          storeId: candidate.storeId,
          lineOfficialAccountId: candidate.lineOfficialAccountId,
          lineChatUserId: candidate.lineChatUserId,
        };
        const identityKey = key(identity);
        const record = identities.get(identityKey) ?? { identity, messages: [], candidates: [] };
        record.messages.push({ ...identity, sourceEventId: candidate.sourceEventId, direction: candidate.direction, messageType: "TEXT", text: candidate.text, sentAt: candidate.sentAt });
        record.candidates.push(candidate);
        identities.set(identityKey, record);
      }

      const canonicalMessages: CanonicalCrosswalkMessage[] = [];
      for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
        const batch = candidates.slice(offset, offset + BATCH_SIZE);
        const externalIds = [...new Set(batch.flatMap((candidate) => sourceIds(candidate.sourceEventId)))];
        const rows = await tx.message.findMany({
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
        canonicalMessages.push(...rows.map((row) => ({
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
        })));
      }
      const sourceIndex = indexCanonicalSourceMessages(canonicalMessages);
      const directRows = await tx.conversation.findMany({
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
      const results = [...identities.values()].map((record) => classifyHistoricalConversationIdentity({
        identity: record.identity,
        historicalMessages: record.messages,
        canonicalMessages,
        canonicalSourceIndex: sourceIndex,
        directConversationIds: directByIdentity.get(key(record.identity))?.map((conversation) => conversation.id),
      }));
      const resultByIdentity = new Map(results.map((result) => [key(result.identity), result]));
      const persistedRows = await tx.historicalConversationCrosswalk.findMany({
        select: { storeId: true, lineOfficialAccountId: true, historicalLineChatUserId: true, classification: true, canonicalConversationId: true, evidenceType: true, anchorCount: true },
      });
      const persisted: StoredLink[] = persistedRows.map((row) => ({
        storeId: row.storeId,
        lineOfficialAccountId: row.lineOfficialAccountId,
        lineChatUserId: row.historicalLineChatUserId,
        classification: row.classification,
        canonicalConversationId: row.canonicalConversationId,
        evidenceType: row.evidenceType,
        anchorCount: row.anchorCount,
      }));
      const expectedSafe = new Map(results.filter((result) => result.classification === "LINK_SAFE").map((result) => [key(result.identity), {
        canonicalConversationId: result.canonicalConversationId as string,
        anchorCount: result.anchorCount,
      }]));
      assertStoredCrosswalk(persisted, expectedSafe);
      const storedByIdentity = new Map(persisted.map((link) => [key(link), link]));

      const historicalRows = await tx.historicalTimelineMessage.findMany({
        where: { storeId: { in: storeIds } },
        select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true, sourceEventId: true, sourceEventType: true, direction: true, text: true, sentAt: true },
      });
      const historicalByKey = new Map<string, HistoricalRow>();
      for (const row of historicalRows) {
        const rowKey = `${key(row)}\u0000${row.sourceEventId}`;
        if (historicalByKey.has(rowKey)) throw new Error("DUPLICATE_HISTORICAL_SOURCE_ROWS_FOUND");
        historicalByKey.set(rowKey, row);
      }
      const historicalIdentityKeys = new Set([...historicalByKey.values()].map((row) => key(row)));

      const classificationCounts: Record<string, number> = {};
      const candidateRowsByClass: Record<string, number> = {};
      const importedRowsByClass: Record<string, number> = {};
      for (const result of results) classificationCounts[result.classification] = (classificationCounts[result.classification] ?? 0) + 1;
      let imported = 0;
      let directVisible = 0;
      let crosslinkVisible = 0;
      let virtualVisible = 0;
      let canonicalHeld = 0;
      let archiveHeld = 0;
      let duplicateSuppressed = 0;
      for (const candidate of candidates) {
        const identityKey = key(candidate);
        const result = resultByIdentity.get(identityKey);
        if (!result) throw new Error("CANDIDATE_CLASSIFICATION_MISSING");
        candidateRowsByClass[result.classification] = (candidateRowsByClass[result.classification] ?? 0) + 1;
        const rowKey = `${identityKey}\u0000${candidate.sourceEventId}`;
        const historical = historicalByKey.get(rowKey);
        const matches = new Map<string, CanonicalCrosswalkMessage>();
        for (const externalId of sourceIds(candidate.sourceEventId)) for (const message of sourceIndex.get(externalId) ?? []) matches.set(message.id, message);
        const canonicalCompatible = [...matches.values()].some((message) => message.storeId === candidate.storeId
          && message.lineOfficialAccountId === candidate.lineOfficialAccountId
          && message.direction === candidate.direction
          && message.messageType === "TEXT"
          && message.text === candidate.text
          && Math.abs(message.sentAt.getTime() - candidate.sentAt.getTime()) <= 1_000);
        if (historical) {
          if (historical.storeId !== candidate.storeId || historical.lineOfficialAccountId !== candidate.lineOfficialAccountId
            || historical.lineChatUserId !== candidate.lineChatUserId || historical.sourceEventId !== candidate.sourceEventId
            || historical.sourceEventType !== candidate.sourceEventType || historical.direction !== candidate.direction
            || historical.text !== candidate.text || historical.sentAt.getTime() !== candidate.sentAt.getTime()) {
            throw new Error("IMPORTED_HISTORICAL_SOURCE_ROW_DIFFERS_FROM_VERIFIED_ARCHIVE");
          }
          imported += 1;
          importedRowsByClass[result.classification] = (importedRowsByClass[result.classification] ?? 0) + 1;
          const hasCanonicalTwin = [...matches.values()].some((message) => {
            const destination = result.classification === "DIRECT_VISIBLE"
              ? directByIdentity.get(identityKey)?.[0]?.id
              : result.classification === "LINK_SAFE" ? result.canonicalConversationId : undefined;
            return destination === message.conversationId && message.storeId === candidate.storeId && message.lineOfficialAccountId === candidate.lineOfficialAccountId;
          });
          if (hasCanonicalTwin) duplicateSuppressed += 1;
          else if (result.classification === "DIRECT_VISIBLE") directVisible += 1;
          else if (result.classification === "LINK_SAFE") crosslinkVisible += 1;
          else if (result.classification === "NO_CANONICAL_ANCHOR") virtualVisible += 1;
          else archiveHeld += 1;
        } else if (canonicalCompatible) canonicalHeld += 1;
        else archiveHeld += 1;
      }

      const profileByStoreId = new Map(stores.map((store) => [store.storeId, store]));
      const acceptanceIdentities: AcceptanceIdentity[] = [...identities.values()].map((record) => ({
        identity: record.identity,
        sourceRows: record.messages.length,
        store: profileByStoreId.get(record.identity.storeId),
      }));
      const withImportedRows = acceptanceIdentities.filter((record) => historicalIdentityKeys.has(key(record.identity)));
      const directOrSafeWithImports = withImportedRows.filter((record) => {
        const classification = resultByIdentity.get(key(record.identity))?.classification;
        return classification === "DIRECT_VISIBLE" || classification === "LINK_SAFE";
      });
      const linkedWithImports = withImportedRows.filter((record) => resultByIdentity.get(key(record.identity))?.classification === "LINK_SAFE");
      const selectCase = (label: string, records: AcceptanceIdentity[], sort: (a: AcceptanceIdentity, b: AcceptanceIdentity) => number) => {
        const record = [...records].sort(sort)[0];
        if (!record) throw new Error(`ACCEPTANCE_REPRESENTATIVE_NOT_FOUND_${label}`);
        return { label, record };
      };
      const cases: Array<{ label: string; record: AcceptanceIdentity; expectedConversationId: string; classification: string }> = [];
      for (const named of NAMED_STORES) {
        const store = stores.find((candidate) => candidate.storeCode === named.code);
        if (!store) throw new Error(`ACCEPTANCE_STORE_MISSING_${named.code}`);
        const storeRecords = directOrSafeWithImports.filter((record) => record.identity.storeId === store.storeId
          && (named.code !== "30282" || (record.identity.lineChatUserId === CANARY_LINE_CHAT_USER_ID
            && resultByIdentity.get(key(record.identity))?.classification === "LINK_SAFE")));
        const selected = selectCase(named.label, storeRecords, (a, b) => b.sourceRows - a.sourceRows);
        const result = resultByIdentity.get(key(selected.record.identity));
        const link = storedByIdentity.get(key(selected.record.identity));
        const directConversationId = directByIdentity.get(key(selected.record.identity))?.[0]?.id;
        const expectedConversationId = result?.classification === "DIRECT_VISIBLE" ? directConversationId : link?.canonicalConversationId;
        if (!result || !expectedConversationId) throw new Error(`ACCEPTANCE_SELECTED_STORE_NOT_LINKED_${named.code}`);
        cases.push({ label: named.label, record: selected.record, expectedConversationId, classification: result.classification });
      }
      const excludedCodes = new Set<string>(NAMED_STORES.map((store) => store.code));
      for (const profile of ["pinklao-pilot-v1", "profile-b"] as const) {
        const selected = selectCase(`Profile ${profile === "pinklao-pilot-v1" ? "A" : "B"}`,
          linkedWithImports.filter((item) => item.store?.localProfile === profile && !excludedCodes.has(item.store.storeCode)),
          (a, b) => b.sourceRows - a.sourceRows);
        const link = storedByIdentity.get(key(selected.record.identity));
        if (!link?.canonicalConversationId) throw new Error("ACCEPTANCE_PROFILE_LINK_MISSING");
        cases.push({ label: selected.label, record: selected.record, expectedConversationId: link.canonicalConversationId, classification: "LINK_SAFE" });
      }
      const highVolume = selectCase("High-volume linked", linkedWithImports, (a, b) => b.sourceRows - a.sourceRows);
      const lowVolume = selectCase("Sparse linked", linkedWithImports, (a, b) => a.sourceRows - b.sourceRows);
      for (const selected of [highVolume, lowVolume]) {
        const link = storedByIdentity.get(key(selected.record.identity));
        if (!link?.canonicalConversationId) throw new Error("ACCEPTANCE_VOLUME_LINK_MISSING");
        cases.push({ label: selected.label, record: selected.record, expectedConversationId: link.canonicalConversationId, classification: "LINK_SAFE" });
      }

      const canaryIdentity: HistoricalCrosswalkIdentity = {
        storeId: stores.find((store) => store.storeCode === "30282")?.storeId ?? "",
        lineOfficialAccountId: oaByStore.get(stores.find((store) => store.storeCode === "30282")?.storeId ?? "") ?? "",
        lineChatUserId: CANARY_LINE_CHAT_USER_ID,
      };
      const canaryLink = storedByIdentity.get(key(canaryIdentity));
      if (!canaryLink || canaryLink.canonicalConversationId !== CANARY_CONVERSATION_ID) throw new Error("SARABURI_CANARY_CROSSWALK_MISSING_OR_WRONG");

      const user = { id: "historical-crosswalk-acceptance", role: "ADMIN" } as unknown as AuthUser;
      const virtualService = new HistoricalTimelineService(tx as unknown as PrismaService, { accessibleStoreIds: () => Promise.resolve(null) } as never);
      const representativeResults: AcceptanceCaseResult[] = [];
      for (const item of cases) {
        const identityKey = key(item.record.identity);
        const store = item.record.store;
        if (!store) throw new Error("REPRESENTATIVE_STORE_METADATA_MISSING");
        const conversation = await tx.conversation.findUnique({ where: { id: item.expectedConversationId }, select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true } });
        if (!conversation || conversation.storeId !== item.record.identity.storeId || conversation.lineOfficialAccountId !== item.record.identity.lineOfficialAccountId) {
          throw new Error(`REPRESENTATIVE_CANONICAL_SCOPE_MISMATCH_${item.label}`);
        }
        const sourceCandidates = identities.get(identityKey)?.messages ?? [];
        const sourceIdsSet = new Set(sourceCandidates.map((candidate) => candidate.sourceEventId));
        const apiItems = await readApiTimeline(tx, item.expectedConversationId);
        const historicalItems = apiItems.filter((message) => message.sourceEventId && sourceIdsSet.has(message.sourceEventId));
        const canonicalItems = apiItems.filter((message) => !message.sourceEventId && message.messageType === "TEXT");
        const returnedSourceIds = new Set(historicalItems.flatMap((message) => message.sourceEventId ? [message.sourceEventId] : []));
        const returnedCanonicalSourceIds = new Set(canonicalItems.map((message) => sourceEventId(message)).filter((id): id is string => id !== null && sourceIdsSet.has(id)));
        const representedSourceIds = new Set([...returnedSourceIds, ...returnedCanonicalSourceIds]);
        const missingSourceTextCount = sourceIdsSet.size - representedSourceIds.size;
        const duplicateSourceIds = [...returnedSourceIds].filter((id) => returnedCanonicalSourceIds.has(id));
        const sameSourceApiDuplicates = new Set<string>();
        for (const message of apiItems) {
          const sourceId = sourceEventId(message);
          if (!sourceId || !sourceIdsSet.has(sourceId)) continue;
          if (sameSourceApiDuplicates.has(sourceId)) throw new Error(`REPRESENTATIVE_DUPLICATE_SOURCE_ROW_${item.label}`);
          sameSourceApiDuplicates.add(sourceId);
        }
        const virtual = await virtualService.listVirtualChats(user, { storeId: store.storeId, search: item.record.identity.lineChatUserId, page: 1, pageSize: 100 });
        const virtualId = buildHistoricalVirtualConversationId(item.record.identity.lineOfficialAccountId, item.record.identity.lineChatUserId);
        const virtualCopyCount = virtual.items.filter((chat) => chat.id === virtualId).length;
        if (virtualCopyCount !== 0) throw new Error(`REPRESENTATIVE_DUPLICATE_VIRTUAL_CHAT_${item.label}`);
        if (missingSourceTextCount !== 0 || duplicateSourceIds.length !== 0) throw new Error(`REPRESENTATIVE_SOURCE_VISIBILITY_FAILED_${item.label}`);
        representativeResults.push({
          label: item.label,
          storeCode: store.storeCode,
          storeName: store.storeName,
          classification: item.classification,
          canonicalConversationId: conversation.id,
          historicalLineChatUserId: item.record.identity.lineChatUserId,
          canonicalLineChatUserId: conversation.lineChatUserId,
          crosslinkPresent: Boolean(storedByIdentity.get(identityKey)),
          sourceTextRows: sourceIdsSet.size,
          importedHistoricalTextRows: [...historicalByKey.values()].filter((row) => key(row) === identityKey).length,
          apiVisibleHistoricalTextRows: historicalItems.length,
          canonicalTextRowsReturned: canonicalItems.length,
          duplicateSourceMessages: duplicateSourceIds.length,
          missingHistoricalTextRows: missingSourceTextCount,
          ordering: "PASS_ASCENDING_SENT_AT_AND_ID",
          virtualCopyCount,
        });
      }

      const canaryResult = representativeResults.find((result) => result.storeCode === "30282");
      if (!canaryResult || canaryResult.canonicalConversationId !== CANARY_CONVERSATION_ID) throw new Error("SARABURI_CANARY_API_ACCEPTANCE_FAILED");
      console.log(JSON.stringify({
        event: "HISTORICAL_CROSSWALK_BACKEND_ACCEPTANCE",
        archiveSha256: { registry: archive.registrySha256, ledger: archive.ledgerSha256 },
        canary: canaryResult,
        fleet: {
          historicalChatIdentities: results.length,
          directChats: classificationCounts.DIRECT_VISIBLE ?? 0,
          safeCrosslinksPersisted: persisted.length,
          virtualOnlyChats: classificationCounts.NO_CANONICAL_ANCHOR ?? 0,
          ambiguous: classificationCounts.LINK_AMBIGUOUS ?? 0,
          conflicts: classificationCounts.LINK_CONFLICT ?? 0,
          noAnchor: classificationCounts.NO_CANONICAL_ANCHOR ?? 0,
          candidateTextRowsByClassification: candidateRowsByClass,
          importedHistoricalRowsByClassification: importedRowsByClass,
        },
        textVisibility: { imported, directVisible, crosslinkVisible, virtualVisible, canonicalHeld, archiveHeld, duplicateSuppressed },
        representatives: representativeResults,
        backendServicePathAcceptance: "PASS",
        authenticatedHttpApiAcceptance: "NOT_RUN_NO_AUTH_SESSION",
        signedInBrowserAcceptance: "PENDING",
        databaseTransaction: "READ_ONLY",
      }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 240_000 });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_FAILURE";
  console.error(JSON.stringify({ event: "HISTORICAL_CROSSWALK_BACKEND_ACCEPTANCE_FAILED", code: message.split("\n")[0] }));
  process.exitCode = 1;
});
