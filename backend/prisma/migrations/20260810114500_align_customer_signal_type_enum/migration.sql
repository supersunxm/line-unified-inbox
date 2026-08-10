-- Align the production enum with the current CustomerSignalType Prisma enum.
-- Existing legacy values are retained; new values are additive only.
ALTER TYPE "CustomerSignalType" ADD VALUE IF NOT EXISTS 'PRODUCT_INTEREST';
ALTER TYPE "CustomerSignalType" ADD VALUE IF NOT EXISTS 'PURCHASE_INTENT';
ALTER TYPE "CustomerSignalType" ADD VALUE IF NOT EXISTS 'PROMOTION_INTEREST';
ALTER TYPE "CustomerSignalType" ADD VALUE IF NOT EXISTS 'PRICE_INQUIRY';
ALTER TYPE "CustomerSignalType" ADD VALUE IF NOT EXISTS 'STORE_VISIT_INTENT';
ALTER TYPE "CustomerSignalType" ADD VALUE IF NOT EXISTS 'UNKNOWN';
