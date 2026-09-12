import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { StoresController } from "../stores.controller";
import { LineOfficialAccountsService } from "./line-official-accounts.service";

type FakeStore = {
  id: string;
  name: string;
  code: string | null;
  storeMasterId: string | null;
  isActive: boolean;
  archivedAt: Date | null;
};

type FakeMaster = {
  id: string;
  externalStoreId: string;
  storeName: string;
  accountName: string;
  region: string;
  province: string;
  lineId: string;
  lineManagerUrl: string | null;
  isActive: boolean;
};

type FakeOa = {
  id: string;
  webhookKey: string;
  name: string;
  basicId: string | null;
  channelId: string | null;
  destinationId: string | null;
  encryptedChannelSecret: string | null;
  encryptedChannelAccessToken: string | null;
  connectionStatus: string;
  storeId: string;
  accountType: "STORE";
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  conversationCount: number;
};

type QueryOptions = { where?: Record<string, unknown>; include?: Record<string, unknown> };

class FakeDatabase {
  readonly masters = new Map<string, FakeMaster>();
  readonly stores = new Map<string, FakeStore>();
  readonly oas = new Map<string, FakeOa>();
  private sequence = 0;

  constructor() {
    this.masters.set("master-12140", {
      id: "master-12140",
      externalStoreId: "12140",
      storeName: "OBS Central Nakhon Si Thammarat FL.2 By Inter Computer & IT",
      accountName: "OPPO Central Nakhon.",
      region: "Southern",
      province: "Nakhon Si Thammarat",
      lineId: "@tay5614g",
      lineManagerUrl: null,
      isActive: true,
    });
  }

  readonly storeMaster = {
    findUnique: async (options: QueryOptions) => {
      const id = this.where(options).id;
      const master = typeof id === "string" ? this.masters.get(id) : undefined;
      if (!master) return null;
      return { ...master, stores: [...this.stores.values()].filter((store) => store.storeMasterId === master.id) };
    },
    findMany: async () => [...this.masters.values()],
  };

  readonly store = {
    findUnique: async (options: QueryOptions) => {
      const where = this.where(options);
      const store = typeof where.id === "string"
        ? this.stores.get(where.id)
        : typeof where.code === "string"
        ? [...this.stores.values()].find((item) => item.code === where.code)
        : undefined;
      if (!store) return null;
      if (options.include?.lineOfficialAccounts) {
        return { ...store, lineOfficialAccounts: [...this.oas.values()].filter((oa) => oa.storeId === store.id).map(({ id, isActive, archivedAt }) => ({ id, isActive, archivedAt })) };
      }
      return { ...store };
    },
    create: async (options: { data: Record<string, unknown> }) => {
      const id = `store-${++this.sequence}`;
      const data = options.data;
      const store: FakeStore = {
        id,
        name: String(data.name),
        code: typeof data.code === "string" ? data.code : null,
        storeMasterId: typeof data.storeMasterId === "string" ? data.storeMasterId : null,
        isActive: true,
        archivedAt: null,
      };
      this.stores.set(id, store);
      return { id };
    },
    update: async (options: { where: { id: string }; data: Record<string, unknown> }) => {
      const store = this.stores.get(options.where.id);
      if (!store) throw new Error("store not found");
      for (const [key, value] of Object.entries(options.data)) {
        if (key === "name" && typeof value === "string") store.name = value;
        if (key === "code" && (typeof value === "string" || value === null)) store.code = value;
        if (key === "storeMasterId" && (typeof value === "string" || value === null)) store.storeMasterId = value;
        if (key === "isActive" && typeof value === "boolean") store.isActive = value;
        if (key === "archivedAt" && (value instanceof Date || value === null)) store.archivedAt = value;
      }
      return { ...store };
    },
    updateMany: async () => ({ count: 0 }),
  };

  readonly lineOfficialAccount = {
    findUnique: async (options: QueryOptions) => {
      const id = this.where(options).id;
      const oa = typeof id === "string" ? this.oas.get(id) : undefined;
      return oa ? this.projectOa(oa) : null;
    },
    findMany: async (options: QueryOptions) => {
      const where = this.where(options);
      return [...this.oas.values()].filter((oa) => this.matchesOa(oa, where)).map((oa) => this.projectOa(oa));
    },
    create: async (options: { data: Record<string, unknown> }) => {
      const now = new Date();
      const oa: FakeOa = {
        id: `oa-${++this.sequence}`,
        webhookKey: String(options.data.webhookKey),
        name: String(options.data.name),
        basicId: typeof options.data.basicId === "string" ? options.data.basicId : null,
        channelId: typeof options.data.channelId === "string" ? options.data.channelId : null,
        destinationId: typeof options.data.destinationId === "string" ? options.data.destinationId : null,
        encryptedChannelSecret: typeof options.data.encryptedChannelSecret === "string" ? options.data.encryptedChannelSecret : null,
        encryptedChannelAccessToken: typeof options.data.encryptedChannelAccessToken === "string" ? options.data.encryptedChannelAccessToken : null,
        connectionStatus: String(options.data.connectionStatus),
        storeId: String(options.data.storeId),
        accountType: "STORE",
        isActive: options.data.isActive === true,
        archivedAt: options.data.archivedAt instanceof Date ? options.data.archivedAt : null,
        createdAt: now,
        updatedAt: now,
        conversationCount: 0,
      };
      this.oas.set(oa.id, oa);
      return this.projectOa(oa);
    },
    update: async (options: { where: { id: string }; data: Record<string, unknown> }) => {
      const oa = this.oas.get(options.where.id);
      if (!oa) throw new Error("LINE OA not found");
      for (const [key, value] of Object.entries(options.data)) {
        if (key === "name" && typeof value === "string") oa.name = value;
        if (key === "basicId" && (typeof value === "string" || value === null)) oa.basicId = value;
        if (key === "channelId" && (typeof value === "string" || value === null)) oa.channelId = value;
        if (key === "destinationId" && (typeof value === "string" || value === null)) oa.destinationId = value;
        if (key === "encryptedChannelSecret" && (typeof value === "string" || value === null)) oa.encryptedChannelSecret = value;
        if (key === "encryptedChannelAccessToken" && (typeof value === "string" || value === null)) oa.encryptedChannelAccessToken = value;
        if (key === "webhookKey" && typeof value === "string") oa.webhookKey = value;
        if (key === "storeId" && typeof value === "string") oa.storeId = value;
        if (key === "isActive" && typeof value === "boolean") oa.isActive = value;
        if (key === "archivedAt" && (value instanceof Date || value === null)) oa.archivedAt = value;
        if (key === "connectionStatus" && typeof value === "string") oa.connectionStatus = value;
      }
      oa.updatedAt = new Date();
      return this.projectOa(oa);
    },
    updateMany: async (options: { where: { storeId: string }; data: Record<string, unknown> }) => {
      let count = 0;
      for (const oa of this.oas.values()) {
        if (oa.storeId !== options.where.storeId) continue;
        await this.lineOfficialAccount.update({ where: { id: oa.id }, data: options.data });
        count += 1;
      }
      return { count };
    },
    delete: async (options: { where: { id: string } }) => {
      this.oas.delete(options.where.id);
      return {};
    },
    deleteMany: async () => ({ count: 0 }),
  };

  readonly conversation = {
    count: async () => 0,
    findMany: async () => [],
  };
  readonly message = { count: async () => 0, deleteMany: async () => ({ count: 0 }) };
  readonly internalNote = { count: async () => 0, deleteMany: async () => ({ count: 0 }) };
  readonly activityHistory = { count: async () => 0, deleteMany: async () => ({ count: 0 }) };
  readonly customer = { count: async () => 0, delete: async () => ({}) };

  async $transaction<T>(callback: (client: PrismaService) => Promise<T>) {
    const stores = new Map(this.stores);
    const oas = new Map(this.oas);
    try {
      return await callback(this as unknown as PrismaService);
    } catch (error) {
      this.stores.clear();
      for (const [id, store] of stores) this.stores.set(id, store);
      this.oas.clear();
      for (const [id, oa] of oas) this.oas.set(id, oa);
      throw error;
    }
  }

  private where(options: QueryOptions) {
    return options.where ?? {};
  }

  private matchesOa(oa: FakeOa, where: Record<string, unknown>) {
    if (where.accountType && where.accountType !== oa.accountType) return false;
    if (where.isActive !== undefined && where.isActive !== oa.isActive) return false;
    if (where.archivedAt === null && oa.archivedAt !== null) return false;
    const not = where.NOT as { isActive?: boolean; archivedAt?: null } | undefined;
    if (not?.isActive === true && not.archivedAt === null && oa.isActive && oa.archivedAt === null) return false;
    const filters = where.OR as Array<Record<string, unknown>> | undefined;
    if (!filters) return true;
    return filters.some((filter) => Object.entries(filter).every(([key, value]) => oa[key as keyof FakeOa] === value));
  }

  private projectOa(oa: FakeOa) {
    const store = this.stores.get(oa.storeId);
    const master = store?.storeMasterId ? this.masters.get(store.storeMasterId) : undefined;
    return {
      ...oa,
      store: store ? { ...store, storeMaster: master ?? null } : null,
      _count: { conversations: oa.conversationCount },
    };
  }
}

function serviceFor(database: FakeDatabase) {
  const encryption = { encrypt: (value: string) => `encrypted:${value}`, decrypt: () => "decrypted" } as unknown as CredentialEncryptionService;
  return new LineOfficialAccountsService(database as unknown as PrismaService, encryption);
}

async function createFor(database: FakeDatabase, input: { basicId?: string; channelId?: string; destinationId?: string; storeMasterId?: string } = {}) {
  const service = serviceFor(database);
  return service.create({
    storeMasterId: input.storeMasterId ?? "master-12140",
    name: "OPPO Central Nakhon.",
    basicId: input.basicId ?? "@tay5614g",
    channelId: input.channelId,
    destinationId: input.destinationId,
    channelSecret: "secret-is-never-logged",
    channelAccessToken: "token-is-never-logged",
    isActive: true,
  });
}

const previousBaseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
process.env.PUBLIC_WEBHOOK_BASE_URL = "https://backend.example.com";
process.env.NODE_ENV = "production";

test.after(() => {
  if (previousBaseUrl === undefined) delete process.env.PUBLIC_WEBHOOK_BASE_URL;
  else process.env.PUBLIC_WEBHOOK_BASE_URL = previousBaseUrl;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

for (const [label, input] of [
  ["Channel ID", { channelId: "2000000001" }],
  ["Basic ID", { basicId: "@tay5614g" }],
  ["store code", {}],
] as const) {
  test(`create → delete → reconnect preserves the same ${label}`, async () => {
    const database = new FakeDatabase();
    const service = serviceFor(database);
    const first = await createFor(database, input);
    await service.remove(first.id);
    const second = await createFor(database, input);

    assert.notEqual(second.id, first.id);
    assert.equal(database.stores.size, 1);
    assert.equal(database.oas.size, 1);
    assert.equal(second.store.externalStoreId, "12140");
    assert.equal(database.stores.get(second.store.id)?.storeMasterId, "master-12140");
  });
}

test("an archived OA on the same Store is restored instead of creating a duplicate active row", async () => {
  const database = new FakeDatabase();
  const service = serviceFor(database);
  const first = await createFor(database, { basicId: "@tay5614g" });
  const stored = database.oas.get(first.id);
  assert.ok(stored);
  stored.conversationCount = 1;
  await service.remove(first.id);
  const second = await createFor(database, { basicId: "@tay5614g" });

  assert.equal(second.id, first.id);
  assert.equal(database.oas.size, 1);
  assert.equal(database.oas.get(first.id)?.isActive, true);
  assert.equal(database.oas.get(first.id)?.archivedAt, null);
});

test("one Store cannot have two active STORE OAs", async () => {
  const database = new FakeDatabase();
  await createFor(database);
  await assert.rejects(
    () => createFor(database, { channelId: "different-channel" }),
    (error: unknown) => {
      const response = (error as ConflictException).getResponse() as { code: string; conflicts: Record<string, boolean> };
      assert.equal(response.code, "STORE_MASTER_IDENTITY_MISMATCH");
      assert.equal(response.conflicts.activeStoreOa, true);
      return true;
    },
  );
});

test("an archived OA and one active OA may coexist on the same Store", async () => {
  const database = new FakeDatabase();
  const service = serviceFor(database);
  const archived = await createFor(database);
  database.oas.get(archived.id)!.conversationCount = 1;
  database.oas.get(archived.id)!.basicId = "@historical-basic-id";
  await service.remove(archived.id);
  const active = await createFor(database, { basicId: "@tay5614g", channelId: "new-channel" });

  assert.notEqual(active.id, archived.id);
  assert.equal(database.oas.size, 2);
  assert.equal([...database.oas.values()].filter((oa) => oa.isActive && !oa.archivedAt).length, 1);
});

test("selected StoreMaster Basic ID mismatch is rejected", async () => {
  const database = new FakeDatabase();
  await assert.rejects(
    () => createFor(database, { basicId: "@wrong-basic-id" }),
    (error: unknown) => {
      const response = (error as ConflictException).getResponse() as { code: string; conflicts: Record<string, boolean> };
      assert.equal(response.code, "STORE_MASTER_IDENTITY_MISMATCH");
      assert.deepEqual(response.conflicts, { storeId: false, basicId: true, activeStoreOa: false });
      return true;
    },
  );
});

test("selected StoreMaster Store ID mismatch is rejected", async () => {
  const database = new FakeDatabase();
  database.stores.set("store-wrong", {
    id: "store-wrong",
    name: "Wrong Store",
    code: "30968",
    storeMasterId: null,
    isActive: true,
    archivedAt: null,
  });
  await assert.rejects(
    () => serviceFor(database).create({
      storeId: "store-wrong",
      storeMasterId: "master-12140",
      name: "OPPO Central Nakhon.",
      basicId: "@tay5614g",
      channelSecret: "secret-is-never-logged",
      channelAccessToken: "token-is-never-logged",
      isActive: true,
    }),
    (error: unknown) => {
      const response = (error as ConflictException).getResponse() as { code: string; conflicts: Record<string, boolean> };
      assert.equal(response.code, "STORE_MASTER_IDENTITY_MISMATCH");
      assert.equal(response.conflicts.storeId, true);
      return true;
    },
  );
});

test("correct StoreMaster identity succeeds", async () => {
  const database = new FakeDatabase();
  const account = await createFor(database);
  assert.equal(account.basicId, "@tay5614g");
  assert.equal(account.store.externalStoreId, "12140");
});

for (const [label, input] of [
  ["Channel ID", { channelId: "2000000002" }],
  ["Basic ID", { basicId: "@tay5614g" }],
  ["Destination ID", { destinationId: "destination-duplicate" }],
] as const) {
  test(`duplicate active ${label} is rejected with structured conflict details`, async () => {
    const database = new FakeDatabase();
    await createFor(database, input);
    await assert.rejects(
      () => serviceFor(database).create({
        newStore: { name: "Other Store", code: `OTHER-${label}` },
        name: "Other OA",
        basicId: input.basicId,
        channelId: input.channelId,
        destinationId: input.destinationId,
        channelSecret: "secret-is-never-logged",
        channelAccessToken: "token-is-never-logged",
        isActive: true,
      }),
      (error: unknown) => {
        assert.equal(error instanceof ConflictException, true);
        const response = (error as ConflictException).getResponse() as { code: string; conflicts: Record<string, boolean> };
        assert.equal(response.code, "LINE_ACCOUNT_DUPLICATE");
        const conflictField = label === "Channel ID" ? "channelId" : label === "Destination ID" ? "destinationId" : "basicId";
        assert.equal(response.conflicts[conflictField], true);
        return true;
      },
    );
  });
}

test("Store archive transactionally disables every attached LINE OA", async () => {
  const database = new FakeDatabase();
  const service = serviceFor(database);
  await createFor(database, { basicId: "@tay5614g" });
  const store = [...database.stores.values()][0];
  assert.ok(store);
  const controller = new StoresController(
    database as unknown as PrismaService,
    { getOperationalConversationFilter: async () => ({}) } as never,
    { assertStoreAccess: async () => undefined } as never,
    {
      closeStoreFromMaster: async (_client: unknown, _identity: unknown, closedAt = new Date()) => {
        database.stores.set(store.id, { ...store, isActive: false, archivedAt: closedAt });
        for (const [id, oa] of database.oas) database.oas.set(id, { ...oa, isActive: false, archivedAt: closedAt, connectionStatus: "DISABLED" });
      },
    } as never,
  );

  await controller.archive(store.id, { user: { role: "ADMIN" } } as never);

  assert.equal(database.stores.get(store.id)?.isActive, false);
  assert.equal(database.oas.get([...database.oas.keys()][0])?.isActive, false);
  assert.ok(database.oas.get([...database.oas.keys()][0])?.archivedAt);
});

test("new LINE OA connection rejects an inactive StoreMaster with STORE_CLOSED", async () => {
  const database = new FakeDatabase();
  const master = database.masters.get("master-12140");
  assert.ok(master);
  master.isActive = false;
  await assert.rejects(
    () => createFor(database),
    (error: unknown) => {
      assert.equal(error instanceof ConflictException, true);
      assert.deepEqual((error as ConflictException).getResponse(), {
        code: "STORE_CLOSED",
        storeCode: "12140",
        message: "Store 12140 is closed",
      });
      return true;
    },
  );
  assert.equal(database.stores.size, 0);
  assert.equal(database.oas.size, 0);
});

test("duplicate active store code is rejected when no Store Master target is selected", async () => {
  const database = new FakeDatabase();
  const service = serviceFor(database);
  await createFor(database);

  await assert.rejects(
    () => service.create({
      newStore: { name: "Different Store", code: "12140" },
      name: "Different Store OA",
      channelSecret: "secret-is-never-logged",
      channelAccessToken: "token-is-never-logged",
      isActive: true,
    }),
    (error: unknown) => {
      assert.equal(error instanceof ConflictException, true);
      const response = (error as ConflictException).getResponse() as { code: string; conflicts: Record<string, boolean> };
      assert.equal(response.code, "LINE_ACCOUNT_DUPLICATE");
      assert.equal(response.conflicts.storeCode, true);
      return true;
    },
  );
});
