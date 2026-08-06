-- CreateEnum
CREATE TYPE "CustomerSignalType" AS ENUM ('PRODUCT_NAME_RENAME', 'PURCHASE_INTENT_RENAME', 'STORE_PROMOTION_RENAME', 'GENERAL_NOTE_RENAME');

-- CreateTable
CREATE TABLE "CustomerSignal" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerEventId" TEXT,
    "signalType" "CustomerSignalType" NOT NULL,
    "productModelId" TEXT,
    "detectedText" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSignal_customerEventId_key" ON "CustomerSignal"("customerEventId");

-- CreateIndex
CREATE INDEX "CustomerSignal_customerId_createdAt_idx" ON "CustomerSignal"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerSignal_signalType_createdAt_idx" ON "CustomerSignal"("signalType", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerSignal_productModelId_createdAt_idx" ON "CustomerSignal"("productModelId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerSignal" ADD CONSTRAINT "CustomerSignal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSignal" ADD CONSTRAINT "CustomerSignal_customerEventId_fkey" FOREIGN KEY ("customerEventId") REFERENCES "CustomerEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSignal" ADD CONSTRAINT "CustomerSignal_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
