-- Preserve the existing nullable single source tag while migrating to a
-- normalized PostgreSQL enum array. NULL intentionally becomes an empty set.
ALTER TABLE "Conversation"
ADD COLUMN "sourceChannels" "ConversationSourceChannel"[] NOT NULL DEFAULT ARRAY[]::"ConversationSourceChannel"[];

UPDATE "Conversation"
SET "sourceChannels" = ARRAY["sourceChannel"]::"ConversationSourceChannel"[]
WHERE "sourceChannel" IS NOT NULL;

ALTER TABLE "Conversation"
DROP COLUMN "sourceChannel";

ALTER TABLE "Conversation"
ADD COLUMN "isInstallment" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "ram" TEXT,
    "rom" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ConversationProduct"
ADD COLUMN "productVariantId" TEXT;

CREATE UNIQUE INDEX "ProductVariant_productModelId_variantKey_key"
ON "ProductVariant"("productModelId", "variantKey");

CREATE INDEX "ProductVariant_productModelId_isActive_idx"
ON "ProductVariant"("productModelId", "isActive");

CREATE INDEX "ConversationProduct_productVariantId_idx"
ON "ConversationProduct"("productVariantId");

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_productModelId_fkey"
FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationProduct"
ADD CONSTRAINT "ConversationProduct_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
