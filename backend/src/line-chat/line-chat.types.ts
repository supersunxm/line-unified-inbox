export interface UpdateNicknameInput {
  botId: string;
  lineUserId: string;
  nickname: string;
  profilePath: string;
  dryRun?: boolean;
  headless?: boolean;
}

export interface UpdateNicknameResult {
  success: boolean;
  dryRun: boolean;
  botId: string;
  lineUserId: string;
  nickname: string;
  profilePath: string;
  status?: number;
  message?: string;
  error?: string;
  xsrfTokenFound?: boolean;
  tokenSource?: "cookie" | "meta" | "storage" | "network" | "window" | "none";
  clientVersionFound?: boolean;
}

export interface LineChatSessionOptions {
  profilePath: string;
  headless?: boolean;
  channel?: string;
  args?: string[];
}

export interface LineChatSessionValidation {
  authenticated: boolean;
  xsrfToken?: string;
  tokenSource?: "cookie" | "meta" | "storage" | "network" | "window" | "none";
  clientVersion?: string;
  cookiesCount: number;
  cookieNames: string[];
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  message?: string;
}

export interface NicknameCliArgs {
  profilePath: string;
  botId: string;
  lineUserId: string;
  nickname: string;
  dryRun: boolean;
  headless: boolean;
}

export interface LoginCliArgs {
  profilePath: string;
  url?: string;
}

export interface DiagnosticsCliArgs {
  profilePath: string;
  botId?: string;
  lineUserId?: string;
  headless?: boolean;
  surface: "bot" | "chat-list";
}

export interface DiagnosticQueryMetadata {
  parameterNames: string[];
  safeScalars: Record<string, string>;
  redactedParameters: string[];
}

export interface ObservedRequestSummary {
  method: string;
  url: string;
  query: DiagnosticQueryMetadata;
  hasXsrfHeader: boolean;
  hasClientVersionHeader: boolean;
  hasOriginHeader: boolean;
  hasRefererHeader: boolean;
  headerNames: string[];
  timestamp: string;
}

export interface DiagnosticArrayLength {
  path: string;
  length: number;
}

export interface DiagnosticResponseSchemaSummary {
  parseStatus: "JSON" | "NOT_JSON" | "PARSE_FAILED";
  topLevelType: "array" | "object" | "string" | "number" | "boolean" | "null" | "unknown";
  topLevelKeyNames: string[];
  nestedKeyNames: string[];
  arrayLengths: DiagnosticArrayLength[];
  paginationKeyNames: string[];
  candidateFieldNames: string[];
}

export interface ObservedResponseSummary {
  status: number;
  contentType: string;
  url: string;
  query: DiagnosticQueryMetadata;
  schema: DiagnosticResponseSchemaSummary;
  timestamp: string;
}

export interface DiagnosticsResult {
  profilePath: string;
  surface: "bot" | "chat-list";
  targetUrl: string;
  navigationSucceeded: boolean;
  navigationError?: string;
  authenticated: boolean;
  cookiesCount: number;
  cookieNames: string[];
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  metaTags: string[];
  xsrfTokenFound: boolean;
  tokenSource: "cookie" | "meta" | "storage" | "network" | "window" | "none";
  clientVersionFound: boolean;
  observedRequests: ObservedRequestSummary[];
  observedResponses: ObservedResponseSummary[];
  restApiRequestsObserved: number;
  streamingSseObserved: boolean;
}

export interface LineChatDiscoveredChat {
  chatUserId: string;
  displayName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
}

export interface LineChatDiscoveryResult {
  botId: string;
  endpoint: string;
  responseShape: "array" | "chats" | "data" | "items";
  enumerationStatus: "COMPLETE" | "PARTIAL" | "UNVERIFIED";
  chats: LineChatDiscoveredChat[];
}
