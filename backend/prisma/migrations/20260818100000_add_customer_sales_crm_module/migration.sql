-- CreateEnum
CREATE TYPE "CustomerSalesStatus" AS ENUM ('INTERESTED', 'PURCHASED');

-- CreateEnum
CREATE TYPE "CustomerInterestLevel" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'INSTALLMENT', 'CREDIT_CARD', 'OTHER');

-- AlterEnum
ALTER TYPE "ActivityActionType" ADD VALUE 'CUSTOMER_SALES_INFO_UPDATED';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "customerSalesStatus" "CustomerSalesStatus",
ADD COLUMN "interestLevel" "CustomerInterestLevel",
ADD COLUMN "paymentMethod" "PaymentMethodType",
ADD COLUMN "salesRecordedById" TEXT,
ADD COLUMN "salesRecordedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ConversationSalesProduct" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "customProductName" TEXT,
    "ram" TEXT,
    "rom" TEXT,
    "color" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "CustomerSalesStatus" NOT NULL DEFAULT 'INTERESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationSalesProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationSalesProduct_conversationId_idx" ON "ConversationSalesProduct"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationSalesProduct_productModelId_idx" ON "ConversationSalesProduct"("productModelId");

-- CreateIndex
CREATE INDEX "ConversationSalesProduct_productVariantId_idx" ON "ConversationSalesProduct"("productVariantId");

-- CreateIndex
CREATE INDEX "ConversationSalesProduct_status_idx" ON "ConversationSalesProduct"("status");

-- CreateIndex
CREATE INDEX "Conversation_customerSalesStatus_idx" ON "Conversation"("customerSalesStatus");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_salesRecordedById_fkey" FOREIGN KEY ("salesRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSalesProduct" ADD CONSTRAINT "ConversationSalesProduct_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSalesProduct" ADD CONSTRAINT "ConversationSalesProduct_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSalesProduct" ADD CONSTRAINT "ConversationSalesProduct_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing verified purchases and legacy manual tags
UPDATE "Conversation"
SET
  "customerSalesStatus" = 'PURCHASED',
  "paymentMethod" = CASE WHEN "isInstallment" = true THEN 'INSTALLMENT'::"PaymentMethodType" ELSE NULL END,
  "salesRecordedById" = "purchaseRecordedById",
  "salesRecordedAt" = "purchaseRecordedAt"
WHERE "purchaseRecordedAt" IS NOT NULL OR "isInstallment" = true OR array_length("sourceChannels", 1) > 0;

-- Backfill manual ConversationProduct rows into ConversationSalesProduct
INSERT INTO "ConversationSalesProduct" ("id", "conversationId", "productModelId", "productVariantId", "quantity", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  cp."conversationId",
  cp."productModelId",
  cp."productVariantId",
  1,
  'PURCHASED'::"CustomerSalesStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ConversationProduct" cp
JOIN "Conversation" c ON c."id" = cp."conversationId"
WHERE cp."source" = 'MANUAL'
  AND NOT EXISTS (
    SELECT 1 FROM "ConversationSalesProduct" csp
    WHERE csp."conversationId" = cp."conversationId" AND csp."productModelId" = cp."productModelId"
  );
