ALTER TYPE "MassMessageAudienceType" ADD VALUE IF NOT EXISTS 'ALL_FRIENDS';
ALTER TYPE "MassMessageAudienceType" ADD VALUE IF NOT EXISTS 'FRIENDSHIP_PERIOD';

ALTER TABLE "MassMessageCampaign"
ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX "MassMessageCampaign_status_scheduledAt_idx"
ON "MassMessageCampaign"("status", "scheduledAt");
