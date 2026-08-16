-- Additive provenance for BM-recorded purchase information and activity audit data.
ALTER TYPE "ActivityActionType" ADD VALUE 'PURCHASE_INFORMATION_UPDATED';

ALTER TABLE "Conversation"
  ADD COLUMN "purchaseRecordedById" TEXT,
  ADD COLUMN "purchaseRecordedAt" TIMESTAMP(3);

ALTER TABLE "ActivityHistory"
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE INDEX "ActivityHistory_createdByUserId_idx" ON "ActivityHistory"("createdByUserId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_purchaseRecordedById_fkey"
  FOREIGN KEY ("purchaseRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivityHistory"
  ADD CONSTRAINT "ActivityHistory_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
