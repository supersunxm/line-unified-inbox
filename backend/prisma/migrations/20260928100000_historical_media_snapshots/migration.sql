ALTER TABLE "HistoricalTimelineMessage"
ADD COLUMN "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN "mediaMetadata" JSONB,
ADD COLUMN "fileName" TEXT;
