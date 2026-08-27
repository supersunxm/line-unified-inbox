import {
  AutoResponseContentType,
  AutoResponseExecutionStatus,
  AutoResponseStatus,
  AutoResponseTriggerType,
} from "@prisma/client";

export type CreateAutoResponseDto = {
  name: string;
  description?: string | null;
  textTemplate: string;
};

export type UpdateAutoResponseDto = Partial<CreateAutoResponseDto> & {
  status?: AutoResponseStatus;
};

export type AutoResponsePreviewDto = {
  lineOfficialAccountId?: string;
  storeId?: string;
};

export type AutoResponseRuleResponseDto = {
  id: string;
  name: string;
  description: string | null;
  status: AutoResponseStatus;
  triggerType: AutoResponseTriggerType;
  contentType: AutoResponseContentType;
  textTemplate: string;
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
