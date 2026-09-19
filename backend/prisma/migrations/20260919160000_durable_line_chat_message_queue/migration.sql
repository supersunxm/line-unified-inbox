-- Durable LINE Manager outbound queue foundation.

-- Message can now be accepted by the app before LINE Manager confirms delivery.
ALTER TYPE "MessageDeliveryStatus" ADD VALUE IF NOT EXISTS 'PENDING';

DO $$ BEGIN
  CREATE TYPE "LineChatMessageSendJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'VERIFY_PENDING', 'DELIVERED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageDeliveryAttemptStatus" AS ENUM ('PROCESSING', 'VERIFY_PENDING', 'DELIVERED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LineChatMessageSendJob" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "lineOfficialAccountId" TEXT NOT NULL,
  "lineChatSessionId" TEXT NOT NULL,
  "lineChatUserId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "LineChatMessageSendJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "verifyAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "workerId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "lockedUntil" TIMESTAMP(3),
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sendStartedAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "managerMessageId" TEXT,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LineChatMessageSendJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "sendJobId" TEXT,
  "attemptNo" INTEGER NOT NULL,
  "status" "MessageDeliveryAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sendActionAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "managerMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LineChatMessageSendJob_messageId_key"
  ON "LineChatMessageSendJob"("messageId");
CREATE UNIQUE INDEX IF NOT EXISTS "LineChatMessageSendJob_idempotencyKey_key"
  ON "LineChatMessageSendJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "LineChatMessageSendJob_status_scheduledAt_createdAt_idx"
  ON "LineChatMessageSendJob"("status", "scheduledAt", "createdAt");
CREATE INDEX IF NOT EXISTS "LineChatMessageSendJob_status_lockedUntil_idx"
  ON "LineChatMessageSendJob"("status", "lockedUntil");
CREATE INDEX IF NOT EXISTS "LineChatMessageSendJob_lineChatSessionId_status_scheduledAt_idx"
  ON "LineChatMessageSendJob"("lineChatSessionId", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "LineChatMessageSendJob_conversationId_status_idx"
  ON "LineChatMessageSendJob"("conversationId", "status");
CREATE INDEX IF NOT EXISTS "LineChatMessageSendJob_lineOfficialAccountId_status_idx"
  ON "LineChatMessageSendJob"("lineOfficialAccountId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "MessageDeliveryAttempt_messageId_attemptNo_key"
  ON "MessageDeliveryAttempt"("messageId", "attemptNo");
CREATE INDEX IF NOT EXISTS "MessageDeliveryAttempt_sendJobId_status_idx"
  ON "MessageDeliveryAttempt"("sendJobId", "status");
CREATE INDEX IF NOT EXISTS "MessageDeliveryAttempt_messageId_createdAt_idx"
  ON "MessageDeliveryAttempt"("messageId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "LineChatMessageSendJob"
    ADD CONSTRAINT "LineChatMessageSendJob_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LineChatMessageSendJob"
    ADD CONSTRAINT "LineChatMessageSendJob_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LineChatMessageSendJob"
    ADD CONSTRAINT "LineChatMessageSendJob_lineOfficialAccountId_fkey"
    FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LineChatMessageSendJob"
    ADD CONSTRAINT "LineChatMessageSendJob_lineChatSessionId_fkey"
    FOREIGN KEY ("lineChatSessionId") REFERENCES "LineChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MessageDeliveryAttempt"
    ADD CONSTRAINT "MessageDeliveryAttempt_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MessageDeliveryAttempt"
    ADD CONSTRAINT "MessageDeliveryAttempt_sendJobId_fkey"
    FOREIGN KEY ("sendJobId") REFERENCES "LineChatMessageSendJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
