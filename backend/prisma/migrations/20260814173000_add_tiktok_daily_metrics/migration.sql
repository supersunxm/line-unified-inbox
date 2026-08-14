-- CreateTable
CREATE TABLE "TikTokAccountDailyMetric" (
    "id" TEXT NOT NULL,
    "tikTokAccountId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAccountDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TikTokAccountDailyMetric_tikTokAccountId_metricDate_key" ON "TikTokAccountDailyMetric"("tikTokAccountId", "metricDate");

-- CreateIndex
CREATE INDEX "TikTokAccountDailyMetric_tikTokAccountId_idx" ON "TikTokAccountDailyMetric"("tikTokAccountId");

-- CreateIndex
CREATE INDEX "TikTokAccountDailyMetric_metricDate_idx" ON "TikTokAccountDailyMetric"("metricDate");

-- AddForeignKey
ALTER TABLE "TikTokAccountDailyMetric" ADD CONSTRAINT "TikTokAccountDailyMetric_tikTokAccountId_fkey" FOREIGN KEY ("tikTokAccountId") REFERENCES "TikTokAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
