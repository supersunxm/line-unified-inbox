ALTER TABLE "Message" ADD COLUMN "senderUserId" TEXT;
ALTER TABLE "Message" ADD COLUMN "senderDisplayName" TEXT;

CREATE INDEX "Message_senderUserId_idx" ON "Message"("senderUserId");

ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
