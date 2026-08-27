export type ApiFollowUpStatus = "FOLLOW_UP" | "REMINDED" | "ACKNOWLEDGED" | "COMPLETED" | "ESCALATED";
export type ApiPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type ApiBmReplyStatus = "NOT_REPLIED" | "NOTIFIED_BM" | "REPLIED";

export type ApiCustomerSalesInformation = {
  status: "INTERESTED" | "PURCHASED" | null;
  interestLevel: "HOT" | "WARM" | "COLD" | null;
  purchaseChannel: string[];
  paymentMethod: "CASH" | "INSTALLMENT" | "CREDIT_CARD" | "OTHER" | null;
  products: Array<{
    id: string;
    model: { id: string; name: string; seriesName: string | null; category: string | null };
    variant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
    customProductName: string | null;
    quantity: number;
    status: "INTERESTED" | "PURCHASED";
  }>;
  recordedBy: string | null;
  recordedAt: string | null;
};

export type ApiPurchaseInformation = {
  recordState: "VERIFIED" | "LEGACY_MANUAL" | "NONE";
  purchaseChannel: string[];
  paymentMethod: "INSTALLMENT" | null;
  products: Array<{
    model: { id: string; name: string; seriesName: string | null; category: string | null };
    variant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
    source: "MANUAL";
  }>;
  recordedBy: string | null;
  recordedAt: string | null;
};

export type PurchaseAnalyticsResponse = {
  filters: { from: string | null; to: string | null; storeId: string | null };
  overview: {
    verifiedPurchaseRecords: number;
    recordedProducts: number;
    stores: number;
    recordingBms: number;
  };
  products: Array<{ productModelId: string; name: string; seriesName: string; count: number }>;
  variants: Array<{ productVariantId: string; modelName: string; variant: string; color: string | null; count: number }>;
  colors: Array<{ label: string; count: number }>;
  channels: Array<{ label: string; count: number }>;
  paymentMethods: Array<{ label: string; count: number }>;
  stores: Array<{ storeId: string; storeName: string; storeCode: string | null; recordCount: number; uniqueConversations: number }>;
  recordingActivity: Array<{ userId: string | null; displayName: string; recordCount: number; lastRecordedAt: string }>;
};

export type ApiAiInsight = {
  mentionedProducts: Array<{
    model: { id: string; name: string; seriesName: string | null; category: string | null };
    variant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
    confidence: number | null;
    matchedPhrase: string | null;
    detectionMethod: string | null;
    sourceMessageId: string | null;
  }>;
  topics: Array<{ id: string; name: string; category: string; confidence: number | null }>;
  classification: { productRelationship: string | null; purchaseIntent: string | null };
};

export type ApiOperationalState = {
  replyStatus: ApiBmReplyStatus;
  priority: { level: string };
  unread: number | null;
};

export type ApiConversation = {
  id: string;
  latestMessageAt: string;
  priority: ApiPriority;
  followUpStatus: ApiFollowUpStatus;
  bmReplyStatus: ApiBmReplyStatus;
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
  customerSalesInformation?: ApiCustomerSalesInformation;
  purchaseInformation?: ApiPurchaseInformation;
  aiInsight?: ApiAiInsight;
  operationalState?: ApiOperationalState;
  notes: Array<{ id: string; content: string; createdAt: string }>;
  activityHistory: Array<{ id: string; actionType: string; newStatus: ApiFollowUpStatus | null; newBmReplyStatus: ApiBmReplyStatus | null; createdByUserId?: string | null; metadata?: unknown; createdAt: string }>;
};

export type ApiCustomerIntelligence = {
  customerId: string;
  profileSummary: string;
  customerStage: "NEW" | "INTERESTED" | "PURCHASED" | "EXISTING_CUSTOMER" | "UNKNOWN";
  intent: string[];
  interestedProducts: string[];
  recommendedActions: string[];
  confidenceScore: number;
  evidence: string[];
};

export type ApiCustomerEventType = "NAME_CHANGED" | "PRODUCT_INTEREST_DETECTED" | "PURCHASE_INTENT_CHANGED";
export type ApiCustomerEventSource = "LINE_PROFILE_SYNC" | "BM_MANUAL" | "AI_ANALYSIS";

export type ApiCustomerEvent = {
  id: string;
  customerId: string;
  type: ApiCustomerEventType;
  source: ApiCustomerEventSource;
  previousValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ConversationListResponse = { items: ApiConversation[]; total: number; page: number; pageSize: number };
export type SendConversationMessageResponse = {
  message: ApiConversation["messages"][number];
  bmReplyStatus: "REPLIED";
  duplicate: boolean;
};
export type BmReplyStatusSummaryResponse = {
  overview: {
    notReplied: number;
    notifiedBm: number;
    replied: number;
  };
  stores: Array<{
    storeId: string;
    storeName: string;
    notReplied: number;
    notifiedBm: number;
    replied: number;
    oldestWaitingMinutes?: number;
  }>;
};
export type StorePerformanceRow = {
  rank: number;
  id?: string;
  storeId: string;
  masterStoreId?: string | null;
  externalStoreId?: string | null;
  storeName: string;
  messages: number;
  replied: number;
  bmNotified: number;
  pending: number;
  responseRate24h: number;
  networkAvgResponseRate24h: number;
  gapVsNetworkAvg: number;
  avgResponseMinutes: number;
  followerGrowth: number;
  performanceScore: number;
  status: "Excellent" | "Need Attention" | "Improve";
};

export type BestPracticeStoreDetail = StorePerformanceRow & {
  reasons: string[];
};

export type NeedImprovementStoreDetail = StorePerformanceRow & {
  issues: string[];
  recommendation: string;
};

export type NeedActionStoreItem = {
  storeId: string;
  masterStoreId?: string | null;
  externalStoreId?: string | null;
  storeName: string;
  pending: number;
  responseRate: number;
  messages: number;
  severity: "HIGH" | "MEDIUM";
  problem: string;
  impact: string;
  recommendedAction: string;
  status: "OPEN" | "WAITING_BM" | "BM_REPLIED" | "RESOLVED";
  priorityScore: number;
  reasons: string[];
};

export type SlaRiskPredictionItem = {
  storeId: string;
  storeName: string;
  currentWaitingHours: number;
  expectedBreachHours: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  recommendation: string;
};

export type AdminActivityLogItem = {
  timestamp: string;
  admin: string;
  action: string;
  storeName: string;
  status: string;
};

export type DataQualityIndicator = {
  status: "Healthy" | "Warning" | "Critical";
  conversationCount: number;
  storeCount: number;
  lastUpdated: string;
  warnings: string[];
};

export type ProductDemandCorrelationItem = {
  productModelId: string;
  productName: string;
  topTopicName: string;
  count: number;
  percentage: number;
};

export type StoreQuickViewData = {
  storeId: string;
  masterStoreId?: string | null;
  externalStoreId?: string | null;
  storeName: string;
  messages: number;
  answered: number;
  responseRate24h: number;
  pending: number;
  topCustomerNeed: string;
  peakWindow: string;
  recommendation: string;
  customerIssues: Array<{ name: string; percentage: number }>;
  timeline: {
    customerMessageTime: string;
    bmNotificationTime: string;
    storeReplyTime: string;
    responseTimeMinutes: number;
  };
  actionHistory: Array<{ time: string; event: string }>;
};

export type OperationEfficiencyData = {
  opened: number;
  resolved: number;
  closureRate: number;
  averageResolutionTime: string;
};

export type DashboardAnalyticsResponse = {
  period: "today" | "7d" | "30d";
  periodStartDate: string;
  userRolePermissions?: {
    role: string;
    isHeadOffice: boolean;
    canNotifyBm: boolean;
    canViewAllStores: boolean;
  };
  dataQuality: DataQualityIndicator;
  dailySummary: {
    networkStatus: "🟢 Healthy" | "⚠️ Attention Required";
    activeStoresCount: number;
    totalMessagesToday: number;
    slaAchievementRate: number;
    storesNeedAttentionCount: number;
    lastUpdatedTime: string;
  };
  operationEfficiency: OperationEfficiencyData;
  operationHealth: {
    responseRate24h: number;
    count24hReplied: number;
    totalMessagesToday: number;
    responseRateDiffYesterday: number;
    breakdown: {
      compositeScore: number;
      responseSlaScore: number;
      pendingControlScore: number;
      escalationControlScore: number;
      growthScore: number;
    };
  };
  actionWorkflowStatus: {
    open: number;
    waitingBm: number;
    bmReplied: number;
    resolved: number;
    completionRate: number;
  };
  actionStatus: {
    resolved: number;
    waitingBm: number;
    pendingReview: number;
    completionRate: number;
  };
  summaryCards: {
    messagesToday: number;
    messagesYesterday: number;
    messagesDiffPct: number;
    repliedCount: number;
    repliedPercentage: number;
    bmNotifiedCount: number;
    bmNotifiedPercentage: number;
    pendingCount: number;
    responseRate24h: number;
    responseRateDiffYesterday: number;
    count24hReplied: number;
    followerGrowth: {
      totalFriends: number;
      addedToday: number;
      blockedToday: number;
      netToday: number;
    };
  };
  responseAnalytics: {
    avgResponseMinutes: number;
    medianResponseMinutes: number;
    buckets: {
      under4h: number;
      between4and12h: number;
      between12and24h: number;
      over24h: number;
    };
  };
  trend7Days: Array<{ date: string; label: string; count: number; replied: number }>;
  topTopics: Array<{ topicId: string; name: string; count: number; percentage: number }>;
  topProducts: Array<{ productModelId: string; name: string; count: number; percentage: number }>;
  customerDemandProductCorrelation: ProductDemandCorrelationItem[];
  peakHourAnalysis: {
    peakWindow: string;
    peakTrafficCount: number;
    hourlyDistribution: number[];
    topStores: Array<{ storeId: string; storeName: string; count: number }>;
    recommendation: string;
  };
  needActionQueue: NeedActionStoreItem[];
  slaRiskPrediction: SlaRiskPredictionItem[];
  adminActivity: AdminActivityLogItem[];
  storeQuickViews: Record<string, StoreQuickViewData>;
  storeRanking: StorePerformanceRow[];
  bestPracticeStore: BestPracticeStoreDetail | null;
  needImprovementStore: NeedImprovementStoreDetail | null;
  operationalInsights: string[];
  storeFollowersRanking?: {
    top10: Array<{ storeId: string; storeName: string; followers: number }>;
    bottom10: Array<{ storeId: string; storeName: string; followers: number }>;
    top10Average: number;
    bottom10Average: number;
    ratio: number;
  };
};

export type StorePrioritySummaryResponse = {
  stores: Array<{
    id: string;
    name: string;
    notReplied: number;
    notifiedBm: number;
    replied: number;
    oldestWaitingMinutes?: number;
  }>;
};
export type ApiStore = { id: string; storeId?: string | null; name: string; code: string | null; googleMapsUrl?: string | null; isActive?: boolean; archivedAt?: string | null; _count?: { conversations: number; lineOfficialAccounts?: number; operationalConversationCount?: number; operationalNotRepliedCount?: number } };
export type StoreRelatedCounts = { lineOfficialAccounts: number; activeLineOfficialAccounts: number; conversations: number; messages: number; notes: number; activityHistory: number };
export type StoreDeletionPreview = { storeId: string; storeName: string; lineOfficialAccountCount: number; conversationCount: number; messageCount: number; noteCount: number; activityCount: number; customerRecordsThatWillRemain: number; customerRecordsThatWillBeDeleted: number };
export type StoreRemovalResult = { result: "deleted" | "archived" | "restored"; message: string; relatedCounts?: StoreRelatedCounts };
export type ConversationMessagesResponse = { items: ApiConversation["messages"]; total: number; page: number; pageSize: number; hasEarlier: boolean };
export type ProductMetadataResponse = { series: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }> };
export type ProductVariantMetadata = { id: string; ram: string | null; rom: string | null; color: string | null };
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
  store: { id: string; storeId?: string | null; name: string; code: string | null; region: string | null; area: string | null; storeMasterId: string | null; accountName: string | null; externalStoreId: string | null; province: string | null; lineId: string | null; lineOaLink: string | null; lineManagerUrl: string | null; googleMapsUrl?: string | null; dataQualityStatus: StoreMasterSuggestion["dataQualityStatus"] | null; dataSource: "MASTER" | "MANUAL" };
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
  createdAt: string;
  updatedAt: string;
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
  lineManagerUrl: string | null; googleMapsUrl?: string | null; matchScore: number; matchReason: "EXACT_ACCOUNT_NAME" | "NORMALIZED_ACCOUNT_NAME" | "PARTIAL_ACCOUNT_NAME" | "FUZZY_SUGGESTION";
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
  masterStoreId?: string | null;
  externalStoreId?: string | null;
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
  masterStoreId?: string | null;
  externalStoreId?: string | null;
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
  masterStoreId?: string | null;
  externalStoreId?: string | null;
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

export type FriendAttributionConfigDto = {
  lineOaId: string;
  lineOaName: string;
  basicId: string | null;
  storeName: string | null;
  storeCode: string | null;
  lineLoginChannelId: string | null;
  liffId: string | null;
  isEnabled: boolean;
  isConfigured: boolean;
  updatedAt: string | null;
};

export type UpsertFriendAttributionConfigInput = {
  lineOaId: string;
  lineLoginChannelId: string;
  liffId: string;
  isEnabled: boolean;
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
  fallbackUrl?: string;
};

export type UpdateFriendshipStatusInput = {
  sessionToken: string;
  isFriend: boolean;
};

export type UpdateFriendshipStatusResult = {
  action: "ALREADY_FRIEND" | "REQUEST_FRIENDSHIP" | "WAITING_FOR_FOLLOW" | "EXPIRED";
  status: string;
  expiresAt: string;
  fallbackUrl?: string;
};

export type FriendAttributionSessionStatusResult = {
  status: string;
  confirmed: boolean;
  confirmedFollowAt: string | null;
  expiresAt: string;
  fallbackUrl?: string;
  liffId?: string | null;
};

export interface AIRootCauseDiagnosis {
  primaryCause: string;
  contributingFactors: string[];
  evidence: string[];
  category: "WORKLOAD_SURGE" | "RESPONSE_CAPACITY" | "BM_ESCALATION_DELAY" | "PRODUCT_INQUIRY_COMPLEXITY" | "STORE_OPERATION_ISSUE";
}

export interface AIRootCauseInsight {
  id: string;
  storeId: string;
  storeName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  problem: string;
  problemAge: string;
  diagnosis: AIRootCauseDiagnosis;
  confidence: number;
  recommendation: string;
  expectedImpact: string;
  createdAt: string;
}

export interface AIRootCauseSummary {
  summary: string;
  confidence: number;
  totalAffectedStores: number;
  insights: AIRootCauseInsight[];
}

export type ExecutiveStatus = "HEALTHY" | "ATTENTION" | "CRITICAL";

export interface ExecutiveCriticalIssue {
  storeName: string;
  issue: string;
  impact: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface ExecutiveRecommendedDecision {
  action: string;
  owner: string;
  deadline: string;
  expectedImpact: string;
}

export interface ExecutiveDailyBrief {
  date: string;
  overallStatus: ExecutiveStatus;
  headline: string;
  keyHighlights: string[];
  criticalIssues: ExecutiveCriticalIssue[];
  rootCauseSummary: string;
  recommendedDecisions: ExecutiveRecommendedDecision[];
  metrics: {
    totalMessages: number;
    slaRate: number;
    pending: number;
    riskStores: number;
  };
  generatedAt: string;
}

export type BIQueryIntent =
  | "sla_analysis"
  | "root_cause"
  | "store_risk"
  | "bm_performance"
  | "customer_demand"
  | "operation_recommendation";

export interface BIEvidenceItem {
  metric: string;
  value: string;
  explanation: string;
}

export interface BIAnswer {
  question: string;
  intent: BIQueryIntent;
  summary: string;
  evidence: BIEvidenceItem[];
  affectedStores: string[];
  recommendation: string;
  confidence: number;
  generatedAt: string;
}

export type ActionType =
  | "NOTIFY_BM"
  | "ASSIGN_SUPPORT"
  | "ESCALATE_MANAGER"
  | "CREATE_TASK"
  | "FOLLOW_UP";

export type ActionStatus = "PENDING_APPROVAL" | "APPROVED" | "EXECUTING" | "COMPLETED";

export interface OperationalActionTask {
  id: string;
  storeId: string;
  storeName: string;
  problem: string;
  rootCause: string;
  actionType: ActionType;
  recommendedAction: string;
  owner: string;
  deadline: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  status: ActionStatus;
  expectedImpact: string;
  createdAt: string;
}

export interface ActionImpactResultDto {
  id: string;
  taskId: string;
  storeId: string;
  storeName: string;
  actionTitle: string;
  beforeMetrics: {
    slaRate: number;
    pendingCount: number;
    responseTimeMinutes: number;
  };
  afterMetrics: {
    slaRate: number;
    pendingCount: number;
    responseTimeMinutes: number;
  };
  impactScore: number;
  effectiveness: "SUCCESS" | "PARTIAL" | "FAILED";
  improvementSummary: string;
  learnedPattern: string;
  evaluatedAt: string;
}

export interface ImpactSummary {
  totalEvaluated: number;
  successRatePct: number;
  avgSlaRecoveryPct: number;
  topSuccessfulActions: ActionImpactResultDto[];
  learnedPatterns: string[];
}

export interface OperationalMemoryCaseDto {
  id: string;
  storeId: string;
  storeName: string;
  problemPattern: string;
  rootCauseCategory: string;
  successfulAction: string;
  confidence: number;
  timesApplied: number;
  avgSlaLiftPct: number;
  lastAppliedAt: string;
}

export interface OperationalMemorySummary {
  totalStoredCases: number;
  avgConfidencePct: number;
  topSlaLiftCase: string;
  cases: OperationalMemoryCaseDto[];
}

export type AggregatedCorrectionPattern = {
  phrase: string;
  predictedModel: string;
  correctedModel: string;
  correctionCount: number;
  affectedConversations: string[];
  firstSeen: string;
  lastSeen: string;
  sampleTexts: string[];
  storeNames?: string[];
  detectionMethods?: string[];
};

export type AliasPreparedPayload = {
  model: string;
  alias: string;
  language: string;
  safety: "SAFE_EXACT";
};

export type AliasRecommendationStatus = "SUGGESTED" | "APPROVED" | "REJECTED";

export type AliasRecommendation = {
  phrase: string;
  recommendedModel: string;
  corrections: number;
  totalPhraseCorrections: number;
  dominancePct: number;
  collisionRisk: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  riskReason?: string;
  recommendation: "ADD_ALIAS" | "REVIEW" | "IGNORE";
  status: AliasRecommendationStatus;
  statusReason: string;
  firstSeen: string;
  lastSeen: string;
  affectedConversationsCount: number;
  sampleTexts?: string[];
  preparedPayload?: AliasPreparedPayload;
};

export type ProductCorrectionInsightResponse = {
  generatedAt: string;
  totalManualCorrections: number;
  uniqueCorrectedConversations: number;
  mostCorrectedProducts: Array<{ productModel: string; corrections: number }>;
  mostProblematicPredictedProducts: Array<{ productModel: string; corrections: number }>;
  mostProblematicPhrases: Array<{ phrase: string; corrections: number; topCorrectedModel: string }>;
  correctionPatterns: AggregatedCorrectionPattern[];
  aliasRecommendations: AliasRecommendation[];
  dataSufficiency: {
    hasSufficientData: boolean;
    currentSamples: number;
    minimumRequired: number;
    message: string;
  };
};

export type ApproveAliasResponse = {
  success: boolean;
  phrase: string;
  model: string;
  status: "APPROVED";
  normalizedAlias: string;
  affectedConversationsCount: number;
};

export type RejectAliasResponse = {
  success: boolean;
  phrase: string;
  model: string;
  status: "REJECTED";
  reason: string;
};

export type TargetedReanalysisResponse = {
  phrase: string;
  scanned: number;
  changed: number;
  unchanged: number;
  manualProtected: number;
  failed: number;
};

export type ModelAccuracyDetail = {
  productModel: string;
  ruleTagged: number;
  manualTagged: number;
  manualConfirmations: number;
  manualCorrections: number;
  correctionRate: number | null;
  estimatedAccuracy: number | null;
  primaryDetectionMethod: string | null;
  topProblematicPhrases: string[];
};

export type NetworkAccuracyReport = {
  generatedAt: string;
  totalConversations: number;
  conversationsWithProductSignals: number;
  ruleClassificationsCount: number;
  manualClassificationsCount: number;
  unclassifiedCount: number;
  manualCorrectionsCount: number;
  overallCorrectionRate: number | null;
  hasSufficientData: boolean;
  sufficiencyMessage: string;
  perModel: ModelAccuracyDetail[];
  flaggedModels: ModelAccuracyDetail[];
  topProblematicPhrases: Array<{ phrase: string; predictedModel: string; correctedModel: string; count: number }>;
};

export type ProductReviewReason =
  | "UNCLASSIFIED"
  | "AMBIGUOUS"
  | "LOW_CONFIDENCE"
  | "SERIES_ONLY"
  | "RECENTLY_CORRECTED"
  | "GOOD";

export type ProductReviewPriority = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

export type PredictedProductDetail = {
  productModelId: string;
  productModelName: string;
  confidence: number | null;
  source: string;
  detectionMethod: string | null;
  matchedPhrase: string | null;
};

export type ProductReviewQueueItem = {
  conversationId: string;
  customerName: string;
  storeId: string;
  storeName: string;
  latestInboundText: string;
  predictedProducts: PredictedProductDetail[];
  reviewReason: ProductReviewReason;
  reviewPriority: ProductReviewPriority;
  createdAt: string;
  latestMessageAt: string | null;
};

export type ProductReviewQueueSummary = {
  totalNeedsReview: number;
  unclassified: number;
  lowConfidence: number;
  ambiguous: number;
  seriesOnly: number;
  recentlyCorrected: number;
  good: number;
  reviewedTotal: number;
  confirmedCount: number;
  correctedCount: number;
  noProductCount: number;
  observedAccuracyPct: number | null;
  hasSufficientData: boolean;
};

export type ProductReviewQueueResponse = {
  summary: ProductReviewQueueSummary;
  items: ProductReviewQueueItem[];
  page: number;
  pageSize: number;
  total: number;
};

// ==========================================
// MASS MESSAGE TYPES
// ==========================================

export type MassMessageAudienceType =
  | "ALL_KNOWN"
  | "NOT_REPLIED"
  | "NOTIFIED_BM"
  | "REPLIED"
  | "SELECTED_USERS";

export type MassMessageStoreMode = "SINGLE" | "MULTIPLE" | "ALL";

export type MassMessageCampaignStatus =
  | "DRAFT"
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export type MassMessageStoreDeliveryStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "PARTIAL"
  | "FAILED"
  | "SKIPPED";

export type MassMessagePreviewInput = {
  storeSelection: {
    mode: MassMessageStoreMode;
    storeIds?: string[];
  };
  audienceType?: MassMessageAudienceType;
};

export type StorePreviewResult = {
  storeId: string;
  masterStoreId?: string | null;
  externalStoreId?: string | null;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  recipientCount: number;
  status: "READY" | "SKIPPED";
  skipReason: string | null;
};

export type MassMessagePreviewResult = {
  storeCount: number;
  eligibleStoreCount: number;
  skippedStoreCount: number;
  estimatedRecipientCount: number;
  stores: StorePreviewResult[];
};

export type MassMessageTextMessageItem = {
  type: "text";
  text: string;
};

export type MassMessageImageMessageItem = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

export type MassMessageItem =
  | MassMessageTextMessageItem
  | MassMessageImageMessageItem;

export type MassMessageUploadImageResult = {
  url: string;
  previewUrl: string;
  mimeType: string;
  fileSize: number;
};

export type MassMessageCreateInput = {
  campaignRequestId: string;
  title?: string;
  storeSelection: {
    mode: MassMessageStoreMode;
    storeIds?: string[];
  };
  audienceType?: MassMessageAudienceType;
  messages: Array<MassMessageItem>;
};

export type StoreDeliveryDetail = {
  id: string;
  storeId: string;
  masterStoreId?: string | null;
  externalStoreId?: string | null;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  status: MassMessageStoreDeliveryStatus;
  recipientCount: number;
  processedCount: number;
  successCount: number;
  acceptedCount: number;
  failedCount: number;
  failedRequestCount: number;
  skipReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type MassMessageCampaignDetail = {
  id: string;
  campaignRequestId: string;
  title: string | null;
  audienceType: MassMessageAudienceType;
  storeMode: MassMessageStoreMode;
  selectedStoreIds: string[];
  status: MassMessageCampaignStatus;
  createdById: string | null;
  createdByName: string | null;
  storeCount: number;
  eligibleStoreCount: number;
  skippedStoreCount: number;
  estimatedRecipientCount: number;
  processedRecipientCount: number;
  successRecipientCount: number;
  acceptedRecipientCount: number;
  failedRecipientCount: number;
  failedRequestRecipientCount: number;
  messagePayload: { messages: Array<Record<string, unknown>> };
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  duplicate?: boolean;
  storeDeliveries?: StoreDeliveryDetail[];
};

export type StoreMasterSyncResult = {
  source: { type: string; sheetName: string; fetchedAt: string; rows: number };
  validation: {
    total: number;
    complete: number;
    incomplete: number;
    missingStoreId: number;
    invalidManagerUrls: number;
    duplicateAccountNames: number;
    duplicateLineIds: number;
    duplicateExternalStoreIds: number;
    missingProvince?: number;
    missingRegion?: number;
    missingTikTokUsernames?: number;
    duplicateTikTokUsernames?: number;
    invalidTikTokProfileUrls?: number;
    mismatchedTikTokUsernames?: number;
    missingGoogleMapsUrls: number;
    invalidGoogleMapsUrls: number;
  };
  import: {
    validation: {
      total: number;
      complete?: number;
      incomplete?: number;
      missingStoreId?: number;
      invalidManagerUrls?: number;
      duplicateAccountNames?: number;
      duplicateLineIds?: number;
      duplicateExternalStoreIds?: number;
      invalidGoogleMapsUrls?: number;
      missingGoogleMapsUrls?: number;
    };
    failed: number;
  };
  connectedOaSync: { processed: number; updated: number; unchanged: number; missingStoreMaster: number; failed: number };
};
