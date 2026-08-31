-- AlterEnum
ALTER TYPE "LineChatSessionStatus" ADD VALUE IF NOT EXISTS 'DISABLED';

-- AlterTable
ALTER TABLE "LineOfficialAccount" ADD COLUMN IF NOT EXISTS "lineChatNicknameSyncEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LineChatSession"
  ALTER COLUMN "profilePath" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "profileStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "lastSuccessfulRequestAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastAuthFailureAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "consecutiveAuthFailures" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LineChatNicknameSyncJob"
  ADD COLUMN IF NOT EXISTS "workerId" TEXT,
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LineOfficialAccount_lineChatNicknameSyncEnabled_idx" ON "LineOfficialAccount"("lineChatNicknameSyncEnabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LineChatNicknameSyncJob_status_lockedUntil_idx" ON "LineChatNicknameSyncJob"("status", "lockedUntil");
