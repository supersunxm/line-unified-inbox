-- AlterTable
ALTER TABLE "Message" ADD COLUMN "encryptedLineReplyToken" TEXT,
ADD COLUMN "lineReplyTokenReceivedAt" TIMESTAMP(3),
ADD COLUMN "lineReplyTokenUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Message_conversationId_lineReplyTokenUsedAt_lineReplyTokenRec_idx" ON "Message"("conversationId", "lineReplyTokenUsedAt", "lineReplyTokenReceivedAt");
