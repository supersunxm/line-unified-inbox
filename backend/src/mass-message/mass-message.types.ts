import {
  MassMessageAudienceType,
  MassMessageBatchStatus,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
  MassMessageStoreMode,
} from "@prisma/client";

export {
  MassMessageAudienceType,
  MassMessageBatchStatus,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
  MassMessageStoreMode,
};

export type StoreSelectionInput = {
  mode: MassMessageStoreMode;
  storeIds?: string[];
};

export type MassMessagePreviewInput = {
  storeSelection: StoreSelectionInput;
  audienceType?: MassMessageAudienceType;
};

export type MassMessageCreateInput = {
  campaignRequestId: string;
  title?: string;
  storeSelection: StoreSelectionInput;
  audienceType?: MassMessageAudienceType;
  messages: Array<Record<string, unknown>>;
};

export type StorePreviewResult = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  recipientCount: number;
  status: "READY" | "SKIPPED";
  skipReason: string | null;
};

export type MassMessagePreviewResult = {
  storeCount: number;
  eligibleStoreCount: number;
  skippedStoreCount: number;
  estimatedRecipientCount: number;
  stores: StorePreviewResult[];
};

export type StoreDeliveryDetail = {
  id: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  status: MassMessageStoreDeliveryStatus;
  recipientCount: number;
  processedCount: number;
  successCount: number;
  acceptedCount: number; // Semantic alias for successCount (recipients accepted by LINE API)
  failedCount: number;
  failedRequestCount: number; // Semantic alias for failedCount (recipients where LINE request failed)
  skipReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type MassMessageCampaignDetail = {
  id: string;
  campaignRequestId: string;
  title: string | null;
  audienceType: MassMessageAudienceType;
  storeMode: MassMessageStoreMode;
  selectedStoreIds: string[];
  status: MassMessageCampaignStatus;
  createdById: string | null;
  createdByName: string | null;
  storeCount: number;
  eligibleStoreCount: number;
  skippedStoreCount: number;
  estimatedRecipientCount: number;
  processedRecipientCount: number;
  successRecipientCount: number;
  acceptedRecipientCount: number; // Semantic alias for successRecipientCount (recipients accepted by LINE API)
  failedRecipientCount: number;
  failedRequestRecipientCount: number; // Semantic alias for failedRecipientCount (recipients where LINE request failed)
  messagePayload: { messages: Array<Record<string, unknown>> };
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  storeDeliveries?: StoreDeliveryDetail[];
};

export type StoreScopeItem = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  encryptedChannelAccessToken: string | null;
  isEligible: boolean;
  skipReason: string | null;
  recipientUserIds: string[];
};
