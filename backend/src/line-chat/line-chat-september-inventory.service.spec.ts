import assert from "node:assert/strict";
import test from "node:test";
import {
  HistoricalBackfillStatus,
  LINE_CHAT_HISTORICAL_PILOT_STORE_CODES,
} from "./line-chat-historical-backfill";
import { LineChatSeptemberInventoryService } from "./line-chat-september-inventory.service";
import type { PrismaService } from "../prisma.service";
import type { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import type { LineChatSessionService } from "./line-chat-session.service";

test("inventory service returns aggregate chat-list coverage without exposing chat identifiers", async () => {
  const privateChatId = `U${"a".repeat(32)}`;
  let persistedRowsRead = 0;
  let managerListPagesRead = 0;
  const prisma = {
    lineChatMirrorChat: {
      findMany: async (args: { where: { lineOfficialAccountId: string; lineChatUserId: { in: string[] } } }) => {
        persistedRowsRead += 1;
        assert.equal(args.where.lineOfficialAccountId, "oa-1");
        assert.deepEqual(args.where.lineChatUserId.in, [privateChatId]);
        return [{
          lineChatUserId: privateChatId,
          historicalBackfillStatus: HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION,
        }];
      },
    },
  } as unknown as PrismaService;
  const sessionService = {
    resolveProfilePath: () => "/redacted/profile",
    discoverChats: async (input: { pageObserver: (page: {
      responseShape: "list";
      chats: Array<{
        chatUserId: string;
        displayName: string | null;
        lastMessageText: string | null;
        lastMessageAt: string | null;
        lastMessageDirection: string | null;
      }>;
      totalRawRecords: number;
      validUserChats: number;
      ignoredNonUserRecords: number;
      invalidUserRecords: number;
    }) => boolean }) => {
      managerListPagesRead += 1;
      const chats = [{
        chatUserId: privateChatId,
        displayName: "Private Customer Name",
        lastMessageText: null,
        lastMessageAt: "2026-09-23T10:00:00+07:00",
        lastMessageDirection: null,
      }];
      input.pageObserver({
        responseShape: "list",
        chats,
        totalRawRecords: 1,
        validUserChats: 1,
        ignoredNonUserRecords: 0,
        invalidUserRecords: 0,
      });
      return {
        botId: "Ubot",
        endpoint: "https://chat.line.biz/api/v2/bots/Ubot/chats",
        responseShape: "list" as const,
        enumerationStatus: "COMPLETE" as const,
        chats,
        pagesFetched: 1,
        totalRawRecords: 1,
        validUserChats: 1,
        ignoredNonUserRecords: 0,
        invalidUserRecords: 0,
        duplicateIds: 0,
        conflictingDuplicates: 0,
        nextTerminationObserved: true,
      };
    },
  } as unknown as LineChatSessionService;
  const coordinator = {
    withProfileOperation: async (
      input: { sessionId: string; operationKind: string },
      callback: (context: { assertOwnership: () => void }) => Promise<unknown>,
    ) => {
      assert.equal(input.sessionId, "session-1");
      assert.equal(input.operationKind, "MANUAL_DIAGNOSTIC");
      return {
        acquired: true as const,
        value: await callback({ assertOwnership() {} }),
        sessionId: input.sessionId,
        operationKind: input.operationKind,
        requestId: "request-1",
      };
    },
  } as unknown as LineChatProfileOperationCoordinator;

  const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator);
  const report = await service.discoverStore({
    storeCode: "29113",
    lineOfficialAccountId: "oa-1",
    botId: "Ubot",
    session: { id: "session-1", sessionKey: "profile-1" },
  });

  assert.equal(managerListPagesRead, 1);
  assert.equal(persistedRowsRead, 1);
  assert.equal(report.inventoryComplete, true);
  assert.equal(report.septemberChats, 1);
  assert.equal(report.needsBackwardPagination, 1);
  assert.equal(report.historicalCheckedRate, 1);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(privateChatId, "u"));
  assert.doesNotMatch(JSON.stringify(report), /Private Customer Name/u);
});

test("inventory service reports profile contention without attempting chat discovery", async () => {
  let discoveryCalled = false;
  const prisma = {} as PrismaService;
  const sessionService = {
    resolveProfilePath: () => "/redacted/profile",
    discoverChats: async () => {
      discoveryCalled = true;
      throw new Error("unexpected discovery");
    },
  } as unknown as LineChatSessionService;
  const coordinator = {
    withProfileOperation: async () => ({
      acquired: false as const,
      reason: "PROFILE_OPERATION_BUSY" as const,
      retryAfterMs: 5000,
      sessionId: "session-1",
      operationKind: "MANUAL_DIAGNOSTIC" as const,
      requestId: "request-1",
      busyStage: "LOCAL_LOCK" as const,
      waitedMs: 0,
    }),
  } as unknown as LineChatProfileOperationCoordinator;
  const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator);
  const report = await service.discoverStore({
    storeCode: "28375",
    lineOfficialAccountId: "oa-2",
    botId: "Ubot",
    session: { id: "session-1" },
  });
  assert.equal(discoveryCalled, false);
  assert.equal(report.inventoryComplete, false);
  assert.equal(report.inventoryIncompleteReason, "PROFILE_OPERATION_BUSY");
});

test("pilot inventory reports all configured pilot stores without guessing missing targets", async () => {
  let accountLookupCount = 0;
  const prisma = {
    lineChatMirrorStoreState: { findMany: async () => [] },
    lineOfficialAccount: {
      findUnique: async () => {
        accountLookupCount += 1;
        return null;
      },
    },
  } as unknown as PrismaService;
  const sessionService = {
    resolveProfilePath: () => { throw new Error("unexpected profile resolution"); },
    discoverChats: async () => { throw new Error("unexpected chat discovery"); },
  } as unknown as LineChatSessionService;
  const coordinator = {
    withProfileOperation: async () => { throw new Error("unexpected profile lock"); },
  } as unknown as LineChatProfileOperationCoordinator;
  const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator);
  const reports = await service.discoverPilotStores();

  assert.deepEqual(reports.map((report) => report.storeCode), LINE_CHAT_HISTORICAL_PILOT_STORE_CODES);
  assert.ok(reports.every((report) => !report.inventoryComplete));
  assert.ok(reports.every((report) => report.inventoryIncompleteReason === "MIRROR_TARGET_NOT_FOUND"));
  assert.equal(accountLookupCount, 0);
});
