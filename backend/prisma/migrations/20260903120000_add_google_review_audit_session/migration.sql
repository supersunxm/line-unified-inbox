-- CreateEnum
CREATE TYPE "GoogleReviewAuditSessionStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoogleReviewAuditStoreStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'NEEDS_ATTENTION', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "GoogleReviewAuditCoverageStatus" AS ENUM ('OLDER_THAN_TARGET_REACHED', 'END_OF_AVAILABLE_REVIEWS');

-- CreateTable
CREATE TABLE "GoogleReviewAuditSession" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "GoogleReviewAuditSessionStatus" NOT NULL DEFAULT 'IDLE',
    "totalStores" INTEGER NOT NULL DEFAULT 0,
    "completedStores" INTEGER NOT NULL DEFAULT 0,
    "failedStores" INTEGER NOT NULL DEFAULT 0,
    "skippedStores" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "startedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewAuditSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleReviewAuditStore" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "queueOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "GoogleReviewAuditStoreStatus" NOT NULL DEFAULT 'PENDING',
    "reviewsChecked" INTEGER NOT NULL DEFAULT 0,
    "reviewsWithPhoto" INTEGER NOT NULL DEFAULT 0,
    "reviewsOver15ThaiWords" INTEGER NOT NULL DEFAULT 0,
    "qualifiedReviews" INTEGER NOT NULL DEFAULT 0,
    "coverageStatus" "GoogleReviewAuditCoverageStatus",
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewAuditStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleReviewAuditSession_month_status_idx" ON "GoogleReviewAuditSession"("month", "status");

-- CreateIndex
CREATE INDEX "GoogleReviewAuditSession_createdAt_idx" ON "GoogleReviewAuditSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewAuditStore_sessionId_storeId_key" ON "GoogleReviewAuditStore"("sessionId", "storeId");

-- CreateIndex
CREATE INDEX "GoogleReviewAuditStore_sessionId_status_queueOrder_idx" ON "GoogleReviewAuditStore"("sessionId", "status", "queueOrder");

-- CreateIndex
CREATE INDEX "GoogleReviewAuditStore_storeId_idx" ON "GoogleReviewAuditStore"("storeId");

-- AddForeignKey
ALTER TABLE "GoogleReviewAuditSession" ADD CONSTRAINT "GoogleReviewAuditSession_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewAuditStore" ADD CONSTRAINT "GoogleReviewAuditStore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GoogleReviewAuditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewAuditStore" ADD CONSTRAINT "GoogleReviewAuditStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
