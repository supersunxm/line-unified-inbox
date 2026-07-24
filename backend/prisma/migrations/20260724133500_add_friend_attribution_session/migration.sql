-- CreateEnum
CREATE TYPE "FriendAttributionSessionStatus" AS ENUM ('CLICKED', 'IDENTIFIED', 'ALREADY_FRIEND', 'ADD_FRIEND_PROMPTED', 'CONFIRMED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "FriendAttributionSession" (
    "id" TEXT NOT NULL,
    "publicSessionTokenHash" TEXT NOT NULL,
    "friendSourceLinkId" TEXT NOT NULL,
    "lineOaId" TEXT NOT NULL,
    "source" "FriendSource" NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "identifiedAt" TIMESTAMP(3),
    "lineUserIdHash" TEXT,
    "friendshipBefore" BOOLEAN,
    "friendshipAfter" BOOLEAN,
    "confirmedFollowAt" TIMESTAMP(3),
    "attributionStatus" "FriendAttributionSessionStatus" NOT NULL DEFAULT 'CLICKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendAttributionSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FriendAttributionSession_publicSessionTokenHash_key" ON "FriendAttributionSession"("publicSessionTokenHash");

-- CreateIndex
CREATE INDEX "FriendAttributionSession_publicSessionTokenHash_idx" ON "FriendAttributionSession"("publicSessionTokenHash");

-- CreateIndex
CREATE INDEX "FriendAttributionSession_lineOaId_lineUserIdHash_idx" ON "FriendAttributionSession"("lineOaId", "lineUserIdHash");

-- CreateIndex
CREATE INDEX "FriendAttributionSession_attributionStatus_expiresAt_idx" ON "FriendAttributionSession"("attributionStatus", "expiresAt");

-- CreateIndex
CREATE INDEX "FriendAttributionSession_confirmedFollowAt_idx" ON "FriendAttributionSession"("confirmedFollowAt");

-- AddForeignKey
ALTER TABLE "FriendAttributionSession" ADD CONSTRAINT "FriendAttributionSession_friendSourceLinkId_fkey" FOREIGN KEY ("friendSourceLinkId") REFERENCES "FriendSourceLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendAttributionSession" ADD CONSTRAINT "FriendAttributionSession_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
