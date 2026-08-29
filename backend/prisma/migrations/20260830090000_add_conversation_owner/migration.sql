-- Add an optional canonical human owner without rewriting historical conversations.
ALTER TABLE "Conversation" ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "Conversation_ownerUserId_idx" ON "Conversation"("ownerUserId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
