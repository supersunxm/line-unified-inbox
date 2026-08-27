-- AlterEnum
ALTER TYPE "AutoResponseContentType" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "AutoResponseContentType" ADD VALUE IF NOT EXISTS 'MULTI_MESSAGE';

-- AlterTable
ALTER TABLE "AutoResponseRule" ALTER COLUMN "textTemplate" DROP NOT NULL,
ADD COLUMN "contentJson" JSONB;

-- AlterTable
ALTER TABLE "AutoResponseExecution" ADD COLUMN "messageCount" INTEGER,
ADD COLUMN "messageTypesJson" JSONB;
