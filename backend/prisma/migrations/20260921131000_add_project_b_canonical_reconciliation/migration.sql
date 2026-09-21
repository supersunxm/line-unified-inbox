-- Project B canonical reconciliation state.
-- Additive only: the mirror stays the read-only Manager source while canonical
-- writes remain behind explicit runtime flags.

CREATE TYPE "LineChatMirrorReconcileStatus" AS ENUM (
  'PENDING',
  'WAITING_CANONICAL',
  'DUPLICATE',
  'IMPORTED',
  'UNMAPPED',
  'AMBIGUOUS',
  'FAILED',
  'SKIPPED'
);

ALTER TABLE "LineChatMirrorMessage"
  ADD COLUMN "reconcileStatus" "LineChatMirrorReconcileStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "canonicalConversationId" TEXT,
  ADD COLUMN "canonicalMessageId" TEXT,
  ADD COLUMN "reconcileSource" TEXT,
  ADD COLUMN "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconciledAt" TIMESTAMP(3),
  ADD COLUMN "reconcileError" TEXT;

CREATE INDEX "LineChatMirrorMessage_reconcileStatus_sentAt_idx"
  ON "LineChatMirrorMessage"("reconcileStatus", "sentAt");

CREATE INDEX "LineChatMirrorMessage_canonicalConversationId_sentAt_idx"
  ON "LineChatMirrorMessage"("canonicalConversationId", "sentAt");
