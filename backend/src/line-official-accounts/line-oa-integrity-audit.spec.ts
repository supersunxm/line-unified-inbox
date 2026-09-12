import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { auditActiveStoreLineOaIntegrity } from "./line-oa-integrity-audit";

void test("integrity audit is read-only and reports every requested invariant", async () => {
  let writes = 0;
  const account = (overrides: Record<string, unknown> = {}) => ({
    id: "oa-1",
    name: "Wrong OA name",
    basicId: "@wrong",
    channelId: "channel-1",
    destinationId: "destination-1",
    storeId: "store-1",
    store: {
      id: "store-1",
      code: "30968",
      isActive: false,
      archivedAt: new Date("2026-01-01T00:00:00Z"),
      storeMasterId: "master-30968",
      storeMaster: {
        id: "master-30968",
        externalStoreId: "30968",
        lineId: "@518eaepe",
        accountName: "OPPO LT Phatthalung",
      },
    },
    conversations: [{ id: "conversation-1", storeId: "other-store" }],
    ...overrides,
  });
  const prisma = {
    storeMaster: {
      findMany: async () => [{ id: "other-master", externalStoreId: "23590", lineId: "@wrong" }],
    },
    lineOfficialAccount: {
      findMany: async () => [
        account(),
        account({ id: "oa-2", name: "OPPO LT Phatthalung", basicId: "@wrong", conversations: [] }),
      ],
      update: async () => { writes += 1; },
    },
  } as unknown as PrismaClient;

  const report = await auditActiveStoreLineOaIntegrity(prisma);

  assert.equal(report.dryRun, true);
  assert.equal(report.migrationSafe, false);
  assert.equal(report.summary.OA_BASIC_ID_MASTER_MISMATCH, 2);
  assert.equal(report.summary.OA_ACCOUNT_NAME_MASTER_MISMATCH, 1);
  assert.equal(report.summary.MULTIPLE_ACTIVE_OA_PER_STORE, 1);
  assert.equal(report.summary.CONVERSATION_STORE_MISMATCH, 1);
  assert.equal(report.summary.ACTIVE_OA_ON_ARCHIVED_STORE, 2);
  assert.equal(report.summary.DUPLICATE_ACTIVE_BASIC_ID, 1);
  assert.equal(report.summary.DUPLICATE_ACTIVE_CHANNEL_ID, 1);
  assert.equal(report.summary.DUPLICATE_ACTIVE_DESTINATION_ID, 1);
  assert.equal(writes, 0);
});
