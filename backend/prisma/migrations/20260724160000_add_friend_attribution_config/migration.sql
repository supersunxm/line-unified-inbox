-- CreateTable
CREATE TABLE "FriendAttributionConfig" (
    "id" TEXT NOT NULL,
    "lineOaId" TEXT NOT NULL,
    "lineLoginChannelId" TEXT NOT NULL,
    "liffId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendAttributionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FriendAttributionConfig_lineOaId_key" ON "FriendAttributionConfig"("lineOaId");

-- CreateIndex
CREATE INDEX "FriendAttributionConfig_isEnabled_idx" ON "FriendAttributionConfig"("isEnabled");

-- AddForeignKey
ALTER TABLE "FriendAttributionConfig" ADD CONSTRAINT "FriendAttributionConfig_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
