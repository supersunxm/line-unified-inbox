import { Injectable } from "@nestjs/common";

export type TranslationProviderName = "none" | "google";
export type GoogleTranslationCredentials = { client_email: string; private_key: string };

export type MessageTranslationConfig = {
  enabled: boolean;
  provider: TranslationProviderName;
  google: { projectId: string; credentials: GoogleTranslationCredentials } | null;
};

export function readMessageTranslationEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  const value = environment.MESSAGE_TRANSLATION_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error("MESSAGE_TRANSLATION_ENABLED must be true or false");
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
  const provider = readTranslationProvider(environment);
  if (!enabled || provider !== "google") return { enabled, provider, google: null };
  return { enabled, provider, google: readGoogleTranslationProviderOptions(environment) };
}

@Injectable()
export class TranslationConfig {
  readonly enabled: boolean;
  readonly provider: TranslationProviderName;
  readonly google: MessageTranslationConfig["google"];

  constructor() {
    const config = readMessageTranslationConfig();
    this.enabled = config.enabled;
    this.provider = config.provider;
    this.google = config.google;
  }
}
