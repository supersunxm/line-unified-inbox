import test from "node:test";
import assert from "node:assert/strict";
import { AppPlatform } from "@prisma/client";
import { AppVersionService } from "./app-version.service";
import { PrismaService } from "../prisma.service";

const releaseNotes = [
  "Customer status can now remain unset when neither Interested nor Purchased applies",
  "Removing interest level, purchase channel, and payment method now persists correctly",
  "Product quantity changes and Clear all now persist to the backend",
  "Keeps Customer Sales Info consistent after close, Android Back, and reopen",
];

const apkUrl =
  "https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.11-production.apk?sha=38b0e53d7ddb34b15fb2f1bae223048155a268d85ff0df5a0bc179c0f296f4ab";
const sha256 =
  "38b0e53d7ddb34b15fb2f1bae223048155a268d85ff0df5a0bc179c0f296f4ab";

test("AppVersionService returns active Android release with correct structure", async () => {
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({
        id: "rel-1",
        platform: AppPlatform.ANDROID,
        version: "1.0.11",
        buildNumber: 12,
        minimumSupportedVersion: "1.0.3",
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl,
        apkSize: "56.8 MB",
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

  assert.equal(version.latestVersion, "1.0.11");
  assert.equal(version.buildNumber, 12);
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

  assert.equal(version.latestVersion, "1.0.11");
  assert.equal(version.buildNumber, 12);
  assert.equal(version.apkUrl, apkUrl);
  assert.equal(version.sha256, sha256);
  assert.deepEqual(version.releaseNotes, releaseNotes);
});

test("AppVersionService tracks download increments successfully", async () => {
  let updatedId = "";
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({ id: "rel-1", buildNumber: 12 }),
      update: async (args: { where: { id: string } }) => {
        updatedId = args.where.id;
        return {};
      },
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const res = await service.trackDownload(AppPlatform.ANDROID, 12);

  assert.equal(res.success, true);
  assert.equal(updatedId, "rel-1");
});
