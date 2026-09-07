-- Public TikTok analytics is intentionally separate from OAuth-backed TikTokAccount tables.
-- Only exact public profile metrics (statsV2) should be persisted by the application layer.

CREATE TABLE "TikTokPublicProfile" (
    "id" TEXT NOT NULL,
    "storeMasterId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bioDescription" TEXT,
    "isVerified" BOOLEAN,
    "followerCount" INTEGER NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "likesCount" INTEGER NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "metricSource" TEXT NOT NULL,
    "metricPrecision" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokPublicProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TikTokPublicProfile_metricPrecision_check" CHECK ("metricPrecision" = 'EXACT'),
    CONSTRAINT "TikTokPublicProfile_metricSource_check" CHECK ("metricSource" = 'statsV2'),
    CONSTRAINT "TikTokPublicProfile_nonnegative_counts_check" CHECK (
      "followerCount" >= 0 AND "followingCount" >= 0 AND "likesCount" >= 0 AND "videoCount" >= 0
    )
);

CREATE TABLE "TikTokPublicDailyMetric" (
    "id" TEXT NOT NULL,
    "storeMasterId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "likesCount" INTEGER NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "metricSource" TEXT NOT NULL,
    "metricPrecision" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokPublicDailyMetric_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TikTokPublicDailyMetric_metricPrecision_check" CHECK ("metricPrecision" = 'EXACT'),
    CONSTRAINT "TikTokPublicDailyMetric_metricSource_check" CHECK ("metricSource" = 'statsV2'),
    CONSTRAINT "TikTokPublicDailyMetric_nonnegative_counts_check" CHECK (
      "followerCount" >= 0 AND "followingCount" >= 0 AND "likesCount" >= 0 AND "videoCount" >= 0
    )
);

CREATE UNIQUE INDEX "TikTokPublicProfile_storeMasterId_key"
ON "TikTokPublicProfile"("storeMasterId");

CREATE INDEX "TikTokPublicProfile_username_idx"
ON "TikTokPublicProfile"("username");

CREATE INDEX "TikTokPublicProfile_lastFetchedAt_idx"
ON "TikTokPublicProfile"("lastFetchedAt");

CREATE UNIQUE INDEX "TikTokPublicDailyMetric_storeMasterId_metricDate_key"
ON "TikTokPublicDailyMetric"("storeMasterId", "metricDate");

CREATE INDEX "TikTokPublicDailyMetric_metricDate_idx"
ON "TikTokPublicDailyMetric"("metricDate");

CREATE INDEX "TikTokPublicDailyMetric_storeMasterId_idx"
ON "TikTokPublicDailyMetric"("storeMasterId");

ALTER TABLE "TikTokPublicProfile"
ADD CONSTRAINT "TikTokPublicProfile_storeMasterId_fkey"
FOREIGN KEY ("storeMasterId") REFERENCES "StoreMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TikTokPublicDailyMetric"
ADD CONSTRAINT "TikTokPublicDailyMetric_storeMasterId_fkey"
FOREIGN KEY ("storeMasterId") REFERENCES "StoreMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
