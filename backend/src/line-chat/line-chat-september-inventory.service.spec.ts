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
import type { LineChatMirrorService } from "./line-chat-mirror.service";

test("inventory service returns aggregate chat-list coverage without exposing chat identifiers", async () => {
  const privateChatId = `U${"a".repeat(32)}`;
  let persistedRowsRead = 0;
  let managerListPagesRead = 0;
  let discoveryBounds: unknown;
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
    discoverChats: async (input: {
      maxPages?: number;
      maxChats?: number;
      maxDurationMs?: number;
      pageObserver: (page: {
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
    }) => boolean;
    }) => {
      managerListPagesRead += 1;
      discoveryBounds = {
        maxPages: input.maxPages,
        maxChats: input.maxChats,
        maxDurationMs: input.maxDurationMs,
      };
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
      options: { waitForLock?: boolean },
    ) => {
      assert.equal(input.sessionId, "session-1");
      assert.equal(input.operationKind, "MANUAL_DIAGNOSTIC");
      assert.equal(options.waitForLock, false);
      return {
        acquired: true as const,
        value: await callback({ assertOwnership() {} }),
        sessionId: input.sessionId,
        operationKind: input.operationKind,
        requestId: "request-1",
      };
    },
  } as unknown as LineChatProfileOperationCoordinator;

  const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator, {} as LineChatMirrorService);
  const report = await service.discoverStore({
    storeCode: "29113",
    lineOfficialAccountId: "oa-1",
    botId: "Ubot",
    session: { id: "session-1", sessionKey: "profile-1" },
  });

  assert.equal(managerListPagesRead, 1);
  assert.deepEqual(discoveryBounds, { maxPages: 12, maxChats: 600, maxDurationMs: 15_000 });
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
  const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator, {} as LineChatMirrorService);
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
  const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator, {} as LineChatMirrorService);
  const reports = await service.discoverPilotStores();

  assert.deepEqual(reports.map((report) => report.storeCode), LINE_CHAT_HISTORICAL_PILOT_STORE_CODES);
  assert.ok(reports.every((report) => !report.inventoryComplete));
  assert.ok(reports.every((report) => report.inventoryIncompleteReason === "MIRROR_TARGET_NOT_FOUND"));
  assert.equal(accountLookupCount, 0);
});

test("inventory fails closed when used outside the worker module without a Mirror resolver", async () => {
  const prisma = {
    lineChatMirrorStoreState: {
      findMany: async () => [{ storeCode: "29113", lineOfficialAccountId: "oa-1", enabled: true }],
    },
  } as unknown as PrismaService;
  const service = new LineChatSeptemberInventoryService(
    prisma,
    {} as LineChatSessionService,
    {} as LineChatProfileOperationCoordinator,
  );

  const reports = await service.discoverPilotStores();
  assert.equal(reports[0]?.inventoryIncompleteReason, "MIRROR_TARGET_RESOLVER_UNAVAILABLE");
});

test("pilot inventory uses the Live Mirror OA selector and resolver for direct and fallback targets", async () => {
  for (const targetCase of [
    {
      name: "direct OA target",
      chatBotId: "Uexisting-bot",
      session: {
        id: "session-1",
        sessionKey: "profile-1",
        status: "ACTIVE",
        profilePath: "/redacted/profile",
        profileStorageKey: null,
      },
      source: "EXISTING_OA" as const,
    },
    {
      name: "Manager redirect fallback",
      chatBotId: null,
      session: null,
      source: "MANAGER_ACCOUNT_REDIRECT" as const,
    },
  ]) {
    const privateChatId = `U${"a".repeat(32)}`;
    let resolvedInputs: unknown;
    let requestedBounds: unknown;
    const prisma = {
      lineChatMirrorStoreState: {
        findMany: async () => [{ storeCode: "29113", lineOfficialAccountId: "oa-1", enabled: true }],
      },
      lineChatMirrorChat: {
        findMany: async () => [],
      },
    } as unknown as PrismaService;
    const sessionService = {
      resolveProfilePath: () => "/redacted/profile",
      discoverChats: async (input: Record<string, unknown>) => {
        requestedBounds = {
          maxPages: input.maxPages,
          maxChats: input.maxChats,
          maxDurationMs: input.maxDurationMs,
        };
        const chats = [{
          chatUserId: privateChatId,
          displayName: "private customer",
          lastMessageText: null,
          lastMessageAt: "2026-09-10T10:00:00+07:00",
          lastMessageDirection: null,
          lastMessageTimestampStatus: "VALID" as const,
        }];
        (input.pageObserver as ((page: unknown) => boolean) | undefined)?.({
          responseShape: "list",
          chats,
          totalRawRecords: 1,
          validUserChats: 1,
          ignoredNonUserRecords: 0,
          invalidUserRecords: 0,
        });
        return {
          botId: "Uresolved-bot",
          endpoint: "https://chat.line.biz/api/v2/bots/Uresolved-bot/chats",
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
        _input: unknown,
        callback: (context: { assertOwnership: () => void }) => Promise<unknown>,
      ) => ({
        acquired: true as const,
        value: await callback({ assertOwnership() {} }),
        sessionId: "session-1",
        operationKind: "MANUAL_DIAGNOSTIC" as const,
        requestId: "request-1",
      }),
    } as unknown as LineChatProfileOperationCoordinator;
    const mirrorService = {
      getStoreMirrorTargetInputs: async (storeCode: string) => {
        assert.equal(storeCode, "29113");
        return {
          storeId: "store-db-id",
          effectiveStoreCode: "29113",
          storeMasterAccountName: "OPPO Central Pinklao",
          storeMasterLineId: "@pinklao",
          storeManagerUrl: "https://manager.line.biz/account/@pinklao",
          selectionSource: "MASTER_LINE_ID" as const,
          oa: {
            id: "oa-1",
            name: "OPPO Central Pinklao",
            basicId: "@pinklao",
            lineChatWorkspaceUrl: null,
            chatBotId: targetCase.chatBotId,
            lineChatSession: targetCase.session,
          },
        };
      },
      resolveMirrorTarget: async (input: unknown) => {
        resolvedInputs = input;
        return {
          ok: true as const,
          botId: "Uresolved-bot",
          session: {
            id: "session-1",
            sessionKey: "profile-1",
            status: "ACTIVE",
            profilePath: "/redacted/profile",
            profileStorageKey: null,
          },
          source: targetCase.source,
        };
      },
    } as unknown as LineChatMirrorService;

    const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator, mirrorService);
    const [report] = await service.discoverPilotStores();
    assert.equal(report?.inventoryComplete, true, targetCase.name);
    assert.equal(report?.targetResolutionSource, targetCase.source, targetCase.name);
    assert.equal(report?.septemberChats, 1, targetCase.name);
    assert.deepEqual(resolvedInputs, {
      lineOfficialAccountId: "oa-1",
      chatBotId: targetCase.chatBotId,
      basicId: "@pinklao",
      lineChatWorkspaceUrl: null,
      storeManagerUrl: "https://manager.line.biz/account/@pinklao",
      lineChatSession: targetCase.session,
    }, targetCase.name);
    assert.deepEqual(requestedBounds, {
      maxPages: 12,
      maxChats: 600,
      maxDurationMs: 15_000,
    }, targetCase.name);
    assert.doesNotMatch(JSON.stringify(report), new RegExp(privateChatId, "u"), targetCase.name);
    assert.doesNotMatch(JSON.stringify(report), /private customer|profile-1|Uresolved-bot/iu, targetCase.name);
  }
});

test("pilot inventory fails closed for OA mismatch, ambiguous, or unavailable Mirror targets", async () => {
  const state = { storeCode: "29113", lineOfficialAccountId: "oa-1", enabled: true };
  const targetInputs = {
    storeId: "store-db-id",
    effectiveStoreCode: "29113",
    storeMasterAccountName: null,
    storeMasterLineId: null,
    storeManagerUrl: null,
    selectionSource: "ONLY_ACTIVE_OA" as const,
    oa: {
      id: "oa-1",
      name: "OPPO Central Pinklao",
      basicId: "@pinklao",
      lineChatWorkspaceUrl: null,
      chatBotId: null,
      lineChatSession: null,
    },
  };
  for (const errorCode of ["MIRROR_MANAGER_TARGET_AMBIGUOUS", "MIRROR_MANAGER_TARGET_NOT_FOUND"] as const) {
    let discoveryCalls = 0;
    let resolverCalls = 0;
    const prisma = {
      lineChatMirrorStoreState: { findMany: async () => [state] },
    } as unknown as PrismaService;
    const sessionService = {
      resolveProfilePath: () => "/redacted/profile",
      discoverChats: async () => { discoveryCalls += 1; throw new Error("must not discover"); },
    } as unknown as LineChatSessionService;
    const mirrorService = {
      getStoreMirrorTargetInputs: async () => targetInputs,
      resolveMirrorTarget: async () => {
        resolverCalls += 1;
        return { ok: false as const, errorCode, errorMessage: "safe failure" };
      },
    } as unknown as LineChatMirrorService;
    const coordinator = {} as LineChatProfileOperationCoordinator;
    const service = new LineChatSeptemberInventoryService(prisma, sessionService, coordinator, mirrorService);
    const [report] = await service.discoverPilotStores();
    assert.equal(report?.inventoryIncompleteReason, errorCode);
    assert.equal(resolverCalls, 1);
    assert.equal(discoveryCalls, 0);
  }

  let resolverCalls = 0;
  const mismatchPrisma = {
    lineChatMirrorStoreState: {
      findMany: async () => [{ ...state, lineOfficialAccountId: "stale-oa" }],
    },
  } as unknown as PrismaService;
  const mismatchMirrorService = {
    getStoreMirrorTargetInputs: async () => targetInputs,
    resolveMirrorTarget: async () => {
      resolverCalls += 1;
      throw new Error("must not resolve mismatched OA");
    },
  } as unknown as LineChatMirrorService;
  const mismatchService = new LineChatSeptemberInventoryService(
    mismatchPrisma,
    {} as LineChatSessionService,
    {} as LineChatProfileOperationCoordinator,
    mismatchMirrorService,
  );
  const [mismatchReport] = await mismatchService.discoverPilotStores();
  assert.equal(mismatchReport?.inventoryIncompleteReason, "MIRROR_OA_MAPPING_MISMATCH");
  assert.equal(resolverCalls, 0);
});
