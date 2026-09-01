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
  knownChatId?: string;
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

export interface DiagnosticIdentifierFieldSummary {
  stringCount: number;
  matchesUdPattern: number;
  otherStringCount: number;
  nullOrMissing: number;
}

export interface DiagnosticChatIdentifierShape {
  listCount: number;
  chatId: DiagnosticIdentifierFieldSummary;
  userId: DiagnosticIdentifierFieldSummary;
  presenceCounts: {
    bothPresent: number;
    chatIdOnly: number;
    userIdOnly: number;
    neither: number;
  };
}

export interface DiagnosticChatIdPrefixCounts {
  Ud: number;
  U_other: number;
  R: number;
  C: number;
  other: number;
}

export interface DiagnosticChatIdStructure {
  totalStrings: number;
  prefixClass: DiagnosticChatIdPrefixCounts;
  lengthBuckets: {
    lte16: number;
    from17To32: number;
    from33To40: number;
    gte41: number;
  };
}

export interface DiagnosticChatTypeMatrixEntry {
  category: string;
  count: number;
  idShape: DiagnosticChatIdPrefixCounts;
}

export interface DiagnosticChatTypeCorrelation {
  matrix: DiagnosticChatTypeMatrixEntry[];
  chatTypePresence: {
    present: number;
    missing: number;
  };
  friend: {
    trueCount: number;
    falseCount: number;
    otherOrMissing: number;
  };
  profile: {
    present: number;
    missing: number;
  };
}

export interface DiagnosticKnownChatIdMatch {
  chatId: "FOUND" | "NOT_FOUND";
  userId: "FOUND" | "NOT_FOUND";
}

export type DiagnosticNextType = "string" | "object" | "null" | "array" | "other";
export type DiagnosticNextStringClassification = "URL" | "OPAQUE_TOKEN" | "EMPTY" | "NOT_APPLICABLE";
export type DiagnosticNextLengthBucket = "0" | "1-32" | "33-128" | "129+" | "NOT_APPLICABLE";

export interface DiagnosticPaginationSummary {
  nextPresent: "YES" | "NO";
  nextType: DiagnosticNextType;
  nextStringClassification: DiagnosticNextStringClassification;
  nextLengthBucket: DiagnosticNextLengthBucket;
  nextObjectKeys: string[];
}

export interface DiagnosticChatListContractSummary {
  identifierShape: DiagnosticChatIdentifierShape;
  chatIdStructure: DiagnosticChatIdStructure;
  chatTypeCorrelation: DiagnosticChatTypeCorrelation;
  pagination: DiagnosticPaginationSummary;
  knownChatIdMatch?: DiagnosticKnownChatIdMatch;
}

export interface ObservedResponseSummary {
  status: number;
  contentType: string;
  url: string;
  query: DiagnosticQueryMetadata;
  schema: DiagnosticResponseSchemaSummary;
  chatListContract?: DiagnosticChatListContractSummary;
  timestamp: string;
}

export interface DiagnosticApiAuthProbe {
  endpoint: string;
  transport: "SUCCEEDED" | "FAILED";
  status?: number;
  contentType?: string;
  responseWasJson: boolean;
  topLevelKeyNames: string[];
  authenticated: "YES" | "NO" | "UNKNOWN";
}

export interface DiagnosticsResult {
  profilePath: string;
  surface: "bot" | "chat-list";
  /** Requested navigation target, sanitized to origin/path only. */
  targetUrl: string;
  /** Final page URL after navigation redirects, sanitized to origin/path only. */
  finalPageUrl: string;
  finalOrigin: string;
  finalPath: string;
  documentTitle: string | null;
  mainDocumentStatus?: number;
  finalOriginIsChatLine: boolean;
  finalPathMatchesWorkspace: boolean;
  authDestinationDetected: boolean;
  redirected: boolean;
  navigationSucceeded: boolean;
  navigationError?: string;
  /** Deprecated compatibility alias; true only when the API probe confirms auth. */
  authenticated: boolean;
  sessionStatePresent: boolean;
  cookieStatePresent: boolean;
  localStoragePresent: boolean;
  sessionStoragePresent: boolean;
  apiAuthenticated: "YES" | "NO" | "UNKNOWN";
  apiAuthProbe: DiagnosticApiAuthProbe;
  cookiesCount: number;
  metaTags: string[];
  xsrfTokenFound: boolean;
  tokenSource: "cookie" | "meta" | "storage" | "network" | "window" | "none";
  clientVersionFound: boolean;
  observedRequests: ObservedRequestSummary[];
  observedResponses: ObservedResponseSummary[];
  chatListResponseObserved: boolean;
  chatListIdentifierShape?: DiagnosticChatIdentifierShape;
  chatIdStructure?: DiagnosticChatIdStructure;
  chatTypeCorrelation?: DiagnosticChatTypeCorrelation;
  chatListPagination?: DiagnosticPaginationSummary;
  knownChatIdMatch?: DiagnosticKnownChatIdMatch;
  chatListFirstPageQueryNames: string[];
  scrollCandidatesAttempted: number;
  secondPageRequestObserved: boolean;
  secondPageQueryNames: string[];
  secondPageNewQueryNames: string[];
  secondPageQueryMetadata?: DiagnosticQueryMetadata;
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
