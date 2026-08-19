import test from "node:test";
import assert from "node:assert/strict";
import { AppPlatform } from "@prisma/client";
import { AppVersionService } from "./app-version.service";
import { PrismaService } from "../prisma.service";

const releaseNotes = [
  "Persists product-tag deletion immediately when the trash icon is pressed",
  "Removing the final tagged product now saves an empty product list to the backend",
  "Restores the previous product list if deleting a tag fails to save",
  "Includes Customer Sales Info rehydration and tagging reliability fixes from previous hotfixes",
];

const apkUrl =
  "https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.10-production.apk?sha=50f19b2c71c003946b863bf3d23e2b4870ff2a6f4291af26c5db445249c837e5";
const sha256 =
  "50f19b2c71c003946b863bf3d23e2b4870ff2a6f4291af26c5db445249c837e5";

test("AppVersionService returns active Android release with correct structure", async () => {
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({
        id: "rel-1",
        platform: AppPlatform.ANDROID,
        version: "1.0.10",
        buildNumber: 11,
        minimumSupportedVersion: "1.0.3",
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl,
        apkSize: "56.9 MB",
        sha256,
        releaseNotes,
        isActive: true,
        downloadCount: 10,
      }),
      findMany: async () => [],
      upsert: async () => ({}),
      update: async () => ({}),
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const version = await service.getLatestVersion(AppPlatform.ANDROID);

  assert.equal(version.latestVersion, "1.0.10");
  assert.equal(version.buildNumber, 11);
  assert.equal(version.minimumSupportedVersion, "1.0.3");
  assert.equal(version.minimumSupportedBuildNumber, 4);
  assert.equal(version.forceUpdate, false);
  assert.equal(version.apkUrl, apkUrl);
  assert.equal(version.sha256, sha256);
  assert.deepEqual(version.releaseNotes, releaseNotes);
});

test("AppVersionService falls back safely when database returns null", async () => {
  const fakePrisma = {
    appRelease: {
      findFirst: async () => null,
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const version = await service.getLatestVersion(AppPlatform.ANDROID);

  assert.equal(version.latestVersion, "1.0.10");
  assert.equal(version.buildNumber, 11);
  assert.equal(version.apkUrl, apkUrl);
  assert.equal(version.sha256, sha256);
  assert.deepEqual(version.releaseNotes, releaseNotes);
});

test("AppVersionService tracks download increments successfully", async () => {
  let updatedId = "";
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({ id: "rel-1", buildNumber: 11 }),
      update: async (args: { where: { id: string } }) => {
        updatedId = args.where.id;
        return {};
      },
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const res = await service.trackDownload(AppPlatform.ANDROID, 11);

  assert.equal(res.success, true);
  assert.equal(updatedId, "rel-1");
});
