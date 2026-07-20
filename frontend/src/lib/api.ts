import type { ApiConversation, ApiFollowUpStatus, ApiPriority, ApiStore, ApiTopic, ConversationListResponse, ConversationMessagesResponse, CreateLineOaInput, DashboardSummaryResponse, LineOfficialAccountResponse, LineOaCredentialHealth, LineOaTestResult, LineOaWebhookInfo, ProductMetadataResponse, StoreDeletionPreview, StoreMasterSuggestion, StoreRemovalResult } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function messageMediaUrl(messageId: string) {
  return `${API_URL}/messages/${encodeURIComponent(messageId)}/media`;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestUrl = `${API_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
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
    try { const body = await response.json() as { message?: string | string[] }; if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message; } catch {}
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (identifier: string, password: string) => request<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" }>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  setupStatus: () => request<{ firstAdminRequired: boolean; registrationAvailable: boolean; emailProviderConfigured: boolean; emailProviderMode: string }>("/auth/setup-status"),
  requestSetupOtp: (displayName: string, email: string, password: string, language: "th" | "en" | "zh") => request<{ challengeId: string; maskedEmail: string; expiresInSeconds: number; resendAfterSeconds: number }>("/auth/setup/request-otp", { method: "POST", body: JSON.stringify({ displayName, email, password, language }) }),
  verifySetupOtp: (input: { challengeId: string; displayName: string; email: string; password: string; otp: string; language: "th" | "en" | "zh" }) => request<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" }>("/auth/setup/verify-otp", { method: "POST", body: JSON.stringify(input) }),
  resendSetupOtp: (challengeId: string, language: "th" | "en" | "zh") => request<{ challengeId: string; maskedEmail: string; expiresInSeconds: number; resendAfterSeconds: number }>("/auth/setup/resend-otp", { method: "POST", body: JSON.stringify({ challengeId, language }) }),
  logout: () => request<{ success: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" }>("/auth/me"),
  systemStatus: () => request<{ frontend: string; backendApi: string; database: string; lineWebhookEnabled: boolean; publicWebhookUrlConfigured: boolean; activeLineOaCount: number; connectedLineOaCount: number; lineOaIssueCount: number; lastValidWebhookReceived: string | null; lastStoreMasterImport: string | null; storeMasterRecordCount: number; classificationEngine: string; pilotMode: boolean }>("/operations/status"),
  operationalErrors: () => request<Array<{ id: string; feature: string; summary: string; resolved: boolean; createdAt: string }>>("/operations/errors"),
  pilotChecklist: (lineOaId: string) => request<{ oa: { id: string; name: string }; items: Array<{ itemKey: string; status: "NOT_TESTED" | "PASSED" | "FAILED" | "NOT_APPLICABLE"; note: string | null }> }>(`/operations/pilot-checklist/${lineOaId}`),
  updatePilotChecklist: (lineOaId: string, itemKey: string, status: "NOT_TESTED" | "PASSED" | "FAILED" | "NOT_APPLICABLE", note?: string) => request(`/operations/pilot-checklist/${lineOaId}/${itemKey}`, { method: "PUT", body: JSON.stringify({ status, note }) }),
  health: () => request<{ status: string }>("/health"),
  searchStoreMaster: (query: string, limit = 10) => request<StoreMasterSuggestion[]>(`/store-master/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  conversations: () => request<ConversationListResponse>("/conversations?pageSize=100"),
  conversation: (id: string) => request<ApiConversation>(`/conversations/${id}`),
  conversationMessages: (id: string, page = 1) => request<ConversationMessagesResponse>(`/conversations/${id}/messages?page=${page}&pageSize=30`),
  reanalyzeConversation: (id: string) => request<ApiConversation>(`/conversations/${id}/reanalyze`, { method: "POST" }),
  updateConversationTags: (id: string, productModelIds: string[], topicIds: string[]) => request<ApiConversation>(`/conversations/${id}/tags`, { method: "PATCH", body: JSON.stringify({ productModelIds, topicIds }) }),
  refreshLineProfile: (id: string) => request<ApiConversation["customer"]>(`/conversations/${id}/refresh-profile`, { method: "POST" }),
  updateStatus: (id: string, status: ApiFollowUpStatus) => request<{ changed: boolean; conversation: ApiConversation }>(`/conversations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
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
  dashboard: () => request<DashboardSummaryResponse>("/dashboard/summary"),
  lineOfficialAccounts: (showArchived = false) => request<LineOfficialAccountResponse[]>(`/line-official-accounts?showArchived=${showArchived}`),
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
};
