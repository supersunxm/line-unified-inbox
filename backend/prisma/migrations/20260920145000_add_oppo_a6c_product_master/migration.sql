-- Add OPPO A6c to the canonical product data used by the mobile app.
-- This migration is idempotent so it is safe if Product Master sync has already created the model.

INSERT INTO "ProductSeries" (
  "id",
  "name",
  "isActive",
  "productGroup",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  'A Series',
  true,
  'SMARTPHONE'::"ProductGroup",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET
  "isActive" = true,
  "productGroup" = EXCLUDED."productGroup",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ProductModel" (
  "id",
  "name",
  "productSeriesId",
  "isActive",
  "classificationLevel",
  "priority",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'OPPO A6c',
  series."id",
  true,
  'MODEL',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProductSeries" AS series
WHERE series."name" = 'A Series'
ON CONFLICT ("name") DO UPDATE
SET
  "productSeriesId" = EXCLUDED."productSeriesId",
  "isActive" = true,
  "classificationLevel" = 'MODEL',
  "updatedAt" = CURRENT_TIMESTAMP;

WITH target_model AS (
  SELECT "id"
  FROM "ProductModel"
  WHERE "name" = 'OPPO A6c'
),
variants ("ram", "rom", "color", "variantKey") AS (
  VALUES
    ('4', '64',  'Stone Brown',    concat('4', chr(31), '64',  chr(31), 'stone brown')),
    ('4', '64',  'Feather Purple', concat('4', chr(31), '64',  chr(31), 'feather purple')),
    ('4', '128', 'Stone Brown',    concat('4', chr(31), '128', chr(31), 'stone brown')),
    ('4', '128', 'Feather White',  concat('4', chr(31), '128', chr(31), 'feather white'))
)
INSERT INTO "ProductVariant" (
  "id",
  "productModelId",
  "variantKey",
  "ram",
  "rom",
  "color",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  target_model."id",
  variants."variantKey",
  variants."ram",
  variants."rom",
  variants."color",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM target_model
CROSS JOIN variants
ON CONFLICT ("productModelId", "variantKey") DO UPDATE
SET
  "ram" = EXCLUDED."ram",
  "rom" = EXCLUDED."rom",
  "color" = EXCLUDED."color",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
