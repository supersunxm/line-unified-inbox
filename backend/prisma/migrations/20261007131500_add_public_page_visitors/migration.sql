-- CreateTable
CREATE TABLE "PublicPageVisitor" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicPageVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicPageVisitor_pageKey_visitorHash_key"
ON "PublicPageVisitor"("pageKey", "visitorHash");

-- CreateIndex
CREATE INDEX "PublicPageVisitor_pageKey_firstSeenAt_idx"
ON "PublicPageVisitor"("pageKey", "firstSeenAt");
