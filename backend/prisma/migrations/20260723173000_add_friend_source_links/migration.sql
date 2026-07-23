-- CreateEnum
CREATE TYPE "FriendSource" AS ENUM ('STORE_QR', 'TIKTOK', 'FACEBOOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "FriendAttributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'UNMATCHED');

-- CreateTable
CREATE TABLE "FriendSourceLink" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "lineOaId" TEXT NOT NULL,
    "source" "FriendSource" NOT NULL,
    "shortCode" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendSourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendSourceClick" (
    "id" TEXT NOT NULL,
    "friendSourceLinkId" TEXT NOT NULL,
    "trackingSessionId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "FriendSourceClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendSourceAttribution" (
    "id" TEXT NOT NULL,
    "friendSourceLinkId" TEXT NOT NULL,
    "trackingSessionId" TEXT,
    "lineUserIdHash" TEXT,
    "followedAt" TIMESTAMP(3) NOT NULL,
    "status" "FriendAttributionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendSourceAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FriendSourceLink_shortCode_key" ON "FriendSourceLink"("shortCode");

-- CreateIndex
CREATE INDEX "FriendSourceLink_storeId_isActive_idx" ON "FriendSourceLink"("storeId", "isActive");

-- CreateIndex
CREATE INDEX "FriendSourceLink_lineOaId_isActive_idx" ON "FriendSourceLink"("lineOaId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FriendSourceLink_lineOaId_source_key" ON "FriendSourceLink"("lineOaId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "FriendSourceClick_trackingSessionId_key" ON "FriendSourceClick"("trackingSessionId");

-- CreateIndex
CREATE INDEX "FriendSourceClick_friendSourceLinkId_clickedAt_idx" ON "FriendSourceClick"("friendSourceLinkId", "clickedAt");

-- CreateIndex
CREATE INDEX "FriendSourceAttribution_friendSourceLinkId_status_idx" ON "FriendSourceAttribution"("friendSourceLinkId", "status");

-- CreateIndex
CREATE INDEX "FriendSourceAttribution_trackingSessionId_idx" ON "FriendSourceAttribution"("trackingSessionId");

-- AddForeignKey
ALTER TABLE "FriendSourceLink" ADD CONSTRAINT "FriendSourceLink_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendSourceLink" ADD CONSTRAINT "FriendSourceLink_lineOaId_fkey" FOREIGN KEY ("lineOaId") REFERENCES "LineOfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendSourceClick" ADD CONSTRAINT "FriendSourceClick_friendSourceLinkId_fkey" FOREIGN KEY ("friendSourceLinkId") REFERENCES "FriendSourceLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendSourceAttribution" ADD CONSTRAINT "FriendSourceAttribution_friendSourceLinkId_fkey" FOREIGN KEY ("friendSourceLinkId") REFERENCES "FriendSourceLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
