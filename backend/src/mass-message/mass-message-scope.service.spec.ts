import assert from "node:assert/strict";
import test from "node:test";
import { BmReplyStatus, UserRole } from "@prisma/client";
import { MassMessageScopeService } from "./mass-message-scope.service";
import {
  MassMessageAudienceType,
  MassMessageStoreMode,
} from "./mass-message.types";
import type { AuthUser } from "../auth/auth.guard";

const adminUser: AuthUser = {
  id: "admin-1",
  email: "admin@oppo.th",
  displayName: "Admin",
  role: UserRole.ADMIN,
  isActive: true,
};

function createMockServices(overrides: {
  stores?: any[];
  conversations?: any[];
  decryptedToken?: string;
  decryptShouldFail?: boolean;
  accessibleStoreIds?: string[] | null;
}) {
  const prisma = {
    store: {
      findMany: async () => overrides.stores ?? [],
    },
    conversation: {
      findMany: async (args: any) => {
        const all = overrides.conversations ?? [];
        return all.filter((c: any) => {
          if (args.where.lineOfficialAccountId && c.lineOfficialAccountId !== args.where.lineOfficialAccountId) {
            return false;
          }
          if (args.where.storeId && c.storeId !== args.where.storeId) {
            return false;
          }
          if (args.where.bmReplyStatus && c.bmReplyStatus !== args.where.bmReplyStatus) {
            return false;
          }
          return true;
        });
      },
    },
  } as any;

  const encryption = {
    decrypt: (val: string) => {
      if (overrides.decryptShouldFail) throw new Error("Decryption failed");
      return overrides.decryptedToken ?? `decrypted-${val}`;
    },
  } as any;

  const storeAccess = {
    accessibleStoreIds: async () => overrides.accessibleStoreIds ?? null,
  } as any;

  const service = new MassMessageScopeService(prisma, encryption, storeAccess);
  return { service, prisma, encryption, storeAccess };
}

void test("resolveStoreScope in ALL mode resolves stores, decrypts tokens, and deduplicates recipients", async () => {
  const stores = [
    {
      id: "store-1",
      name: "Store Central",
      code: "ST-001",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [
        {
          id: "oa-1",
          name: "OA Central",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "cipher-token-1",
        },
      ],
    },
    {
      id: "store-2",
      name: "Store West",
      code: "ST-002",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [
        {
          id: "oa-2",
          name: "OA West",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "cipher-token-2",
        },
      ],
    },
  ];

  const conversations = [
    { lineOfficialAccountId: "oa-1", storeId: "store-1", customer: { lineUserId: "U_user1" }, bmReplyStatus: BmReplyStatus.REPLIED },
    { lineOfficialAccountId: "oa-1", storeId: "store-1", customer: { lineUserId: "U_user1" }, bmReplyStatus: BmReplyStatus.REPLIED }, // duplicate
    { lineOfficialAccountId: "oa-1", storeId: "store-1", customer: { lineUserId: "U_user2" }, bmReplyStatus: BmReplyStatus.NOT_REPLIED },
    { lineOfficialAccountId: "oa-2", storeId: "store-2", customer: { lineUserId: "U_user3" }, bmReplyStatus: BmReplyStatus.NOT_REPLIED },
  ];

  const { service } = createMockServices({ stores, conversations });
  const result = await service.resolveStoreScope(
    { mode: MassMessageStoreMode.ALL },
    MassMessageAudienceType.ALL_KNOWN,
    adminUser,
  );

  assert.equal(result.length, 2);

  // Store 1
  assert.equal(result[0].storeId, "store-1");
  assert.equal(result[0].isEligible, true);
  assert.equal(result[0].skipReason, null);
  assert.deepEqual(result[0].recipientUserIds.sort(), ["U_user1", "U_user2"].sort());

  // Store 2
  assert.equal(result[1].storeId, "store-2");
  assert.equal(result[1].isEligible, true);
  assert.deepEqual(result[1].recipientUserIds, ["U_user3"]);
});

void test("resolveStoreScope filters by BM reply status correctly", async () => {
  const stores = [
    {
      id: "store-1",
      name: "Store Central",
      code: "ST-001",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [
        {
          id: "oa-1",
          name: "OA Central",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "cipher-token-1",
        },
      ],
    },
  ];

  const conversations = [
    { lineOfficialAccountId: "oa-1", storeId: "store-1", customer: { lineUserId: "U_replied" }, bmReplyStatus: BmReplyStatus.REPLIED },
    { lineOfficialAccountId: "oa-1", storeId: "store-1", customer: { lineUserId: "U_not_replied" }, bmReplyStatus: BmReplyStatus.NOT_REPLIED },
    { lineOfficialAccountId: "oa-1", storeId: "store-1", customer: { lineUserId: "U_notified" }, bmReplyStatus: BmReplyStatus.NOTIFIED_BM },
  ];

  const { service } = createMockServices({ stores, conversations });

  // Test NOT_REPLIED
  const notReplied = await service.resolveStoreScope(
    { mode: MassMessageStoreMode.ALL },
    MassMessageAudienceType.NOT_REPLIED,
    adminUser,
  );
  assert.equal(notReplied[0].recipientUserIds.length, 1);
  assert.equal(notReplied[0].recipientUserIds[0], "U_not_replied");

  // Test NOTIFIED_BM
  const notified = await service.resolveStoreScope(
    { mode: MassMessageStoreMode.ALL },
    MassMessageAudienceType.NOTIFIED_BM,
    adminUser,
  );
  assert.equal(notified[0].recipientUserIds.length, 1);
  assert.equal(notified[0].recipientUserIds[0], "U_notified");

  // Test REPLIED
  const replied = await service.resolveStoreScope(
    { mode: MassMessageStoreMode.ALL },
    MassMessageAudienceType.REPLIED,
    adminUser,
  );
  assert.equal(replied[0].recipientUserIds.length, 1);
  assert.equal(replied[0].recipientUserIds[0], "U_replied");
});

void test("resolveStoreScope marks stores with no recipients as SKIPPED with NO_RECIPIENTS", async () => {
  const stores = [
    {
      id: "store-empty",
      name: "Empty Store",
      code: "ST-EMP",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [
        {
          id: "oa-emp",
          name: "OA Empty",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "valid-cipher",
        },
      ],
    },
  ];

  const { service } = createMockServices({ stores, conversations: [] });
  const result = await service.resolveStoreScope(
    { mode: MassMessageStoreMode.ALL },
    MassMessageAudienceType.ALL_KNOWN,
    adminUser,
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].isEligible, false);
  assert.equal(result[0].skipReason, "NO_RECIPIENTS");
  assert.equal(result[0].recipientUserIds.length, 0);
});

void test("resolveStoreScope marks stores with missing or corrupted tokens as SKIPPED with MISSING_TOKEN", async () => {
  const stores = [
    {
      id: "store-no-token",
      name: "No Token Store",
      code: "ST-NT",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [
        {
          id: "oa-nt",
          name: "OA No Token",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: null,
        },
      ],
    },
    {
      id: "store-corrupt-token",
      name: "Corrupt Token Store",
      code: "ST-CT",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [
        {
          id: "oa-ct",
          name: "OA Corrupt Token",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "bad-ciphertext",
        },
      ],
    },
  ];

  const { service } = createMockServices({
    stores,
    conversations: [{ lineOfficialAccountId: "oa-ct", storeId: "store-corrupt-token", customer: { lineUserId: "U1" } }],
    decryptShouldFail: true,
  });

  const result = await service.resolveStoreScope(
    { mode: MassMessageStoreMode.ALL },
    MassMessageAudienceType.ALL_KNOWN,
    adminUser,
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].skipReason, "MISSING_TOKEN");
  assert.equal(result[0].isEligible, false);
  assert.equal(result[1].skipReason, "MISSING_TOKEN");
  assert.equal(result[1].isEligible, false);
});

void test("Cross-OA Isolation: user IDs are strictly partitioned by OA", async () => {
  const stores = [
    {
      id: "store-a",
      name: "Store A",
      code: "A",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [{ id: "oa-a", name: "OA A", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-a" }],
    },
    {
      id: "store-b",
      name: "Store B",
      code: "B",
      isActive: true,
      archivedAt: null,
      lineOfficialAccounts: [{ id: "oa-b", name: "OA B", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-b" }],
    },
  ];

  const conversations = [
    { lineOfficialAccountId: "oa-a", storeId: "store-a", customer: { lineUserId: "U_CUSTOMER_A" }, bmReplyStatus: BmReplyStatus.REPLIED },
    { lineOfficialAccountId: "oa-b", storeId: "store-b", customer: { lineUserId: "U_CUSTOMER_B" }, bmReplyStatus: BmReplyStatus.REPLIED },
  ];

  const { service } = createMockServices({ stores, conversations });
  const result = await service.resolveStoreScope(
    { mode: MassMessageStoreMode.ALL },
    MassMessageAudienceType.ALL_KNOWN,
    adminUser,
  );

  assert.equal(result.length, 2);
  assert.deepEqual(result[0].recipientUserIds, ["U_CUSTOMER_A"]);
  assert.deepEqual(result[1].recipientUserIds, ["U_CUSTOMER_B"]);
  assert.equal(result[0].recipientUserIds.includes("U_CUSTOMER_B"), false);
  assert.equal(result[1].recipientUserIds.includes("U_CUSTOMER_A"), false);
});
