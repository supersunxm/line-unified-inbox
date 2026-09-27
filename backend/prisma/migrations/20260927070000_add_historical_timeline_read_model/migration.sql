CREATE TABLE "HistoricalTimelineMessage" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "lineChatUserId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceEventType" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "senderBizId" TEXT,
    "sourceArchiveKey" TEXT NOT NULL,
    "sourceArchiveSha256" TEXT NOT NULL,
    "sourcePageIdentity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalTimelineMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HistoricalTimelineMessage_source_identity_key"
ON "HistoricalTimelineMessage"("lineOfficialAccountId", "lineChatUserId", "sourceEventId");

CREATE INDEX "HistoricalTimelineMessage_chat_time_idx"
ON "HistoricalTimelineMessage"("lineOfficialAccountId", "lineChatUserId", "sentAt" DESC, "id" DESC);

CREATE INDEX "HistoricalTimelineMessage_store_time_idx"
ON "HistoricalTimelineMessage"("storeId", "sentAt");

CREATE INDEX "HistoricalTimelineMessage_archive_idx"
ON "HistoricalTimelineMessage"("sourceArchiveKey");

ALTER TABLE "HistoricalTimelineMessage"
ADD CONSTRAINT "HistoricalTimelineMessage_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HistoricalTimelineMessage"
ADD CONSTRAINT "HistoricalTimelineMessage_lineOfficialAccountId_fkey"
FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
