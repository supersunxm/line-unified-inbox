CREATE TYPE "GoogleReviewAuditCompletionReason" AS ENUM ('MONTHLY_STOP_BOUNDARY_REACHED', 'END_OF_REVIEW_FEED');

ALTER TABLE "GoogleReviewAuditStore" ADD COLUMN "completionReason" "GoogleReviewAuditCompletionReason";
