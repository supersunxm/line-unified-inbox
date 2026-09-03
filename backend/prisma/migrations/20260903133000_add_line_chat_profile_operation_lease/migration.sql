-- Additive Phase A1 migration. No existing session, OA, job, conversation,
-- customer, routing, or profile data is changed and no active leases are
-- created during migration.
CREATE TYPE "LineChatProfileOperationKind" AS ENUM (
    'NICKNAME_UPDATE',
    'RECENT_RESOLUTION',
    'HEALTH_SESSION',
    'HEALTH_OA',
    'MANUAL_DIAGNOSTIC'
);

CREATE TABLE "LineChatProfileOperationLease" (
    "id" TEXT NOT NULL,
    "lineChatSessionId" TEXT NOT NULL,
    "ownerToken" TEXT NOT NULL,
    "operationKind" "LineChatProfileOperationKind" NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineChatProfileOperationLease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LineChatProfileOperationLease_lineChatSessionId_key"
    ON "LineChatProfileOperationLease"("lineChatSessionId");

CREATE INDEX "LineChatProfileOperationLease_leaseUntil_idx"
    ON "LineChatProfileOperationLease"("leaseUntil");

CREATE INDEX "LineChatProfileOperationLease_operationKind_idx"
    ON "LineChatProfileOperationLease"("operationKind");

ALTER TABLE "LineChatProfileOperationLease"
    ADD CONSTRAINT "LineChatProfileOperationLease_lineChatSessionId_fkey"
    FOREIGN KEY ("lineChatSessionId") REFERENCES "LineChatSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
