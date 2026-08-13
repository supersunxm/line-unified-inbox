-- CreateEnum
CREATE TYPE "MassMessageAudienceType" AS ENUM ('ALL_KNOWN', 'NOT_REPLIED', 'NOTIFIED_BM', 'REPLIED', 'SELECTED_USERS');

-- CreateEnum
CREATE TYPE "MassMessageStoreMode" AS ENUM ('SINGLE', 'MULTIPLE', 'ALL');

-- CreateEnum
CREATE TYPE "MassMessageCampaignStatus" AS ENUM ('DRAFT', 'PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MassMessageStoreDeliveryStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MassMessageBatchStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "MassMessageCampaign" (
    "id" TEXT NOT NULL,
    "campaignRequestId" TEXT NOT NULL,
    "title" TEXT,
    "audienceType" "MassMessageAudienceType" NOT NULL DEFAULT 'ALL_KNOWN',
    "storeMode" "MassMessageStoreMode" NOT NULL DEFAULT 'SINGLE',
    "selectedStoreIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "messagePayload" JSONB NOT NULL,
    "status" "MassMessageCampaignStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "storeCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleStoreCount" INTEGER NOT NULL DEFAULT 0,
    "skippedStoreCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "processedRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "successRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "failedRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MassMessageCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MassMessageStoreDelivery" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT,
    "status" "MassMessageStoreDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skipReason" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MassMessageStoreDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MassMessageBatch" (
    "id" TEXT NOT NULL,
    "storeDeliveryId" TEXT NOT NULL,
    "batchIndex" INTEGER NOT NULL,
    "retryKey" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "status" "MassMessageBatchStatus" NOT NULL DEFAULT 'PENDING',
    "lineRequestId" TEXT,
    "acceptedRequestId" TEXT,
    "externalMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MassMessageBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MassMessageCampaign_campaignRequestId_key" ON "MassMessageCampaign"("campaignRequestId");

-- CreateIndex
CREATE INDEX "MassMessageCampaign_status_createdAt_idx" ON "MassMessageCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MassMessageCampaign_createdById_idx" ON "MassMessageCampaign"("createdById");

-- CreateIndex
CREATE INDEX "MassMessageCampaign_campaignRequestId_idx" ON "MassMessageCampaign"("campaignRequestId");

-- CreateIndex
CREATE INDEX "MassMessageStoreDelivery_campaignId_status_idx" ON "MassMessageStoreDelivery"("campaignId", "status");

-- CreateIndex
CREATE INDEX "MassMessageStoreDelivery_storeId_idx" ON "MassMessageStoreDelivery"("storeId");

-- CreateIndex
CREATE INDEX "MassMessageStoreDelivery_status_idx" ON "MassMessageStoreDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MassMessageStoreDelivery_campaignId_storeId_key" ON "MassMessageStoreDelivery"("campaignId", "storeId");

-- CreateIndex
CREATE INDEX "MassMessageBatch_storeDeliveryId_batchIndex_idx" ON "MassMessageBatch"("storeDeliveryId", "batchIndex");

-- CreateIndex
CREATE INDEX "MassMessageBatch_status_idx" ON "MassMessageBatch"("status");

-- CreateIndex
CREATE INDEX "MassMessageBatch_retryKey_idx" ON "MassMessageBatch"("retryKey");

-- AddForeignKey
ALTER TABLE "MassMessageCampaign" ADD CONSTRAINT "MassMessageCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassMessageStoreDelivery" ADD CONSTRAINT "MassMessageStoreDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MassMessageCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassMessageStoreDelivery" ADD CONSTRAINT "MassMessageStoreDelivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassMessageStoreDelivery" ADD CONSTRAINT "MassMessageStoreDelivery_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassMessageBatch" ADD CONSTRAINT "MassMessageBatch_storeDeliveryId_fkey" FOREIGN KEY ("storeDeliveryId") REFERENCES "MassMessageStoreDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
