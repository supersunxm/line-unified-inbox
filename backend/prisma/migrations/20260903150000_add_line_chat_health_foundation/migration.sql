-- Additive Phase A2 health foundation. Existing operational status fields,
-- routing, profiles, nickname jobs, and profile-operation leases are unchanged.
-- Existing sessions and OAs receive UNKNOWN health snapshots; no events are
-- backfilled or created by this migration.
CREATE TYPE "LineChatSessionHealthStatus" AS ENUM (
    'UNKNOWN',
    'CONNECTED',
    'DEGRADED',
    'AUTH_REQUIRED',
    'CONFIG_ERROR'
);

CREATE TYPE "LineChatOaHealthStatus" AS ENUM (
    'UNKNOWN',
    'CONNECTED',
    'DEGRADED',
    'OA_ACCESS_LOST',
    'AUTH_REQUIRED',
    'CONFIG_ERROR'
);

CREATE TYPE "LineChatHealthFailureStage" AS ENUM (
    'PROFILE_MISSING',
    'PROFILE_PATH_INVALID',
    'CHROMIUM_LAUNCH',
    'PROFILE_LOCK',
    'MANAGER_AUTH',
    'OA_ACCESS',
    'CHAT_AUTH',
    'CHAT_LIST_REQUEST',
    'CHAT_LIST_RESPONSE',
    'CHAT_LIST_PARSE',
    'RATE_LIMIT',
    'TIMEOUT',
    'CONFIG_ERROR',
    'UNKNOWN'
);

CREATE TYPE "LineChatHealthEventEntityType" AS ENUM (
    'SESSION',
    'OA'
);

CREATE TYPE "LineChatHealthEventStatus" AS ENUM (
    'UNKNOWN',
    'CONNECTED',
    'DEGRADED',
    'OA_ACCESS_LOST',
    'AUTH_REQUIRED',
    'CONFIG_ERROR'
);

CREATE TYPE "LineChatHealthEventSource" AS ENUM (
    'SCHEDULED',
    'MANUAL'
);

ALTER TABLE "LineChatSession"
    ADD COLUMN "healthStatus" "LineChatSessionHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN "healthFailureStage" "LineChatHealthFailureStage",
    ADD COLUMN "healthLastCheckedAt" TIMESTAMP(3),
    ADD COLUMN "healthLastHealthyAt" TIMESTAMP(3),
    ADD COLUMN "healthLastFailureAt" TIMESTAMP(3),
    ADD COLUMN "healthLastHttpStatus" INTEGER,
    ADD COLUMN "healthLastDurationMs" INTEGER,
    ADD COLUMN "healthConsecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "healthNextCheckAt" TIMESTAMP(3);

ALTER TABLE "LineOfficialAccount"
    ADD COLUMN "healthStatus" "LineChatOaHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN "healthFailureStage" "LineChatHealthFailureStage",
    ADD COLUMN "healthLastCheckedAt" TIMESTAMP(3),
    ADD COLUMN "healthLastHealthyAt" TIMESTAMP(3),
    ADD COLUMN "healthLastFailureAt" TIMESTAMP(3),
    ADD COLUMN "healthLastHttpStatus" INTEGER,
    ADD COLUMN "healthLastDurationMs" INTEGER,
    ADD COLUMN "healthConsecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "healthNextCheckAt" TIMESTAMP(3),
    ADD COLUMN "healthSessionSnapshotAt" TIMESTAMP(3);

CREATE TABLE "LineChatHealthEvent" (
    "id" TEXT NOT NULL,
    "entityType" "LineChatHealthEventEntityType" NOT NULL,
    "lineChatSessionId" TEXT,
    "lineOfficialAccountId" TEXT,
    "status" "LineChatHealthEventStatus" NOT NULL,
    "failureStage" "LineChatHealthFailureStage",
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "source" "LineChatHealthEventSource" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineChatHealthEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LineChatHealthEvent_exactly_one_entity_check" CHECK (
        ("entityType" = 'SESSION' AND "lineChatSessionId" IS NOT NULL AND "lineOfficialAccountId" IS NULL)
        OR ("entityType" = 'OA' AND "lineChatSessionId" IS NULL AND "lineOfficialAccountId" IS NOT NULL)
    )
);

CREATE INDEX "LineChatHealthEvent_lineChatSessionId_detectedAt_idx"
    ON "LineChatHealthEvent"("lineChatSessionId", "detectedAt");

CREATE INDEX "LineChatHealthEvent_lineOfficialAccountId_detectedAt_idx"
    ON "LineChatHealthEvent"("lineOfficialAccountId", "detectedAt");

CREATE INDEX "LineChatHealthEvent_detectedAt_idx"
    ON "LineChatHealthEvent"("detectedAt");

ALTER TABLE "LineChatHealthEvent"
    ADD CONSTRAINT "LineChatHealthEvent_lineChatSessionId_fkey"
    FOREIGN KEY ("lineChatSessionId") REFERENCES "LineChatSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LineChatHealthEvent"
    ADD CONSTRAINT "LineChatHealthEvent_lineOfficialAccountId_fkey"
    FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
