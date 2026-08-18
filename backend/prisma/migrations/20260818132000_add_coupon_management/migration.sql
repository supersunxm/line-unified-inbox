CREATE TABLE "CouponCampaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "couponPayload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATING',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CouponCampaignStore" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "lineOfficialAccountId" TEXT,
  "lineCouponId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "skipReason" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponCampaignStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponCampaignStore_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CouponCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CouponCampaignStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CouponCampaignStore_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CouponCampaignStore_campaignId_storeId_key" ON "CouponCampaignStore"("campaignId", "storeId");
CREATE INDEX "CouponCampaign_status_createdAt_idx" ON "CouponCampaign"("status", "createdAt");
CREATE INDEX "CouponCampaignStore_campaignId_status_idx" ON "CouponCampaignStore"("campaignId", "status");
CREATE INDEX "CouponCampaignStore_storeId_createdAt_idx" ON "CouponCampaignStore"("storeId", "createdAt");
CREATE INDEX "CouponCampaignStore_lineCouponId_idx" ON "CouponCampaignStore"("lineCouponId");
