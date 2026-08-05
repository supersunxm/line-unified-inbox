CREATE TYPE "BmReplyStatus" AS ENUM ('NOT_REPLIED', 'NOTIFIED_BM', 'REPLIED');

ALTER TYPE "ActivityActionType" ADD VALUE 'BM_REPLY_STATUS_CHANGED';

ALTER TABLE "Conversation"
ADD COLUMN "bmReplyStatus" "BmReplyStatus" NOT NULL DEFAULT 'NOT_REPLIED';

ALTER TABLE "ActivityHistory"
ADD COLUMN "previousBmReplyStatus" "BmReplyStatus",
ADD COLUMN "newBmReplyStatus" "BmReplyStatus";

-- CreateIndex
CREATE INDEX "Conversation_lineOfficialAccountId_bmReplyStatus_latestMessageAt_idx" ON "Conversation"("lineOfficialAccountId", "bmReplyStatus", "latestMessageAt" DESC);
