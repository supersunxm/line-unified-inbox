-- CreateEnum
CREATE TYPE "GoogleReviewPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "GoogleReviewWeeklyStoreMembership" (
    "id" TEXT NOT NULL,
    "storeCode" TEXT NOT NULL,
    "storeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewWeeklyStoreMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleReviewWeeklyPeriod" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "labelZh" TEXT NOT NULL,
    "labelTh" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "GoogleReviewPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewWeeklyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleReviewDailyKpi" (
    "id" TEXT NOT NULL,
    "storeCode" TEXT NOT NULL,
    "storeId" TEXT,
    "date" TEXT NOT NULL,
    "weekPeriodId" TEXT,
    "weekNumber" INTEGER,
    "storeRating" DOUBLE PRECISION,
    "reviewsChecked" INTEGER NOT NULL DEFAULT 0,
    "reviewsWithPhoto" INTEGER NOT NULL DEFAULT 0,
    "reviewsOver15ThaiWords" INTEGER NOT NULL DEFAULT 0,
    "qualifiedReviews" INTEGER NOT NULL DEFAULT 0,
    "status" "GoogleReviewPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewDailyKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleReviewWeeklyKpi" (
    "id" TEXT NOT NULL,
    "weekPeriodId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "storeCode" TEXT NOT NULL,
    "storeId" TEXT,
    "storeRating" DOUBLE PRECISION,
    "reviewsChecked" INTEGER NOT NULL DEFAULT 0,
    "reviewsWithPhoto" INTEGER NOT NULL DEFAULT 0,
    "reviewsOver15ThaiWords" INTEGER NOT NULL DEFAULT 0,
    "qualifiedReviews" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "status" "GoogleReviewPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewWeeklyKpi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleReviewWeeklyStoreMembership_storeCode_isActive_idx" ON "GoogleReviewWeeklyStoreMembership"("storeCode", "isActive");
CREATE INDEX "GoogleReviewWeeklyStoreMembership_storeId_idx" ON "GoogleReviewWeeklyStoreMembership"("storeId");
CREATE INDEX "GoogleReviewWeeklyStoreMembership_isActive_idx" ON "GoogleReviewWeeklyStoreMembership"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewWeeklyPeriod_weekNumber_key" ON "GoogleReviewWeeklyPeriod"("weekNumber");
CREATE INDEX "GoogleReviewWeeklyPeriod_startDate_endDate_idx" ON "GoogleReviewWeeklyPeriod"("startDate", "endDate");
CREATE INDEX "GoogleReviewWeeklyPeriod_status_idx" ON "GoogleReviewWeeklyPeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewDailyKpi_storeCode_date_key" ON "GoogleReviewDailyKpi"("storeCode", "date");
CREATE INDEX "GoogleReviewDailyKpi_date_status_idx" ON "GoogleReviewDailyKpi"("date", "status");
CREATE INDEX "GoogleReviewDailyKpi_weekNumber_idx" ON "GoogleReviewDailyKpi"("weekNumber");
CREATE INDEX "GoogleReviewDailyKpi_storeId_idx" ON "GoogleReviewDailyKpi"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewWeeklyKpi_weekPeriodId_storeCode_key" ON "GoogleReviewWeeklyKpi"("weekPeriodId", "storeCode");
CREATE INDEX "GoogleReviewWeeklyKpi_weekNumber_qualifiedReviews_idx" ON "GoogleReviewWeeklyKpi"("weekNumber", "qualifiedReviews");
CREATE INDEX "GoogleReviewWeeklyKpi_storeCode_idx" ON "GoogleReviewWeeklyKpi"("storeCode");

-- AddForeignKey
ALTER TABLE "GoogleReviewWeeklyStoreMembership" ADD CONSTRAINT "GoogleReviewWeeklyStoreMembership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewDailyKpi" ADD CONSTRAINT "GoogleReviewDailyKpi_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewDailyKpi" ADD CONSTRAINT "GoogleReviewDailyKpi_weekPeriodId_fkey" FOREIGN KEY ("weekPeriodId") REFERENCES "GoogleReviewWeeklyPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewWeeklyKpi" ADD CONSTRAINT "GoogleReviewWeeklyKpi_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewWeeklyKpi" ADD CONSTRAINT "GoogleReviewWeeklyKpi_weekPeriodId_fkey" FOREIGN KEY ("weekPeriodId") REFERENCES "GoogleReviewWeeklyPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
