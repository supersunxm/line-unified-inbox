-- Phase 2A: evolve the additive notification foundation without deleting data.
-- Existing QUEUED records become PENDING; no notification payloads or messages are changed.
ALTER TYPE "PushNotificationStatus" RENAME VALUE 'QUEUED' TO 'PENDING';
ALTER TYPE "PushNotificationStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' AFTER 'PENDING';

-- New device registrations store an encrypted token plus a deterministic lookup hash.
-- The nullable hash preserves any pre-foundation rows until they naturally expire or are replaced.
ALTER TABLE "DeviceToken" ADD COLUMN "tokenHash" TEXT;
CREATE UNIQUE INDEX "DeviceToken_tokenHash_key" ON "DeviceToken"("tokenHash");

-- One inbound message yields at most one outbox item per recipient, even when the
-- LINE provider retries a webhook event.
CREATE UNIQUE INDEX "PushNotification_userId_messageId_key" ON "PushNotification"("userId", "messageId");
