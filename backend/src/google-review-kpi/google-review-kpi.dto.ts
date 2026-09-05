import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CheckGoogleReviewKpiResultDto {
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @IsString()
  @Matches(MONTH_REGEX, { message: "month must be in YYYY-MM format (e.g. 2026-08)" })
  month!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsChecked!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsWithPhoto!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  photoReviewsInTargetMonth?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsOver15ThaiWords!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  qualifiedReviews!: number;

  @IsOptional()
  @IsString()
  qualificationRuleVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  targetQualifiedReviews?: number;

  @IsOptional()
  @IsString()
  googleMapsReviewUrl?: string;
}

export class QueryGoogleReviewKpiDto {
  @IsOptional()
  @IsString()
  @Matches(MONTH_REGEX, { message: "month must be in YYYY-MM format (e.g. 2026-08)" })
  month?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  region?: string;
}

export class StartMonthlyAuditDto {
  @IsString()
  @Matches(MONTH_REGEX, { message: "month must be in YYYY-MM format (e.g. 2026-08)" })
  month!: string;

  @IsOptional()
  @IsIn(["SELECTED", "ALL_ELIGIBLE"])
  scope?: "SELECTED" | "ALL_ELIGIBLE";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  storeIds?: string[];

  @IsOptional()
  @IsString()
  qualificationRuleVersion?: string;
}

export class CompleteStoreAuditDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsChecked!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsWithPhoto!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  photoReviewsInTargetMonth?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsOver15ThaiWords!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  qualifiedReviews!: number;

  @IsOptional()
  @IsString()
  qualificationRuleVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  targetQualifiedReviews?: number;

  @IsOptional()
  @IsString()
  coverageStatus?: "OLDER_THAN_TARGET_REACHED" | "END_OF_AVAILABLE_REVIEWS";

  @IsOptional()
  @IsString()
  auditCoverageStatus?: "OLDER_THAN_TARGET_REACHED" | "END_OF_AVAILABLE_REVIEWS";

  @IsOptional()
  @IsString()
  oldestReviewDateText?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FailStoreAuditDto {
  @IsString()
  @IsNotEmpty()
  errorCode!: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class UpdateAuditSessionStatusDto {
  @IsString()
  @IsNotEmpty()
  action!: "PAUSE" | "RESUME" | "CANCEL";
}

export type GoogleReviewAuditQueueStoreItem = {
  id: string;
  sessionId: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  region: string | null;
  googleMapsUrl: string | null;
  queueOrder: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "NEEDS_ATTENTION" | "SKIPPED" | "FAILED";
  reviewsChecked: number;
  reviewsWithPhoto: number;
  photoReviewsInTargetMonth: number;
  reviewsOver15ThaiWords: number;
  qualifiedReviews: number;
  coverageStatus: string | null;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type GoogleReviewAuditSessionResponse = {
  id: string;
  month: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  qualificationRuleVersion: string;
  totalStores: number;
  completedStores: number;
  failedStores: number;
  skippedStores: number;
  pendingStores: number;
  runningStores: number;
  needsAttentionStores: number;
  missingMapsUrlCount: number;
  startedAt: string;
  completedAt: string | null;
  currentStore: GoogleReviewAuditQueueStoreItem | null;
  stores: GoogleReviewAuditQueueStoreItem[];
};

export type GoogleReviewKpiStoreItem = {
  id: string;
  storeId: string | null;
  name: string;
  code: string | null;
  region: string | null;
  province: string | null;
  googleMapsUrl: string | null;
  hasGoogleMaps: boolean;
  kpiResult: {
    id: string;
    month: string;
    reviewsChecked: number;
    reviewsWithPhoto: number;
    photoReviewsInTargetMonth: number;
    reviewsOver15ThaiWords: number;
    qualifiedReviews: number;
    qualificationRuleVersion: string;
    targetQualifiedReviews: number;
    isPassed: boolean;
    checkedAt: string;
    checkedBy: {
      id: string;
      displayName: string;
      email: string;
    } | null;
  } | null;
};

export type GoogleReviewKpiSummary = {
  month: string;
  totalStores: number;
  storesWithGoogleMaps: number;
  checkedStores: number;
  uncheckedStores: number;
  passedStores: number;
  belowTargetStores: number;
  totalQualifiedReviews: number;
  totalReviewsChecked: number;
  stores: GoogleReviewKpiStoreItem[];
};

export const LOCKED_WEEKLY_KPI_STORE_CODES: readonly string[] = [
  "109", "971", "2997", "3791", "8586", "9009", "18127", "19704", "24365", "24804",
  "25003", "25389", "25391", "25417", "25610", "25635", "26239", "26346", "27626", "27627",
  "27754", "27755", "27789", "27834", "27893", "27894", "27896", "27897", "28122", "28194",
  "28326", "28374", "28375", "28385", "28620", "28649", "28697", "28818", "28882", "29039",
  "29113", "29114", "29159", "29272", "29422", "29496", "29737", "29745", "29858", "29981",
  "30165", "30258", "30282", "30356", "30360", "30413", "30501", "30606", "30678", "31420",
  "31736", "31749", "32564", "32569", "32687",
];

export class RecordDailyKpiDto {
  @IsString()
  @IsNotEmpty()
  storeCode!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be in YYYY-MM-DD format" })
  date!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weekNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5.0)
  storeRating?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsChecked!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsWithPhoto!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  reviewsOver15ThaiWords!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  qualifiedReviews!: number;

  @IsOptional()
  @IsIn(["OPEN", "CLOSED"])
  status?: "OPEN" | "CLOSED";
}

export class AggregateWeeklyKpiDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weekNumber!: number;
}

export class QueryWeeklyLeaderboardDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weekNumber?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5.0)
  minRating?: number;
}

export type GoogleReviewWeeklyStoreItem = {
  id: string;
  storeCode: string;
  storeId: string | null;
  storeName: string;
  region: string | null;
  province: string | null;
  googleMapsUrl: string | null;
  hasGoogleMaps: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type GoogleReviewWeeklyPeriodItem = {
  id: string;
  weekNumber: number;
  labelZh: string;
  labelTh: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  frozenAt: string | null;
};

export type GoogleReviewDailyBreakdownItem = {
  date: string;
  qualifiedReviews: number;
  reviewsChecked: number;
  reviewsWithPhoto: number;
  status: "OPEN" | "CLOSED";
};

export type GoogleReviewWeeklyRankItem = {
  rank: number;
  storeCode: string;
  storeId: string | null;
  storeName: string;
  region: string | null;
  province: string | null;
  googleMapsUrl: string | null;
  storeRating: number | null;
  isRatingEligible: boolean;
  qualifiedReviews: number;
  reviewsChecked: number;
  reviewsWithPhoto: number;
  reviewsOver15ThaiWords: number;
  status: "OPEN" | "CLOSED";
  dailyBreakdown: GoogleReviewDailyBreakdownItem[];
};

export type GoogleReviewWeeklyLeaderboardResponse = {
  weekNumber: number;
  period: GoogleReviewWeeklyPeriodItem;
  totalStores: number;
  eligibleRatingStores: number;
  totalQualifiedReviews: number;
  topStore: GoogleReviewWeeklyRankItem | null;
  stores: GoogleReviewWeeklyRankItem[];
};

export type GoogleReviewWeeklyCollectorStatusResponse = {
  activeWeekNumber: number;
  todayBangkok: string;
  totalStores: number;
  fingerprintsTracked: number;
  lastRunAt: string | null;
  isRunning: boolean;
  status: "IDLE" | "RUNNING" | "COMPLETED" | "ERROR";
  summaryToday: {
    totalQualifiedToday: number;
    newReviewsDiscoveredToday: number;
  };
};

export class TriggerWeeklyCollectorRunDto {
  @IsOptional()
  @IsBoolean()
  forceAllStores?: boolean;

  @IsOptional()
  @IsString({ each: true })
  targetStoreCodes?: string[];
}

