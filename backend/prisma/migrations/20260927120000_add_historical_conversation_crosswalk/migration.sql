CREATE TABLE "HistoricalConversationCrosswalk" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "historicalLineChatUserId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "canonicalConversationId" TEXT,
    "evidenceType" TEXT,
    "anchorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HistoricalConversationCrosswalk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HistoricalConversationCrosswalk_classification_check"
      CHECK ("classification" = 'LINK_SAFE'),
    CONSTRAINT "HistoricalConversationCrosswalk_link_evidence_check"
      CHECK ("canonicalConversationId" IS NOT NULL AND "evidenceType" = 'SOURCE_EVENT_ID' AND "anchorCount" > 0),
    CONSTRAINT "HistoricalConversationCrosswalk_anchor_count_check" CHECK ("anchorCount" >= 0)
);

CREATE UNIQUE INDEX "HistoricalConversationCrosswalk_identity_key"
ON "HistoricalConversationCrosswalk"("storeId", "lineOfficialAccountId", "historicalLineChatUserId");

CREATE INDEX "HistoricalConversationCrosswalk_classification_store_idx"
ON "HistoricalConversationCrosswalk"("classification", "storeId");

CREATE INDEX "HistoricalConversationCrosswalk_canonical_idx"
ON "HistoricalConversationCrosswalk"("canonicalConversationId");

ALTER TABLE "HistoricalConversationCrosswalk"
ADD CONSTRAINT "HistoricalConversationCrosswalk_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HistoricalConversationCrosswalk"
ADD CONSTRAINT "HistoricalConversationCrosswalk_lineOfficialAccountId_fkey"
FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HistoricalConversationCrosswalk"
ADD CONSTRAINT "HistoricalConversationCrosswalk_canonicalConversationId_fkey"
FOREIGN KEY ("canonicalConversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
