CREATE TABLE "RichMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "altText" TEXT NOT NULL,
    "mediaObjectKey" TEXT NOT NULL,
    "previewObjectKey" TEXT,
    "baseWidth" INTEGER NOT NULL DEFAULT 1040,
    "baseHeight" INTEGER NOT NULL DEFAULT 1040,
    "actionsJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RichMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RichMessage_isActive_updatedAt_idx" ON "RichMessage"("isActive", "updatedAt");
CREATE INDEX "RichMessage_name_idx" ON "RichMessage"("name");
