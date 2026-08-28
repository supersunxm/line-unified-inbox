import {
  AutoResponseContentType,
  AutoResponseExecutionOutcome,
  AutoResponseIntent,
  AutoResponsePilotMode,
  AutoResponseStatus,
  AutoResponseTriggerType,
} from "@prisma/client";

export type AutoResponseTextBlock = {
  id: string;
  type: "TEXT";
  textTemplate: string;
};

export type AutoResponseImageBlock = {
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

export type AutoResponseMessageBlock = AutoResponseTextBlock | AutoResponseImageBlock;

export type AutoResponseContentJson = {
  version: number;
  messages: AutoResponseMessageBlock[];
};

export type AutoResponseTextTriggerConfig = {
  matcherVersion: number;
  reviewedAliases?: string[];
};

export type CreateAutoResponseDto = {
  name: string;
  description?: string | null;
  textTemplate?: string;
  messages?: AutoResponseMessageBlock[];
  triggerType?: AutoResponseTriggerType;
  intent?: AutoResponseIntent | null;
  scopeStoreId?: string | null;
  triggerConfig?: AutoResponseTextTriggerConfig | null;
};

export type UpdateAutoResponseDto = {
  name?: string;
  description?: string | null;
  textTemplate?: string;
  messages?: AutoResponseMessageBlock[];
  status?: AutoResponseStatus;
  triggerType?: AutoResponseTriggerType;
  intent?: AutoResponseIntent | null;
  scopeStoreId?: string | null;
  triggerConfig?: AutoResponseTextTriggerConfig | null;
};

export type AutoResponsePreviewDto = {
  lineOfficialAccountId?: string;
  storeId?: string;
};

export type AutoResponseUploadMediaResult = {
  mediaObjectKey: string;
  previewObjectKey: string;
  imageUrl: string;
  previewUrl: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
};

export type AutoResponseRuleResponseDto = {
  id: string;
  name: string;
  description: string | null;
  status: AutoResponseStatus;
  triggerType: AutoResponseTriggerType;
  intent: AutoResponseIntent | null;
  scopeStoreId: string | null;
  scopeStoreExternalId: string | null;
  triggerConfig: AutoResponseTextTriggerConfig | null;
  contentType: AutoResponseContentType;
  textTemplate: string;
  contentJson: AutoResponseContentJson | null;
  messages: AutoResponseMessageBlock[];
  version: number;
  usedVariables: string[];
  usageCount: number;
  linkedRichMenus?: Array<{
    templateId: string;
    templateName: string;
    templateStatus: string;
    areaCount: number;
  }>;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastActivatedAt: Date | null;
  archivedAt: Date | null;
};

export type ResolvedAutoResponseBlock =
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

export type AutoResponsePreviewResult = {
  ruleId: string;
  ruleName: string;
  store: {
    lineOfficialAccountId: string;
    lineOfficialAccountName: string;
    storeId: string | null;
    storeName: string;
    externalStoreId: string | null;
    googleMapsUrl: string | null;
  };
  usedVariables: string[];
  resolvedText: string;
  unresolvedVariables: string[];
  messages: ResolvedAutoResponseBlock[];
  ready: boolean;
  reason: string | null;
};

export type AutoResponseUsageResponseDto = {
  ruleId: string;
  ruleName: string;
  usageCount: number;
  linkedRichMenus: Array<{
    templateId: string;
    templateName: string;
    templateStatus: string;
    areaCount: number;
  }>;
};

export type AutoResponsePilotSummaryDto = {
  mode: AutoResponsePilotMode;
  storeExternalId: string;
  matcherVersion: number;
  counts: {
    totalEligibleInboundTexts: number;
    storeLocationMatches: number;
    financeInfoMatches: number;
    excluded: number;
    ambiguous: number;
    noMatch: number;
    wouldSend: number;
    sent: number;
    failed: number;
    duplicate: number;
  };
  recent: Array<{
    intent: AutoResponseIntent | null;
    outcome: AutoResponseExecutionOutcome | null;
    mode: AutoResponsePilotMode | null;
    reason: string | null;
    createdAt: Date;
  }>;
};
