-- FILM is a structured customer sales state, separate from ONLINE and PURCHASED.
ALTER TYPE "CustomerSalesStatus" ADD VALUE IF NOT EXISTS 'FILM';

ALTER TABLE "Conversation" ADD COLUMN "filmBrand" TEXT;
