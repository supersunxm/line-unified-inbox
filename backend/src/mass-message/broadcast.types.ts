import { MassMessageStoreMode } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import type {
  BroadcastAdvancedInput,
  BroadcastMessage,
  BroadcastScheduleInput,
  BroadcastTargetingInput,
} from "./broadcast-targeting";

export type BroadcastStoreSelectionInput = {
  mode: MassMessageStoreMode;
  storeIds?: string[];
};

export type BroadcastPreviewInput = {
  storeSelection: BroadcastStoreSelectionInput;
  targeting: BroadcastTargetingInput;
  advanced?: BroadcastAdvancedInput;
  messages?: Array<Record<string, unknown>>;
};

export type BroadcastCreateInput = Omit<BroadcastPreviewInput, "messages"> & {
  campaignRequestId: string;
  title?: string;
  messages: Array<Record<string, unknown>>;
  schedule?: BroadcastScheduleInput;
};

export type BroadcastDraftInput = BroadcastCreateInput;

export type BroadcastScopeItem = {
  storeId: string;
  masterStoreId: string | null;
  externalStoreId: string | null;
  storeName: string;
  storeCode: string | null;
  storeLocationText: string | null;
  missingVariables: string[];
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  encryptedChannelAccessToken: string | null;
  isEligible: boolean;
  skipReason: string | null;
  warnings: string[];
  estimatedReach: number | null;
  targetReach: number | null;
  followerCount: number | null;
  snapshotDate: string | null;
};

export type BroadcastStorePreview = Omit<
  BroadcastScopeItem,
  "encryptedChannelAccessToken"
> & {
  status: "READY" | "BLOCKED";
};

export type BroadcastPreviewResult = {
  storeCount: number;
  readyStoreCount: number;
  blockedStoreCount: number;
  warningStoreCount: number;
  estimatedReach: number;
  stores: BroadcastStorePreview[];
};

export type BroadcastCampaignPayload = {
  messages: BroadcastMessage[];
  broadcast: {
    targeting: BroadcastTargetingInput;
    advanced: {
      allowPartial: boolean;
      maxVolume: number | null;
    };
    schedule: BroadcastScheduleInput;
  };
};

export type BroadcastRequestContext = {
  user: AuthUser;
};
