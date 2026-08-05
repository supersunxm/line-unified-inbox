-- CreateTable
CREATE TABLE "OperationalSession" (
    "id" TEXT NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetById" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalSession_resetAt_idx" ON "OperationalSession"("resetAt");

-- CreateIndex
CREATE INDEX "OperationalSession_createdAt_idx" ON "OperationalSession"("createdAt");

-- CreateIndex
CREATE INDEX "Conversation_storeId_followUpStatus_latestMessageAt_idx" ON "Conversation"("storeId", "followUpStatus", "latestMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_lineOfficialAccountId_followUpStatus_latestMes_idx" ON "Conversation"("lineOfficialAccountId", "followUpStatus", "latestMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_customerId_latestMessageAt_idx" ON "Conversation"("customerId", "latestMessageAt" DESC);
-- AddForeignKey
ALTER TABLE "OperationalSession" ADD CONSTRAINT "OperationalSession_resetById_fkey" FOREIGN KEY ("resetById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
