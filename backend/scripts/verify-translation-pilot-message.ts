import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { v3 } from "@google-cloud/translate";
import { GoogleTranslationProvider } from "../src/translation/providers/google-translation.provider";
import type { GoogleTranslationClient } from "../src/translation/providers/google-translation.provider";
import { PrismaService } from "../src/prisma.service";
import { TranslationAuditLogger } from "../src/translation/translation-audit.logger";
import {
  MessageTranslationConfig,
  readGoogleTranslationProviderOptions,
  readMessageTranslationConfig,
  readTranslationDailyCharacterLimit,
  readTranslationRateLimitPerMinute,
  TranslationConfig,
} from "../src/translation/translation.config";
import { TranslationFeedbackService } from "../src/translation/translation-feedback";
import { TranslationMetrics } from "../src/translation/translation-metrics";
import { InMemoryTranslationRateLimiter } from "../src/translation/translation-rate-limiter";
import { TranslationService } from "../src/translation/translation.service";
import { TranslationUsageBudget } from "../src/translation/translation-usage-budget";

const MESSAGE_ID = "a4af464d-954d-4a43-aadb-3fb55042e33b";
const CONFIRMATION = "TRANSLATE_CONTROLLED_MESSAGE";
type SafeProviderError = { code: string; messageCategory: string; status: string };
let capturedProviderError: SafeProviderError | null = null;
const TRANSLATION_ENVIRONMENT_KEYS = [
  "MESSAGE_TRANSLATION_ENABLED",
  "TRANSLATION_PROVIDER",
  "TRANSLATION_PILOT_MODE",
  "TRANSLATION_PILOT_ALLOWED_ADMIN_IDS",
  "TRANSLATION_RATE_LIMIT_PER_MINUTE",
  "TRANSLATION_DAILY_CHARACTER_LIMIT",
  "GOOGLE_TRANSLATION_PROJECT_ID",
  "GOOGLE_TRANSLATION_CREDENTIALS_JSON",
] as const;

function railwayVariables(service: string): NodeJS.ProcessEnv | null {
  try {
    const output = execFileSync("railway", ["variable", "list", "--service", service, "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output) as NodeJS.ProcessEnv;
  } catch {
    return null;
  }
}

type DatabaseSource = "explicit" | "railway" | "dotenv";

function databaseHost(databaseUrl: string): string {
  try { return new URL(databaseUrl).hostname; }
  catch { throw new Error("DATABASE_URL_INVALID"); }
}

function isLocalDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  const host = databaseHost(databaseUrl).toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function safeProviderError(error: unknown): SafeProviderError {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof candidate.code === "number" || typeof candidate.code === "string" ? String(candidate.code) : "UNKNOWN";
  const rawMessage = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  const statusByCode: Record<string, string> = {
    "3": "INVALID_ARGUMENT",
    "5": "NOT_FOUND",
    "7": "PERMISSION_DENIED",
    "8": "RESOURCE_EXHAUSTED",
    "14": "UNAVAILABLE",
    "16": "UNAUTHENTICATED",
  };
  const status = statusByCode[code] ?? "UNKNOWN";
  let messageCategory = "UNKNOWN_PROVIDER_FAILURE";
  if (/api.+(disabled|not enabled)|service.+(disabled|not enabled)|has not been used/.test(rawMessage)) messageCategory = "API_DISABLED";
  else if (code === "7") messageCategory = "IAM_PERMISSION";
  else if (code === "16") messageCategory = "AUTHENTICATION_FAILED";
  else if ((code === "3" || code === "5") && /(project|location|parent)/.test(rawMessage)) messageCategory = "INVALID_PROJECT_OR_LOCATION";
  else if (code === "3") messageCategory = "INVALID_REQUEST_PAYLOAD";
  else if (code === "8") messageCategory = "QUOTA_EXCEEDED";
  else if (code === "14") messageCategory = "PROVIDER_UNAVAILABLE";
  return { code, messageCategory, status };
}

function prepareEnvironment(): { databaseHost: string; databaseSource: DatabaseSource } {
  const explicitDatabaseUrl = process.env.DATABASE_URL?.trim();
  const explicitTranslation = Object.fromEntries(TRANSLATION_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));
  try { loadEnvFile(".env"); } catch { /* `.env` is only the final local fallback. */ }
  const envFileDatabaseUrl = process.env.DATABASE_URL?.trim();
  const envFileTranslation = Object.fromEntries(TRANSLATION_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));

  const backendVariables = railwayVariables(process.env.RAILWAY_BACKEND_SERVICE?.trim() || "line-unified-inbox");
  const shouldResolveRailwayDatabase = !explicitDatabaseUrl || isLocalDatabaseUrl(explicitDatabaseUrl);
  const databaseVariables = shouldResolveRailwayDatabase
    ? railwayVariables(process.env.RAILWAY_DATABASE_SERVICE?.trim() || "Postgres")
    : null;
  const railwayPublicDatabaseUrl = databaseVariables?.DATABASE_PUBLIC_URL?.trim();
  const selection = explicitDatabaseUrl && !isLocalDatabaseUrl(explicitDatabaseUrl)
    ? { databaseUrl: explicitDatabaseUrl, databaseSource: "explicit" as const }
    : railwayPublicDatabaseUrl
      ? { databaseUrl: railwayPublicDatabaseUrl, databaseSource: "railway" as const }
      : explicitDatabaseUrl
        ? { databaseUrl: explicitDatabaseUrl, databaseSource: "explicit" as const }
        : envFileDatabaseUrl
          ? { databaseUrl: envFileDatabaseUrl, databaseSource: "dotenv" as const }
          : null;
  const databaseUrl = selection?.databaseUrl;
  if (!databaseUrl) throw new Error("DATABASE_URL_UNAVAILABLE");
  process.env.DATABASE_URL = databaseUrl;

  for (const key of TRANSLATION_ENVIRONMENT_KEYS) {
    const resolved = explicitTranslation[key] || backendVariables?.[key] || envFileTranslation[key];
    if (resolved !== undefined) process.env[key] = resolved;
  }

  return { databaseHost: databaseHost(databaseUrl), databaseSource: selection.databaseSource };
}

function isReady(config: MessageTranslationConfig): config is MessageTranslationConfig & { google: NonNullable<MessageTranslationConfig["google"]> } {
  return config.enabled && config.pilotMode && config.provider === "google" && Boolean(config.google) && config.allowedAdminIds.length > 0;
}

async function localVerificationConfig(prisma: PrismaService): Promise<TranslationConfig> {
  const environmentConfig = readMessageTranslationConfig(process.env);
  if (isReady(environmentConfig)) return environmentConfig as TranslationConfig;

  const credentialPath = process.env.GOOGLE_TRANSLATION_CREDENTIALS_FILE?.trim()
    || join(homedir(), ".config", "oppo", "translation-benchmark-key.json");
  const credentialsJson = process.env.GOOGLE_TRANSLATION_CREDENTIALS_JSON?.trim()
    || await readFile(credentialPath, "utf8");
  const parsed = JSON.parse(credentialsJson) as { project_id?: unknown };
  const projectId = process.env.GOOGLE_TRANSLATION_PROJECT_ID?.trim()
    || (typeof parsed.project_id === "string" ? parsed.project_id.trim() : "");
  const google = readGoogleTranslationProviderOptions({
    GOOGLE_TRANSLATION_PROJECT_ID: projectId,
    GOOGLE_TRANSLATION_CREDENTIALS_JSON: credentialsJson,
  });
  if (!google) throw new Error("LOCAL_GOOGLE_CREDENTIALS_NOT_READY");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("ACTIVE_ADMIN_NOT_FOUND");

  return {
    enabled: true,
    pilotMode: true,
    allowedAdminIds: [admin.id],
    rateLimitPerMinute: readTranslationRateLimitPerMinute(process.env),
    dailyCharacterLimit: readTranslationDailyCharacterLimit(process.env),
    provider: "google",
    google,
  } as TranslationConfig;
}

async function main() {
  const confirmed = process.argv.includes(`--confirm=${CONFIRMATION}`) || process.env.TRANSLATION_LOCAL_PILOT_VERIFY === CONFIRMATION;
  if (!confirmed) throw new Error("LOCAL_CONFIRMATION_REQUIRED");

  const database = prepareEnvironment();
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const config = await localVerificationConfig(prisma);
    const translationReady = isReady(config);
    console.error(JSON.stringify({ databaseHost: database.databaseHost, databaseSource: database.databaseSource, translationReady }));
    const actingUserId = config.allowedAdminIds[0];
    if (!actingUserId || !config.google) throw new Error("TRANSLATION_CONFIGURATION_NOT_READY");
    const before = await prisma.message.findUnique({
      where: { id: MESSAGE_ID },
      select: { translatedEnglish: true },
    });
    console.error(JSON.stringify({ messageFound: Boolean(before) }));
    if (!before && isLocalDatabaseUrl(process.env.DATABASE_URL)) {
      console.log(JSON.stringify({ error: "LOCAL_DATABASE_SELECTED", hint: "Use Railway database for pilot verification" }));
      process.exitCode = 1;
      return;
    }
    if (!before) throw new Error("MESSAGE_NOT_FOUND");
    if (before.translatedEnglish !== null) throw new Error("ENGLISH_TRANSLATION_ALREADY_EXISTS");

    const googleClient = new v3.TranslationServiceClient({
      projectId: config.google.projectId,
      credentials: config.google.credentials,
    });
    const diagnosticClient: GoogleTranslationClient = {
      async translateText(request) {
        try { return await googleClient.translateText(request); }
        catch (error: unknown) {
          capturedProviderError = safeProviderError(error);
          throw error;
        }
      },
    };
    const google = new GoogleTranslationProvider({ ...config.google, client: diagnosticClient });
    let providerCalls = 0;
    const provider = {
      async translate(text: string, targetLanguage: "en" | "zh") {
        providerCalls += 1;
        return google.translate(text, targetLanguage);
      },
    };
    const metrics = new TranslationMetrics();
    const service = new TranslationService(
      prisma,
      config,
      provider,
      new InMemoryTranslationRateLimiter(config),
      new TranslationAuditLogger(),
      metrics,
      new TranslationUsageBudget(config),
      new TranslationFeedbackService(),
    );

    const result = await service.translateMessage(MESSAGE_ID, "en", actingUserId).finally(async () => {
      await googleClient.close();
    });
    const after = await prisma.message.findUnique({
      where: { id: MESSAGE_ID },
      select: { translatedEnglish: true },
    });
    const snapshot = metrics.snapshot();
    const translatedEnglishUpdated = Boolean(after?.translatedEnglish);
    if (result.status !== "TRANSLATED" || result.cached || providerCalls !== 1 || !translatedEnglishUpdated
      || snapshot.totalTranslationRequests !== 1 || snapshot.successfulTranslations !== 1
      || snapshot.failedTranslations !== 0 || snapshot.providerFailures !== 0 || snapshot.cacheHitCount !== 0) {
      throw new Error("TRANSLATION_VERIFICATION_FAILED");
    }

    console.log(JSON.stringify({
      status: result.status,
      providerCalls,
      translatedEnglishUpdated,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  if (capturedProviderError) console.error(JSON.stringify({ providerError: capturedProviderError }));
  else console.error(error instanceof Error ? error.message : "LOCAL_TRANSLATION_VERIFY_FAILED");
  process.exitCode = 1;
});
