-- CreateEnum
CREATE TYPE "ProductAliasSource" AS ENUM ('CATALOG', 'MANUAL');

-- AlterTable
ALTER TABLE "ProductAlias"
ADD COLUMN "source" "ProductAliasSource" NOT NULL DEFAULT 'MANUAL';
