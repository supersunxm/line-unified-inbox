-- Align Google Review audit-session tables with the current Prisma schema.
-- This is additive only and preserves existing audit/KPI data.

ALTER TABLE "GoogleReviewAuditSession"
ADD COLUMN IF NOT EXISTS "qualificationRuleVersion" TEXT NOT NULL DEFAULT 'REVIEW_CREATION_DATE_V1';

ALTER TABLE "GoogleReviewAuditStore"
ADD COLUMN IF NOT EXISTS "photoReviewsInTargetMonth" INTEGER NOT NULL DEFAULT 0;
