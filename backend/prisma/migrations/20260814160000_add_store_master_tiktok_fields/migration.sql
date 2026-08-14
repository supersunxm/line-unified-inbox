-- AlterTable
ALTER TABLE "StoreMaster" ADD COLUMN "tiktokUsername" TEXT,
ADD COLUMN "tiktokProfileUrl" TEXT;

-- CreateIndex
CREATE INDEX "StoreMaster_tiktokUsername_idx" ON "StoreMaster"("tiktokUsername");
