-- CreateTable
CREATE TABLE "NicknameSourceState" (
    "conversationId" TEXT NOT NULL,
    "tag" TEXT,
    "ruleVersion" TEXT,
    "sourceObservationId" TEXT,
    "lastObservedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NicknameSourceState_pkey" PRIMARY KEY ("conversationId")
);

-- CreateTable
CREATE TABLE "NicknameSourceObservation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "lineChatUserId" TEXT NOT NULL,
    "conversationId" TEXT,
    "nickname" TEXT,
    "nicknameReadStatus" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "parsedTag" TEXT,
    "ruleVersion" TEXT NOT NULL,
    "ruleId" TEXT,
    "classification" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousTag" TEXT,
    "resultingTag" TEXT,

    CONSTRAINT "NicknameSourceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NicknameSourceCapture" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatCount" INTEGER NOT NULL,
    "coverage" TEXT NOT NULL,
    "profileKey" TEXT,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "NicknameSourceCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NicknameSourceApplication" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "previousTag" TEXT,
    "resultingTag" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NicknameSourceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NicknameSourceObservation_lineOfficialAccountId_lineChatUse_idx" ON "NicknameSourceObservation"("lineOfficialAccountId", "lineChatUserId", "observedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "NicknameSourceObservation_observedAt_classification_idx" ON "NicknameSourceObservation"("observedAt", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "NicknameSourceObservation_batchId_lineChatUserId_key" ON "NicknameSourceObservation"("batchId", "lineChatUserId");

-- CreateIndex
CREATE INDEX "NicknameSourceCapture_lineOfficialAccountId_observedAt_idx" ON "NicknameSourceCapture"("lineOfficialAccountId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "NicknameSourceApplication_conversationId_appliedAt_idx" ON "NicknameSourceApplication"("conversationId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NicknameSourceApplication_manifestSha256_observationId_key" ON "NicknameSourceApplication"("manifestSha256", "observationId");

-- AddForeignKey
ALTER TABLE "NicknameSourceState" ADD CONSTRAINT "NicknameSourceState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NicknameSourceObservation" ADD CONSTRAINT "NicknameSourceObservation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NicknameSourceObservation" ADD CONSTRAINT "NicknameSourceObservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "NicknameSourceCapture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NicknameSourceApplication" ADD CONSTRAINT "NicknameSourceApplication_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "NicknameSourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NicknameSourceApplication" ADD CONSTRAINT "NicknameSourceApplication_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Evidence is append-only; never erase the nickname that supported a decision.
CREATE FUNCTION reject_nickname_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Nickname source evidence is append-only'; END;
$$;
CREATE TRIGGER nickname_observation_immutable BEFORE UPDATE OR DELETE ON "NicknameSourceObservation"
FOR EACH ROW EXECUTE FUNCTION reject_nickname_evidence_mutation();
CREATE TRIGGER nickname_capture_immutable BEFORE UPDATE OR DELETE ON "NicknameSourceCapture"
FOR EACH ROW EXECUTE FUNCTION reject_nickname_evidence_mutation();
CREATE TRIGGER nickname_application_immutable BEFORE UPDATE OR DELETE ON "NicknameSourceApplication"
FOR EACH ROW EXECUTE FUNCTION reject_nickname_evidence_mutation();
ALTER TABLE "NicknameSourceObservation" ADD CONSTRAINT "nickname_classification_check"
CHECK ("classification" IN ('TAG_MAPPED','TAG_NEEDS_UPDATE','NO_TAG_SIGNAL','AMBIGUOUS','IDENTITY_CONFLICT','UNKNOWN'));
ALTER TABLE "NicknameSourceState" ADD CONSTRAINT "nickname_tag_check"
CHECK ("tag" IS NULL OR "tag" IN ('TikTok','Facebook','Instagram','LINE','Website','Lemon8'));
ALTER TABLE "NicknameSourceState" ADD CONSTRAINT "nickname_state_observation_fkey"
FOREIGN KEY ("sourceObservationId") REFERENCES "NicknameSourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NicknameSourceObservation" ADD CONSTRAINT "nickname_parsed_tag_check"
CHECK ("parsedTag" IS NULL OR "parsedTag" IN ('TikTok','Facebook','Instagram','LINE','Website','Lemon8'));
ALTER TABLE "NicknameSourceObservation" ADD CONSTRAINT "nickname_read_status_check"
CHECK ("nicknameReadStatus" IN ('READ','MISSING','INVALID'));
ALTER TABLE "NicknameSourceApplication" ADD CONSTRAINT "nickname_resulting_tag_check"
CHECK ("resultingTag" IN ('TikTok','Facebook','Instagram','LINE','Website','Lemon8'));
