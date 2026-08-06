-- CreateEnum
CREATE TYPE "CustomerEventType" AS ENUM ('NAME_CHANGED', 'PRODUCT_INTEREST_DETECTED', 'PURCHASE_INTENT_CHANGED');

-- CreateEnum
CREATE TYPE "CustomerEventSource" AS ENUM ('LINE_PROFILE_SYNC', 'BM_MANUAL', 'AI_ANALYSIS');

-- CreateTable
CREATE TABLE "CustomerEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerEventType" NOT NULL,
    "source" "CustomerEventSource" NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerEvent_customerId_createdAt_idx" ON "CustomerEvent"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerEvent_type_createdAt_idx" ON "CustomerEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerEvent" ADD CONSTRAINT "CustomerEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
