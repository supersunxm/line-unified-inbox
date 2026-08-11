import assert from "node:assert/strict";
import test from "node:test";
import { DevicePlatform } from "@prisma/client";
import { DeviceTokenService } from "./device-token.service";

void test("register encrypts a device token and persists only its lookup hash", async () => {
  let upsertArgs: any;
  const prisma: any = {
    user: { findUnique: async () => ({ isActive: true, status: "ACTIVE", memberships: [{ id: "membership-1" }] }) },
    deviceToken: { upsert: async (args: any) => { upsertArgs = args; return { id: "device-1", platform: DevicePlatform.ANDROID, isActive: true, lastSeenAt: new Date() }; } },
  };
  const service = new DeviceTokenService(prisma, { encrypt: () => "encrypted-device-token" } as any);
  await service.register("user-1", { token: "a".repeat(30), platform: DevicePlatform.ANDROID, deviceId: "device-id" });
  assert.equal(upsertArgs.create.token.includes("a".repeat(30)), false);
  assert.match(upsertArgs.create.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(upsertArgs.create.deviceIdHash.length, 64);
});

void test("unregister and last-seen updates are scoped to the authenticated user", async () => {
  const updates: any[] = [];
  const service = new DeviceTokenService({ deviceToken: { updateMany: async (args: any) => { updates.push(args); return { count: 1 }; } } } as any, {} as any);
  await service.unregister("user-1", "a".repeat(30));
  await service.touch("user-1", "a".repeat(30));
  assert.equal(updates.length, 2);
  assert.equal(updates.every((entry) => entry.where.userId === "user-1" && entry.where.isActive === true), true);
  assert.equal(updates[0].data.isActive, false);
});
