-- CreateTable
CREATE TABLE "GoogleReviewKpiResult" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "reviewsChecked" INTEGER NOT NULL DEFAULT 0,
    "reviewsWithPhoto" INTEGER NOT NULL DEFAULT 0,
    "reviewsOver15ThaiWords" INTEGER NOT NULL DEFAULT 0,
    "qualifiedReviews" INTEGER NOT NULL DEFAULT 0,
    "targetQualifiedReviews" INTEGER NOT NULL DEFAULT 10,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewKpiResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewKpiResult_storeId_month_key" ON "GoogleReviewKpiResult"("storeId", "month");

-- CreateIndex
CREATE INDEX "GoogleReviewKpiResult_month_idx" ON "GoogleReviewKpiResult"("month");

-- CreateIndex
CREATE INDEX "GoogleReviewKpiResult_storeId_idx" ON "GoogleReviewKpiResult"("storeId");

-- AddForeignKey
ALTER TABLE "GoogleReviewKpiResult" ADD CONSTRAINT "GoogleReviewKpiResult_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewKpiResult" ADD CONSTRAINT "GoogleReviewKpiResult_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
