CREATE TYPE "ProfileFetchStatus" AS ENUM ('NOT_REQUESTED', 'SUCCESS', 'FAILED', 'TOKEN_UNAVAILABLE', 'USER_UNAVAILABLE');
ALTER TYPE "ActivityActionType" ADD VALUE 'CLASSIFICATION_UPDATED';

ALTER TABLE "Store" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "LineOfficialAccount" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "statusMessage" TEXT,
ADD COLUMN "profileFetchedAt" TIMESTAMP(3),
ADD COLUMN "profileFetchStatus" "ProfileFetchStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "profileFetchError" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "prioritySource" TEXT NOT NULL DEFAULT 'SYSTEM';

CREATE TABLE "ProductAlias" (
  "id" TEXT NOT NULL,
  "productModelId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "language" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductAlias_normalizedAlias_key" ON "ProductAlias"("normalizedAlias");
CREATE INDEX "ProductAlias_productModelId_isActive_idx" ON "ProductAlias"("productModelId", "isActive");
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
