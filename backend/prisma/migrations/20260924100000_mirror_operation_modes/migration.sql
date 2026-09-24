CREATE TYPE "MirrorOperationMode" AS ENUM ('NORMAL', 'BACKFILL', 'CATCH_UP');

CREATE TYPE "MirrorOperationCoverageStatus" AS ENUM ('UNPROVEN', 'PROVEN');

CREATE TABLE "MirrorOperationState" (
    "id" TEXT NOT NULL DEFAULT 'big-project-a',
    "mode" "MirrorOperationMode" NOT NULL DEFAULT 'NORMAL',
    "runId" TEXT,
    "freezeAt" TIMESTAMP(3),
    "backfillTargetStartAt" TIMESTAMP(3),
    "catchUpOverlapSeconds" INTEGER NOT NULL DEFAULT 300,
    "catchUpStartAt" TIMESTAMP(3),
    "backfillCoverageStatus" "MirrorOperationCoverageStatus" NOT NULL DEFAULT 'UNPROVEN',
    "catchUpCoverageStatus" "MirrorOperationCoverageStatus" NOT NULL DEFAULT 'UNPROVEN',
    "catchUpObservedThroughAt" TIMESTAMP(3),
    "catchUpStoresTotal" INTEGER NOT NULL DEFAULT 0,
    "catchUpStoresComplete" INTEGER NOT NULL DEFAULT 0,
    "catchUpStoresPending" INTEGER NOT NULL DEFAULT 0,
    "catchUpStoresFailed" INTEGER NOT NULL DEFAULT 0,
    "catchUpEarliestUncoveredAt" TIMESTAMP(3),
    "recoveryRequired" BOOLEAN NOT NULL DEFAULT false,
    "emergencyResumedAt" TIMESTAMP(3),
    "emergencyResumeReason" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MirrorOperationState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MirrorOperationState_freeze_check"
      CHECK (
        "mode" = 'NORMAL'
        OR (
          "runId" IS NOT NULL
          AND "freezeAt" IS NOT NULL
          AND "backfillTargetStartAt" IS NOT NULL
        )
      ),
    CONSTRAINT "MirrorOperationState_catchup_boundary_check"
      CHECK ("mode" <> 'CATCH_UP' OR "catchUpStartAt" IS NOT NULL),
    CONSTRAINT "MirrorOperationState_overlap_check"
      CHECK ("catchUpOverlapSeconds" >= 0),
    CONSTRAINT "MirrorOperationState_catchup_counts_check"
      CHECK (
        "catchUpStoresTotal" >= 0
        AND "catchUpStoresComplete" >= 0
        AND "catchUpStoresPending" >= 0
        AND "catchUpStoresFailed" >= 0
        AND "catchUpStoresComplete" + "catchUpStoresPending" + "catchUpStoresFailed"
          <= "catchUpStoresTotal"
      )
);


CREATE TABLE "MirrorBackfillStoreCohort" (
    "runId" TEXT NOT NULL,
    "storeCode" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "inventoryStatus" "MirrorOperationCoverageStatus" NOT NULL DEFAULT 'UNPROVEN',
    "observedConversations" INTEGER NOT NULL DEFAULT 0,
    "exactSeptemberChats" INTEGER,
    "inventoryCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MirrorBackfillStoreCohort_pkey" PRIMARY KEY ("runId", "storeCode"),
    CONSTRAINT "MirrorBackfillStoreCohort_counts_check"
      CHECK (
        "observedConversations" >= 0
        AND ("exactSeptemberChats" IS NULL OR "exactSeptemberChats" >= 0)
      )
);

CREATE INDEX "MirrorBackfillStoreCohort_runId_inventoryStatus_idx"
  ON "MirrorBackfillStoreCohort"("runId", "inventoryStatus");

CREATE INDEX "MirrorBackfillStoreCohort_lineOfficialAccountId_idx"
  ON "MirrorBackfillStoreCohort"("lineOfficialAccountId");

CREATE TABLE "MirrorBackfillConversation" (
    "runId" TEXT NOT NULL,
    "storeCode" TEXT NOT NULL,
    "lineOfficialAccountId" TEXT NOT NULL,
    "lineChatUserId" TEXT NOT NULL,
    "observedLastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MirrorBackfillConversation_pkey"
      PRIMARY KEY ("runId", "lineOfficialAccountId", "lineChatUserId")
);

CREATE INDEX "MirrorBackfillConversation_runId_storeCode_idx"
  ON "MirrorBackfillConversation"("runId", "storeCode");

CREATE INDEX "MirrorBackfillConversation_lineOfficialAccountId_lineChatUserId_idx"
  ON "MirrorBackfillConversation"("lineOfficialAccountId", "lineChatUserId");
