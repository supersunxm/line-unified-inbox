import assert from "node:assert/strict";
import test from "node:test";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { LineOfficialAccountsService } from "./line-official-accounts.service";

type UpdateCall = { where: { id: string }; data: Record<string, unknown> };

function fixture() {
  const updates: UpdateCall[] = [];
  const prisma = {
    lineOfficialAccount: {
      update: (call: UpdateCall) => { updates.push(call); return Promise.resolve({}); },
      findUniqueOrThrow: () => Promise.resolve({ encryptedChannelSecret: null, encryptedChannelAccessToken: null }),
    },
  } as unknown as PrismaService;
  const encryption = { encrypt: (value: string) => `encrypted:${value}`, decrypt: () => "decrypted" } as unknown as CredentialEncryptionService;
  const service = new LineOfficialAccountsService(prisma, encryption);
  const mutable = service as unknown as { get: (id: string) => Promise<Record<string, unknown>>; webhookInfo: (id: string) => Promise<Record<string, unknown>> };
  mutable.get = (id) => Promise.resolve({ id });
  mutable.webhookInfo = (id) => Promise.resolve({ id });
  return { service, updates };
}

void test("normal LINE OA edit does not change the persisted webhook key", async () => {
  const { service, updates } = fixture();
  await service.update("oa-1", { name: "Edited OA" });
  assert.equal(Object.hasOwn(updates[0].data, "webhookKey"), false);
});

void test("explicit regeneration persists a new key and invalidates the previous key", async () => {
  const { service, updates } = fixture();
  await service.regenerateWebhook("oa-1");
  assert.equal(typeof updates[0].data.webhookKey, "string");
  assert.notEqual(updates[0].data.webhookKey, "old-key");
});
