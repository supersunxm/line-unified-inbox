import {
  GreetingExecutionStatus,
  GreetingSendPolicy,
  GreetingTemplateStatus,
} from "@prisma/client";

export type GreetingTextBlock = {
  id: string;
  type: "TEXT";
  textTemplate: string;
};

export type GreetingImageBlock = {
  id: string;
  type: "IMAGE";
  mediaObjectKey: string;
  previewObjectKey?: string;
  imageUrl?: string;
  previewUrl?: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
};

export type GreetingMessageBlock = GreetingTextBlock | GreetingImageBlock;

export type GreetingContentJson = {
  version: number;
  messages: GreetingMessageBlock[];
};

export type CreateGreetingTemplateDto = {
  name: string;
  description?: string | null;
  sendPolicy?: GreetingSendPolicy;
  messages?: GreetingMessageBlock[];
};

export type UpdateGreetingTemplateDto = {
  name?: string;
  description?: string | null;
  sendPolicy?: GreetingSendPolicy;
  messages?: GreetingMessageBlock[];
  status?: GreetingTemplateStatus;
};

export type GreetingPreviewDto = {
  lineOfficialAccountId?: string;
  storeId?: string;
  sampleCustomerName?: string;
};

export type GreetingAssignStoresDto = {
  lineOfficialAccountIds: string[];
};

export type GreetingUploadMediaResult = {
  mediaObjectKey: string;
  previewObjectKey: string;
  imageUrl: string;
  previewUrl: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
};

export type GreetingTemplateResponseDto = {
  id: string;
  name: string;
  description: string | null;
  status: GreetingTemplateStatus;
  sendPolicy: GreetingSendPolicy;
  contentJson: GreetingContentJson | null;
  messages: GreetingMessageBlock[];
  version: number;
  usedVariables: string[];
  assignedStoreCount: number;
  assignedOaIds: string[];
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
};

export type ResolvedGreetingBlock =
  | {
      id: string;
      type: "TEXT";
      resolvedText: string;
      usedVariables: string[];
      unresolvedVariables: string[];
      isValid: boolean;
      validationError?: string;
    }
  | {
      id: string;
      type: "IMAGE";
      imageUrl: string;
      previewUrl: string;
      mediaObjectKey: string;
      previewObjectKey?: string;
      isValid: boolean;
      validationError?: string;
    };

export type GreetingPreviewResult = {
  templateId: string;
  templateName: string;
  sendPolicy: GreetingSendPolicy;
  store: {
    lineOfficialAccountId: string;
    lineOfficialAccountName: string;
    storeId: string | null;
    storeName: string;
    externalStoreId: string | null;
    googleMapsUrl: string | null;
  };
  sampleCustomerName: string;
  usedVariables: string[];
  messages: ResolvedGreetingBlock[];
  ready: boolean;
  reason: string | null;
};

export type GreetingStoreReadinessItem = {
  lineOfficialAccountId: string;
  lineOfficialAccountName: string;
  storeId: string | null;
  storeCode: string | null;
  storeName: string;
  province: string | null;
  region: string | null;
  googleMapsUrl: string | null;
  readinessStatus: "READY" | "BLOCKED";
  missingVariables: string[];
  reason: string | null;
  isAssigned: boolean;
  currentTemplateId: string | null;
  currentTemplateName: string | null;
};

export type GreetingReadinessResponseDto = {
  templateId: string;
  templateName: string;
  usedVariables: string[];
  totalStores: number;
  readyStores: number;
  blockedStores: number;
  assignedStores: number;
  stores: GreetingStoreReadinessItem[];
};
