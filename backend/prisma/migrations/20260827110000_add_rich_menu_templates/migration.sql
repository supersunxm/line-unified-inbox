-- CreateEnum
CREATE TYPE "RichMenuTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "RichMenuTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RichMenuTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "canvasPreset" TEXT NOT NULL DEFAULT 'GRID_6',
    "width" INTEGER NOT NULL DEFAULT 2500,
    "height" INTEGER NOT NULL DEFAULT 1686,
    "chatBarText" TEXT NOT NULL DEFAULT 'Menu',
    "imageUrl" TEXT,
    "areasJson" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichMenuTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMenuStoreAssignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichMenuStoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RichMenuTemplate_status_idx" ON "RichMenuTemplate"("status");

-- CreateIndex
CREATE INDEX "RichMenuTemplate_createdAt_idx" ON "RichMenuTemplate"("createdAt");

-- CreateIndex
CREATE INDEX "RichMenuStoreAssignment_templateId_idx" ON "RichMenuStoreAssignment"("templateId");

-- CreateIndex
CREATE INDEX "RichMenuStoreAssignment_lineOfficialAccountId_idx" ON "RichMenuStoreAssignment"("lineOfficialAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RichMenuStoreAssignment_templateId_lineOfficialAccountId_key" ON "RichMenuStoreAssignment"("templateId", "lineOfficialAccountId");

-- AddForeignKey
ALTER TABLE "RichMenuStoreAssignment" ADD CONSTRAINT "RichMenuStoreAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RichMenuTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMenuStoreAssignment" ADD CONSTRAINT "RichMenuStoreAssignment_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
