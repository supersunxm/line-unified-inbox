import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationSql = readFileSync(
  "prisma/migrations/20260730173000_add_product_alias_source/migration.sql",
  "utf8",
);

void test("ProductAlias provenance migration conservatively defaults existing rows to MANUAL", () => {
  assert.match(migrationSql, /CREATE TYPE "ProductAliasSource" AS ENUM \('CATALOG', 'MANUAL'\)/);
  assert.match(migrationSql, /ADD COLUMN "source" "ProductAliasSource" NOT NULL DEFAULT 'MANUAL'/);
  assert.doesNotMatch(migrationSql, /DELETE|ConversationProduct|ProductModel/i);
});
