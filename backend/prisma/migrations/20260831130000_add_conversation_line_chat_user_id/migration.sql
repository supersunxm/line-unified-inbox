-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lineChatUserId" TEXT;

-- AlterTable
ALTER TABLE "LineChatNicknameSyncJob" ADD COLUMN IF NOT EXISTS "lineChatUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conversation_lineChatUserId_idx" ON "Conversation"("lineChatUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LineChatNicknameSyncJob_lineChatUserId_idx" ON "LineChatNicknameSyncJob"("lineChatUserId");
