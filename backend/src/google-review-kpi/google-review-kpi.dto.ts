import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
    reviewsOver15ThaiWords: number;
    qualifiedReviews: number;
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
