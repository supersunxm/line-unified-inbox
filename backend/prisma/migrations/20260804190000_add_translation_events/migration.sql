CREATE TYPE "TranslationEventStatus" AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE "TranslationEvent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "TranslationEventStatus" NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TranslationEvent_createdAt_idx" ON "TranslationEvent"("createdAt");
CREATE INDEX "TranslationEvent_status_createdAt_idx" ON "TranslationEvent"("status", "createdAt");
CREATE INDEX "TranslationEvent_messageId_createdAt_idx" ON "TranslationEvent"("messageId", "createdAt");
