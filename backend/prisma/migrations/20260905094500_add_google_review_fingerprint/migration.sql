-- CreateTable
CREATE TABLE "GoogleReviewFingerprint" (
    "id" TEXT NOT NULL,
    "storeCode" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "reviewDate" TEXT,
    "isQualified" BOOLEAN NOT NULL DEFAULT false,
    "weekNumber" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleReviewFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewFingerprint_fingerprint_key" ON "GoogleReviewFingerprint"("fingerprint");

-- CreateIndex
CREATE INDEX "GoogleReviewFingerprint_storeCode_idx" ON "GoogleReviewFingerprint"("storeCode");

-- CreateIndex
CREATE INDEX "GoogleReviewFingerprint_fingerprint_idx" ON "GoogleReviewFingerprint"("fingerprint");

-- CreateIndex
CREATE INDEX "GoogleReviewFingerprint_storeCode_isQualified_idx" ON "GoogleReviewFingerprint"("storeCode", "isQualified");

-- CreateIndex
CREATE INDEX "GoogleReviewFingerprint_reviewDate_idx" ON "GoogleReviewFingerprint"("reviewDate");
