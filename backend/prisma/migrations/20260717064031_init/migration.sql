-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('FOLLOW_UP', 'REMINDED', 'ACKNOWLEDGED', 'COMPLETED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ProductRelationship" AS ENUM ('INTERESTED', 'CURRENT_OWNER', 'PREVIOUS_OWNER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PurchaseIntent" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'AFTER_SALES', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TopicCategory" AS ENUM ('SALES', 'PRODUCT_FEATURE', 'PURCHASE_JOURNEY', 'AFTER_SALES', 'COMPLAINT', 'GENERAL');

-- CreateEnum
CREATE TYPE "ActivityActionType" AS ENUM ('STATUS_CHANGED', 'NOTE_ADDED', 'REMINDER_SENT', 'MANAGER_ACKNOWLEDGED', 'CONVERSATION_COMPLETED', 'ESCALATED', 'RETURNED_TO_FOLLOW_UP');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "region" TEXT,
    "area" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineOfficialAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basicId" TEXT,
    "channelId" TEXT,
    "storeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineOfficialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT,
    "displayName" TEXT NOT NULL,
    "pictureUrl" TEXT,
    "preferredLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "latestMessageAt" TIMESTAMP(3) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "followUpStatus" "FollowUpStatus" NOT NULL DEFAULT 'FOLLOW_UP',
    "productRelationship" "ProductRelationship",
    "purchaseIntent" "PurchaseIntent",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "originalText" TEXT NOT NULL,
    "originalLanguage" TEXT,
    "translatedThai" TEXT,
    "translatedEnglish" TEXT,
    "translatedChinese" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productSeriesId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationProduct" (
    "conversationId" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" TEXT,

    CONSTRAINT "ConversationProduct_pkey" PRIMARY KEY ("conversationId","productModelId")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TopicCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTopic" (
    "conversationId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" TEXT,

    CONSTRAINT "ConversationTopic_pkey" PRIMARY KEY ("conversationId","topicId")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityHistory" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actionType" "ActivityActionType" NOT NULL,
    "previousStatus" "FollowUpStatus",
    "newStatus" "FollowUpStatus",
    "description" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE INDEX "Store_isActive_idx" ON "Store"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LineOfficialAccount_basicId_key" ON "LineOfficialAccount"("basicId");

-- CreateIndex
CREATE UNIQUE INDEX "LineOfficialAccount_channelId_key" ON "LineOfficialAccount"("channelId");

-- CreateIndex
CREATE INDEX "LineOfficialAccount_storeId_isActive_idx" ON "LineOfficialAccount"("storeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_lineUserId_key" ON "Customer"("lineUserId");

-- CreateIndex
CREATE INDEX "Conversation_latestMessageAt_idx" ON "Conversation"("latestMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_followUpStatus_idx" ON "Conversation"("followUpStatus");

-- CreateIndex
CREATE INDEX "Conversation_priority_idx" ON "Conversation"("priority");

-- CreateIndex
CREATE INDEX "Conversation_storeId_idx" ON "Conversation"("storeId");

-- CreateIndex
CREATE INDEX "Conversation_customerId_idx" ON "Conversation"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalMessageId_key" ON "Message"("externalMessageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_idx" ON "Message"("conversationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSeries_name_key" ON "ProductSeries"("name");

-- CreateIndex
CREATE INDEX "ProductSeries_isActive_idx" ON "ProductSeries"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModel_name_key" ON "ProductModel"("name");

-- CreateIndex
CREATE INDEX "ProductModel_isActive_idx" ON "ProductModel"("isActive");

-- CreateIndex
CREATE INDEX "ProductModel_productSeriesId_idx" ON "ProductModel"("productSeriesId");

-- CreateIndex
CREATE INDEX "ConversationProduct_productModelId_idx" ON "ConversationProduct"("productModelId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE INDEX "Topic_isActive_idx" ON "Topic"("isActive");

-- CreateIndex
CREATE INDEX "Topic_category_idx" ON "Topic"("category");

-- CreateIndex
CREATE INDEX "ConversationTopic_topicId_idx" ON "ConversationTopic"("topicId");

-- CreateIndex
CREATE INDEX "InternalNote_conversationId_createdAt_idx" ON "InternalNote"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityHistory_conversationId_createdAt_idx" ON "ActivityHistory"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityHistory_createdAt_idx" ON "ActivityHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "LineOfficialAccount" ADD CONSTRAINT "LineOfficialAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_productSeriesId_fkey" FOREIGN KEY ("productSeriesId") REFERENCES "ProductSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationProduct" ADD CONSTRAINT "ConversationProduct_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationProduct" ADD CONSTRAINT "ConversationProduct_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTopic" ADD CONSTRAINT "ConversationTopic_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTopic" ADD CONSTRAINT "ConversationTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityHistory" ADD CONSTRAINT "ActivityHistory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
