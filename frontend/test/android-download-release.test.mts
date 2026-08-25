import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { latestAndroidRelease } from "../src/app/download/releases.ts";

const pubspec = readFileSync(new URL("../../android_app/pubspec.yaml", import.meta.url), "utf8");
const versionMatch = pubspec.match(/^version:\s*([0-9.]+)\+(\d+)$/m);

void test("download metadata matches Android pubspec version", () => {
  assert.ok(versionMatch, "android_app/pubspec.yaml must contain version x.y.z+build");
  assert.equal(latestAndroidRelease.version, versionMatch[1]);
  assert.equal(latestAndroidRelease.build, Number(versionMatch[2]));
});

void test("latest release APK exists on the public download surface", () => {
  const apkUrl = new URL(`../public/downloads/${latestAndroidRelease.fileName}`, import.meta.url);
  assert.equal(existsSync(apkUrl), true, `Missing latest APK: ${latestAndroidRelease.fileName}`);
});

void test("latest release always has a publish date and checksum", () => {
  assert.match(latestAndroidRelease.releasedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(latestAndroidRelease.releasedAtDisplay.length > 0);
  assert.match(latestAndroidRelease.sha256, /^[a-f0-9]{64}$/);
});
