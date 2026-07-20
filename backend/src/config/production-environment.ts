import { readPilotAdminBootstrapConfig } from "../auth/pilot-admin-bootstrap.config";

import { readMediaStorageEnabled } from "../media/media-storage.config";

const requiredProductionVariables = ["DATABASE_URL", "FRONTEND_URL", "PUBLIC_WEBHOOK_BASE_URL", "LINE_CREDENTIAL_ENCRYPTION_KEY", "LINE_WEBHOOK_ENABLED", "PILOT_MODE", "PILOT_ADMIN_BOOTSTRAP_ENABLED", "EMAIL_PROVIDER"] as const;

function validUrl(value: string, protocols: string[]) {
  try { const url = new URL(value); return protocols.includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}

export function validateProductionEnvironment(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.NODE_ENV !== "production") return;
  const missing = requiredProductionVariables.filter((name) => !environment[name]?.trim());
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  if (!environment.DATABASE_URL?.startsWith("postgresql://") && !environment.DATABASE_URL?.startsWith("postgres://")) throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  if (!validUrl(environment.FRONTEND_URL!, ["http:", "https:"])) throw new Error("FRONTEND_URL must be a valid HTTP(S) origin without credentials");
  if (!validUrl(environment.PUBLIC_WEBHOOK_BASE_URL!, ["https:"])) throw new Error("PUBLIC_WEBHOOK_BASE_URL must be a valid HTTPS origin without credentials");
  const encryptionKey = Buffer.from(environment.LINE_CREDENTIAL_ENCRYPTION_KEY!, "base64");
  if (encryptionKey.length !== 32 || encryptionKey.toString("base64") !== environment.LINE_CREDENTIAL_ENCRYPTION_KEY) throw new Error("LINE_CREDENTIAL_ENCRYPTION_KEY must be exactly 32 bytes encoded as Base64");
  if (environment.DEV_ADMIN_ENABLED === "true") throw new Error("DEV_ADMIN_ENABLED must never be true in production");
  if (environment.LINE_WEBHOOK_ENABLED !== "true" && environment.LINE_WEBHOOK_ENABLED !== "false") throw new Error("LINE_WEBHOOK_ENABLED must be true or false");
  if (environment.PILOT_MODE !== "true" && environment.PILOT_MODE !== "false") throw new Error("PILOT_MODE must be true or false");
  if (environment.PILOT_ADMIN_BOOTSTRAP_ENABLED !== "true" && environment.PILOT_ADMIN_BOOTSTRAP_ENABLED !== "false") throw new Error("PILOT_ADMIN_BOOTSTRAP_ENABLED must be true or false");
  if (readMediaStorageEnabled(environment)) {
    if (!environment.MEDIA_STORAGE_DRIVER?.trim()) throw new Error("Media storage is enabled but configuration is invalid: MEDIA_STORAGE_DRIVER is required and must be s3");
    if (environment.MEDIA_STORAGE_DRIVER.trim().toLowerCase() !== "s3") throw new Error("Media storage is enabled but configuration is invalid: MEDIA_STORAGE_DRIVER must be s3 in production");
    const requiredS3 = ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;
    const missingS3 = requiredS3.filter((name) => !environment[name]?.trim());
    if (missingS3.length) throw new Error(`Media storage is enabled but required S3 variables are missing: ${missingS3.join(", ")}`);
    const placeholders = requiredS3.filter((name) => /(test|fake|example|placeholder|changeme|your[-_])/i.test(environment[name]!.trim()));
    if (placeholders.length) throw new Error(`Media storage S3 variables contain placeholder values: ${placeholders.join(", ")}`);
  }
  readPilotAdminBootstrapConfig(environment);
  const emailProvider = environment.EMAIL_PROVIDER!.trim().toLowerCase();
  if (emailProvider === "console") throw new Error("EMAIL_PROVIDER=console is not allowed in production");
  if (emailProvider === "resend" && (!environment.RESEND_API_KEY?.trim() || !environment.EMAIL_FROM?.trim())) throw new Error("RESEND_API_KEY and EMAIL_FROM are required when EMAIL_PROVIDER=resend");
  if (emailProvider !== "none" && emailProvider !== "resend") throw new Error("EMAIL_PROVIDER must be none or resend in production");
}

export { requiredProductionVariables };
