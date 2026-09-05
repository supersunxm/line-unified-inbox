-- Align Google Review monthly KPI result table with the current Prisma schema.
-- Additive only; preserves existing monthly KPI data.

ALTER TABLE "GoogleReviewKpiResult"
ADD COLUMN IF NOT EXISTS "photoReviewsInTargetMonth" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GoogleReviewKpiResult"
ADD COLUMN IF NOT EXISTS "qualificationRuleVersion" TEXT NOT NULL DEFAULT 'REVIEW_CREATION_DATE_V1';
