import test from "node:test";
import assert from "node:assert/strict";
import { AppPlatform } from "@prisma/client";
import { AppVersionService } from "./app-version.service";
import { PrismaService } from "../prisma.service";

test("AppVersionService returns active Android release with correct structure", async () => {
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({
        id: "rel-1",
        platform: AppPlatform.ANDROID,
        version: "1.0.8",
        buildNumber: 9,
        minimumSupportedVersion: "1.0.3",
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl:
          "https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.8-production.apk?sha=532fd6b7a706fc2c589aedab1d8e5522d2a66827cba220f75a0d8c62517b87e8",
        apkSize: "56.9 MB",
        sha256: "532fd6b7a706fc2c589aedab1d8e5522d2a66827cba220f75a0d8c62517b87e8",
        releaseNotes: [
          "Confirmed product selections are saved immediately",
          "Fixed product tags disappearing after closing Customer Sales Info",
          "Rehydrates saved product tagging from the backend response",
          "Prevents closing or changing product selection while a save is in progress",
          "Improved reliability of customer sales tagging persistence",
        ],
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

  assert.equal(version.latestVersion, "1.0.8");
  assert.equal(version.buildNumber, 9);
  assert.equal(version.minimumSupportedVersion, "1.0.3");
  assert.equal(version.minimumSupportedBuildNumber, 4);
  assert.equal(version.forceUpdate, false);
  assert.deepEqual(version.releaseNotes, [
    "Confirmed product selections are saved immediately",
    "Fixed product tags disappearing after closing Customer Sales Info",
    "Rehydrates saved product tagging from the backend response",
    "Prevents closing or changing product selection while a save is in progress",
    "Improved reliability of customer sales tagging persistence",
  ]);
});

test("AppVersionService falls back safely when database returns null", async () => {
  const fakePrisma = {
    appRelease: {
      findFirst: async () => null,
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const version = await service.getLatestVersion(AppPlatform.ANDROID);

  assert.equal(version.latestVersion, "1.0.8");
  assert.equal(version.buildNumber, 9);
  assert.ok(version.apkUrl);
  assert.equal(
    version.sha256,
    "532fd6b7a706fc2c589aedab1d8e5522d2a66827cba220f75a0d8c62517b87e8",
  );
});

test("AppVersionService tracks download increments successfully", async () => {
  let updatedId = "";
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({ id: "rel-1", buildNumber: 9 }),
      update: async (args: { where: { id: string } }) => {
        updatedId = args.where.id;
        return {};
      },
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const res = await service.trackDownload(AppPlatform.ANDROID, 9);

  assert.equal(res.success, true);
  assert.equal(updatedId, "rel-1");
});
