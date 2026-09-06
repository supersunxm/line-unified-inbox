import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { latestAndroidRelease } from "../src/app/download/releases.ts";

const pubspec = readFileSync(new URL("../../android_app/pubspec.yaml", import.meta.url), "utf8");
const versionMatch = pubspec.match(/^version:\s*([0-9.]+)\+(\d+)$/m);

void test("download metadata matches Android pubspec version", () => {
  assert.ok(versionMatch, "android_app/pubspec.yaml must contain version x.y.z+build");
  assert.ok(latestAndroidRelease.version.length > 0);
  assert.ok(latestAndroidRelease.build > 0);
  assert.ok(Number(versionMatch[2]) >= latestAndroidRelease.build);
});

void test("latest release APK exists on the public download surface", () => {
  const apkUrl = new URL(`../public/downloads/${latestAndroidRelease.fileName}`, import.meta.url);
  assert.equal(existsSync(apkUrl), true, `Missing latest APK: ${latestAndroidRelease.fileName}`);
  assert.equal(createHash("sha256").update(readFileSync(apkUrl)).digest("hex"), latestAndroidRelease.sha256);
});

void test("latest release always has a publish date and checksum", () => {
  assert.match(latestAndroidRelease.releasedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(latestAndroidRelease.releasedAtDisplay.length > 0);
  assert.match(latestAndroidRelease.sha256, /^[a-f0-9]{64}$/);
});

void test("web download and in-app update metadata are locked to the same release", () => {
  const migration = readFileSync(new URL("../../backend/prisma/migrations/20260906083000_release_android_1_1_16/migration.sql", import.meta.url), "utf8");
  assert.match(migration, new RegExp(`'${latestAndroidRelease.version.replaceAll(".", "\\.")}'`));
  assert.match(migration, new RegExp(`\\b${latestAndroidRelease.build}\\b`));
  assert.ok(migration.includes(latestAndroidRelease.fileName));
  assert.ok(migration.includes(latestAndroidRelease.sha256));
  assert.ok(migration.includes(latestAndroidRelease.size));
  for (const note of latestAndroidRelease.notes) assert.ok(migration.includes(note));
});
