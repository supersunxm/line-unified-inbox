CREATE TYPE "MediaProcessingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "MessageMedia" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "mediaType" "MessageType" NOT NULL,
    "mimeType" TEXT,
    "objectKey" TEXT,
    "fileSize" INTEGER,
    "processingStatus" "MediaProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageMedia_messageId_key" ON "MessageMedia"("messageId");
CREATE UNIQUE INDEX "MessageMedia_providerMessageId_key" ON "MessageMedia"("providerMessageId");
CREATE INDEX "MessageMedia_processingStatus_createdAt_idx" ON "MessageMedia"("processingStatus", "createdAt");

ALTER TABLE "MessageMedia" ADD CONSTRAINT "MessageMedia_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
