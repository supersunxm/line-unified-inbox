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

void test("CSV export uses the complete safe list, applies filters, escapes RFC fields, and includes an Excel UTF-8 BOM", async () => {
  const { service } = fixture();
  let showArchivedArgument: boolean | null = null;
  const rows = [
    {
      id: "oa-1", name: "บัญชี, \"ทดสอบ\"\nสาขา", basicId: "@safe", channelId: "12345", connectionStatus: "CONNECTED", isActive: true,
      webhookUrl: "https://backend.example.com/webhook/safe", webhookConfigured: true, lastWebhookReceivedAt: new Date("2026-08-09T10:00:00Z"),
      messagesReceivedToday: 3, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-08-09T10:00:00Z"),
      store: { name: "ร้านไทย", code: "LOCAL-001", accountName: "OPPO TEST", externalStoreId: "S001", province: "กรุงเทพฯ", region: "Central", lineManagerUrl: "https://manager.line.biz/account/safe", lineOaLink: "https://page.line.me/safe" },
      encryptedChannelSecret: "must-never-export-secret", encryptedChannelAccessToken: "must-never-export-token",
    },
    {
      id: "oa-2", name: "Other OA", basicId: null, channelId: null, connectionStatus: "ERROR", isActive: false,
      webhookUrl: null, webhookConfigured: false, lastWebhookReceivedAt: null, messagesReceivedToday: 0,
      createdAt: new Date("2026-01-02T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"),
      store: { name: "Other Store", code: "LOCAL-002", accountName: null, externalStoreId: null, province: null, region: null, lineManagerUrl: null, lineOaLink: null },
    },
  ];
  (service as unknown as { list: (showArchived: boolean) => Promise<typeof rows> }).list = (showArchived) => {
    showArchivedArgument = showArchived;
    return Promise.resolve(rows);
  };

  const result = await service.exportCsv({ search: "test", status: "active", showArchived: "true" });
  assert.equal(showArchivedArgument, true);
  assert.equal(result.rowCount, 1);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  assert.equal(result.filename, `line-oa-management-${today}.csv`);
  assert.equal(result.csv.startsWith("\uFEFF\"LINE OA Account Name\""), true);
  assert.equal(result.csv.includes('"บัญชี, ""ทดสอบ""\nสาขา"'), true);
  assert.equal(result.csv.includes("ร้านไทย"), true);
  assert.equal(result.csv.includes("must-never-export-secret"), false);
  assert.equal(result.csv.includes("must-never-export-token"), false);
  assert.equal(result.csv.split("\r\n").length, 3);
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
