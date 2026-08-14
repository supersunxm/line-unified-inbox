-- CreateEnum
CREATE TYPE "TikTokConnectionStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "TikTokAccount" (
    "id" TEXT NOT NULL,
    "storeMasterId" TEXT,
    "openId" TEXT NOT NULL,
    "unionId" TEXT,
    "username" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatarUrl100" TEXT,
    "avatarLargeUrl" TEXT,
    "bioDescription" TEXT,
    "profileDeepLink" TEXT,
    "profileWebLink" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "grantedScopes" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "connectionStatus" "TikTokConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokVideo" (
    "id" TEXT NOT NULL,
    "tikTokAccountId" TEXT NOT NULL,
    "tikTokVideoId" TEXT NOT NULL,
    "title" TEXT,
    "videoDescription" TEXT,
    "createTime" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "shareUrl" TEXT,
    "duration" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TikTokAccount_openId_key" ON "TikTokAccount"("openId");

-- CreateIndex
CREATE INDEX "TikTokAccount_storeMasterId_idx" ON "TikTokAccount"("storeMasterId");

-- CreateIndex
CREATE INDEX "TikTokAccount_openId_idx" ON "TikTokAccount"("openId");

-- CreateIndex
CREATE INDEX "TikTokAccount_username_idx" ON "TikTokAccount"("username");

-- CreateIndex
CREATE INDEX "TikTokAccount_connectionStatus_idx" ON "TikTokAccount"("connectionStatus");

-- CreateIndex
CREATE INDEX "TikTokAccount_lastSyncedAt_idx" ON "TikTokAccount"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "TikTokVideo_tikTokAccountId_idx" ON "TikTokVideo"("tikTokAccountId");

-- CreateIndex
CREATE INDEX "TikTokVideo_tikTokVideoId_idx" ON "TikTokVideo"("tikTokVideoId");

-- CreateIndex
CREATE INDEX "TikTokVideo_createTime_idx" ON "TikTokVideo"("createTime");

-- CreateIndex
CREATE INDEX "TikTokVideo_viewCount_idx" ON "TikTokVideo"("viewCount");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokVideo_tikTokAccountId_tikTokVideoId_key" ON "TikTokVideo"("tikTokAccountId", "tikTokVideoId");

-- AddForeignKey
ALTER TABLE "TikTokAccount" ADD CONSTRAINT "TikTokAccount_storeMasterId_fkey" FOREIGN KEY ("storeMasterId") REFERENCES "StoreMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokVideo" ADD CONSTRAINT "TikTokVideo_tikTokAccountId_fkey" FOREIGN KEY ("tikTokAccountId") REFERENCES "TikTokAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
