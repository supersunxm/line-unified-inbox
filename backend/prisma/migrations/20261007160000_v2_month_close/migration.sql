-- v2 month close (additive: two new tables, no change to existing tables or rows).

CREATE TABLE "MonthlyKpiClose" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "closedBy" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "reason" TEXT,
    "backfill" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "definitionVersion" TEXT NOT NULL,
    "storeCount" INTEGER NOT NULL,
    "chatsTotal" INTEGER NOT NULL,
    "chatsUnreplied" INTEGER NOT NULL,
    "chatsReplied" INTEGER NOT NULL,
    "rate24Total" INTEGER NOT NULL,
    "rate24Within" INTEGER NOT NULL,

    CONSTRAINT "MonthlyKpiClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyKpiClose_month_revision_key" ON "MonthlyKpiClose"("month", "revision");
CREATE INDEX "MonthlyKpiClose_month_idx" ON "MonthlyKpiClose"("month");

CREATE TABLE "MonthlyStoreKpiSnapshot" (
    "id" TEXT NOT NULL,
    "closeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "storeUuid" TEXT NOT NULL,
    "storeId" TEXT,
    "storeName" TEXT NOT NULL,
    "chatsTotal" INTEGER NOT NULL,
    "chatsUnreplied" INTEGER NOT NULL,
    "chatsReplied" INTEGER NOT NULL,
    "oldestWaitingMinutes" INTEGER,
    "rate24Total" INTEGER NOT NULL,
    "rate24Within" INTEGER NOT NULL,
    "hasChatData" BOOLEAN NOT NULL,
    "rate24Measured" BOOLEAN NOT NULL,
    "replyStatusCovered" BOOLEAN NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "definitionVersion" TEXT NOT NULL,
    "closedBy" TEXT NOT NULL,

    CONSTRAINT "MonthlyStoreKpiSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyStoreKpiSnapshot_closeId_storeUuid_key" ON "MonthlyStoreKpiSnapshot"("closeId", "storeUuid");
CREATE INDEX "MonthlyStoreKpiSnapshot_month_revision_idx" ON "MonthlyStoreKpiSnapshot"("month", "revision");

ALTER TABLE "MonthlyStoreKpiSnapshot" ADD CONSTRAINT "MonthlyStoreKpiSnapshot_closeId_fkey" FOREIGN KEY ("closeId") REFERENCES "MonthlyKpiClose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
