import { MessageTranslationConfig, readMessageTranslationConfig } from "./translation.config";

export const TRANSLATION_PILOT_PRODUCTION_VERIFY_ARGUMENT = "--verify-production";

export type TranslationPilotPreflightChecks = {
  featureEnabled: boolean;
  googleProvider: boolean;
  pilotMode: boolean;
  allowlistConfigured: boolean;
  rateLimitConfigured: boolean;
  budgetConfigured: boolean;
  credentialsConfigured: boolean;
};

export type TranslationPilotPreflightResult = {
  ready: boolean;
  allowlistedAdminCount: number;
  checks: TranslationPilotPreflightChecks;
};

export class TranslationPilotPreflightError extends Error {
  constructor(readonly category: "PRODUCTION_VERIFICATION_MARKER_REQUIRED" | "INVALID_CONFIGURATION") {
    super(category);
    this.name = "TranslationPilotPreflightError";
  }
}

function createResult(config: MessageTranslationConfig): TranslationPilotPreflightResult {
  const checks: TranslationPilotPreflightChecks = {
    featureEnabled: config.enabled === true,
    googleProvider: config.provider === "google",
    pilotMode: config.pilotMode === true,
    allowlistConfigured: config.allowedAdminIds.length > 0,
    rateLimitConfigured: Number.isSafeInteger(config.rateLimitPerMinute) && config.rateLimitPerMinute > 0,
    budgetConfigured: Number.isSafeInteger(config.dailyCharacterLimit) && config.dailyCharacterLimit > 0,
    credentialsConfigured: config.google !== null,
  };
  return { ready: Object.values(checks).every(Boolean), allowlistedAdminCount: config.allowedAdminIds.length, checks };
}

export function runTranslationPilotPreflight(environment: NodeJS.ProcessEnv, arguments_: readonly string[] = []): TranslationPilotPreflightResult {
  if (environment.NODE_ENV === "production" && !arguments_.includes(TRANSLATION_PILOT_PRODUCTION_VERIFY_ARGUMENT)) {
    throw new TranslationPilotPreflightError("PRODUCTION_VERIFICATION_MARKER_REQUIRED");
  }
  try {
    return createResult(readMessageTranslationConfig(environment));
  } catch {
    throw new TranslationPilotPreflightError("INVALID_CONFIGURATION");
  }
}
