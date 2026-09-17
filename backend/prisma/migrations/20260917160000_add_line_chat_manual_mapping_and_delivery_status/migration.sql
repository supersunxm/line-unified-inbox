-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MessageDeliveryStatus" AS ENUM ('DELIVERED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Conversation
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lineChatMappingSource" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lineChatMappedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lineChatMappedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conversation_lineChatMappingSource_idx" ON "Conversation"("lineChatMappingSource");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_lineChatMappedById_fkey" FOREIGN KEY ("lineChatMappedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Message
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'DELIVERED';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_conversationId_deliveryStatus_idx" ON "Message"("conversationId", "deliveryStatus");
