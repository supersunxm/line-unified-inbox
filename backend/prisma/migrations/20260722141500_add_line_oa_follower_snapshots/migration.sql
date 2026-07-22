-- CreateTable
CREATE TABLE "LineOaFollowerSnapshot" (
    "id" TEXT NOT NULL,
    "lineOaId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "followers" INTEGER,
    "targetedReaches" INTEGER,
    "blocks" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineOaFollowerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineOaFollowerSnapshot_snapshotDate_idx" ON "LineOaFollowerSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "LineOaFollowerSnapshot_lineOaId_idx" ON "LineOaFollowerSnapshot"("lineOaId");

-- CreateIndex
CREATE UNIQUE INDEX "LineOaFollowerSnapshot_lineOaId_snapshotDate_key" ON "LineOaFollowerSnapshot"("lineOaId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "LineOaFollowerSnapshot" ADD CONSTRAINT "LineOaFollowerSnapshot_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
