CREATE TYPE "ProductGroup" AS ENUM ('SMARTPHONE', 'TABLET', 'WEARABLE', 'AUDIO', 'TV', 'SMART_HOME_AIOT', 'ACCESSORIES', 'SERVICE_AFTER_SALES', 'UNKNOWN');
ALTER TABLE "ProductSeries" ADD COLUMN "productGroup" "ProductGroup" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "ProductModel" ADD COLUMN "classificationLevel" TEXT NOT NULL DEFAULT 'MODEL', ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductAlias" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ConversationProduct" ADD COLUMN "matchedPhrase" TEXT, ADD COLUMN "detectionMethod" TEXT, ADD COLUMN "sourceMessageId" TEXT;
UPDATE "ProductSeries" SET "productGroup" = CASE WHEN lower("name") LIKE '%pad%' THEN 'TABLET'::"ProductGroup" WHEN lower("name") LIKE '%watch%' OR lower("name") LIKE '%band%' THEN 'WEARABLE'::"ProductGroup" WHEN lower("name") LIKE '%enco%' THEN 'AUDIO'::"ProductGroup" WHEN lower("name") LIKE '%accessor%' THEN 'ACCESSORIES'::"ProductGroup" ELSE 'SMARTPHONE'::"ProductGroup" END;
