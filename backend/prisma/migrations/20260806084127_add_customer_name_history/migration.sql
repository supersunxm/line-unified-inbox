-- CreateTable
CREATE TABLE "CustomerNameHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerNameHistory_customerId_capturedAt_idx" ON "CustomerNameHistory"("customerId", "capturedAt");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Conversation_storeId_createdAt_idx" ON "Conversation"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_storeId_bmReplyStatus_idx" ON "Conversation"("storeId", "bmReplyStatus");

-- CreateIndex
CREATE INDEX "Conversation_bmReplyStatus_createdAt_idx" ON "Conversation"("bmReplyStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Store_isActive_archivedAt_idx" ON "Store"("isActive", "archivedAt");

-- CreateIndex
CREATE INDEX "Store_region_idx" ON "Store"("region");

-- AddForeignKey
ALTER TABLE "CustomerNameHistory" ADD CONSTRAINT "CustomerNameHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Conversation_lineOfficialAccountId_bmReplyStatus_latestMessageA" RENAME TO "Conversation_lineOfficialAccountId_bmReplyStatus_latestMess_idx";

-- RenameIndex
ALTER INDEX "FriendAttributionUnmatchedFollow_lineOaId_lineUserIdHash_consum" RENAME TO "FriendAttributionUnmatchedFollow_lineOaId_lineUserIdHash_co_idx";

-- RenameIndex
ALTER INDEX "MessageTranslationFeedback_messageId_targetLanguage_adminUserId" RENAME TO "MessageTranslationFeedback_messageId_targetLanguage_adminUs_key";
