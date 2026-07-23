-- CreateEnum
CREATE TYPE "BackfillJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateTable
CREATE TABLE "LineOaBackfillJob" (
    "id" TEXT NOT NULL,
    "lineOaId" TEXT NOT NULL,
    "workerId" TEXT,
    "status" "BackfillJobStatus" NOT NULL DEFAULT 'QUEUED',
    "dateFrom" TEXT NOT NULL,
    "dateTo" TEXT NOT NULL,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    "requested" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "unready" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "claimedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineOaBackfillJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineOaBackfillJob_lineOaId_status_idx" ON "LineOaBackfillJob"("lineOaId", "status");
CREATE INDEX "LineOaBackfillJob_status_heartbeatAt_idx" ON "LineOaBackfillJob"("status", "heartbeatAt");
CREATE INDEX "LineOaBackfillJob_nextAttemptAt_idx" ON "LineOaBackfillJob"("nextAttemptAt");
CREATE INDEX "LineOaBackfillJob_createdAt_idx" ON "LineOaBackfillJob"("createdAt");

-- Concurrency protection: Partial Unique Index ensuring max 1 active job in QUEUED/RUNNING per lineOaId
CREATE UNIQUE INDEX "line_oa_backfill_jobs_active_unique_idx" ON "LineOaBackfillJob"("lineOaId") WHERE "status" IN ('QUEUED', 'RUNNING');

-- AlterTable
ALTER TABLE "LineOfficialAccount" ADD COLUMN "lastBackfillReconciledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LineOfficialAccount_isActive_lastBackfillReconciledAt_idx" ON "LineOfficialAccount"("isActive", "lastBackfillReconciledAt");

-- AddForeignKey
ALTER TABLE "LineOaBackfillJob" ADD CONSTRAINT "LineOaBackfillJob_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

