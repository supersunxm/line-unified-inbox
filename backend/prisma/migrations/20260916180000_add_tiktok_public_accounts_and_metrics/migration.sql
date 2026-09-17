-- CreateTable
CREATE TABLE "TikTokPublicAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "profileUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'TOKCOUNTER',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCollectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokPublicAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TikTokPublicAccount_username_key" ON "TikTokPublicAccount"("username");

-- CreateIndex
CREATE INDEX "TikTokPublicAccount_username_idx" ON "TikTokPublicAccount"("username");

-- AlterTable StoreMaster: add tiktokPublicAccountId
ALTER TABLE "StoreMaster" ADD COLUMN "tiktokPublicAccountId" TEXT;

-- CreateIndex
CREATE INDEX "StoreMaster_tiktokPublicAccountId_idx" ON "StoreMaster"("tiktokPublicAccountId");

-- AddForeignKey StoreMaster -> TikTokPublicAccount
ALTER TABLE "StoreMaster" ADD CONSTRAINT "StoreMaster_tiktokPublicAccountId_fkey" FOREIGN KEY ("tiktokPublicAccountId") REFERENCES "TikTokPublicAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old constraints & foreign keys from TikTokPublicDailyMetric
ALTER TABLE "TikTokPublicDailyMetric" DROP CONSTRAINT IF EXISTS "TikTokPublicDailyMetric_storeMasterId_fkey";
ALTER TABLE "TikTokPublicDailyMetric" DROP CONSTRAINT IF EXISTS "TikTokPublicDailyMetric_metricPrecision_check";
ALTER TABLE "TikTokPublicDailyMetric" DROP CONSTRAINT IF EXISTS "TikTokPublicDailyMetric_metricSource_check";
ALTER TABLE "TikTokPublicDailyMetric" DROP CONSTRAINT IF EXISTS "TikTokPublicDailyMetric_nonnegative_counts_check";

DROP INDEX IF EXISTS "TikTokPublicDailyMetric_storeMasterId_metricDate_key";
DROP INDEX IF EXISTS "TikTokPublicDailyMetric_storeMasterId_idx";

-- Empty old test rows if any (there was only 1 test row from Sep 8)
DELETE FROM "TikTokPublicDailyMetric";

-- Modify columns on TikTokPublicDailyMetric
ALTER TABLE "TikTokPublicDailyMetric" DROP COLUMN IF EXISTS "storeMasterId";
ALTER TABLE "TikTokPublicDailyMetric" DROP COLUMN IF EXISTS "metricSource";
ALTER TABLE "TikTokPublicDailyMetric" DROP COLUMN IF EXISTS "metricPrecision";
ALTER TABLE "TikTokPublicDailyMetric" DROP COLUMN IF EXISTS "fetchedAt";

ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "tiktokPublicAccountId" TEXT NOT NULL;
ALTER TABLE "TikTokPublicDailyMetric" ALTER COLUMN "followingCount" DROP NOT NULL;
ALTER TABLE "TikTokPublicDailyMetric" ALTER COLUMN "likesCount" DROP NOT NULL;
ALTER TABLE "TikTokPublicDailyMetric" ALTER COLUMN "videoCount" DROP NOT NULL;
ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "followersRaw" TEXT;
ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "followingRaw" TEXT;
ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "likesRaw" TEXT;
ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "videosRaw" TEXT;
ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "precision" TEXT NOT NULL DEFAULT 'EXACT';
ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'TOKCOUNTER';
ALTER TABLE "TikTokPublicDailyMetric" ADD COLUMN "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex on TikTokPublicDailyMetric
CREATE UNIQUE INDEX "TikTokPublicDailyMetric_tiktokPublicAccountId_metricDate_key" ON "TikTokPublicDailyMetric"("tiktokPublicAccountId", "metricDate");
CREATE INDEX "TikTokPublicDailyMetric_tiktokPublicAccountId_idx" ON "TikTokPublicDailyMetric"("tiktokPublicAccountId");

-- AddForeignKey TikTokPublicDailyMetric -> TikTokPublicAccount
ALTER TABLE "TikTokPublicDailyMetric" ADD CONSTRAINT "TikTokPublicDailyMetric_tiktokPublicAccountId_fkey" FOREIGN KEY ("tiktokPublicAccountId") REFERENCES "TikTokPublicAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
