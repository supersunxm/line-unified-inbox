import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, Matches } from "class-validator";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const STORE_INSIGHTS_EXPORT_MAX_STORES = 10;

export const STORE_INSIGHTS_RESPONSE_SEGMENTS = ["all", "within-15m", "within-1h", "within-24h", "after-24h", "unanswered"] as const;
export type StoreInsightsResponseSegment = typeof STORE_INSIGHTS_RESPONSE_SEGMENTS[number];

export const STORE_INSIGHTS_RESPONSE_SORTS = ["date-desc", "date-asc", "response-time-desc", "response-time-asc"] as const;
export type StoreInsightsResponseSort = typeof STORE_INSIGHTS_RESPONSE_SORTS[number];

export const STORE_INSIGHTS_CUSTOMER_VOICE_DIMENSIONS = ["topic", "intent", "product"] as const;
export type StoreInsightsCustomerVoiceDimension = typeof STORE_INSIGHTS_CUSTOMER_VOICE_DIMENSIONS[number];

export const STORE_INSIGHTS_CUSTOMER_VOICE_SORTS = ["date-desc", "date-asc"] as const;
export type StoreInsightsCustomerVoiceSort = typeof STORE_INSIGHTS_CUSTOMER_VOICE_SORTS[number];

export class StoreInsightsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  to?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  compareFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  compareTo?: string;

  @IsOptional()
  @IsIn(["REPLIED", "UNANSWERED"])
  responseStatus?: "REPLIED" | "UNANSWERED";

  @IsOptional()
  @IsString()
  responderId?: string;

  @IsOptional()
  @IsString()
  customerVoiceTopic?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value))
  @IsIn([true, false])
  salesTagged?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class StoreInsightsResponseCasesQueryDto extends StoreInsightsQueryDto {
  @IsOptional()
  @IsIn([...STORE_INSIGHTS_RESPONSE_SEGMENTS])
  segment?: StoreInsightsResponseSegment;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([...STORE_INSIGHTS_RESPONSE_SORTS])
  sort?: StoreInsightsResponseSort;
}

export class StoreInsightsCustomerVoiceDrilldownQueryDto extends StoreInsightsQueryDto {
  @IsOptional()
  @IsIn([...STORE_INSIGHTS_CUSTOMER_VOICE_DIMENSIONS])
  dimension?: StoreInsightsCustomerVoiceDimension;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([...STORE_INSIGHTS_CUSTOMER_VOICE_SORTS])
  sort?: StoreInsightsCustomerVoiceSort;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value))
  @IsIn([true, false])
  unclassified?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value))
  @IsIn([true, false])
  notAnalyzed?: boolean;
}

export class StoreInsightsExportDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(STORE_INSIGHTS_EXPORT_MAX_STORES)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  storeIds!: string[];

  @IsString()
  @Matches(ISO_DATE_PATTERN)
  startDate!: string;

  @IsString()
  @Matches(ISO_DATE_PATTERN)
  endDate!: string;

  @IsOptional()
  @IsIn(["Asia/Bangkok"])
  timezone?: string;
}

export type StoreInsightsPeriod = {
  from: string;
  to: string;
  timezone: "Asia/Bangkok";
};

export type StoreInsightsStore = {
  id: string;
  name: string;
  code: string | null;
  externalStoreId: string | null;
  province: string | null;
  region: string | null;
  lineOas: Array<{
    id: string;
    name: string;
    basicId: string | null;
    connectionStatus: string;
    lastWebhookReceivedAt: string | null;
  }>;
};

export type StoreInsightsFollowers = {
  current: number | null;
  growth: number | null;
  historicalAvailable: boolean;
  snapshotCoverage: "available" | "partial" | "unavailable";
};

export type StoreInsightsResponseMetric = {
  count: number;
  percentage: number | null;
};

export type StoreInsightsDailyTrendPoint = {
  date: string;
  customers: number;
  salesTaggedCustomers: number;
  replyRate: number | null;
};

export type StoreInsightsResponsePerformance = {
  totalConversations: number;
  repliedWithin15Minutes: StoreInsightsResponseMetric;
  repliedWithin1Hour: StoreInsightsResponseMetric;
  repliedWithin24Hours: StoreInsightsResponseMetric;
  unanswered: StoreInsightsResponseMetric;
  medianFirstResponseSeconds: number | null;
  volumeByHour: number[];
  dailyTrend: StoreInsightsDailyTrendPoint[];
  totalInboundMessages: number;
  available: boolean;
  dataQuality: {
    ambiguousOutboundCount: number;
    automatedOutboundCount: number;
  };
};

export type StoreInsightsResponder = {
  id: string;
  displayName: string;
  conversationsHandled: number;
  repliedWithin24HoursPercentage: number | null;
  medianResponseSeconds: number | null;
  followUpCount: number | null;
  salesTaggedCount: number | null;
};

export type StoreInsightsSales = {
  totalCustomers: number;
  salesTaggedCustomers: number;
  salesTaggedCustomerPercentage: number | null;
  totalConversations: number;
  salesTaggedConversations: number;
  productModels: Array<{ name: string; count: number }>;
  paymentMethods: Array<{ name: string; count: number }>;
  missingSalesInformation: number;
};

export type StoreInsightsConversation = {
  id: string;
  customer: { id: string; displayName: string };
  topic: string | null;
  responseStatus: "REPLIED" | "UNANSWERED";
  responder: { id: string; displayName: string } | null;
  firstResponseSeconds: number | null;
  salesProduct: string | null;
  salesTagged: boolean;
  lastActivity: string;
};

export type StoreInsightsResponseCase = StoreInsightsConversation & {
  firstInboundAt: string;
  firstResponseAt: string | null;
  responseBand: Exclude<StoreInsightsResponseSegment, "all">;
};

export type StoreInsightsResponseCasesSummary = {
  totalCases: number;
  repliedWithin15Minutes: StoreInsightsResponseMetric;
  repliedWithin1Hour: StoreInsightsResponseMetric;
  repliedWithin24Hours: StoreInsightsResponseMetric;
  after24Hours: StoreInsightsResponseMetric;
  unanswered: StoreInsightsResponseMetric;
  medianFirstResponseSeconds: number | null;
  available: boolean;
  dataQuality: {
    ambiguousOutboundCount: number;
    automatedOutboundCount: number;
  };
};

export type StoreInsightsResponseCasesResponse = {
  storeId: string;
  store: StoreInsightsStore;
  period: StoreInsightsPeriod;
  summary: StoreInsightsResponseCasesSummary;
  items: StoreInsightsResponseCase[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  responders: StoreInsightsResponder[];
};

export type StoreInsightsCustomerVoiceDistributionItem = {
  label: string;
  count: number;
  percentage: number;
};

export type StoreInsightsCustomerVoiceEvidence = {
  id: string;
  customer: { displayName: string };
  topics: string[];
  intent: string | null;
  products: string[];
  salesTagged: boolean;
  responseStatus: "REPLIED" | "UNANSWERED";
  responder: { displayName: string } | null;
  firstInboundAt: string | null;
  lastActivity: string;
  source: string | null;
  analysisVersion: string | null;
  classified: boolean;
};

export type StoreInsightsCustomerVoiceDrilldownResponse = {
  storeId: string;
  store: StoreInsightsStore;
  period: StoreInsightsPeriod;
  analysisVersion: string;
  dimension: StoreInsightsCustomerVoiceDimension;
  value: string | null;
  coverage: {
    totalConversations: number;
    analysisRows: number;
    analyzedConversations: number;
    classifiedConversations: number;
    unclassifiedConversations: number;
    notAnalyzedConversations: number;
    persistedTopicConversations: number;
    ruleEnrichedConversations: number;
    aiEnrichedConversations: number;
    lowConfidenceConversations: number;
    analyzedPercentage: number | null;
    classifiedPercentage: number | null;
  };
  distribution: StoreInsightsCustomerVoiceDistributionItem[];
  items: StoreInsightsCustomerVoiceEvidence[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
};
