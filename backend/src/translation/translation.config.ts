import { Injectable } from "@nestjs/common";

export type TranslationProviderName = "none" | "google";
export type GoogleTranslationCredentials = { client_email: string; private_key: string };

export type MessageTranslationConfig = {
  enabled: boolean;
  pilotMode: boolean;
  allowedAdminIds: string[];
  dailyCharacterLimit: number;
  rateLimitPerMinute: number;
  provider: TranslationProviderName;
  google: { projectId: string; credentials: GoogleTranslationCredentials } | null;
};

const DEFAULT_TRANSLATION_RATE_LIMIT_PER_MINUTE = 20;
export const DEFAULT_TRANSLATION_DAILY_CHARACTER_LIMIT = 50_000;

function readBooleanFlag(name: string, value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === undefined || normalized === "" || normalized === "false") return false;
  if (normalized === "true") return true;
  throw new Error(`${name} must be true or false`);
}

export function readMessageTranslationEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return readBooleanFlag("MESSAGE_TRANSLATION_ENABLED", environment.MESSAGE_TRANSLATION_ENABLED);
}

export function readTranslationPilotMode(environment: NodeJS.ProcessEnv = process.env): boolean {
  return readBooleanFlag("TRANSLATION_PILOT_MODE", environment.TRANSLATION_PILOT_MODE);
}

export function readTranslationRateLimitPerMinute(environment: NodeJS.ProcessEnv = process.env): number {
  const raw = environment.TRANSLATION_RATE_LIMIT_PER_MINUTE?.trim();
  if (!raw) return DEFAULT_TRANSLATION_RATE_LIMIT_PER_MINUTE;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("TRANSLATION_RATE_LIMIT_PER_MINUTE must be a positive integer");
  return value;
}

export function readTranslationPilotAllowedAdminIds(environment: NodeJS.ProcessEnv = process.env): string[] {
  const values = environment.TRANSLATION_PILOT_ALLOWED_ADMIN_IDS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  return [...new Set(values)];
}

export function readTranslationDailyCharacterLimit(environment: NodeJS.ProcessEnv = process.env): number {
  const raw = environment.TRANSLATION_DAILY_CHARACTER_LIMIT?.trim();
  if (!raw) return DEFAULT_TRANSLATION_DAILY_CHARACTER_LIMIT;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("TRANSLATION_DAILY_CHARACTER_LIMIT must be a positive integer");
  return value;
}

export function readTranslationProvider(environment: NodeJS.ProcessEnv = process.env): TranslationProviderName {
  const value = environment.TRANSLATION_PROVIDER?.trim().toLowerCase();
  if (value === undefined || value === "" || value === "none") return "none";
  if (value === "google") return "google";
  throw new Error("TRANSLATION_PROVIDER must be none or google");
}

function readGoogleCredentials(raw: string): GoogleTranslationCredentials {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("GOOGLE_TRANSLATION_CREDENTIALS_JSON must be valid JSON"); }
  if (!parsed || typeof parsed !== "object") throw new Error("GOOGLE_TRANSLATION_CREDENTIALS_JSON must contain a service account object");
  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.client_email !== "string" || !candidate.client_email.trim() || typeof candidate.private_key !== "string" || !candidate.private_key.trim()) {
    throw new Error("GOOGLE_TRANSLATION_CREDENTIALS_JSON must contain client_email and private_key");
  }
  return { client_email: candidate.client_email, private_key: candidate.private_key };
}

export function readGoogleTranslationProviderOptions(environment: NodeJS.ProcessEnv = process.env): MessageTranslationConfig["google"] {
  const projectId = environment.GOOGLE_TRANSLATION_PROJECT_ID?.trim();
  const credentialsJson = environment.GOOGLE_TRANSLATION_CREDENTIALS_JSON?.trim();
  if (!projectId || !credentialsJson) return null;
  return { projectId, credentials: readGoogleCredentials(credentialsJson) };
}

export function readMessageTranslationConfig(environment: NodeJS.ProcessEnv = process.env): MessageTranslationConfig {
  const enabled = readMessageTranslationEnabled(environment);
  const pilotMode = readTranslationPilotMode(environment);
  const allowedAdminIds = readTranslationPilotAllowedAdminIds(environment);
  const dailyCharacterLimit = readTranslationDailyCharacterLimit(environment);
  const rateLimitPerMinute = readTranslationRateLimitPerMinute(environment);
  const provider = readTranslationProvider(environment);
  if (!enabled || !pilotMode || provider !== "google") return { enabled, pilotMode, allowedAdminIds, dailyCharacterLimit, rateLimitPerMinute, provider, google: null };
  return { enabled, pilotMode, allowedAdminIds, dailyCharacterLimit, rateLimitPerMinute, provider, google: readGoogleTranslationProviderOptions(environment) };
}

@Injectable()
export class TranslationConfig {
  readonly enabled: boolean;
  readonly pilotMode: boolean;
  readonly allowedAdminIds: string[];
  readonly dailyCharacterLimit: number;
  readonly rateLimitPerMinute: number;
  readonly provider: TranslationProviderName;
  readonly google: MessageTranslationConfig["google"];

  constructor() {
    const config = readMessageTranslationConfig();
    this.enabled = config.enabled;
    this.pilotMode = config.pilotMode;
    this.allowedAdminIds = config.allowedAdminIds;
    this.dailyCharacterLimit = config.dailyCharacterLimit;
    this.rateLimitPerMinute = config.rateLimitPerMinute;
    this.provider = config.provider;
    this.google = config.google;
  }
}
