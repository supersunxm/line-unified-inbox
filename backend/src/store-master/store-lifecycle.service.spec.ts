import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { StoreLifecycleService } from "./store-lifecycle.service";

function lifecycleHarness(withOa = true) {
  const closedAt = new Date("2026-09-12T09:00:00.000Z");
  const store = { id: "store-31749", code: "31749", storeMasterId: "master-31749", isActive: true, archivedAt: null as Date | null };
  const activeOa = { id: "oa-active", storeId: store.id, accountType: "STORE", isActive: true, archivedAt: null as Date | null, connectionStatus: "CONNECTED" };
  const archivedOa = { id: "oa-history", storeId: store.id, accountType: "STORE", isActive: false, archivedAt: new Date("2026-01-01T00:00:00Z"), connectionStatus: "DISABLED" };
  const oas = withOa ? [activeOa, archivedOa] : [];
  const preserved = { conversations: 22, messages: 74, webhookEvents: 94, richMenuAttempts: 3 };
  const pending = { richMenu: 1, backfill: 1, nickname: 1, delivery: 1, batch: 1 };
  const matchesStore = (where: { OR?: Array<{ storeMasterId?: string; code?: string }> }) => !where.OR || where.OR.some((item) => item.storeMasterId === store.storeMasterId || item.code === store.code);
  const prisma = {
    store: {
      findMany: async ({ where }: { where: { OR: Array<{ storeMasterId?: string; code?: string }> } }) => matchesStore(where) ? [store] : [],
      updateMany: async ({ where, data }: { where: { id?: string; AND?: unknown[] }; data: { isActive: boolean; archivedAt: Date | null } }) => {
        if ((where.id && where.id !== store.id) || (store.isActive === data.isActive && store.archivedAt === data.archivedAt)) return { count: 0 };
        Object.assign(store, data);
        return { count: 1 };
      },
    },
    lineOfficialAccount: {
      findMany: async () => oas.map(({ id }) => ({ id })),
      updateMany: async ({ data }: { data: { isActive: boolean; archivedAt: Date; connectionStatus: string } }) => {
        let count = 0;
        for (const oa of oas) if (oa.isActive && !oa.archivedAt) { Object.assign(oa, data); count += 1; }
        return { count };
      },
    },
    richMenuPublishAttempt: { updateMany: async () => { const count = pending.richMenu; pending.richMenu = 0; return { count }; } },
    lineOaBackfillJob: { updateMany: async () => { const count = pending.backfill; pending.backfill = 0; return { count }; } },
    lineChatNicknameSyncJob: { updateMany: async () => { const count = pending.nickname; pending.nickname = 0; return { count }; } },
    massMessageStoreDelivery: {
      findMany: async () => pending.delivery ? [{ id: "delivery" }] : [],
      updateMany: async () => { const count = pending.delivery; pending.delivery = 0; return { count }; },
    },
    massMessageBatch: { updateMany: async () => { pending.batch = 0; return { count: 1 }; } },
  } as unknown as PrismaService;
  return { closedAt, store, activeOa, archivedOa, preserved, pending, prisma, service: new StoreLifecycleService(prisma) };
}

test("CLOSED lifecycle archives Store and active STORE OA while preserving historical data", async () => {
  const h = lifecycleHarness();
  const before = { ...h.preserved };
  const result = await h.service.closeStoreFromMaster(h.prisma, { storeMasterId: "master-31749", externalStoreId: "31749" }, h.closedAt);
  assert.equal(h.store.isActive, false);
  assert.equal(h.store.archivedAt, h.closedAt);
  assert.equal(h.activeOa.isActive, false);
  assert.equal(h.activeOa.archivedAt, h.closedAt);
  assert.equal(h.activeOa.connectionStatus, "DISABLED");
  assert.equal(h.archivedOa.archivedAt?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.deepEqual(h.preserved, before);
  assert.deepEqual(result, { storesMatched: 1, storesClosed: 1, oasArchived: 1, richMenuAttemptsCancelled: 1, backfillJobsBlocked: 1, nicknameJobsBlocked: 1, massMessageDeliveriesBlocked: 1 });
});

test("repeated CLOSED lifecycle is idempotent", async () => {
  const h = lifecycleHarness();
  await h.service.closeStoreFromMaster(h.prisma, { storeMasterId: "master-31749", externalStoreId: "31749" }, h.closedAt);
  const second = await h.service.closeStoreFromMaster(h.prisma, { storeMasterId: "master-31749", externalStoreId: "31749" }, h.closedAt);
  assert.equal(second.storesClosed, 0);
  assert.equal(second.oasArchived, 0);
  assert.equal(second.richMenuAttemptsCancelled, 0);
});

test("ACTIVE after CLOSED restores only Store operational state", async () => {
  const h = lifecycleHarness();
  await h.service.closeStoreFromMaster(h.prisma, { storeMasterId: "master-31749", externalStoreId: "31749" }, h.closedAt);
  const result = await h.service.reopenStoreFromMaster(h.prisma, { storeMasterId: "master-31749", externalStoreId: "31749" });
  assert.equal(result.storesRestored, 1);
  assert.equal(h.store.isActive, true);
  assert.equal(h.store.archivedAt, null);
  assert.equal(h.activeOa.isActive, false);
  assert.equal(h.activeOa.connectionStatus, "DISABLED");
});

test("Store without an OA closes safely", async () => {
  const h = lifecycleHarness(false);
  const result = await h.service.closeStoreFromMaster(h.prisma, { storeMasterId: "master-31749", externalStoreId: "31749" }, h.closedAt);
  assert.equal(result.storesClosed, 1);
  assert.equal(result.oasArchived, 0);
});
