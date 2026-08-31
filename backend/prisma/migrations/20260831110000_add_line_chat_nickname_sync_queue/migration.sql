-- CreateEnum
CREATE TYPE "LineChatNicknameSyncJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'FAILED_AUTH', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "LineChatSessionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'AUTH_REQUIRED');

-- CreateTable
CREATE TABLE "LineChatSession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profilePath" TEXT NOT NULL,
    "status" "LineChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastAuthenticatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineChatNicknameSyncJob" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "status" "LineChatNicknameSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineChatNicknameSyncJob_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LineOfficialAccount" ADD COLUMN "chatBotId" TEXT;
ALTER TABLE "LineOfficialAccount" ADD COLUMN "lineChatSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LineChatSession_sessionKey_key" ON "LineChatSession"("sessionKey");
CREATE INDEX "LineChatSession_status_idx" ON "LineChatSession"("status");

-- CreateIndex
CREATE INDEX "LineOfficialAccount_lineChatSessionId_idx" ON "LineOfficialAccount"("lineChatSessionId");

-- CreateIndex
CREATE INDEX "LineChatNicknameSyncJob_status_scheduledAt_idx" ON "LineChatNicknameSyncJob"("status", "scheduledAt");
CREATE INDEX "LineChatNicknameSyncJob_conversationId_status_idx" ON "LineChatNicknameSyncJob"("conversationId", "status");
CREATE INDEX "LineChatNicknameSyncJob_lineOfficialAccountId_status_idx" ON "LineChatNicknameSyncJob"("lineOfficialAccountId", "status");
CREATE INDEX "LineChatNicknameSyncJob_createdAt_idx" ON "LineChatNicknameSyncJob"("createdAt");

-- AddForeignKey
ALTER TABLE "LineOfficialAccount" ADD CONSTRAINT "LineOfficialAccount_lineChatSessionId_fkey" FOREIGN KEY ("lineChatSessionId") REFERENCES "LineChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineChatNicknameSyncJob" ADD CONSTRAINT "LineChatNicknameSyncJob_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineChatNicknameSyncJob" ADD CONSTRAINT "LineChatNicknameSyncJob_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
