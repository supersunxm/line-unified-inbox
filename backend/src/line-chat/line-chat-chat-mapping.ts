import {
  CustomerSalesStatus,
  LineChatSessionStatus,
  PrismaClient,
} from "@prisma/client";
import type { LineChatDiscoveredChat } from "./line-chat.types";
import { isLineChatUserId } from "./line-chat-chat-discovery";

export const PILOT_MAPPING_STORE_CODE = "28375";
export const PILOT_MAPPING_OA_NAME = "OPPO BS RBS Chonburi";
export const PILOT_MAPPING_BOT_ID = "U729972869a565723cb7fcf7ea28bbc43";
export const PILOT_MAPPING_SESSION_KEY = "profile-b";
const RELEVANT_STATUSES = new Set<CustomerSalesStatus>([
  CustomerSalesStatus.ONLINE,
  CustomerSalesStatus.PURCHASED,
  CustomerSalesStatus.INTERESTED,
]);
const MATCH_TIMESTAMP_TOLERANCE_MS = 2 * 60 * 1000;

export type MappingConfidence =
  | "EXACT_CONFIDENT"
  | "POSSIBLE"
  | "AMBIGUOUS"
  | "NO_MATCH"
  | "ALREADY_MAPPED";

export interface MappingConversationInput {
  id: string;
  displayName: string;
  salesStatus: CustomerSalesStatus | null;
  lineChatUserId: string | null;
  latestMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: {
    direction: string;
    originalText: string;
    sentAt: Date;
  } | null;
}

export interface MappingPlanRow {
  conversationId: string;
  displayName: string;
  salesStatus: CustomerSalesStatus | null;
  candidateChatUserId: string | null;
  confidence: MappingConfidence;
  signals: readonly string[];
  reason: string;
  alreadyMapped: boolean;
}

export interface MappingSummary {
  totalStoreConversations: number;
  missingLineChatUserId: number;
  relevantTaggedConversations: number;
  chatCandidatesDiscovered: number;
  exactConfident: number;
  possible: number;
  ambiguous: number;
  noMatch: number;
  alreadyMapped: number;
  conflictsDetected: number;
}

export interface PilotMappingPlan {
  store: { id: string; code: string; name: string };
  lineOfficialAccount: { id: string; name: string; chatBotId: string; sessionKey: string; sessionStatus: LineChatSessionStatus };
  endpoint: string;
  responseShape: "array" | "chats" | "data" | "items";
  enumerationStatus: "COMPLETE" | "PARTIAL" | "UNVERIFIED";
  rows: readonly MappingPlanRow[];
  summary: MappingSummary;
}

export interface PilotMappingContext {
  store: { id: string; code: string; name: string };
  lineOfficialAccount: {
    id: string;
    name: string;
    chatBotId: string;
    sessionKey: string;
    profilePath: string;
    sessionStatus: LineChatSessionStatus;
  };
  conversations: readonly MappingConversationInput[];
}

export interface MappingApplySummary {
  enumerationStatus: "COMPLETE" | "PARTIAL" | "UNVERIFIED";
  applyBlocked: boolean;
  blockReason?: string;
  eligibleConfident: number;
  mapped: number;
  skippedAlreadyMapped: number;
  skippedAmbiguous: number;
  skippedPossible: number;
  skippedNoMatch: number;
  conflicts: number;
  failedWrites: number;
}

interface MappingPrisma {
  store: { findMany: (args: unknown) => Promise<unknown[]> };
  conversation: {
    findMany: (args: unknown) => Promise<unknown[]>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  $transaction: <T>(callback: (tx: MappingPrisma) => Promise<T>) => Promise<T>;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/gu, " ").toLowerCase();
}

function normalizeDirection(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleUpperCase();
}

function safeDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())
      ? Number(value.trim())
      : null;
  if (numericValue !== null && Number.isFinite(numericValue)) {
    const milliseconds = Math.abs(numericValue) < 100_000_000_000 ? numericValue * 1000 : numericValue;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeCandidate(raw: LineChatDiscoveredChat): LineChatDiscoveredChat | null {
  if (!isLineChatUserId(raw.chatUserId)) return null;
  return {
    chatUserId: raw.chatUserId.trim(),
    displayName: raw.displayName?.trim() || null,
    lastMessageText: raw.lastMessageText?.trim() || null,
    lastMessageAt: raw.lastMessageAt?.trim() || null,
    lastMessageDirection: raw.lastMessageDirection?.trim() || null,
  };
}

function dedupeCandidates(candidates: readonly LineChatDiscoveredChat[]): {
  candidates: LineChatDiscoveredChat[];
  conflictingIds: Set<string>;
} {
  const byId = new Map<string, LineChatDiscoveredChat>();
  const conflictingIds = new Set<string>();
  for (const raw of candidates) {
    const candidate = normalizeCandidate(raw);
    if (!candidate) continue;
    const previous = byId.get(candidate.chatUserId);
    if (!previous) {
      byId.set(candidate.chatUserId, candidate);
      continue;
    }
    if (JSON.stringify(previous) !== JSON.stringify(candidate)) conflictingIds.add(candidate.chatUserId);
  }
  return { candidates: [...byId.values()], conflictingIds };
}

function scoreCandidate(
  conversation: MappingConversationInput,
  candidate: LineChatDiscoveredChat,
): { score: number; signals: string[]; exactEligible: boolean } {
  const signals: string[] = [];
  let score = 0;
  const conversationName = normalizeText(conversation.displayName);
  const candidateName = normalizeText(candidate.displayName);
  if (conversationName && candidateName && conversationName === candidateName) {
    signals.push("display_name_exact");
    score += 1;
  }

  const conversationText = normalizeText(conversation.lastMessage?.originalText);
  const candidateText = normalizeText(candidate.lastMessageText);
  if (conversationText && candidateText && conversationText === candidateText) {
    signals.push("last_message_text_exact");
    score += 3;
  }

  const conversationAt = safeDate(conversation.lastMessage?.sentAt ?? conversation.latestMessageAt);
  const candidateAt = safeDate(candidate.lastMessageAt);
  if (conversationAt && candidateAt && Math.abs(conversationAt.getTime() - candidateAt.getTime()) <= MATCH_TIMESTAMP_TOLERANCE_MS) {
    signals.push("last_message_timestamp_within_2m");
    score += 3;
  }

  const conversationDirection = normalizeDirection(conversation.lastMessage?.direction);
  const candidateDirection = normalizeDirection(candidate.lastMessageDirection);
  if (conversationDirection && candidateDirection && conversationDirection === candidateDirection) {
    signals.push("last_message_direction_exact");
    score += 1;
  }

  const strongSignalCount = signals.filter((signal) =>
    signal === "last_message_text_exact" || signal === "last_message_timestamp_within_2m",
  ).length;
  const exactEligible = score >= 4 && strongSignalCount > 0 && (signals.includes("display_name_exact") || strongSignalCount >= 2);
  return { score, signals, exactEligible };
}

export function assertPilotMappingStore(storeCode: string): void {
  if (storeCode.trim() !== PILOT_MAPPING_STORE_CODE) {
    throw new Error(`Pilot guard rejected store "${storeCode}". Only store ${PILOT_MAPPING_STORE_CODE} is allowed.`);
  }
}

export async function loadPilotMappingContext(
  prisma: PrismaClient,
  storeCode: string,
): Promise<PilotMappingContext> {
  assertPilotMappingStore(storeCode);
  const db = prisma as unknown as MappingPrisma;
  const stores = await db.store.findMany({
    where: {
      OR: [
        { id: PILOT_MAPPING_STORE_CODE },
        { code: PILOT_MAPPING_STORE_CODE },
        { storeMaster: { is: { externalStoreId: PILOT_MAPPING_STORE_CODE } } },
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
      storeMaster: { select: { externalStoreId: true } },
      lineOfficialAccounts: {
        where: { isActive: true, archivedAt: null, accountType: "STORE" },
        select: {
          id: true,
          name: true,
          chatBotId: true,
          lineChatSessionId: true,
          lineChatSession: { select: { sessionKey: true, profilePath: true, profileStorageKey: true, status: true } },
        },
      },
    },
    take: 2,
  });
  if (stores.length !== 1) {
    throw new Error(
      stores.length === 0
        ? `Pilot store ${PILOT_MAPPING_STORE_CODE} was not found.`
        : `Pilot store ${PILOT_MAPPING_STORE_CODE} resolved to multiple Store records; refusing to continue.`,
    );
  }

  const store = stores[0] as {
    id: string;
    code: string | null;
    name: string;
    storeMaster: { externalStoreId: string | null } | null;
    lineOfficialAccounts: Array<{
      id: string;
      name: string;
      chatBotId: string | null;
      lineChatSessionId: string | null;
      lineChatSession: { sessionKey: string; profilePath: string | null; profileStorageKey: string | null; status: LineChatSessionStatus } | null;
    }>;
  };
  const resolvedCode = store.code?.trim() || store.storeMaster?.externalStoreId?.trim();
  if (resolvedCode !== PILOT_MAPPING_STORE_CODE) throw new Error("Resolved Store record does not match pilot store 28375.");
  if (store.lineOfficialAccounts.length !== 1) {
    throw new Error(`Pilot store 28375 must have exactly one active Store LINE OA; found ${store.lineOfficialAccounts.length}.`);
  }
  const account = store.lineOfficialAccounts[0];
  if (account.name.trim() !== PILOT_MAPPING_OA_NAME || account.chatBotId?.trim() !== PILOT_MAPPING_BOT_ID) {
    throw new Error(`Pilot store 28375 resolved an unexpected LINE OA or bot; refusing discovery.`);
  }
  const session = account.lineChatSession;
  if (!account.chatBotId || !session?.sessionKey || !session.profilePath && !session.profileStorageKey) {
    throw new Error("Pilot Store LINE OA is missing its bot ID or authenticated browser session configuration.");
  }
  if (session.status !== LineChatSessionStatus.ACTIVE) {
    throw new Error(`Pilot LINE OA Manager session is ${session.status}; discovery requires an ACTIVE session.`);
  }
  if (session.sessionKey.trim() !== PILOT_MAPPING_SESSION_KEY) {
    throw new Error(`Pilot store 28375 resolved an unexpected LINE Chat session; refusing discovery.`);
  }

  const conversations = await db.conversation.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      storeId: true,
      lineOfficialAccountId: true,
      customerSalesStatus: true,
      lineChatUserId: true,
      latestMessageAt: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { displayName: true } },
      messages: {
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { direction: true, originalText: true, sentAt: true },
      },
    },
  });
  const conversationRows = conversations as Array<{
    id: string;
    storeId: string | null;
    lineOfficialAccountId: string;
    customerSalesStatus: CustomerSalesStatus | null;
    lineChatUserId: string | null;
    latestMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
    customer: { displayName: string };
    messages: Array<{ direction: string; originalText: string; sentAt: Date }>;
  }>;
  const crossOa = conversationRows.filter((row) => row.lineOfficialAccountId !== account.id).length;
  if (crossOa > 0) throw new Error(`Pilot store 28375 has ${crossOa} conversation(s) linked to a different OA; refusing partial discovery.`);

  return {
    store: { id: store.id, code: resolvedCode, name: store.name },
    lineOfficialAccount: {
      id: account.id,
      name: account.name,
      chatBotId: account.chatBotId,
      sessionKey: session.sessionKey,
      profilePath: session.profilePath || session.profileStorageKey!,
      sessionStatus: session.status,
    },
    conversations: conversationRows.map((row) => ({
      id: row.id,
      displayName: row.customer.displayName,
      salesStatus: row.customerSalesStatus,
      lineChatUserId: row.lineChatUserId,
      latestMessageAt: row.latestMessageAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastMessage: row.messages[0] ?? null,
    })),
  };
}

export function buildPilotMappingPlan(
  context: PilotMappingContext,
  discovery: {
    endpoint: string;
    responseShape: "array" | "chats" | "data" | "items";
    enumerationStatus: "COMPLETE" | "PARTIAL" | "UNVERIFIED";
    chats: readonly LineChatDiscoveredChat[];
  },
): PilotMappingPlan {
  const { candidates, conflictingIds } = dedupeCandidates(discovery.chats);
  const existingIds = new Set(
    context.conversations.map((conversation) => conversation.lineChatUserId?.trim()).filter((id): id is string => Boolean(id)),
  );
  const rows: MappingPlanRow[] = context.conversations.map((conversation) => {
    if (conversation.lineChatUserId?.trim()) {
      return {
        conversationId: conversation.id,
        displayName: conversation.displayName,
        salesStatus: conversation.salesStatus,
        candidateChatUserId: conversation.lineChatUserId.trim(),
        confidence: "ALREADY_MAPPED",
        signals: ["existing_line_chat_user_id_preserved"],
        reason: "Conversation.lineChatUserId already exists; no overwrite is permitted.",
        alreadyMapped: true,
      };
    }
    if (!conversation.salesStatus || !RELEVANT_STATUSES.has(conversation.salesStatus)) {
      return {
        conversationId: conversation.id,
        displayName: conversation.displayName,
        salesStatus: conversation.salesStatus,
        candidateChatUserId: null,
        confidence: "NO_MATCH",
        signals: [],
        reason: "Conversation is not an ONLINE, PURCHASED, or INTERESTED historical tag.",
        alreadyMapped: false,
      };
    }

    const scored = candidates.map((candidate) => ({ candidate, ...scoreCandidate(conversation, candidate) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.candidate.chatUserId.localeCompare(b.candidate.chatUserId));
    const best = scored[0];
    if (!best) {
      return {
        conversationId: conversation.id,
        displayName: conversation.displayName,
        salesStatus: conversation.salesStatus,
        candidateChatUserId: null,
        confidence: "NO_MATCH",
        signals: [],
        reason: "No safe matching signal was found among discovered chats.",
        alreadyMapped: false,
      };
    }
    const similarlyStrong = scored[1] && scored[1].score >= best.score - 1;
    const blocked = conflictingIds.has(best.candidate.chatUserId) || existingIds.has(best.candidate.chatUserId);
    const confidence: MappingConfidence = blocked || similarlyStrong
      ? "AMBIGUOUS"
      : best.exactEligible
        ? "EXACT_CONFIDENT"
        : "POSSIBLE";
    const reason = blocked
      ? existingIds.has(best.candidate.chatUserId)
        ? "Candidate chat ID is already assigned to an existing mapped conversation."
        : "Candidate chat ID appeared with conflicting response records."
      : similarlyStrong
        ? "Multiple similarly strong candidate chats were found."
        : best.exactEligible
          ? "Unique multi-signal match; display name is not the sole signal."
          : "Some correlation exists, but it is not strong enough to write safely.";
    return {
      conversationId: conversation.id,
      displayName: conversation.displayName,
      salesStatus: conversation.salesStatus,
      candidateChatUserId: best.candidate.chatUserId,
      confidence,
      signals: best.signals,
      reason,
      alreadyMapped: false,
    };
  });

  const rowsByCandidate = new Map<string, MappingPlanRow[]>();
  for (const row of rows) {
    if (row.alreadyMapped || !row.candidateChatUserId || row.confidence === "NO_MATCH") continue;
    const matches = rowsByCandidate.get(row.candidateChatUserId) ?? [];
    matches.push(row);
    rowsByCandidate.set(row.candidateChatUserId, matches);
  }
  const conflictIds = new Set(conflictingIds);
  for (const matches of rowsByCandidate.values()) {
    if (matches.length < 2) continue;
    const candidateId = matches[0]?.candidateChatUserId;
    if (candidateId) conflictIds.add(candidateId);
    for (const row of matches) {
      row.confidence = "AMBIGUOUS";
      row.reason = `Candidate chat ID would map to ${matches.length} database conversations; rejecting all conflicting mappings.`;
    }
  }
  for (const row of rows) {
    if (row.candidateChatUserId && !row.alreadyMapped && existingIds.has(row.candidateChatUserId)) {
      conflictIds.add(row.candidateChatUserId);
    }
  }

  const summary: MappingSummary = {
    totalStoreConversations: rows.length,
    missingLineChatUserId: rows.filter((row) => !row.alreadyMapped).length,
    relevantTaggedConversations: rows.filter((row) => row.salesStatus !== null && RELEVANT_STATUSES.has(row.salesStatus) && !row.alreadyMapped).length,
    chatCandidatesDiscovered: candidates.length,
    exactConfident: rows.filter((row) => row.confidence === "EXACT_CONFIDENT").length,
    possible: rows.filter((row) => row.confidence === "POSSIBLE").length,
    ambiguous: rows.filter((row) => row.confidence === "AMBIGUOUS").length,
    noMatch: rows.filter((row) => row.confidence === "NO_MATCH").length,
    alreadyMapped: rows.filter((row) => row.alreadyMapped).length,
    conflictsDetected: conflictIds.size,
  };
  return {
    store: context.store,
    lineOfficialAccount: {
      id: context.lineOfficialAccount.id,
      name: context.lineOfficialAccount.name,
      chatBotId: context.lineOfficialAccount.chatBotId,
      sessionKey: context.lineOfficialAccount.sessionKey,
      sessionStatus: context.lineOfficialAccount.sessionStatus,
    },
    endpoint: discovery.endpoint,
    responseShape: discovery.responseShape,
    enumerationStatus: discovery.enumerationStatus,
    rows,
    summary,
  };
}

export async function applyPilotMappings(
  plan: PilotMappingPlan,
  prisma: PrismaClient,
): Promise<MappingApplySummary> {
  const exactRows = plan.rows.filter((row) => row.confidence === "EXACT_CONFIDENT" && row.candidateChatUserId);
  const expectedEndpoint = `https://chat.line.biz/api/v1/bots/${encodeURIComponent(PILOT_MAPPING_BOT_ID)}/chats`;
  const identityBlockReason = plan.store.code !== PILOT_MAPPING_STORE_CODE
    ? `Pilot guard rejected store "${plan.store.code}". Only store ${PILOT_MAPPING_STORE_CODE} is allowed.`
    : plan.lineOfficialAccount.name !== PILOT_MAPPING_OA_NAME
      || plan.lineOfficialAccount.chatBotId !== PILOT_MAPPING_BOT_ID
      || plan.lineOfficialAccount.sessionKey !== PILOT_MAPPING_SESSION_KEY
      || plan.lineOfficialAccount.sessionStatus !== LineChatSessionStatus.ACTIVE
      ? "Pilot LINE OA or authenticated session identity is not the approved Store 28375 mapping target."
      : plan.endpoint !== expectedEndpoint || !["array", "chats", "data", "items"].includes(plan.responseShape)
        ? "Chat-list parser/schema precondition is not an approved known shape or endpoint."
        : undefined;
  const result: MappingApplySummary = {
    enumerationStatus: plan.enumerationStatus,
    applyBlocked: Boolean(identityBlockReason) || plan.enumerationStatus !== "COMPLETE" || plan.summary.conflictsDetected > 0,
    blockReason: identityBlockReason
      ?? (plan.enumerationStatus !== "COMPLETE"
        ? `Chat enumeration is ${plan.enumerationStatus}; production completeness is required before apply.`
        : plan.summary.conflictsDetected > 0
          ? `${plan.summary.conflictsDetected} candidate conflict(s) must be resolved before apply.`
          : undefined),
    eligibleConfident: exactRows.length,
    mapped: 0,
    skippedAlreadyMapped: plan.summary.alreadyMapped,
    skippedAmbiguous: plan.summary.ambiguous,
    skippedPossible: plan.summary.possible,
    skippedNoMatch: plan.summary.noMatch,
    conflicts: plan.summary.conflictsDetected,
    failedWrites: 0,
  };
  if (result.applyBlocked) return result;
  try {
    await (prisma as unknown as MappingPrisma).$transaction(async (tx) => {
      for (const row of exactRows) {
        const updated = await tx.conversation.updateMany({
          where: { id: row.conversationId, storeId: plan.store.id, lineChatUserId: null },
          data: { lineChatUserId: row.candidateChatUserId },
        });
        if (updated.count === 1) result.mapped++;
        else result.skippedAlreadyMapped++;
      }
      return undefined;
    });
  } catch {
    result.failedWrites = exactRows.length;
    result.mapped = 0;
  }
  return result;
}

function maskChatUserId(value: string | null): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `${trimmed.slice(0, 3)}…`;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function formatPilotMappingReport(plan: PilotMappingPlan, apply: boolean): string {
  const summary = plan.summary;
  const lines = [
    "===============================================================",
    " LINE OA Manager Historical Chat ID Discovery",
    "===============================================================",
    `Mode  : ${apply ? "APPLY (exact confident writes only)" : "DRY-RUN (default; read-only)"}`,
    `Store : ${plan.store.code} - ${plan.store.name}`,
    `OA    : ${plan.lineOfficialAccount.name}`,
    `Bot   : ${plan.lineOfficialAccount.chatBotId}`,
    `Session: ${plan.lineOfficialAccount.sessionKey} (${plan.lineOfficialAccount.sessionStatus})`,
    `GET   : ${plan.endpoint}`,
    "Contract: observed endpoint; parser fail-closed; sanitized known shape",
    `Shape : ${plan.responseShape} (fixture-supported, not production-verified)`,
    `Chat enumeration status : ${plan.enumerationStatus}`,
    "---------------------------------------------------------------",
    `Total store conversations : ${summary.totalStoreConversations}`,
    `Missing lineChatUserId    : ${summary.missingLineChatUserId}`,
    `Relevant tagged           : ${summary.relevantTaggedConversations}`,
    `Chat candidates discovered: ${summary.chatCandidatesDiscovered}`,
    `EXACT_CONFIDENT           : ${summary.exactConfident}`,
    `POSSIBLE                  : ${summary.possible}`,
    `AMBIGUOUS                 : ${summary.ambiguous}`,
    `NO_MATCH                  : ${summary.noMatch}`,
    `Already mapped            : ${summary.alreadyMapped}`,
    `Conflicts detected        : ${summary.conflictsDetected}`,
    "---------------------------------------------------------------",
    "conversationId | displayName | salesStatus | candidateChatId | confidence | signals | reason",
  ];
  for (const row of plan.rows) {
    lines.push([
      row.conversationId,
      row.displayName.replace(/[\r\n|]/gu, " ").slice(0, 36),
      row.salesStatus ?? "NONE",
      maskChatUserId(row.candidateChatUserId),
      row.confidence,
      row.signals.join(",") || "-",
      row.reason.replace(/[\r\n|]/gu, " "),
    ].join(" | "));
  }
  return lines.join("\n");
}

export function formatMappingApplySummary(summary: MappingApplySummary): string {
  return [
    "---------------------------------------------------------------",
    "Apply result (Conversation.lineChatUserId only)",
    `Enumeration status : ${summary.enumerationStatus}`,
    `Apply blocked      : ${summary.applyBlocked ? "YES" : "NO"}`,
    ...(summary.blockReason ? [`Block reason       : ${summary.blockReason}`] : []),
    `Eligible confident : ${summary.eligibleConfident}`,
    `Mapped             : ${summary.mapped}`,
    `Skipped already    : ${summary.skippedAlreadyMapped}`,
    `Skipped ambiguous  : ${summary.skippedAmbiguous}`,
    `Skipped possible   : ${summary.skippedPossible}`,
    `Skipped no match   : ${summary.skippedNoMatch}`,
    `Conflicts          : ${summary.conflicts}`,
    `Failed writes      : ${summary.failedWrites}`,
  ].join("\n");
}
