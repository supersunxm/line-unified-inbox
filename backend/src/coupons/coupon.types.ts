export type CouponStoreMode = "ALL" | "SELECTED";

export type CouponStoreSelection = {
  mode: CouponStoreMode;
  storeIds?: string[];
};

export type CouponPriceInfo =
  | { type: "fixed"; fixedAmount: number }
  | { type: "percentage"; percentage: number }
  | { type: "explicit"; originalPrice: number; priceAfterDiscount: number };

export type CouponReward =
  | { type: "discount"; priceInfo: CouponPriceInfo }
  | { type: "cashBack"; priceInfo: Extract<CouponPriceInfo, { type: "fixed" | "percentage" }> }
  | { type: "free" | "gift" | "others" };

export type CouponAcquisitionCondition =
  | { type: "normal" }
  | { type: "lottery"; lotteryProbability: number; maxAcquireCount?: number };

export type LineCouponPayload = {
  title: string;
  description?: string;
  reward: CouponReward;
  acquisitionCondition: CouponAcquisitionCondition;
  startTimestamp: number;
  endTimestamp: number;
  imageUrl?: string;
  timezone: "ASIA_BANGKOK";
  visibility: "PUBLIC" | "UNLISTED";
  maxUseCountPerTicket: 1 | -1;
  usageCondition?: string;
  couponCode?: string;
};

export type CouponPreviewInput = {
  coupon: LineCouponPayload;
  storeSelection: CouponStoreSelection;
};

export type CouponCreateInput = CouponPreviewInput;

export type CouponScopeItem = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  encryptedChannelAccessToken: string | null;
  isEligible: boolean;
  skipReason: "UNAUTHORIZED" | "STORE_NOT_ACTIVE" | "INVALID_CONNECTION" | "MISSING_TOKEN" | null;
};

export type LineCouponCreateResult = {
  couponId: string;
  requestId: string | null;
};

export type LineCouponCloseResult = {
  requestId: string | null;
};
