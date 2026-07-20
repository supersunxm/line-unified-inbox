import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionEnvironment } from "./production-environment";

const valid = { NODE_ENV: "production", DATABASE_URL: "postgresql://user:password@host/db", FRONTEND_URL: "http://localhost:3000", PUBLIC_WEBHOOK_BASE_URL: "https://example.up.railway.app", LINE_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), LINE_WEBHOOK_ENABLED: "true", PILOT_MODE: "true", PILOT_ADMIN_BOOTSTRAP_ENABLED: "false", EMAIL_PROVIDER: "none", DEV_ADMIN_ENABLED: "false", MEDIA_STORAGE_DRIVER: "s3", S3_REGION: "ap-southeast-1", S3_BUCKET: "pilot-media", S3_ACCESS_KEY_ID: "test-access-key", S3_SECRET_ACCESS_KEY: "test-secret-key" };
void test("valid Railway production environment passes", () => assert.doesNotThrow(() => validateProductionEnvironment(valid)));
void test("missing production variables fail clearly", () => assert.throws(() => validateProductionEnvironment({ NODE_ENV: "production" }), /Missing required production environment variables/));
void test("development admin and console email fail closed in production", () => {
  assert.throws(() => validateProductionEnvironment({ ...valid, DEV_ADMIN_ENABLED: "true" }), /must never/);
  assert.throws(() => validateProductionEnvironment({ ...valid, EMAIL_PROVIDER: "console" }), /not allowed/);
});
void test("enabled pilot admin bootstrap is validated before startup", () => {
  const enabled = { ...valid, PILOT_ADMIN_BOOTSTRAP_ENABLED: "true", PILOT_ADMIN_USERNAME: "pilot", PILOT_ADMIN_PASSWORD: "A strong pilot password" };
  assert.doesNotThrow(() => validateProductionEnvironment(enabled));
  assert.throws(() => validateProductionEnvironment({ ...enabled, PILOT_ADMIN_USERNAME: "" }), /PILOT_ADMIN_USERNAME is required/);
  assert.throws(() => validateProductionEnvironment({ ...enabled, PILOT_ADMIN_PASSWORD: "password123" }), /at least 12 characters|common password/);
});
