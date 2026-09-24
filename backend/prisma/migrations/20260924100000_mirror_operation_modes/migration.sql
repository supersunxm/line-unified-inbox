CREATE TYPE "MirrorOperationMode" AS ENUM ('NORMAL', 'BACKFILL', 'CATCH_UP');

CREATE TYPE "MirrorOperationCoverageStatus" AS ENUM ('UNPROVEN', 'PROVEN');

CREATE TABLE "MirrorOperationState" (
    "id" TEXT NOT NULL DEFAULT 'big-project-a',
    "mode" "MirrorOperationMode" NOT NULL DEFAULT 'NORMAL',
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
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MirrorOperationState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MirrorOperationState_freeze_check"
      CHECK (
        "mode" = 'NORMAL'
        OR ("freezeAt" IS NOT NULL AND "backfillTargetStartAt" IS NOT NULL)
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
