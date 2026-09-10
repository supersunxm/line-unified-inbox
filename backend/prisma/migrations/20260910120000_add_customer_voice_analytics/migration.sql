-- Customer Voice keeps versioned, read-only analysis separate from Conversation.
CREATE TYPE "CustomerVoiceAnalysisSource" AS ENUM ('EXISTING_TOPIC', 'RULE_ENRICHED', 'AI_CLASSIFIED', 'MIXED_ENRICHED', 'UNCLASSIFIED');

CREATE TYPE "CustomerVoiceIntent" AS ENUM ('INFORMATION', 'PRICE_CHECK', 'PRODUCT_COMPARISON', 'PURCHASE_CONSIDERATION', 'READY_TO_BUY', 'STOCK_CHECK', 'PAYMENT_INQUIRY', 'AFTER_SALES', 'COMPLAINT', 'GENERAL');

CREATE TABLE "ConversationAnalytics" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "analysisVersion" TEXT NOT NULL,
    "source" "CustomerVoiceAnalysisSource" NOT NULL,
    "primaryTopic" TEXT,
    "secondaryTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "intent" "CustomerVoiceIntent",
    "productMentions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rawProductMentions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "inputMessageCount" INTEGER NOT NULL DEFAULT 0,
    "lastAnalyzedMessageAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationAnalytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationAnalytics_conversationId_analysisVersion_key" ON "ConversationAnalytics"("conversationId", "analysisVersion");
CREATE INDEX "ConversationAnalytics_storeId_analysisVersion_processedAt_idx" ON "ConversationAnalytics"("storeId", "analysisVersion", "processedAt");
CREATE INDEX "ConversationAnalytics_storeId_primaryTopic_idx" ON "ConversationAnalytics"("storeId", "primaryTopic");
CREATE INDEX "ConversationAnalytics_storeId_intent_idx" ON "ConversationAnalytics"("storeId", "intent");

ALTER TABLE "ConversationAnalytics" ADD CONSTRAINT "ConversationAnalytics_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationAnalytics" ADD CONSTRAINT "ConversationAnalytics_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
