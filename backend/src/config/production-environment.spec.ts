import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionEnvironment } from "./production-environment";

const valid = { NODE_ENV: "production", DATABASE_URL: "postgresql://user:password@host/db", FRONTEND_URL: "http://localhost:3000", PUBLIC_WEBHOOK_BASE_URL: "https://example.up.railway.app", LINE_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), LINE_WEBHOOK_ENABLED: "true", PILOT_MODE: "true", PILOT_ADMIN_BOOTSTRAP_ENABLED: "false", EMAIL_PROVIDER: "none", DEV_ADMIN_ENABLED: "false", MEDIA_STORAGE_ENABLED: "false", FRIEND_SOURCE_PUBLIC_BASE_URL: "https://friends.example.com", FRIEND_SOURCE_IP_HASH_KEY: "prod-secret-hash-key" };
void test("valid Railway production environment passes", () => assert.doesNotThrow(() => validateProductionEnvironment(valid)));
void test("missing production variables fail clearly", () => assert.throws(() => validateProductionEnvironment({ NODE_ENV: "production" }), /Missing required production environment variables/));
void test("missing FRIEND_SOURCE production variables fail validation", () => {
  const missingBaseUrl = { ...valid }; delete (missingBaseUrl as any).FRIEND_SOURCE_PUBLIC_BASE_URL;
  assert.throws(() => validateProductionEnvironment(missingBaseUrl), /FRIEND_SOURCE_PUBLIC_BASE_URL/);
  const missingKey = { ...valid }; delete (missingKey as any).FRIEND_SOURCE_IP_HASH_KEY;
  assert.throws(() => validateProductionEnvironment(missingKey), /FRIEND_SOURCE_IP_HASH_KEY/);
});
void test("development admin and console email fail closed in production", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid, DEV_ADMIN_ENABLED: "true" }), /must never/);
  assert.throws(() => validateProductionEnvironment({ ...valid, EMAIL_PROVIDER: "console" }), /not allowed/);
});
void test("Resend production email configuration requires the API key and sender address", () => {
  assert.doesNotThrow(() => validateProductionEnvironment({ ...valid, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "resend-secret", EMAIL_FROM_ADDRESS: "no-reply@lineoppo.click" }));
  assert.throws(() => validateProductionEnvironment({ ...valid, EMAIL_PROVIDER: "resend", EMAIL_FROM_ADDRESS: "no-reply@lineoppo.click" }), /RESEND_API_KEY and EMAIL_FROM_ADDRESS/);
  assert.throws(() => validateProductionEnvironment({ ...valid, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "resend-secret" }), /RESEND_API_KEY and EMAIL_FROM_ADDRESS/);
});
void test("enabled pilot admin bootstrap is validated before startup", () => {
  const enabled = { ...valid, PILOT_ADMIN_BOOTSTRAP_ENABLED: "true", PILOT_ADMIN_USERNAME: "pilot", PILOT_ADMIN_PASSWORD: "A strong pilot password" };
  assert.doesNotThrow(() => validateProductionEnvironment(enabled));
  assert.throws(() => validateProductionEnvironment({ ...enabled, PILOT_ADMIN_USERNAME: "" }), /PILOT_ADMIN_USERNAME is required/);
  assert.throws(() => validateProductionEnvironment({ ...enabled, PILOT_ADMIN_PASSWORD: "password123" }), /at least 12 characters|common password/);
});
void test("production media storage is optional and disabled by default", () => {
  assert.doesNotThrow(() => validateProductionEnvironment(valid));
  const withoutFlag: NodeJS.ProcessEnv = { ...valid };
  delete withoutFlag.MEDIA_STORAGE_ENABLED;
  assert.doesNotThrow(() => validateProductionEnvironment(withoutFlag));
});
void test("invalid production media flag fails with the exact configuration error", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid, MEDIA_STORAGE_ENABLED: "yes" }), { message: "MEDIA_STORAGE_ENABLED must be true or false" });
});
void test("enabled production media requires the s3 driver", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid, MEDIA_STORAGE_ENABLED: "true" }), /MEDIA_STORAGE_DRIVER is required/);
  assert.throws(() => validateProductionEnvironment({ ...valid, MEDIA_STORAGE_ENABLED: "true", MEDIA_STORAGE_DRIVER: "local" }), /must be s3/);
});
void test("enabled production media reports missing S3 configuration together", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid, MEDIA_STORAGE_ENABLED: "true", MEDIA_STORAGE_DRIVER: "s3" }), /S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/);
});
void test("enabled Google Drive media requires OAuth refresh-token configuration", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid, MEDIA_STORAGE_ENABLED: "true", GOOGLE_DRIVE_ENABLED: "true" }), /GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID/);
  assert.doesNotThrow(() => validateProductionEnvironment({ ...valid, MEDIA_STORAGE_ENABLED: "true", GOOGLE_DRIVE_ENABLED: "true", GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret", GOOGLE_REFRESH_TOKEN: "refresh-token", GOOGLE_DRIVE_FOLDER_ID: "folder-id" }));
});
void test("enabled production media accepts complete non-placeholder S3 configuration", () => {
  assert.doesNotThrow(() => validateProductionEnvironment({ ...valid, MEDIA_STORAGE_ENABLED: "true", MEDIA_STORAGE_DRIVER: "s3", S3_REGION: "ap-southeast-1", S3_BUCKET: "oppo-pilot-media-9821", S3_ACCESS_KEY_ID: "AKIA7Q6M2N8R4V1C9Z3P", S3_SECRET_ACCESS_KEY: "n7VQ2rM9xK4pL8sC6wT1yB5dF3hJ0uG2aE9zX7q" }));
});
