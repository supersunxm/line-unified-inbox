export type ApiFollowUpStatus = "FOLLOW_UP" | "REMINDED" | "ACKNOWLEDGED" | "COMPLETED" | "ESCALATED";
export type ApiPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type ApiConversation = {
  id: string;
  latestMessageAt: string;
  priority: ApiPriority;
  followUpStatus: ApiFollowUpStatus;
  productRelationship: string | null;
  purchaseIntent: string | null;
  resolvedLineOaManagerUrl: string | null;
  customer: { id: string; lineUserId: string | null; displayName: string; pictureUrl: string | null; statusMessage: string | null; preferredLanguage: string | null; profileFetchStatus: string; profileFetchError: string | null };
  store: { id: string; name: string; lineManagerUrl: string | null; lineManagerUrlStatus: "VALID" | "MISSING" | "INVALID" };
  lineOfficialAccount: { id: string; name: string; basicId: string | null; connectionStatus: string; isActive: boolean; lastWebhookReceivedAt: string | null };
  messages: Array<{
    id: string;
    direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
    messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "LOCATION" | "STICKER" | "UNSUPPORTED";
    originalText: string;
    originalLanguage: string | null;
    translatedThai: string | null;
    translatedEnglish: string | null;
    translatedChinese: string | null;
    sentAt: string;
    fileName: string | null;
    media: { processingStatus: "PENDING" | "READY" | "FAILED" | "SKIPPED"; mimeType: string | null; fileSize: number | null; url: string | null } | null;
    latitude: number | null;
    longitude: number | null;
  }>;
  products: Array<{ source: string | null; confidence: number | null; matchedPhrase?: string | null; detectionMethod?: string | null; productModel: { id: string; name: string; classificationLevel?: string; productSeries: { id: string; name: string; productGroup?: string } } }>;
  topics: Array<{ source: string | null; confidence: number | null; topic: { id: string; name: string; category: string } }>;
  notes: Array<{ id: string; content: string; createdAt: string }>;
  activityHistory: Array<{ id: string; actionType: string; newStatus: ApiFollowUpStatus | null; createdAt: string }>;
};

export type ConversationListResponse = { items: ApiConversation[]; total: number; page: number; pageSize: number };
export type ApiStore = { id: string; name: string; code: string | null; isActive?: boolean; archivedAt?: string | null; _count?: { conversations: number; lineOfficialAccounts?: number } };
export type StoreRelatedCounts = { lineOfficialAccounts: number; activeLineOfficialAccounts: number; conversations: number; messages: number; notes: number; activityHistory: number };
export type StoreDeletionPreview = { storeId: string; storeName: string; lineOfficialAccountCount: number; conversationCount: number; messageCount: number; noteCount: number; activityCount: number; customerRecordsThatWillRemain: number; customerRecordsThatWillBeDeleted: number };
export type StoreRemovalResult = { result: "deleted" | "archived" | "restored"; message: string; relatedCounts?: StoreRelatedCounts };
export type ConversationMessagesResponse = { items: ApiConversation["messages"]; total: number; page: number; pageSize: number; hasEarlier: boolean };
export type ProductMetadataResponse = { series: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }> };
export type ApiTopic = { id: string; name: string; category: string };
export type DashboardSummaryResponse = {
  totalConversations: number;
  countByStatus: Partial<Record<ApiFollowUpStatus, number>>;
  countByPriority: Partial<Record<ApiPriority, number>>;
  storeMonitoring: unknown[];
  mostDiscussedProductModels: unknown[];
  topConversationTopics: unknown[];
  storesRequiringAttention: unknown[];
  recentActivity: unknown[];
};

export type LineOaConnectionStatus = "CONNECTED" | "READY" | "NOT_CONFIGURED" | "ERROR" | "DISABLED";
export type LineOfficialAccountResponse = {
  id: string;
  resolvedLineOaManagerUrl: string | null;
  name: string;
  basicId: string | null;
  channelId: string | null;
  maskedChannelId: string | null;
  destinationId: string | null;
  store: { id: string; name: string; region: string | null; area: string | null; storeMasterId: string | null; accountName: string | null; externalStoreId: string | null; province: string | null; lineId: string | null; lineOaLink: string | null; lineManagerUrl: string | null; dataQualityStatus: StoreMasterSuggestion["dataQualityStatus"] | null; dataSource: "MASTER" | "MANUAL" };
  connectionStatus: LineOaConnectionStatus;
  isActive: boolean;
  lastWebhookReceivedAt: string | null;
  lastConnectionTestAt: string | null;
  lastConnectionError: string | null;
  hasChannelSecret: boolean;
  hasChannelAccessToken: boolean;
  credentialsHealthy: boolean;
  conversationCount: number;
  messagesReceivedToday: number;
  archivedAt: string | null;
  webhookUrl: string | null;
  webhookConfigured: boolean;
};

export type LineOaCredentialHealth = {
  channelSecretStored: boolean;
  channelSecretDecryptable: boolean;
  accessTokenStored: boolean;
  accessTokenDecryptable: boolean;
  webhookKeyConfigured: boolean;
  isActive: boolean;
};

export type CreateLineOaInput = {
  storeId?: string;
  storeMasterId?: string;
  newStore?: { name: string; code?: string; region?: string; area?: string };
  name: string;
  basicId?: string;
  channelId?: string;
  destinationId?: string;
  channelSecret: string;
  channelAccessToken: string;
  isActive: boolean;
};

export type StoreMasterSuggestion = {
  id: string; accountName: string; storeName: string; externalStoreId: string | null;
  province: string | null; region: string | null; lineId: string | null; lineOaLink: string | null;
  lineManagerUrl: string | null; matchScore: number; matchReason: "EXACT_ACCOUNT_NAME" | "NORMALIZED_ACCOUNT_NAME" | "PARTIAL_ACCOUNT_NAME" | "FUZZY_SUGGESTION";
  dataQualityStatus: "COMPLETE" | "MISSING_STORE_ID" | "INVALID_MANAGER_URL" | "DUPLICATE_ACCOUNT_NAME" | "INCOMPLETE";
  existingStore: { id: string; name: string } | null;
};

export type LineOaTestResult = {
  status: LineOaConnectionStatus;
  configurationComplete: boolean;
  credentialsAvailable: boolean;
  accessTokenAvailable: boolean;
  webhookUrl: string | null;
  webhookUrlConfigured: boolean;
  channelIdConfigured: boolean;
  destinationIdConfigured: boolean;
  lastWebhookReceivedAt: string | null;
  matchingDestinationReceived: boolean;
  missingConfigurationFields: string[];
  credentialDecryptionError: boolean;
};

export type LineOaWebhookInfo = {
  webhookUrl: string | null;
  webhookKeyConfigured: boolean;
  routeConfigured: boolean;
  isActive: boolean;
  isArchived: boolean;
  credentialsHealthy: boolean;
  webhookUrlConfigured: boolean;
  credentialsConfigured: boolean;
  channelIdConfigured: boolean;
  destinationIdConfigured: boolean;
  credentialDecrypts: boolean;
  lastWebhookReceivedAt: string | null;
  connectionStatus: LineOaConnectionStatus;
  missingConfigurationFields: string[];
  backendPort: number;
  webhookPath: string;
  oa: { id: string; name: string; store: string; isActive: boolean };
};

export type SummaryDailyRow = {
  date: string;
  followers: number | null;
  targetedReaches: number | null;
  blocks: number | null;
  dailyIncrease: number | null;
  accountsExpected: number;
  accountsWithData: number;
  accountsReady: number;
  accountsUnready: number;
  accountsMissing: number;
};

export type ByStoreAccountRow = {
  lineOaId: string;
  accountName: string;
  storeId: string;
  storeName: string;
  date: string;
  followers: number | null;
  previousFollowers: number | null;
  startFollowers: number | null;
  dailyIncrease: number | null;
  periodIncrease: number | null;
  targetedReaches: number | null;
  blocks: number | null;
  status: string;
  fetchedAt: Date | string | null;
};

export type SyncBatchResult = {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  totalDays?: number;
  requested?: number;
  succeeded?: number;
  unready?: number;
  failed?: number;
  skipped?: number;
  errors?: Array<{
    lineOaId: string;
    accountName: string;
    date: string;
    code: string;
  }>;
  results?: SyncBatchResult[];
};

export type BackfillJobResponseDto = {
  id: string;
  lineOaId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  requested: number;
  succeeded: number;
  skipped: number;
  unready: number;
  failed: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

export type FriendSource = "STORE_QR" | "TIKTOK" | "FACEBOOK" | "INSTAGRAM";

export type FriendSourceLink = {
  id: string;
  storeId: string;
  storeName: string | null;
  storeCode: string | null;
  lineOaId: string;
  lineOaName: string | null;
  source: FriendSource;
  shortCode: string;
  /** Full short URL, e.g. https://example.com/f/{shortCode} */
  shortUrl: string;
  destinationUrl: string;
  isActive: boolean;
  clickCount: number;
  identifiedVisits?: number;
  alreadyFriends?: number;
  promptedAdds?: number;
  confirmedAdds?: number;
  conversionRate?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type FriendSourceLinksGenerateResult = {
  createdCount: number;
  existingCount: number;
  items: FriendSourceLink[];
};

export type FriendSourceLinksSummaryItem = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  source: FriendSource;
  totalLinks: number;
  activeLinks: number;
  clicks: number;
  identifiedVisits?: number;
  alreadyFriends?: number;
  promptedAdds?: number;
  confirmedAdds?: number;
  conversionRate?: number;
};

export type FriendSourceLinksFilters = {
  storeId?: string;
  lineOaId?: string;
  source?: FriendSource;
  isActive?: "true" | "false";
  search?: string;
};

export type IdentifyFriendAttributionInput = {
  sessionToken: string;
  idToken?: string;
  accessToken?: string;
  consentGiven: boolean;
};

export type IdentifyFriendAttributionResult = {
  status: string;
  expiresAt: string;
};

export type UpdateFriendshipStatusInput = {
  sessionToken: string;
  isFriend: boolean;
};

export type UpdateFriendshipStatusResult = {
  action: "ALREADY_FRIEND" | "REQUEST_FRIENDSHIP" | "WAITING_FOR_FOLLOW" | "EXPIRED";
  status: string;
  expiresAt: string;
};

export type FriendAttributionSessionStatusResult = {
  status: string;
  confirmed: boolean;
  confirmedFollowAt: string | null;
  expiresAt: string;
};
