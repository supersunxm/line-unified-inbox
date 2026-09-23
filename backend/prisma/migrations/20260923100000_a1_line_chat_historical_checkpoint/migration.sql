-- A1 historical Sep 1 coverage is tracked separately from the live mirror
-- watermark. All fields stay nullable so existing chat rows retain their
-- current meaning until the explicitly gated historical worker processes them.
ALTER TYPE "LineChatProfileOperationKind"
  ADD VALUE IF NOT EXISTS 'HISTORICAL_BACKFILL';

ALTER TABLE "LineChatMirrorChat"
  ADD COLUMN "historicalBackfillStatus" TEXT,
  ADD COLUMN "historicalBackfillLowerBoundAt" TIMESTAMP(3),
  ADD COLUMN "historicalBackfillOldestAt" TIMESTAMP(3),
  ADD COLUMN "historicalBackfillNewestAt" TIMESTAMP(3),
  ADD COLUMN "historicalBackfillLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "historicalBackfillLastSuccessAt" TIMESTAMP(3),
  ADD COLUMN "historicalBackfillBackwardRequired" BOOLEAN,
  ADD COLUMN "historicalBackfillErrorCode" TEXT;

CREATE INDEX "LineChatMirrorChat_historicalBackfillStatus_idx"
  ON "LineChatMirrorChat"("historicalBackfillStatus");
