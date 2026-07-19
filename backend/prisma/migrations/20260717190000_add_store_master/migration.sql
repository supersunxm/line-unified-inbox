CREATE TYPE "StoreMasterDataQualityStatus" AS ENUM ('COMPLETE', 'MISSING_STORE_ID', 'INVALID_MANAGER_URL', 'DUPLICATE_ACCOUNT_NAME', 'INCOMPLETE');
CREATE TYPE "StoreMetadataSource" AS ENUM ('MASTER', 'PROVINCE_MAPPING', 'AI_SUGGESTED', 'MANUAL');

CREATE TABLE "StoreMaster" (
  "id" TEXT NOT NULL,
  "externalStoreId" TEXT,
  "storeName" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "normalizedAccountName" TEXT NOT NULL,
  "lineOaLink" TEXT,
  "lineId" TEXT,
  "lineManagerUrl" TEXT,
  "province" TEXT,
  "region" TEXT,
  "source" TEXT NOT NULL,
  "sourceRowNumber" INTEGER NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "dataQualityStatus" "StoreMasterDataQualityStatus" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreMaster_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Store" ADD COLUMN "storeMasterId" TEXT;
ALTER TABLE "Store" ADD COLUMN "provinceSource" "StoreMetadataSource";
ALTER TABLE "Store" ADD COLUMN "regionSource" "StoreMetadataSource";
CREATE UNIQUE INDEX "Store_storeMasterId_key" ON "Store"("storeMasterId");
CREATE UNIQUE INDEX "StoreMaster_source_sourceRowNumber_key" ON "StoreMaster"("source", "sourceRowNumber");
CREATE INDEX "StoreMaster_normalizedAccountName_idx" ON "StoreMaster"("normalizedAccountName");
CREATE INDEX "StoreMaster_externalStoreId_idx" ON "StoreMaster"("externalStoreId");
CREATE INDEX "StoreMaster_lineId_idx" ON "StoreMaster"("lineId");
CREATE INDEX "StoreMaster_province_idx" ON "StoreMaster"("province");
CREATE INDEX "StoreMaster_region_idx" ON "StoreMaster"("region");
CREATE INDEX "StoreMaster_isActive_idx" ON "StoreMaster"("isActive");
ALTER TABLE "Store" ADD CONSTRAINT "Store_storeMasterId_fkey" FOREIGN KEY ("storeMasterId") REFERENCES "StoreMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
