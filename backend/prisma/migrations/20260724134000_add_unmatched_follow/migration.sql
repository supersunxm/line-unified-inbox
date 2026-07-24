-- CreateTable
CREATE TABLE "FriendAttributionUnmatchedFollow" (
    "id" TEXT NOT NULL,
    "lineOaId" TEXT NOT NULL,
    "lineUserIdHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "FriendAttributionUnmatchedFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendAttributionUnmatchedFollow_lineOaId_lineUserIdHash_consumedAt_idx" ON "FriendAttributionUnmatchedFollow"("lineOaId", "lineUserIdHash", "consumedAt");

-- CreateIndex
CREATE INDEX "FriendAttributionUnmatchedFollow_expiresAt_idx" ON "FriendAttributionUnmatchedFollow"("expiresAt");

-- AddForeignKey
ALTER TABLE "FriendAttributionUnmatchedFollow" ADD CONSTRAINT "FriendAttributionUnmatchedFollow_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
