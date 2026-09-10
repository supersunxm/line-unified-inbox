import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min, Matches } from "class-validator";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export type StoreInsightsResponsePerformance = {
  totalConversations: number;
  repliedWithin15Minutes: StoreInsightsResponseMetric;
  repliedWithin1Hour: StoreInsightsResponseMetric;
  repliedWithin24Hours: StoreInsightsResponseMetric;
  unanswered: StoreInsightsResponseMetric;
  medianFirstResponseSeconds: number | null;
  volumeByHour: number[];
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
