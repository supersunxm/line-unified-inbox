-- Independent typed metadata derived only from immutable Manager nickname evidence.
-- Intentionally no backfill: existing onlineSource and v2 state remain untouched.
CREATE TABLE "NicknameDerivedMetadataState" (
  "conversationId" TEXT NOT NULL,
  "sourceObservationId" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provenance" TEXT NOT NULL DEFAULT 'MANAGER_NICKNAME',
  "source" TEXT,
  "customerType" TEXT,
  "productModelId" TEXT,
  "paymentMethod" TEXT,
  "financeProvider" TEXT,
  "service" TEXT,
  "periodYear" INTEGER,
  "periodMonth" INTEGER,
  "eventDate" DATE,
  CONSTRAINT "NicknameDerivedMetadataState_pkey" PRIMARY KEY ("conversationId"),
  CONSTRAINT "nickname_derived_parser_version_check" CHECK ("parserVersion" LIKE 'nickname-parser-v3.%'),
  CONSTRAINT "nickname_derived_provenance_check" CHECK ("provenance" = 'MANAGER_NICKNAME'),
  CONSTRAINT "nickname_derived_source_check" CHECK ("source" IS NULL OR "source" IN ('TikTok','Facebook','Instagram','LINE','Website','Lemon8')),
  CONSTRAINT "nickname_derived_customer_type_check" CHECK ("customerType" IS NULL OR "customerType" = 'ONLINE'),
  CONSTRAINT "nickname_derived_payment_check" CHECK ("paymentMethod" IS NULL OR "paymentMethod" IN ('CASH','INSTALLMENT')),
  CONSTRAINT "nickname_derived_finance_check" CHECK ("financeProvider" IS NULL OR "financeProvider" IN ('SG_FINANCE','UFUND')),
  CONSTRAINT "nickname_derived_service_check" CHECK ("service" IS NULL OR "service" = 'FILM_INSTALLATION'),
  CONSTRAINT "nickname_derived_period_pair_check" CHECK (("periodYear" IS NULL) = ("periodMonth" IS NULL)),
  CONSTRAINT "nickname_derived_period_year_check" CHECK ("periodYear" IS NULL OR "periodYear" BETWEEN 1900 AND 2199),
  CONSTRAINT "nickname_derived_period_month_check" CHECK ("periodMonth" IS NULL OR "periodMonth" BETWEEN 1 AND 12),
  CONSTRAINT "nickname_derived_nonempty_check" CHECK (
    "source" IS NOT NULL OR "customerType" IS NOT NULL OR "productModelId" IS NOT NULL OR
    "paymentMethod" IS NOT NULL OR "financeProvider" IS NOT NULL OR "service" IS NOT NULL OR
    "periodYear" IS NOT NULL OR "eventDate" IS NOT NULL
  )
);
CREATE UNIQUE INDEX "NicknameDerivedMetadataState_sourceObservationId_key"
  ON "NicknameDerivedMetadataState"("sourceObservationId");
CREATE INDEX "NicknameDerivedMetadataState_productModelId_idx"
  ON "NicknameDerivedMetadataState"("productModelId");
ALTER TABLE "NicknameDerivedMetadataState"
  ADD CONSTRAINT "NicknameDerivedMetadataState_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NicknameDerivedMetadataState"
  ADD CONSTRAINT "NicknameDerivedMetadataState_sourceObservationId_fkey"
  FOREIGN KEY ("sourceObservationId") REFERENCES "NicknameSourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NicknameDerivedMetadataState"
  ADD CONSTRAINT "NicknameDerivedMetadataState_productModelId_fkey"
  FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NicknameDerivedMetadataApplication" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sourceObservationId" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "manifestSha256" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "previousValues" JSONB NOT NULL,
  "resultingValues" JSONB NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NicknameDerivedMetadataApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nickname_derived_application_parser_version_check" CHECK ("parserVersion" LIKE 'nickname-parser-v3.%'),
  CONSTRAINT "nickname_derived_application_hash_check" CHECK ("manifestSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "nickname_derived_application_outcome_check" CHECK ("outcome" = 'APPLIED')
);
CREATE UNIQUE INDEX "NicknameDerivedMetadataApplication_sourceObservationId_parserVersion_key"
  ON "NicknameDerivedMetadataApplication"("sourceObservationId", "parserVersion");
CREATE INDEX "NicknameDerivedMetadataApplication_conversationId_appliedAt_idx"
  ON "NicknameDerivedMetadataApplication"("conversationId", "appliedAt");
CREATE INDEX "NicknameDerivedMetadataApplication_manifestSha256_idx"
  ON "NicknameDerivedMetadataApplication"("manifestSha256");
ALTER TABLE "NicknameDerivedMetadataApplication"
  ADD CONSTRAINT "NicknameDerivedMetadataApplication_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NicknameDerivedMetadataApplication"
  ADD CONSTRAINT "NicknameDerivedMetadataApplication_sourceObservationId_fkey"
  FOREIGN KEY ("sourceObservationId") REFERENCES "NicknameSourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION reject_nickname_derived_application_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'NicknameDerivedMetadataApplication is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NicknameDerivedMetadataApplication_immutable"
  BEFORE UPDATE OR DELETE ON "NicknameDerivedMetadataApplication"
  FOR EACH ROW EXECUTE FUNCTION reject_nickname_derived_application_mutation();
