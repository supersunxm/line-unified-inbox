-- CreateEnum
CREATE TYPE "RichMenuPublishStatus" AS ENUM ('PENDING', 'VALIDATING', 'CREATING', 'IMAGE_UPLOADING', 'SETTING_DEFAULT', 'VERIFYING', 'PUBLISHED', 'FAILED', 'ROLLING_BACK', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "RichMenuPreviousDefaultSource" AS ENUM ('MESSAGING_API', 'OTHER_OR_MANAGER', 'NONE');

-- AlterTable
ALTER TABLE "RichMenuTemplate" ADD COLUMN "selected" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RichMenuPublishAttempt" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "status" "RichMenuPublishStatus" NOT NULL DEFAULT 'PENDING',
    "lineRichMenuId" TEXT,
    "previousDefaultRichMenuId" TEXT,
    "previousDefaultSource" "RichMenuPreviousDefaultSource",
    "resolvedConfigJson" JSONB,
    "errorStage" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichMenuPublishAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RichMenuPublishAttempt_templateId_idx" ON "RichMenuPublishAttempt"("templateId");

-- CreateIndex
CREATE INDEX "RichMenuPublishAttempt_lineOfficialAccountId_idx" ON "RichMenuPublishAttempt"("lineOfficialAccountId");

-- CreateIndex
CREATE INDEX "RichMenuPublishAttempt_status_idx" ON "RichMenuPublishAttempt"("status");

-- CreateIndex
CREATE INDEX "RichMenuPublishAttempt_createdAt_idx" ON "RichMenuPublishAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "RichMenuPublishAttempt" ADD CONSTRAINT "RichMenuPublishAttempt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RichMenuTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMenuPublishAttempt" ADD CONSTRAINT "RichMenuPublishAttempt_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMenuPublishAttempt" ADD CONSTRAINT "RichMenuPublishAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RichMenuStoreAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
