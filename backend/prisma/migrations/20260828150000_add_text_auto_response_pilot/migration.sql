-- Extend the existing auto-response manager with scoped inbound-text pilot support.
ALTER TYPE "AutoResponseTriggerType" ADD VALUE 'INBOUND_TEXT';
ALTER TYPE "AutoResponseExecutionStatus" ADD VALUE 'PENDING';

CREATE TYPE "AutoResponseIntent" AS ENUM ('STORE_LOCATION', 'FINANCE_INFO');
CREATE TYPE "AutoResponsePilotMode" AS ENUM ('OFF', 'SHADOW', 'LIVE');
CREATE TYPE "AutoResponseExecutionOutcome" AS ENUM (
  'MATCHED_SHADOW',
  'SENT',
  'NO_MATCH',
  'EXCLUDED',
  'AMBIGUOUS',
  'DUPLICATE',
  'FAILED'
);

ALTER TABLE "AutoResponseRule"
  ADD COLUMN "intent" "AutoResponseIntent",
  ADD COLUMN "scopeStoreId" TEXT,
  ADD COLUMN "triggerConfig" JSONB;

ALTER TABLE "AutoResponseExecution"
  ALTER COLUMN "ruleId" DROP NOT NULL,
  ADD COLUMN "sourceMessageId" TEXT,
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "intent" "AutoResponseIntent",
  ADD COLUMN "matcherVersion" INTEGER,
  ADD COLUMN "mode" "AutoResponsePilotMode",
  ADD COLUMN "outcome" "AutoResponseExecutionOutcome",
  ADD COLUMN "exclusionReason" TEXT;

CREATE INDEX "AutoResponseRule_triggerType_status_scopeStoreId_idx"
  ON "AutoResponseRule"("triggerType", "status", "scopeStoreId");
CREATE UNIQUE INDEX "AutoResponseExecution_sourceMessageId_key"
  ON "AutoResponseExecution"("sourceMessageId");
CREATE INDEX "AutoResponseExecution_conversationId_createdAt_idx"
  ON "AutoResponseExecution"("conversationId", "createdAt");
CREATE INDEX "AutoResponseExecution_intent_outcome_createdAt_idx"
  ON "AutoResponseExecution"("intent", "outcome", "createdAt");

ALTER TABLE "AutoResponseRule"
  ADD CONSTRAINT "AutoResponseRule_scopeStoreId_fkey"
  FOREIGN KEY ("scopeStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutoResponseExecution"
  ADD CONSTRAINT "AutoResponseExecution_sourceMessageId_fkey"
  FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AutoResponseExecution_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
