-- CreateEnum
CREATE TYPE "TranslationFeedbackRating" AS ENUM ('HELPFUL', 'INCORRECT');

-- CreateEnum
CREATE TYPE "TranslationFeedbackIssueCategory" AS ENUM ('MEANING_ISSUE', 'TERMINOLOGY_ISSUE', 'OTHER');

-- CreateTable
CREATE TABLE "MessageTranslationFeedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "translationHash" TEXT NOT NULL,
    "rating" "TranslationFeedbackRating" NOT NULL,
    "issueCategory" "TranslationFeedbackIssueCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageTranslationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageTranslationFeedback_messageId_targetLanguage_adminUserId_translationHash_key"
ON "MessageTranslationFeedback"("messageId", "targetLanguage", "adminUserId", "translationHash");

-- CreateIndex
CREATE INDEX "MessageTranslationFeedback_messageId_targetLanguage_idx"
ON "MessageTranslationFeedback"("messageId", "targetLanguage");

-- CreateIndex
CREATE INDEX "MessageTranslationFeedback_createdAt_idx"
ON "MessageTranslationFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "MessageTranslationFeedback" ADD CONSTRAINT "MessageTranslationFeedback_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTranslationFeedback" ADD CONSTRAINT "MessageTranslationFeedback_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
