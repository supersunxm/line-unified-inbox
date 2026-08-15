import type { ApiBmReplyStatus, ApiConversation, ApiCustomerEvent, ApiCustomerIntelligence, ApiFollowUpStatus, ApiPriority, ApiStore, ApiTopic, BackfillJobResponseDto, BmReplyStatusSummaryResponse, ClassificationInsightsResponse, ProductCorrectionInsightResponse, NetworkAccuracyReport, ProductReviewQueueResponse, ApproveAliasResponse, RejectAliasResponse, TargetedReanalysisResponse, ConversationListResponse, ConversationMessagesResponse, CreateLineOaInput, DashboardAnalyticsResponse, FriendAttributionConfigDto, FriendAttributionSessionStatusResult, FriendSourceLink, FriendSourceLinksFilters, FriendSourceLinksGenerateResult, FriendSourceLinksSummaryItem, IdentifyFriendAttributionInput, IdentifyFriendAttributionResult, LineOfficialAccountResponse, LineOaCredentialHealth, LineOaTestResult, LineOaWebhookInfo, ProductMetadataResponse, SendConversationMessageResponse, StoreDeletionPreview, StoreMasterSuggestion, StorePrioritySummaryResponse, StoreRemovalResult, SummaryDailyRow, ByStoreAccountRow, SyncBatchResult, UpdateFriendshipStatusInput, UpdateFriendshipStatusResult, UpsertFriendAttributionConfigInput } from "@/types/api";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import { API_BASE_URL } from "@/lib/runtime-config";

export function messageMediaUrl(messageId: string) {
  const isBrowser = typeof window !== "undefined";
  return isBrowser
    ? `/api-backend/messages/${encodeURIComponent(messageId)}/media`
    : `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/media`;
}

export type MessageTranslationResult = {
  messageId: string;
  targetLanguage: "en" | "zh";
  status: "TRANSLATED" | "CACHED" | "SAME_LANGUAGE" | "UNSUPPORTED_MESSAGE" | "UNSUPPORTED_LANGUAGE";
  translatedText: string;
  cached: boolean;
};

export type StoreMasterSyncResult = {
  source: { type: string; sheetName: string; fetchedAt: string; rows: number };
  validation: { total: number; complete: number; incomplete: number; invalidManagerUrls: number; duplicateAccountNames: number; duplicateLineIds: number; duplicateExternalStoreIds: number };
  import: { validation: { total: number }; failed: number };
  connectedOaSync: { processed: number; updated: number; unchanged: number; missingStoreMaster: number; failed: number };
};

export type PendingRegistration = {
  id: string;
  name: string;
  employeeId: string | null;
  email: string;
  store: { id: string; name: string; code: string | null };
  role: "STAFF" | "STORE_MANAGER";
  createdAt: string;
};

export type TranslationFeedbackIssueCategory = "meaning_issue" | "terminology_issue" | "other";
export type MessageTranslationFeedbackResult = {
  id: string;
  messageId: string;
  targetLanguage: "en" | "zh";
  rating: "HELPFUL" | "INCORRECT";
  issueCategory: TranslationFeedbackIssueCategory | null;
  createdAt: string;
  recorded: boolean;
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isBrowser = typeof window !== "undefined";
  const requestUrl = isBrowser
    ? (path.startsWith("/auth/") ? path : `/api-backend${path}`)
    : `${API_BASE_URL}${path}`;
  let response: Response;

  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (init?.headers) {
    Object.assign(headers, init.headers);
  }

  try {
    response = await fetch(requestUrl, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    const developmentHint =
      process.env.NODE_ENV === "development"
        ? ` Attempted ${requestUrl}. The backend may not be running; start it with \"cd backend && npm run start:dev\".`
        : "";
    throw new ApiError(`Unable to reach the data service.${developmentHint}`, 0);
  }
  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try { const body = await response.json() as { message?: string | string[] }; if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message; } catch { }
    const error = new ApiError(message, response.status);
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    }
    throw error;
  }
  return response.json() as Promise<T>;
}

async function download(path: string) {
  const isBrowser = typeof window !== "undefined";
  const requestUrl = isBrowser
    ? (path.startsWith("/auth/") ? path : `/api-backend${path}`)
    : `${API_BASE_URL}${path}`;
  let response: Response;
  try { response = await fetch(requestUrl, { credentials: "include" }); }
  catch { throw new ApiError("Unable to reach the data service.", 0); }
  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try { const body = await response.json() as { message?: string }; if (body.message) message = body.message; } catch { /* CSV error response is not guaranteed to be JSON. */ }
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    throw new ApiError(message, response.status);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "line-oa-management.csv";
  return { blob: await response.blob(), filename };
}

export const api = {
  login: (identifier: string, password: string) => request<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" }>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  setupStatus: () =>
    request<{ firstAdminRequired: boolean; registrationAvailable: boolean; emailProviderConfigured: boolean; emailProviderMode: string }>(
      "/auth/setup-status",
      { cache: "no-store", headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
    ),
  requestSetupOtp: (displayName: string, email: string, password: string, language: "th" | "en" | "zh") => request<{ challengeId: string; maskedEmail: string; expiresInSeconds: number; resendAfterSeconds: number }>("/auth/setup/request-otp", { method: "POST", body: JSON.stringify({ displayName, email, password, language }) }),
  verifySetupOtp: (input: { challengeId: string; displayName: string; email: string; password: string; otp: string; language: "th" | "en" | "zh" }) => request<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" }>("/auth/setup/verify-otp", { method: "POST", body: JSON.stringify(input) }),
  resendSetupOtp: (challengeId: string, language: "th" | "en" | "zh") => request<{ challengeId: string; maskedEmail: string; expiresInSeconds: number; resendAfterSeconds: number }>("/auth/setup/resend-otp", { method: "POST", body: JSON.stringify({ challengeId, language }) }),
  logout: () => request<{ success: true }>("/auth/logout", { method: "POST" }),
  me: () =>
    request<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" }>(
      "/auth/me",
      { cache: "no-store", headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
    ),
  getPendingRegistrations: async () => {
    const response = await request<{ registrations?: PendingRegistration[] } | PendingRegistration[]>("/admin/registrations/pending");
    return Array.isArray(response) ? response : response.registrations ?? [];
  },
  approveRegistration: (id: string) => request<{ registrationId: string; userId: string; status: string }>(`/admin/registrations/${encodeURIComponent(id)}/approve`, { method: "PATCH" }),
  rejectRegistration: (id: string) => request<{ registrationId: string; userId: string; status: string }>(`/admin/registrations/${encodeURIComponent(id)}/reject`, { method: "PATCH" }),
  systemStatus: () => request<{ frontend: string; backendApi: string; database: string; lineWebhookEnabled: boolean; publicWebhookUrlConfigured: boolean; activeLineOaCount: number; connectedLineOaCount: number; lineOaIssueCount: number; lastValidWebhookReceived: string | null; lastStoreMasterImport: string | null; storeMasterRecordCount: number; classificationEngine: string; pilotMode: boolean }>("/operations/status"),
  operationalErrors: () => request<Array<{ id: string; feature: string; summary: string; resolved: boolean; createdAt: string }>>("/operations/errors"),
  resetCounter: () => request<{ resetAt: string | null }>("/operations/reset-counter", { method: "POST" }),
  pilotChecklist: (lineOaId: string) => request<{ oa: { id: string; name: string }; items: Array<{ itemKey: string; status: "NOT_TESTED" | "PASSED" | "FAILED" | "NOT_APPLICABLE"; note: string | null }> }>(`/operations/pilot-checklist/${lineOaId}`),
  updatePilotChecklist: (lineOaId: string, itemKey: string, status: "NOT_TESTED" | "PASSED" | "FAILED" | "NOT_APPLICABLE", note?: string) => request(`/operations/pilot-checklist/${lineOaId}/${itemKey}`, { method: "PUT", body: JSON.stringify({ status, note }) }),
  health: () => request<{ status: string }>("/health"),
  searchStoreMaster: (query: string, limit = 10) => request<StoreMasterSuggestion[]>(`/store-master/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  syncStoreMaster: () => request<StoreMasterSyncResult>("/store-master/sync", { method: "POST" }),
  conversations: (params?: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
          query.append(key, String(value));
        }
      }
    }
    const qStr = query.toString();
    return request<ConversationListResponse>(`/conversations${qStr ? `?${qStr}` : "?pageSize=100"}`);
  },
  bmReplyStatusSummary: () => request<BmReplyStatusSummaryResponse>("/conversations/bm-reply-status-summary"),
  storePrioritySummary: () => request<StorePrioritySummaryResponse>("/conversations/store-priority-summary"),
  conversation: (id: string) => request<ApiConversation>(`/conversations/${id}`),
  conversationMessages: (id: string, page = 1) => request<ConversationMessagesResponse>(`/conversations/${id}/messages?page=${page}&pageSize=30`),
  sendConversationMessage: (id: string, text: string, idempotencyKey: string) =>
    request<SendConversationMessageResponse>(`/conversations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, idempotencyKey }),
    }),
  translateMessage: (messageId: string, targetLanguage: "en" | "zh") =>
    request<MessageTranslationResult>(`/messages/${encodeURIComponent(messageId)}/translations`, {
      method: "POST",
      body: JSON.stringify({ targetLanguage }),
    }),
  submitTranslationFeedback: (
    messageId: string,
    input: {
      targetLanguage: "en" | "zh";
      rating: "HELPFUL" | "INCORRECT";
      issueCategory?: TranslationFeedbackIssueCategory;
    },
  ) => request<MessageTranslationFeedbackResult>(`/messages/${encodeURIComponent(messageId)}/translations/feedback`, {
    method: "POST",
    body: JSON.stringify(input),
  }),
  reanalyzeConversation: (id: string) => request<ApiConversation>(`/conversations/${id}/reanalyze`, { method: "POST" }),
  updateConversationTags: (id: string, productModelIds: string[], topicIds: string[]) => request<ApiConversation>(`/conversations/${id}/tags`, { method: "PATCH", body: JSON.stringify({ productModelIds, topicIds }) }),
  refreshLineProfile: (id: string) => request<ApiConversation["customer"]>(`/conversations/${id}/refresh-profile`, { method: "POST" }),
  customerNameHistory: (customerId: string) => request<{ currentName: string; history: Array<{ id: string; displayName: string; source: string; capturedAt: string }> }>(`/customers/${encodeURIComponent(customerId)}/name-history`),
  customerEvents: (customerId: string) => request<ApiCustomerEvent[]>(`/customers/${encodeURIComponent(customerId)}/events`),
  customerIntelligence: (customerId: string) => request<ApiCustomerIntelligence>(`/customers/${encodeURIComponent(customerId)}/intelligence`),
  updateStatus: (id: string, status: ApiFollowUpStatus) => request<{ changed: boolean; conversation: ApiConversation }>(`/conversations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updateBmReplyStatus: (id: string, status: ApiBmReplyStatus) => request<{ changed: boolean; conversation: ApiConversation }>(`/conversations/${id}/bm-reply-status`, { method: "PATCH", body: JSON.stringify({ status, bmReplyStatus: status }) }),
  bulkUpdateBmReplyStatus: (input: { storeId: string; status: ApiBmReplyStatus; fromStatuses?: ApiBmReplyStatus[] }) =>
    request<{ updated: number; status: ApiBmReplyStatus }>("/conversations/bm-reply-status/bulk", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  updatePriority: (id: string, priority: ApiPriority) => request<ApiConversation>(`/conversations/${id}/priority`, { method: "PATCH", body: JSON.stringify({ priority }) }),
  notes: (id: string) => request<ApiConversation["notes"]>(`/conversations/${id}/notes`),
  addNote: (id: string, content: string) => request<ApiConversation["notes"][number]>(`/conversations/${id}/notes`, { method: "POST", body: JSON.stringify({ content, createdByName: "OPPO LINE OA Specialist" }) }),
  activity: (id: string) => request<ApiConversation["activityHistory"]>(`/conversations/${id}/activity`),
  recentActivity: () => request<unknown[]>("/activity/recent"),
  stores: (showArchived = false) => request<ApiStore[]>(`/stores?showArchived=${showArchived}`),
  getStoreDeletionPreview: (id: string) => request<StoreDeletionPreview>(`/stores/${id}/deletion-preview`),
  deleteStore: (id: string, storeName: string) => request<StoreRemovalResult>(`/stores/${id}?mode=permanent`, { method: "DELETE", body: JSON.stringify({ confirmation: `DELETE ${storeName}` }) }),
  archiveStore: (id: string) => request<StoreRemovalResult>(`/stores/${id}/archive`, { method: "POST" }),
  restoreStore: (id: string) => request<StoreRemovalResult>(`/stores/${id}/restore`, { method: "POST" }),
  products: () => request<ProductMetadataResponse>("/metadata/products"),
  topics: () => request<ApiTopic[]>("/metadata/topics"),
  dashboard: () => request<DashboardAnalyticsResponse>("/dashboard/analytics"),
  dashboardAnalytics: (period: "today" | "7d" | "30d" = "today") => request<DashboardAnalyticsResponse>(`/dashboard/analytics?period=${period}`),
  classificationInsights: () => request<ClassificationInsightsResponse>("/classification-insights"),
  productCorrections: (storeId?: string) => request<ProductCorrectionInsightResponse>(`/product-intelligence/corrections${storeId ? `?storeId=${storeId}` : ""}`),
  productAccuracy: (storeId?: string) => request<NetworkAccuracyReport>(`/product-intelligence/accuracy${storeId ? `?storeId=${storeId}` : ""}`),
  productReviewQueue: (params?: { storeId?: string; reason?: string; productModelId?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.storeId) query.append("storeId", params.storeId);
    if (params?.reason) query.append("reason", params.reason);
    if (params?.productModelId) query.append("productModelId", params.productModelId);
    if (params?.page) query.append("page", String(params.page));
    if (params?.pageSize) query.append("pageSize", String(params.pageSize));
    const qs = query.toString();
    return request<ProductReviewQueueResponse>(`/product-intelligence/review-queue${qs ? `?${qs}` : ""}`);
  },
  confirmProductReview: (conversationId: string, createdByName?: string) =>
    request<{ success: boolean; conversationId: string; action: string }>("/product-intelligence/review-queue/confirm", {
      method: "POST",
      body: JSON.stringify({ conversationId, createdByName }),
    }),
  correctProductReview: (conversationId: string, productModelId: string, createdByName?: string) =>
    request<{ success: boolean; conversationId: string; action: string }>("/product-intelligence/review-queue/correct", {
      method: "POST",
      body: JSON.stringify({ conversationId, productModelId, createdByName }),
    }),
  confirmNoProductReview: (conversationId: string, createdByName?: string) =>
    request<{ success: boolean; conversationId: string; action: string }>("/product-intelligence/review-queue/no-product", {
      method: "POST",
      body: JSON.stringify({ conversationId, createdByName }),
    }),
  approveProductAlias: (phrase: string, modelName: string, createdByName?: string) =>
    request<ApproveAliasResponse>("/product-intelligence/aliases/approve", {
      method: "POST",
      body: JSON.stringify({ phrase, modelName, createdByName }),
    }),
  rejectProductAlias: (phrase: string, modelName: string, reason?: string, createdByName?: string) =>
    request<RejectAliasResponse>("/product-intelligence/aliases/reject", {
      method: "POST",
      body: JSON.stringify({ phrase, modelName, reason, createdByName }),
    }),
  reanalyzeProductAlias: (phrase: string) =>
    request<TargetedReanalysisResponse>("/product-intelligence/aliases/reanalyze", {
      method: "POST",
      body: JSON.stringify({ phrase }),
    }),
  lineOfficialAccounts: (showArchived = false) => request<LineOfficialAccountResponse[]>(`/line-official-accounts?showArchived=${showArchived}`),
  exportLineOfficialAccounts: (params: { search?: string; status?: "all" | "active" | "issues"; showArchived?: boolean }) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.status && params.status !== "all") query.set("status", params.status);
    if (params.showArchived) query.set("showArchived", "true");
    return download(`/line-official-accounts/export.csv?${query.toString()}`);
  },
  createLineOfficialAccount: (input: CreateLineOaInput) => request<LineOfficialAccountResponse>("/line-official-accounts", { method: "POST", body: JSON.stringify(input) }),
  updateLineOfficialAccount: (id: string, input: Partial<CreateLineOaInput>) => request<LineOfficialAccountResponse>(`/line-official-accounts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  setLineOfficialAccountStatus: (id: string, isActive: boolean) => request<LineOfficialAccountResponse>(`/line-official-accounts/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
  testLineOfficialAccount: (id: string) => request<LineOaTestResult>(`/line-official-accounts/${id}/test-connection`, { method: "POST" }),
  lineOfficialAccountCredentialHealth: (id: string) => request<LineOaCredentialHealth>(`/line-official-accounts/${id}/credential-health`),
  lineOfficialAccountWebhookInfo: (id: string) => request<LineOaWebhookInfo>(`/line-official-accounts/${id}/webhook-info`),
  regenerateLineOfficialAccountWebhook: (id: string) => request<LineOaWebhookInfo>(`/line-official-accounts/${id}/regenerate-webhook`, { method: "POST" }),
  removeLineOfficialAccount: (id: string) => request<{ outcome: "deleted" | "archived"; id: string }>(`/line-official-accounts/${id}`, { method: "DELETE" }),
  archiveLineOfficialAccount: (id: string) => request<{ outcome: "archived"; id: string }>(`/line-official-accounts/${id}/archive`, { method: "POST" }),
  restoreLineOfficialAccount: (id: string) => request<{ outcome: "restored"; id: string }>(`/line-official-accounts/${id}/restore`, { method: "POST" }),
  followerInsightsSummary: (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.append(key, value);
    return request<SummaryDailyRow[]>(`/follower-insights/summary?${query.toString()}`);
  },
  followerInsightsByStore: (dateFrom: string, dateTo: string) => request<ByStoreAccountRow[]>(`/follower-insights/by-store?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`),
  followerInsightsSync: (date: string) => request<SyncBatchResult>("/follower-insights/sync", { method: "POST", body: JSON.stringify({ date }) }),
  followerInsightsBackfill: (dto: { dateFrom: string; dateTo: string; lineOaId?: string; lineOaIds?: string[]; force?: boolean }) => request<SyncBatchResult>("/follower-insights/backfill", { method: "POST", body: JSON.stringify(dto) }),
  followerInsightsJobStatus: (lineOaId: string) => request<BackfillJobResponseDto>(`/follower-insights/backfill/jobs/${encodeURIComponent(lineOaId)}`),
  followerInsightsRetryJob: (lineOaId: string) => request<BackfillJobResponseDto>("/follower-insights/backfill/retry", { method: "POST", body: JSON.stringify({ lineOaId }) }),
  friendSourceLinks: (filters?: FriendSourceLinksFilters) => {
    const query = new URLSearchParams();
    if (filters) {
      if (filters.storeId) query.append("storeId", filters.storeId);
      if (filters.lineOaId) query.append("lineOaId", filters.lineOaId);
      if (filters.source) query.append("source", filters.source);
      if (filters.isActive !== undefined) query.append("isActive", filters.isActive);
      if (filters.search) query.append("search", filters.search);
    }
    const qs = query.toString();
    return request<FriendSourceLink[]>(`/friend-source-links${qs ? `?${qs}` : ""}`);
  },
  generateFriendSourceLinks: (lineOaIds: string[]) =>
    request<FriendSourceLinksGenerateResult>("/friend-source-links/generate", { method: "POST", body: JSON.stringify({ lineOaIds }) }),
  updateFriendSourceLink: (id: string, input: { isActive?: boolean; destinationUrl?: string }) =>
    request<FriendSourceLink>(`/friend-source-links/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  friendSourceLinksSummary: () =>
    request<FriendSourceLinksSummaryItem[]>("/friend-source-links/summary"),
  identifyFriendAttribution: (input: IdentifyFriendAttributionInput) =>
    request<IdentifyFriendAttributionResult>("/friend-attribution/identify", { method: "POST", body: JSON.stringify(input) }),
  updateFriendshipStatus: (input: UpdateFriendshipStatusInput) =>
    request<UpdateFriendshipStatusResult>("/friend-attribution/friendship-status", { method: "POST", body: JSON.stringify(input) }),
  getFriendAttributionSessionStatus: (token: string) =>
    request<FriendAttributionSessionStatusResult>(`/friend-attribution/session-status?token=${encodeURIComponent(token)}`),
  friendAttributionConfigs: () =>
    request<FriendAttributionConfigDto[]>("/friend-source-links/attribution-configs"),
  upsertFriendAttributionConfig: (lineOaId: string, input: UpsertFriendAttributionConfigInput) =>
    request<FriendAttributionConfigDto>(`/friend-source-links/attribution-configs/${encodeURIComponent(lineOaId)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteFriendAttributionConfig: (lineOaId: string) =>
    request<{ success: boolean; lineOaId: string }>(`/friend-source-links/attribution-configs/${encodeURIComponent(lineOaId)}`, {
      method: "DELETE",
    }),
  getRootCauseInsights: (period?: string) =>
    request<import("@/types/api").AIRootCauseSummary>(`/dashboard/root-cause-insights?period=${encodeURIComponent(period || "today")}`),
  getExecutiveDailyBrief: (period?: string) =>
    request<import("@/types/api").ExecutiveDailyBrief>(`/dashboard/executive-daily-brief?period=${encodeURIComponent(period || "today")}`),
  queryBiAssistant: (question: string, period?: string) =>
    request<import("@/types/api").BIAnswer>(`/dashboard/bi-assistant/query?period=${encodeURIComponent(period || "today")}`, {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  getOperationalActions: (period?: string) =>
    request<import("@/types/api").OperationalActionTask[]>(`/dashboard/actions?period=${encodeURIComponent(period || "today")}`),
  approveOperationalAction: (id: string) =>
    request<import("@/types/api").OperationalActionTask>(`/dashboard/actions/${encodeURIComponent(id)}/approve`, {
      method: "POST",
    }),
  completeOperationalAction: (id: string) =>
    request<import("@/types/api").OperationalActionTask>(`/dashboard/actions/${encodeURIComponent(id)}/complete`, {
      method: "POST",
    }),
  getActionImpact: (period?: string) =>
    request<import("@/types/api").ImpactSummary>(`/dashboard/action-impact?period=${encodeURIComponent(period || "today")}`),
  getOperationalMemory: (period?: string) =>
    request<import("@/types/api").OperationalMemorySummary>(`/dashboard/operational-memory?period=${encodeURIComponent(period || "today")}`),
  uploadMassMessageImage: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<import("@/types/api").MassMessageUploadImageResult>("/mass-messages/upload-image", {
      method: "POST",
      body: formData,
    });
  },
  previewMassMessage: (input: import("@/types/api").MassMessagePreviewInput) =>
    request<import("@/types/api").MassMessagePreviewResult>("/mass-messages/preview", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createMassMessage: (input: import("@/types/api").MassMessageCreateInput) =>
    request<import("@/types/api").MassMessageCampaignDetail>("/mass-messages", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getMassMessageCampaign: (id: string) =>
    request<import("@/types/api").MassMessageCampaignDetail>(`/mass-messages/${encodeURIComponent(id)}`),
  listMassMessageCampaigns: (limit = 20, offset = 0) =>
    request<{ items: import("@/types/api").MassMessageCampaignDetail[]; total: number }>(
      `/mass-messages?limit=${limit}&offset=${offset}`,
    ),
};
