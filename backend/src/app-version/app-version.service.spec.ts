import test from "node:test";
import assert from "node:assert/strict";
import { AppPlatform } from "@prisma/client";
import { AppVersionService } from "./app-version.service";
import { PrismaService } from "../prisma.service";

const releaseNotes = [
  "Makes the Customer Sales Information header readable on narrow Android screens",
  "Moves Clear all and Save to a second action row when horizontal space is limited",
  "Preserves existing Customer Sales Info tagging and persistence behavior",
];

const apkUrl =
  "https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.12-production.apk?sha=376a29715cf143b1d92697990d22f8261fb246b7f9e1a80de5b8c621d90da82e";
const sha256 =
  "376a29715cf143b1d92697990d22f8261fb246b7f9e1a80de5b8c621d90da82e";

test("AppVersionService returns active Android release with correct structure", async () => {
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({
        id: "rel-1",
        platform: AppPlatform.ANDROID,
        version: "1.0.12",
        buildNumber: 13,
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

  assert.equal(version.latestVersion, "1.0.12");
  assert.equal(version.buildNumber, 13);
  assert.equal(version.minimumSupportedVersion, "1.0.3");
  assert.equal(version.minimumSupportedBuildNumber, 4);
  assert.equal(version.forceUpdate, false);
  assert.equal(version.apkUrl, apkUrl);
  assert.equal(version.apkSize, "56.9 MB");
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

  assert.equal(version.latestVersion, "1.0.12");
  assert.equal(version.buildNumber, 13);
  assert.equal(version.apkUrl, apkUrl);
  assert.equal(version.apkSize, "56.9 MB");
  assert.equal(version.sha256, sha256);
  assert.deepEqual(version.releaseNotes, releaseNotes);
});

test("AppVersionService tracks download increments successfully", async () => {
  let updatedId = "";
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({ id: "rel-1", buildNumber: 13 }),
      update: async (args: { where: { id: string } }) => {
        updatedId = args.where.id;
        return {};
      },
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const res = await service.trackDownload(AppPlatform.ANDROID, 13);

  assert.equal(res.success, true);
  assert.equal(updatedId, "rel-1");
});
