import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(join(__dirname, "../../prisma/migrations/20260815110000_add_detailed_manual_tags/migration.sql"), "utf8");

void test("source migration preserves NULL as empty and single values as arrays", () => {
  assert.match(migration, /ADD COLUMN "sourceChannels"/);
  assert.match(migration, /DEFAULT ARRAY\[\]::"ConversationSourceChannel"\[\]/);
  assert.match(migration, /WHERE "sourceChannel" IS NOT NULL/);
  assert.match(migration, /DROP COLUMN "sourceChannel"/);
});

void test("detailed tag migration adds installment and variant constraints without destructive deletes", () => {
  assert.match(migration, /ADD COLUMN "isInstallment" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(migration, /CREATE TABLE "ProductVariant"/);
  assert.match(migration, /ProductVariant_productModelId_variantKey_key/);
  assert.match(migration, /ConversationProduct_productVariantId_fkey/);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE/);
});
