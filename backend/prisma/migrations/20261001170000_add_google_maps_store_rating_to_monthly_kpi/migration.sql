-- Add Google Maps current store rating fields to GoogleReviewKpiResult monthly snapshot
-- Non-breaking additive columns; preserves all existing monthly review KPI data

ALTER TABLE "GoogleReviewKpiResult"
ADD COLUMN IF NOT EXISTS "googleRating" DOUBLE PRECISION;

ALTER TABLE "GoogleReviewKpiResult"
ADD COLUMN IF NOT EXISTS "googleReviewCount" INTEGER;

ALTER TABLE "GoogleReviewKpiResult"
ADD COLUMN IF NOT EXISTS "googleRatingCheckedAt" TIMESTAMP(3);
