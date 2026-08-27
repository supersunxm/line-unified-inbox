-- AlterEnum
ALTER TYPE "RichMenuPublishStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "RichMenuPublishStatus" ADD VALUE 'CANCELLED';

-- CreateEnum
CREATE TYPE "RichMenuPublishJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLING', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "RichMenuPublishAttempt" ADD COLUMN "jobId" TEXT,
ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "RichMenuPublishJob" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "RichMenuPublishJobStatus" NOT NULL DEFAULT 'QUEUED',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "processingCount" INTEGER NOT NULL DEFAULT 0,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichMenuPublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMenuWorkerHeartbeat" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "workerId" TEXT NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hostname" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichMenuWorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RichMenuPublishJob_templateId_idx" ON "RichMenuPublishJob"("templateId");

-- CreateIndex
CREATE INDEX "RichMenuPublishJob_status_idx" ON "RichMenuPublishJob"("status");

-- CreateIndex
CREATE INDEX "RichMenuPublishJob_createdAt_idx" ON "RichMenuPublishJob"("createdAt");

-- CreateIndex
CREATE INDEX "RichMenuPublishAttempt_jobId_idx" ON "RichMenuPublishAttempt"("jobId");

-- CreateIndex
CREATE INDEX "RichMenuPublishAttempt_jobId_status_idx" ON "RichMenuPublishAttempt"("jobId", "status");

-- CreateIndex
CREATE INDEX "RichMenuPublishAttempt_status_createdAt_idx" ON "RichMenuPublishAttempt"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RichMenuPublishJob" ADD CONSTRAINT "RichMenuPublishJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RichMenuTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMenuPublishAttempt" ADD CONSTRAINT "RichMenuPublishAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RichMenuPublishJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
