import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { LineChatPendingControlService } from "./line-chat-pending-control.service";

const blockedJob = {
  id: "job-blocked",
  status: LineChatNicknameSyncJobStatus.PENDING,
  lineChatUserId: null,
  lastError: "RESOLVE_NO_MATCH",
  updatedAt: new Date("2026-09-16T10:00:00.000Z"),
  createdAt: new Date("2026-09-16T09:00:00.000Z"),
  conversationId: "conversation-blocked",
};

const successJob = {
  id: "job-success",
  status: LineChatNicknameSyncJobStatus.SUCCESS,
  lineChatUserId: "mapped-user",
  lastError: null,
  updatedAt: new Date("2026-09-16T10:01:00.000Z"),
  createdAt: new Date("2026-09-16T09:01:00.000Z"),
  conversationId: "conversation-success",
};

test("LineChatPendingControlService: run progress exposes safe blocked-customer details without LINE identity fields", async () => {
  let conversationQuery: any = null;
  const mockPrisma: any = {
    lineChatSession: {
      findUnique: async () => ({ lineOfficialAccounts: [{ id: "oa-profile-b" }] }),
    },
    lineChatNicknameSyncJob: {
      findMany: async (args: any) => {
        if (args.where?.id) return [blockedJob, successJob];
        return [successJob, blockedJob];
      },
    },
    conversation: {
      findMany: async (args: any) => {
        conversationQuery = args;
        return [
          {
            id: "conversation-blocked",
            customerSalesStatus: "PURCHASED",
            paymentMethod: "INSTALLMENT",
            salesRecordedAt: new Date("2026-09-15T08:30:00.000Z"),
            latestMessageAt: new Date("2026-09-16T09:30:00.000Z"),
            customer: { displayName: "Blocked Customer" },
            salesProducts: [
              {
                customProductName: null,
                ram: null,
                rom: null,
                color: null,
                productModel: { name: "OPPO A7 Pro 5G" },
                productVariant: { ram: "8", rom: "256", color: "Surfing Blue" },
              },
            ],
          },
        ];
      },
    },
  };

  const service = new LineChatPendingControlService(mockPrisma);
  const result = await service.runProgress("profile-b", ["job-blocked", "job-success"]);

  assert.equal(result.total, 2);
  assert.equal(result.success, 1);
  assert.equal(result.blockedMapping, 1);
  assert.equal(result.blockedNoMatch, 1);
  assert.equal(result.blockedCustomers.length, 1);
  assert.deepEqual(result.blockedCustomers[0], {
    jobId: "job-blocked",
    conversationId: "conversation-blocked",
    customerName: "Blocked Customer",
    reason: "RESOLVE_NO_MATCH",
    customerSalesStatus: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    salesRecordedAt: "2026-09-15T08:30:00.000Z",
    latestMessageAt: "2026-09-16T09:30:00.000Z",
    productSummary: "OPPO A7 Pro 5G · 8+256 · Surfing Blue",
  });

  assert.deepEqual(conversationQuery.select.customer, { select: { displayName: true } });
  const serialized = JSON.stringify(result.blockedCustomers);
  assert.equal(serialized.includes("lineChatUserId"), false);
  assert.equal(serialized.includes("lineUserId"), false);
  assert.equal(serialized.includes("ownerToken"), false);
});

test("LineChatPendingControlService: successful jobs are not included in blocked customers", async () => {
  const mockPrisma: any = {
    lineChatSession: {
      findUnique: async () => ({ lineOfficialAccounts: [{ id: "oa-profile-b" }] }),
    },
    lineChatNicknameSyncJob: {
      findMany: async () => [successJob],
    },
    conversation: {
      findMany: async () => {
        assert.fail("conversation details should not be queried when there are no blocked jobs");
      },
    },
  };

  const service = new LineChatPendingControlService(mockPrisma);
  const result = await service.runProgress("profile-b", ["job-success"]);

  assert.equal(result.success, 1);
  assert.equal(result.blockedMapping, 0);
  assert.deepEqual(result.blockedCustomers, []);
});
