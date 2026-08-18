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
        version: "1.0.7",
        buildNumber: 8,
        minimumSupportedVersion: "1.0.3",
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: "https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.7-production.apk",
        apkSize: "56.9 MB",
        sha256: "3458e9b78e1231cf16165e5fee20c69653bde4f8227e9d58f964e0352f7b2c19",
        releaseNotes: [
          "Improved product tagging flow",
          "Draft Selection Flow (Select → Configure → Confirm → Save)",
          "Fixed product persistence issue after confirmation",
          "Improved product name display and overflow handling",
          "Improved CRM accuracy for multi-product tagging",
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

  assert.equal(version.latestVersion, "1.0.7");
  assert.equal(version.buildNumber, 8);
  assert.equal(version.minimumSupportedVersion, "1.0.3");
  assert.equal(version.minimumSupportedBuildNumber, 4);
  assert.equal(version.forceUpdate, false);
  assert.deepEqual(version.releaseNotes, [
    "Improved product tagging flow",
    "Draft Selection Flow (Select → Configure → Confirm → Save)",
    "Fixed product persistence issue after confirmation",
    "Improved product name display and overflow handling",
    "Improved CRM accuracy for multi-product tagging",
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

  assert.equal(version.latestVersion, "1.0.7");
  assert.equal(version.buildNumber, 8);
  assert.ok(version.apkUrl);
});

test("AppVersionService tracks download increments successfully", async () => {
  let updatedId = "";
  const fakePrisma = {
    appRelease: {
      findFirst: async () => ({ id: "rel-1", buildNumber: 8 }),
      update: async (args: { where: { id: string } }) => {
        updatedId = args.where.id;
        return {};
      },
    },
  } as unknown as PrismaService;

  const service = new AppVersionService(fakePrisma);
  const res = await service.trackDownload(AppPlatform.ANDROID, 7);

  assert.equal(res.success, true);
  assert.equal(updatedId, "rel-1");
});
