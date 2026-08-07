-- CreateTable
CREATE TABLE IF NOT EXISTS "OperationalActionTask" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'HIGH',
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "expectedImpact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalActionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionImpactResult" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "beforeSla" DOUBLE PRECISION NOT NULL,
    "afterSla" DOUBLE PRECISION NOT NULL,
    "beforePending" INTEGER NOT NULL,
    "afterPending" INTEGER NOT NULL,
    "beforeResponseTime" DOUBLE PRECISION NOT NULL,
    "afterResponseTime" DOUBLE PRECISION NOT NULL,
    "impactScore" DOUBLE PRECISION NOT NULL,
    "effectiveness" TEXT NOT NULL,
    "improvementSummary" TEXT NOT NULL,
    "learnedPattern" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionImpactResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OperationalMemoryCase" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "problemPattern" TEXT NOT NULL,
    "rootCauseCategory" TEXT NOT NULL,
    "successfulAction" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timesApplied" INTEGER NOT NULL DEFAULT 1,
    "avgSlaLiftPct" DOUBLE PRECISION NOT NULL,
    "lastAppliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalMemoryCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationalActionTask_storeId_status_idx" ON "OperationalActionTask"("storeId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationalActionTask_createdAt_idx" ON "OperationalActionTask"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionImpactResult_storeId_idx" ON "ActionImpactResult"("storeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionImpactResult_effectiveness_idx" ON "ActionImpactResult"("effectiveness");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionImpactResult_evaluatedAt_idx" ON "ActionImpactResult"("evaluatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationalMemoryCase_storeId_idx" ON "OperationalMemoryCase"("storeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationalMemoryCase_rootCauseCategory_idx" ON "OperationalMemoryCase"("rootCauseCategory");
