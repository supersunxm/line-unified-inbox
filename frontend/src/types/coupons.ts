export type CouponStoreMode = "ALL" | "SELECTED";
export type CouponRewardType = "discount" | "free" | "gift" | "cashBack" | "others";
export type CouponPriceType = "fixed" | "percentage";

export type CouponPayload = {
  title: string;
  description?: string;
  reward:
    | { type: "discount"; priceInfo: { type: "fixed"; fixedAmount: number } | { type: "percentage"; percentage: number } }
    | { type: "cashBack"; priceInfo: { type: "fixed"; fixedAmount: number } | { type: "percentage"; percentage: number } }
    | { type: "free" | "gift" | "others" };
  acquisitionCondition: { type: "normal" };
  startTimestamp: number;
  endTimestamp: number;
  imageUrl?: string;
  timezone: "ASIA_BANGKOK";
  visibility: "PUBLIC" | "UNLISTED";
  maxUseCountPerTicket: 1 | -1;
  usageCondition?: string;
  couponCode?: string;
};

export type CouponInput = {
  coupon: CouponPayload;
  storeSelection: {
    mode: CouponStoreMode;
    storeIds?: string[];
  };
};

export type CouponPreviewStore = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  isEligible: boolean;
  skipReason: "UNAUTHORIZED" | "STORE_NOT_ACTIVE" | "INVALID_CONNECTION" | "MISSING_TOKEN" | null;
};

export type CouponPreview = {
  totalStores: number;
  eligibleStores: number;
  skippedStores: number;
  skipReasons: Record<string, number>;
  stores: CouponPreviewStore[];
};

export type CouponCampaign = {
  id: string;
  title: string;
  description: string | null;
  couponPayload: CouponPayload;
  status: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type CouponCampaignStore = {
  id: string;
  campaignId: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  lineCouponId: string | null;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  completedAt: string | null;
};

export type CouponCampaignDetail = {
  campaign: CouponCampaign;
  summary: Record<string, number>;
  stores: CouponCampaignStore[];
};

export type CouponCampaignList = {
  items: CouponCampaign[];
  limit: number;
  offset: number;
};
