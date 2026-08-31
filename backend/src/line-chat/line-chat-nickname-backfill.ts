import {
  CustomerSalesStatus,
  PaymentMethodType,
  PrismaClient,
} from "@prisma/client";
import { buildLineChatNickname } from "../line-chat-nickname";
import type {
  EnqueueNicknameSyncOptions,
  EnqueueNicknameSyncResult,
} from "./line-chat-nickname-queue.service";

export const PILOT_STORE_CODE = "28375";

export type BackfillClassification =
  | "WOULD_ENQUEUE_ONLINE"
  | "WOULD_ENQUEUE_PURCHASED"
  | "SKIP_INTERESTED"
  | "SKIP_MISSING_LINE_CHAT_USER_ID"
  | "SKIP_INCOMPLETE_PURCHASE_DATA"
  | "SKIP_NO_NICKNAME_NEEDED";

export interface BackfillConversationInput {
  id: string;
  displayName: string;
  customerSalesStatus: CustomerSalesStatus | null;
  paymentMethod: PaymentMethodType | null;
  salesRecordedAt: Date | null;
  lineChatUserId: string | null;
  salesProducts: readonly {
    customProductName: string | null;
    productModel: { name: string } | null;
  }[];
}

export interface BackfillPlanRow {
  conversationId: string;
  displayName: string;
  salesStatus: CustomerSalesStatus | null;
  targetNickname: string | null;
  lineChatUserIdPresent: boolean;
  classification: BackfillClassification;
}

export interface BackfillSummary {
  totalConversations: number;
  onlineCount: number;
  purchasedCount: number;
  interestedCount: number;
  withLineChatUserId: number;
  missingLineChatUserId: number;
  wouldEnqueueCount: number;
  skippedCount: number;
  skippedByReason: Record<Exclude<BackfillClassification, "WOULD_ENQUEUE_ONLINE" | "WOULD_ENQUEUE_PURCHASED">, number>;
}

export interface PilotBackfillPlan {
  store: { id: string; code: string; name: string };
  lineOfficialAccount: { id: string; name: string };
  rows: BackfillPlanRow[];
  summary: BackfillSummary;
}

export interface BackfillApplySummary {
  eligibleCount: number;
  createdCount: number;
  skippedCount: number;
  supersededCount: number;
  failedCount: number;
  results: readonly {
    conversationId: string;
    enqueued: boolean;
    jobId?: string;
    reason?: string;
  }[];
}

export interface NicknameQueue {
  enqueueSalesSync(
    conversationId: string,
    options?: EnqueueNicknameSyncOptions,
  ): Promise<EnqueueNicknameSyncResult>;
}

const SKIP_CLASSIFICATIONS = [
  "SKIP_INTERESTED",
  "SKIP_MISSING_LINE_CHAT_USER_ID",
  "SKIP_INCOMPLETE_PURCHASE_DATA",
  "SKIP_NO_NICKNAME_NEEDED",
] as const;

const SAFE_QUEUE_SKIP_REASONS = new Set([
  "CONVERSATION_NOT_FOUND",
  "ROLLOUT_DISABLED",
  "MISSING_OA_MAPPING",
  "SESSION_DISABLED",
  "MISSING_LINE_CHAT_USER_ID",
  "NO_NICKNAME_NEEDED",
  "MATCHING_JOB_EXISTS",
]);

export function assertPilotStore(storeCode: string): void {
  if (storeCode.trim() !== PILOT_STORE_CODE) {
    throw new Error(`Pilot guard rejected store "${storeCode}". Only store ${PILOT_STORE_CODE} is allowed.`);
  }
}

export function classifyBackfillConversation(
  conversation: BackfillConversationInput,
): BackfillPlanRow {
  const status = conversation.customerSalesStatus;
  const targetNickname = buildLineChatNickname({
    status,
    paymentMethod: conversation.paymentMethod,
    recordedAt: conversation.salesRecordedAt,
    products: conversation.salesProducts.map((product) => ({
      customProductName: product.customProductName,
      model: product.productModel,
    })),
  });
  const lineChatUserIdPresent = Boolean(conversation.lineChatUserId?.trim());

  let classification: BackfillClassification;
  if (status === CustomerSalesStatus.INTERESTED) {
    classification = "SKIP_INTERESTED";
  } else if (status !== CustomerSalesStatus.ONLINE && status !== CustomerSalesStatus.PURCHASED) {
    classification = "SKIP_NO_NICKNAME_NEEDED";
  } else if (status === CustomerSalesStatus.PURCHASED && !targetNickname) {
    classification = "SKIP_INCOMPLETE_PURCHASE_DATA";
  } else if (!lineChatUserIdPresent) {
    classification = "SKIP_MISSING_LINE_CHAT_USER_ID";
  } else {
    classification = status === CustomerSalesStatus.ONLINE
      ? "WOULD_ENQUEUE_ONLINE"
      : "WOULD_ENQUEUE_PURCHASED";
  }

  return {
    conversationId: conversation.id,
    displayName: conversation.displayName,
    salesStatus: status,
    targetNickname,
    lineChatUserIdPresent,
    classification,
  };
}

export function summarizeBackfill(rows: readonly BackfillPlanRow[]): BackfillSummary {
  const skippedByReason: BackfillSummary["skippedByReason"] = {
    SKIP_INTERESTED: 0,
    SKIP_MISSING_LINE_CHAT_USER_ID: 0,
    SKIP_INCOMPLETE_PURCHASE_DATA: 0,
    SKIP_NO_NICKNAME_NEEDED: 0,
  };

  for (const row of rows) {
    if (SKIP_CLASSIFICATIONS.includes(row.classification as typeof SKIP_CLASSIFICATIONS[number])) {
      skippedByReason[row.classification as keyof typeof skippedByReason]++;
    }
  }

  const wouldEnqueueCount = rows.filter((row) => row.classification.startsWith("WOULD_ENQUEUE_")).length;
  return {
    totalConversations: rows.length,
    onlineCount: rows.filter((row) => row.salesStatus === CustomerSalesStatus.ONLINE).length,
    purchasedCount: rows.filter((row) => row.salesStatus === CustomerSalesStatus.PURCHASED).length,
    interestedCount: rows.filter((row) => row.salesStatus === CustomerSalesStatus.INTERESTED).length,
    withLineChatUserId: rows.filter((row) => row.lineChatUserIdPresent).length,
    missingLineChatUserId: rows.filter((row) => !row.lineChatUserIdPresent).length,
    wouldEnqueueCount,
    skippedCount: rows.length - wouldEnqueueCount,
    skippedByReason,
  };
}

export async function loadPilotBackfillPlan(
  prisma: PrismaClient,
  storeCode: string,
): Promise<PilotBackfillPlan> {
  assertPilotStore(storeCode);

  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { id: PILOT_STORE_CODE },
        { code: PILOT_STORE_CODE },
        { storeMaster: { is: { externalStoreId: PILOT_STORE_CODE } } },
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
      storeMaster: { select: { externalStoreId: true } },
      lineOfficialAccounts: {
        where: { isActive: true, archivedAt: null, accountType: "STORE" },
        select: { id: true, name: true },
      },
    },
    take: 2,
  });

  if (stores.length !== 1) {
    throw new Error(
      stores.length === 0
        ? `Pilot store ${PILOT_STORE_CODE} was not found.`
        : `Pilot store ${PILOT_STORE_CODE} resolved to multiple Store records; refusing to continue.`,
    );
  }

  const store = stores[0];
  const resolvedCode = store.code?.trim()
    || store.storeMaster?.externalStoreId?.trim()
    || (store.id === PILOT_STORE_CODE ? store.id : undefined);
  if (resolvedCode !== PILOT_STORE_CODE) {
    throw new Error(`Resolved Store record does not match pilot store ${PILOT_STORE_CODE}.`);
  }
  if (store.lineOfficialAccounts.length !== 1) {
    throw new Error(
      `Pilot store ${PILOT_STORE_CODE} must have exactly one active Store LINE OA; found ${store.lineOfficialAccounts.length}.`,
    );
  }

  const lineOfficialAccount = store.lineOfficialAccounts[0];
  const conversations = await prisma.conversation.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      lineOfficialAccountId: true,
      customerSalesStatus: true,
      paymentMethod: true,
      salesRecordedAt: true,
      lineChatUserId: true,
      customer: { select: { displayName: true } },
      salesProducts: {
        orderBy: { createdAt: "asc" },
        select: {
          customProductName: true,
          productModel: { select: { name: true } },
        },
      },
    },
  });

  const mismatchedOaCount = conversations.filter(
    (conversation) => conversation.lineOfficialAccountId !== lineOfficialAccount.id,
  ).length;
  if (mismatchedOaCount > 0) {
    throw new Error(
      `Pilot store ${PILOT_STORE_CODE} has ${mismatchedOaCount} conversation(s) linked to a different OA; refusing partial backfill.`,
    );
  }

  const rows = conversations.map((conversation) => classifyBackfillConversation({
    id: conversation.id,
    displayName: conversation.customer.displayName,
    customerSalesStatus: conversation.customerSalesStatus,
    paymentMethod: conversation.paymentMethod,
    salesRecordedAt: conversation.salesRecordedAt,
    lineChatUserId: conversation.lineChatUserId,
    salesProducts: conversation.salesProducts,
  }));

  return {
    store: { id: store.id, code: resolvedCode, name: store.name },
    lineOfficialAccount,
    rows,
    summary: summarizeBackfill(rows),
  };
}

export async function applyPilotBackfill(
  plan: PilotBackfillPlan,
  queue: NicknameQueue,
): Promise<BackfillApplySummary> {
  const eligibleRows = plan.rows.filter((row) => row.classification.startsWith("WOULD_ENQUEUE_"));
  const results: BackfillApplySummary["results"][number][] = [];
  let createdCount = 0;
  let skippedCount = 0;
  let supersededCount = 0;
  let failedCount = 0;

  for (const row of eligibleRows) {
    const result = await queue.enqueueSalesSync(row.conversationId, {
      skipIfMatchingJobExists: true,
    });
    results.push({
      conversationId: row.conversationId,
      enqueued: result.enqueued,
      jobId: result.jobId,
      reason: result.reason,
    });

    if (result.enqueued) {
      createdCount++;
      supersededCount += result.supersededCount ?? 0;
    } else if (result.reason && SAFE_QUEUE_SKIP_REASONS.has(result.reason)) {
      skippedCount++;
    } else {
      failedCount++;
    }
  }

  return {
    eligibleCount: eligibleRows.length,
    createdCount,
    skippedCount,
    supersededCount,
    failedCount,
    results,
  };
}

function safeCell(value: string, maxLength: number): string {
  return Array.from(value)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? " " : character;
    })
    .join("")
    .slice(0, maxLength);
}

export function formatPilotBackfillReport(plan: PilotBackfillPlan, apply: boolean): string {
  const summary = plan.summary;
  const lines = [
    "===============================================================",
    " LINE Chat Historical Nickname Backfill",
    "===============================================================",
    `Mode  : ${apply ? "APPLY" : "DRY-RUN (default; zero writes)"}`,
    `Store : ${plan.store.code} - ${safeCell(plan.store.name, 80)}`,
    `OA    : ${safeCell(plan.lineOfficialAccount.name, 80)}`,
    "---------------------------------------------------------------",
    `Total conversations       : ${summary.totalConversations}`,
    `ONLINE                   : ${summary.onlineCount}`,
    `PURCHASED                : ${summary.purchasedCount}`,
    `INTERESTED               : ${summary.interestedCount}`,
    `With lineChatUserId      : ${summary.withLineChatUserId}`,
    `Missing lineChatUserId   : ${summary.missingLineChatUserId}`,
    `Would enqueue            : ${summary.wouldEnqueueCount}`,
    `Skipped total            : ${summary.skippedCount}`,
    `  SKIP_INTERESTED        : ${summary.skippedByReason.SKIP_INTERESTED}`,
    `  SKIP_MISSING_LINE_CHAT_USER_ID: ${summary.skippedByReason.SKIP_MISSING_LINE_CHAT_USER_ID}`,
    `  SKIP_INCOMPLETE_PURCHASE: ${summary.skippedByReason.SKIP_INCOMPLETE_PURCHASE_DATA}`,
    `  SKIP_NO_NICKNAME_NEEDED: ${summary.skippedByReason.SKIP_NO_NICKNAME_NEEDED}`,
    "---------------------------------------------------------------",
    "conversationId | displayName | salesStatus | targetNickname | lineChatUserId? | classification",
  ];

  for (const row of plan.rows) {
    lines.push([
      row.conversationId,
      safeCell(row.displayName, 32),
      row.salesStatus ?? "NONE",
      safeCell(row.targetNickname ?? "-", 48),
      row.lineChatUserIdPresent ? "yes" : "no",
      row.classification,
    ].join(" | "));
  }

  return lines.join("\n");
}

export function formatBackfillApplySummary(summary: BackfillApplySummary): string {
  return [
    "---------------------------------------------------------------",
    "Apply result",
    `Eligible   : ${summary.eligibleCount}`,
    `Created    : ${summary.createdCount}`,
    `Skipped    : ${summary.skippedCount}`,
    `Superseded : ${summary.supersededCount}`,
    `Failed     : ${summary.failedCount}`,
  ].join("\n");
}
