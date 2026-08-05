import type { ApiBmReplyStatus, ApiFollowUpStatus, ApiPriority } from "@/types/api";

export type ConversationListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  storeId?: string;
  lineOaId?: string;
  followUpStatus?: ApiFollowUpStatus;
  bmReplyStatus?: ApiBmReplyStatus;
  priority?: ApiPriority;
  productSeriesId?: string;
  productModelId?: string;
  topicId?: string;
};

export type ConversationListQueryInput = {
  page: number;
  pageSize: number;
  search: string;
  storeId: string;
  lineOaId: string;
  followUpStatus?: ApiFollowUpStatus;
  bmReplyStatus?: ApiBmReplyStatus;
  priority?: ApiPriority;
  productSeriesId?: string;
  productModelId?: string;
  topicId?: string;
};

export function buildConversationListQuery(input: ConversationListQueryInput): ConversationListQuery {
  return {
    page: input.page,
    pageSize: input.pageSize,
    search: input.search.trim() || undefined,
    storeId: input.storeId === "all" ? undefined : input.storeId,
    lineOaId: input.lineOaId === "all" ? undefined : input.lineOaId,
    followUpStatus: input.followUpStatus,
    ...(input.bmReplyStatus ? { bmReplyStatus: input.bmReplyStatus } : {}),
    priority: input.priority,
    productSeriesId: input.productSeriesId,
    productModelId: input.productModelId,
    topicId: input.topicId,
  };
}

export function conversationListQueryKey(query: ConversationListQuery): string {
  return JSON.stringify(query);
}

export function reconcileConversationPage(total: number, page: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
  return Math.max(1, Math.min(page, totalPages));
}

export class LatestConversationRequestGuard {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  isLatest(generation: number): boolean {
    return generation === this.generation;
  }
}
