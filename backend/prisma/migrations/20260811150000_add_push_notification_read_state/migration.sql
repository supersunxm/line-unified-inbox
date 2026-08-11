-- Phase 2B: per-user read/open state for the mobile notification badge.
-- This is additive and leaves existing notification delivery history intact.
ALTER TABLE "PushNotification"
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "openedAt" TIMESTAMP(3);

CREATE INDEX "PushNotification_userId_readAt_idx" ON "PushNotification"("userId", "readAt");
