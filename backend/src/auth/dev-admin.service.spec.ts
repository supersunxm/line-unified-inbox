import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { DevAdminService } from "./dev-admin.service";
import { PasswordService } from "./password.service";

void test("development admin is skipped when disabled", async () => {
  const previousEnabled = process.env.DEV_ADMIN_ENABLED; const previousNodeEnv = process.env.NODE_ENV;
  process.env.DEV_ADMIN_ENABLED = "false"; process.env.NODE_ENV = "development";
  try { await new DevAdminService({} as PrismaService, {} as PasswordService).onApplicationBootstrap(); }
  finally { process.env.DEV_ADMIN_ENABLED = previousEnabled; process.env.NODE_ENV = previousNodeEnv; }
});

void test("production rejects an enabled development admin", async () => {
  const previousEnabled = process.env.DEV_ADMIN_ENABLED; const previousNodeEnv = process.env.NODE_ENV;
  process.env.DEV_ADMIN_ENABLED = "true"; process.env.NODE_ENV = "production";
  try { await assert.rejects(() => new DevAdminService({} as PrismaService, {} as PasswordService).onApplicationBootstrap(), /must never be true in production/); }
  finally { process.env.DEV_ADMIN_ENABLED = previousEnabled; process.env.NODE_ENV = previousNodeEnv; }
});
