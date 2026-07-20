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

void test("25 sequential and 25 concurrent creates persist unique stable canonical webhook URLs", async () => {
  const previousBase = process.env.PUBLIC_WEBHOOK_BASE_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.PUBLIC_WEBHOOK_BASE_URL = "https://backend.example.com/";
  process.env.NODE_ENV = "production";
  const records = new Map<string, Record<string, unknown>>();
  let sequence = 0;
  const createRecord = (data: Record<string, unknown>) => {
    const id = `oa-${sequence += 1}`;
    const record = { id, ...data, basicId: data.basicId ?? null, channelId: data.channelId ?? null, destinationId: data.destinationId ?? null, lastWebhookReceivedAt: null, lastConnectionTestAt: null, lastConnectionError: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), store: { id: "store-1", name: "Store", region: null, area: null, storeMasterId: null, storeMaster: null }, _count: { conversations: 0 } };
    records.set(id, record);
    return record;
  };
  const transactionClient = {
    storeMaster: { findUnique: () => Promise.resolve(null) },
    store: { findUnique: () => Promise.resolve(null), update: () => Promise.resolve({}), create: () => Promise.resolve({ id: "store-1" }) },
    lineOfficialAccount: { create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve(createRecord(data)) },
  };
  const prisma = {
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
    lineOfficialAccount: { findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(records.get(where.id) ?? null) },
  } as unknown as PrismaService;
  const encryption = { encrypt: (value: string) => `encrypted:${value}`, decrypt: () => "decrypted" } as unknown as CredentialEncryptionService;
  const service = new LineOfficialAccountsService(prisma, encryption);
  const create = () => service.create({ storeId: "store-1", name: "OA", channelSecret: "secret", channelAccessToken: "token", isActive: true });
  try {
    const sequential: Array<Awaited<ReturnType<typeof create>>> = [];
    for (let index = 0; index < 25; index += 1) sequential.push(await create());
    const concurrent = await Promise.all(Array.from({ length: 25 }, () => create()));
    const all = [...sequential, ...concurrent];
    const urls = all.map((item) => item.webhookUrl);
    assert.equal(all.length, 50);
    assert.equal(new Set(urls).size, 50);
    assert.equal(urls.every((url) => typeof url === "string" && /^https:\/\/backend\.example\.com\/webhook\/[A-Za-z0-9_-]+$/.test(url)), true);
    const first = all[0];
    assert.equal((await service.get(first.id)).webhookUrl, first.webhookUrl);
    assert.equal(records.size, 50);
  } finally {
    if (previousBase === undefined) delete process.env.PUBLIC_WEBHOOK_BASE_URL; else process.env.PUBLIC_WEBHOOK_BASE_URL = previousBase;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  }
});

void test("create fails without returning an incomplete record when persistence fails", async () => {
  const previousBase = process.env.PUBLIC_WEBHOOK_BASE_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.PUBLIC_WEBHOOK_BASE_URL = "https://backend.example.com";
  process.env.NODE_ENV = "production";
  let committed = false;
  const tx = {
    storeMaster: { findUnique: () => Promise.resolve(null) },
    store: { findUnique: () => Promise.resolve(null), create: () => Promise.resolve({ id: "store-1" }) },
    lineOfficialAccount: { create: () => Promise.reject(new Error("database write failed")) },
  };
  const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => { const result = await callback(tx); committed = true; return result; } } as unknown as PrismaService;
  const service = new LineOfficialAccountsService(prisma, { encrypt: (value: string) => value } as unknown as CredentialEncryptionService);
  try {
    await assert.rejects(() => service.create({ storeId: "store-1", name: "OA", channelSecret: "secret", channelAccessToken: "token", isActive: true }), /database write failed/);
    assert.equal(committed, false);
  } finally {
    if (previousBase === undefined) delete process.env.PUBLIC_WEBHOOK_BASE_URL; else process.env.PUBLIC_WEBHOOK_BASE_URL = previousBase;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  }
});
