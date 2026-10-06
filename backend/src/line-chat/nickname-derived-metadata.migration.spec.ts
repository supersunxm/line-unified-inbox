import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(join(__dirname, "../../prisma/migrations/20261006070000_nickname_derived_metadata/migration.sql"), "utf8");

test("nickname-derived migration is additive and independent of sales/v2 fields", () => {
  assert.match(migration, /CREATE TABLE "NicknameDerivedMetadataState"/);
  assert.match(migration, /CREATE TABLE "NicknameDerivedMetadataApplication"/);
  assert.match(migration, /REFERENCES "NicknameSourceObservation"\("id"\)/);
  assert.match(migration, /REFERENCES "ProductModel"\("id"\)/);
  assert.match(migration, /nickname_derived_period_pair_check/);
  assert.match(migration, /nickname_derived_nonempty_check/);
  assert.doesNotMatch(migration, /UPDATE\s+"Conversation"/i);
  assert.doesNotMatch(migration, /"NicknameSourceState"/);
  assert.doesNotMatch(migration, /"onlineSource"/);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+"NicknameDerivedMetadataState"/i);
});

test("application history is database-enforced append-only", () => {
  assert.match(migration, /CREATE TRIGGER "NicknameDerivedMetadataApplication_immutable"/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "NicknameDerivedMetadataApplication"/);
  assert.match(migration, /NicknameDerivedMetadataApplication is append-only/);
});
