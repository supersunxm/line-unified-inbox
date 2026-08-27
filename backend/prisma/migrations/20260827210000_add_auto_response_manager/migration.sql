-- CreateEnum
CREATE TYPE "AutoResponseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutoResponseTriggerType" AS ENUM ('POSTBACK');

-- CreateEnum
CREATE TYPE "AutoResponseContentType" AS ENUM ('TEXT');

-- CreateEnum
CREATE TYPE "AutoResponseExecutionStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "AutoResponseRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AutoResponseStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" "AutoResponseTriggerType" NOT NULL DEFAULT 'POSTBACK',
    "contentType" "AutoResponseContentType" NOT NULL DEFAULT 'TEXT',
    "textTemplate" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AutoResponseRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoResponseExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "webhookEventId" TEXT,
    "status" "AutoResponseExecutionStatus" NOT NULL,
    "reason" TEXT,
    "resolvedVariablesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoResponseExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoResponseRule_status_createdAt_idx" ON "AutoResponseRule"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AutoResponseRule_createdAt_idx" ON "AutoResponseRule"("createdAt");

-- CreateIndex
CREATE INDEX "AutoResponseExecution_ruleId_createdAt_idx" ON "AutoResponseExecution"("ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoResponseExecution_lineOfficialAccountId_createdAt_idx" ON "AutoResponseExecution"("lineOfficialAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoResponseExecution_createdAt_idx" ON "AutoResponseExecution"("createdAt");

-- CreateIndex
CREATE INDEX "AutoResponseExecution_webhookEventId_idx" ON "AutoResponseExecution"("webhookEventId");

-- AddForeignKey
ALTER TABLE "AutoResponseExecution" ADD CONSTRAINT "AutoResponseExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutoResponseRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoResponseExecution" ADD CONSTRAINT "AutoResponseExecution_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
