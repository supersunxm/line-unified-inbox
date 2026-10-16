-- Add schema fields required by the Google Review monthly batch orchestration.
-- Additive only; existing Store Master and audit data are preserved.

-- CreateEnum
CREATE TYPE "GoogleReviewAuditCompletionReason" AS ENUM (
  'MONTHLY_STOP_BOUNDARY_REACHED',
  'END_OF_REVIEW_FEED'
);

-- AlterTable
ALTER TABLE "StoreMaster"
ADD COLUMN "googleMapsName" TEXT;

-- AlterTable
ALTER TABLE "GoogleReviewAuditStore"
ADD COLUMN "completionReason" "GoogleReviewAuditCompletionReason";
