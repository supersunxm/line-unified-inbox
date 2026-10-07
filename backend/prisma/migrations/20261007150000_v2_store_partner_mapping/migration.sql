-- v2 Store → partner mapping (additive: two new tables, no change to existing tables or rows).

CREATE TABLE "StorePartnerMapping" (
    "storeId" TEXT NOT NULL,
    "partnerName" TEXT,
    "updatedById" TEXT,
    "updatedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePartnerMapping_pkey" PRIMARY KEY ("storeId")
);

CREATE INDEX "StorePartnerMapping_partnerName_idx" ON "StorePartnerMapping"("partnerName");

CREATE TABLE "StorePartnerMappingChange" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "previousPartner" TEXT,
    "partnerName" TEXT,
    "source" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorePartnerMappingChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorePartnerMappingChange_storeId_changedAt_idx" ON "StorePartnerMappingChange"("storeId", "changedAt");
CREATE INDEX "StorePartnerMappingChange_source_idx" ON "StorePartnerMappingChange"("source");
