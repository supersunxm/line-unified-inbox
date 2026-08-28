-- CreateEnum
CREATE TYPE "GreetingTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GreetingSendPolicy" AS ENUM ('FIRST_TIME_ONLY', 'ADD_AND_UNBLOCK');

-- CreateEnum
CREATE TYPE "GreetingExecutionStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "GreetingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "GreetingTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "sendPolicy" "GreetingSendPolicy" NOT NULL DEFAULT 'FIRST_TIME_ONLY',
    "contentJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "GreetingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreetingStoreAssignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreetingStoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreetingExecution" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "lineOfficialAccountId" TEXT NOT NULL,
    "webhookEventId" TEXT,
    "lineUserIdHash" TEXT NOT NULL,
    "status" "GreetingExecutionStatus" NOT NULL,
    "reason" TEXT,
    "messageCount" INTEGER,
    "messageTypesJson" JSONB,
    "isUnblocked" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GreetingExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GreetingTemplate_status_createdAt_idx" ON "GreetingTemplate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GreetingTemplate_createdAt_idx" ON "GreetingTemplate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GreetingStoreAssignment_lineOfficialAccountId_key" ON "GreetingStoreAssignment"("lineOfficialAccountId");

-- CreateIndex
CREATE INDEX "GreetingStoreAssignment_templateId_idx" ON "GreetingStoreAssignment"("templateId");

-- CreateIndex
CREATE INDEX "GreetingExecution_templateId_createdAt_idx" ON "GreetingExecution"("templateId", "createdAt");

-- CreateIndex
CREATE INDEX "GreetingExecution_lineOfficialAccountId_createdAt_idx" ON "GreetingExecution"("lineOfficialAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "GreetingExecution_lineOfficialAccountId_lineUserIdHash_status_idx" ON "GreetingExecution"("lineOfficialAccountId", "lineUserIdHash", "status");

-- CreateIndex
CREATE INDEX "GreetingExecution_webhookEventId_idx" ON "GreetingExecution"("webhookEventId");

-- CreateIndex
CREATE INDEX "GreetingExecution_createdAt_idx" ON "GreetingExecution"("createdAt");

-- AddForeignKey
ALTER TABLE "GreetingStoreAssignment" ADD CONSTRAINT "GreetingStoreAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GreetingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreetingStoreAssignment" ADD CONSTRAINT "GreetingStoreAssignment_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreetingExecution" ADD CONSTRAINT "GreetingExecution_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GreetingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreetingExecution" ADD CONSTRAINT "GreetingExecution_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
