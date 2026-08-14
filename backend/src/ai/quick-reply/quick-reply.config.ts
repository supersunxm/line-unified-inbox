import { Injectable } from "@nestjs/common";

export type QuickReplyProviderMode = "deterministic";

export interface QuickReplyFeatureConfig {
  enabled: boolean;
  provider: QuickReplyProviderMode;
  allowedPlatformRoles: Array<"ADMIN" | "VIEWER">;
  allowedMembershipRoles: Array<"STORE_MANAGER" | "STAFF">;
  allowedUserIds: string[];
  allowedStoreIds: string[];
  locales: Array<"th" | "en" | "zh">;
  maxSuggestions: number;
  suggestionTtlSeconds: number;
  timeoutMs: number;
  requestsPerUserPerMinute: number;
}

const parseBoolean = (value: string | undefined) => value?.trim().toLowerCase() === "true";
const parseList = (value: string | undefined) => value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
const parseBoundedInt = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function readQuickReplyConfig(environment: NodeJS.ProcessEnv = process.env): QuickReplyFeatureConfig {
  const configuredLocales = parseList(environment.AI_QUICK_REPLY_LOCALES).filter((locale): locale is "th" | "en" | "zh" => locale === "th" || locale === "en" || locale === "zh");
  return {
    enabled: parseBoolean(environment.AI_QUICK_REPLY_ENABLED),
    provider: "deterministic",
    allowedPlatformRoles: ["ADMIN", "VIEWER"],
    allowedMembershipRoles: ["STORE_MANAGER", "STAFF"],
    allowedUserIds: parseList(environment.AI_QUICK_REPLY_ALLOWED_USER_IDS),
    allowedStoreIds: parseList(environment.AI_QUICK_REPLY_ALLOWED_STORE_IDS),
    locales: configuredLocales.length > 0 ? configuredLocales : ["th", "en", "zh"],
    maxSuggestions: parseBoundedInt(environment.AI_QUICK_REPLY_MAX_SUGGESTIONS, 3, 1, 3),
    suggestionTtlSeconds: parseBoundedInt(environment.AI_QUICK_REPLY_TTL_SECONDS, 120, 30, 600),
    timeoutMs: parseBoundedInt(environment.AI_QUICK_REPLY_TIMEOUT_MS, 1500, 250, 5000),
    requestsPerUserPerMinute: parseBoundedInt(environment.AI_QUICK_REPLY_RATE_LIMIT_PER_MINUTE, 10, 1, 60),
  };
}

@Injectable()
export class QuickReplyConfigService {
  get(): QuickReplyFeatureConfig {
    return readQuickReplyConfig();
  }
}
