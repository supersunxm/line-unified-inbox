import test from "node:test";
import assert from "node:assert/strict";
import { AppPlatform } from "@prisma/client";
import { AppVersionService } from "./app-version.service";
import { PrismaService } from "../prisma.service";

const releaseNotes = [
  "Refreshes Customer Sales Info from the backend after Android Back, swipe, or sheet dismiss",
  "Prevents stale chat state from making confirmed product tags appear missing",
  "Keeps confirmed products, purchase channel, and payment method visible after reopening Sales Info",
  "Includes customer sales tagging persistence and backend audit fixes",
];

const apkUrl =
  "https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.9-production.apk?sha=390bf0d22afafad473724856acb33679ed809baef81019a218e47ed7748fe368";
const sha256 = "390bf0d22afafad473724856acb33679ed809baef81019a218e47ed7748fe368";

test("AppVersionService returns active Android release with correct structure", async () => {
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({
        id: "rel-1",
        platform: AppPlatform.ANDROID,
        version: "1.0.9",
        buildNumber: 10,
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

  assert.equal(version.latestVersion, "1.0.9");
  assert.equal(version.buildNumber, 10);
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

  assert.equal(version.latestVersion, "1.0.9");
  assert.equal(version.buildNumber, 10);
  assert.equal(version.apkUrl, apkUrl);
  assert.equal(version.sha256, sha256);
  assert.deepEqual(version.releaseNotes, releaseNotes);
});

test("AppVersionService tracks download increments successfully", async () => {
  let updatedId = "";
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({ id: "rel-1", buildNumber: 10 }),
      update: async (args: { where: { id: string } }) => {
        updatedId = args.where.id;
        return {};
      },
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const res = await service.trackDownload(AppPlatform.ANDROID, 10);

  assert.equal(res.success, true);
  assert.equal(updatedId, "rel-1");
});
