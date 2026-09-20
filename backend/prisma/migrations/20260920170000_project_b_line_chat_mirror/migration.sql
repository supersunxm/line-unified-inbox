-- Project B: read-only LINE OA Manager mirror shadow storage.
-- Additive only. No existing conversation/message data is changed.

ALTER TYPE "LineChatProfileOperationKind"
  ADD VALUE IF NOT EXISTS 'MIRROR_SYNC';

DO $$ BEGIN
  CREATE TYPE "LineChatMirrorSyncStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LineChatMirrorDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LineChatMirrorStoreState" (
  "id" TEXT NOT NULL,
  "lineOfficialAccountId" TEXT NOT NULL,
  "storeId" TEXT,
  "storeCode" TEXT NOT NULL,
  "status" "LineChatMirrorSyncStatus" NOT NULL DEFAULT 'IDLE',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "lastStartedAt" TIMESTAMP(3),
  "lastCompletedAt" TIMESTAMP(3),
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "recentChatsObserved" INTEGER NOT NULL DEFAULT 0,
  "pendingChats" INTEGER NOT NULL DEFAULT 0,
  "messagesStored" INTEGER NOT NULL DEFAULT 0,
  "lastCycleDurationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LineChatMirrorStoreState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LineChatMirrorStoreState_lineOfficialAccountId_key"
  ON "LineChatMirrorStoreState"("lineOfficialAccountId");
CREATE INDEX IF NOT EXISTS "LineChatMirrorStoreState_storeCode_idx"
  ON "LineChatMirrorStoreState"("storeCode");
CREATE INDEX IF NOT EXISTS "LineChatMirrorStoreState_enabled_status_idx"
  ON "LineChatMirrorStoreState"("enabled", "status");
CREATE INDEX IF NOT EXISTS "LineChatMirrorStoreState_lastSuccessfulSyncAt_idx"
  ON "LineChatMirrorStoreState"("lastSuccessfulSyncAt");

CREATE TABLE IF NOT EXISTS "LineChatMirrorChat" (
  "id" TEXT NOT NULL,
  "lineOfficialAccountId" TEXT NOT NULL,
  "lineChatUserId" TEXT NOT NULL,
  "displayName" TEXT,
  "lastMessageText" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastMessageDirection" TEXT,
  "historySyncedThroughAt" TIMESTAMP(3),
  "lastHistorySyncedAt" TIMESTAMP(3),
  "status" "LineChatMirrorSyncStatus" NOT NULL DEFAULT 'IDLE',
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LineChatMirrorChat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LineChatMirrorChat_oa_chatUser_key"
  ON "LineChatMirrorChat"("lineOfficialAccountId", "lineChatUserId");
CREATE INDEX IF NOT EXISTS "LineChatMirrorChat_oa_lastMessageAt_idx"
  ON "LineChatMirrorChat"("lineOfficialAccountId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "LineChatMirrorChat_oa_status_idx"
  ON "LineChatMirrorChat"("lineOfficialAccountId", "status");
CREATE INDEX IF NOT EXISTS "LineChatMirrorChat_historySyncedThroughAt_idx"
  ON "LineChatMirrorChat"("historySyncedThroughAt");

CREATE TABLE IF NOT EXISTS "LineChatMirrorMessage" (
  "id" TEXT NOT NULL,
  "lineOfficialAccountId" TEXT NOT NULL,
  "lineChatUserId" TEXT NOT NULL,
  "managerMessageId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "direction" "LineChatMirrorDirection" NOT NULL DEFAULT 'UNKNOWN',
  "messageType" TEXT,
  "text" TEXT,
  "fileName" TEXT,
  "bizId" TEXT,
  "ownerName" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LineChatMirrorMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LineChatMirrorMessage_oa_managerMessage_key"
  ON "LineChatMirrorMessage"("lineOfficialAccountId", "managerMessageId");
CREATE INDEX IF NOT EXISTS "LineChatMirrorMessage_oa_chatUser_sentAt_idx"
  ON "LineChatMirrorMessage"("lineOfficialAccountId", "lineChatUserId", "sentAt");
CREATE INDEX IF NOT EXISTS "LineChatMirrorMessage_oa_direction_sentAt_idx"
  ON "LineChatMirrorMessage"("lineOfficialAccountId", "direction", "sentAt");
CREATE INDEX IF NOT EXISTS "LineChatMirrorMessage_eventType_idx"
  ON "LineChatMirrorMessage"("eventType");
