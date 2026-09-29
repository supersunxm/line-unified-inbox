-- CreateEnum
CREATE TYPE "ReplyStateProjectionState" AS ENUM ('REPLIED', 'NOT_REPLIED');

-- CreateEnum
CREATE TYPE "ReplyStateProjectionDecidingEvent" AS ENUM ('CUSTOMER_INBOUND', 'HUMAN_STAFF_REPLY');

-- CreateTable
CREATE TABLE "ConversationReplyStateProjection" (
    "conversationId" TEXT NOT NULL,
    "state" "ReplyStateProjectionState" NOT NULL,
    "decidingEventKind" "ReplyStateProjectionDecidingEvent" NOT NULL,
    "decidingEventAt" TIMESTAMP(3) NOT NULL,
    "evidenceBoundary" TIMESTAMP(3) NOT NULL,
    "resolverVersion" TEXT NOT NULL,
    "canonicalMessageCount" INTEGER NOT NULL DEFAULT 0,
    "historicalMessageCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationReplyStateProjection_pkey" PRIMARY KEY ("conversationId")
);

-- CreateIndex
CREATE INDEX "ConversationReplyStateProjection_state_decidingEventAt_idx"
ON "ConversationReplyStateProjection"("state", "decidingEventAt" DESC);

-- CreateIndex
CREATE INDEX "ConversationReplyStateProjection_evidenceBoundary_idx"
ON "ConversationReplyStateProjection"("evidenceBoundary");

-- CreateIndex
CREATE INDEX "ConversationReplyStateProjection_updatedAt_idx"
ON "ConversationReplyStateProjection"("updatedAt");

-- AddForeignKey
ALTER TABLE "ConversationReplyStateProjection"
ADD CONSTRAINT "ConversationReplyStateProjection_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
