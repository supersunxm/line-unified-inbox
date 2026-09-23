import assert from "node:assert/strict";
import test from "node:test";
import { LineChatMirrorDirection, LineChatSessionStatus } from "@prisma/client";
import { LineChatMirrorService } from "./line-chat-mirror.service";
import type { PrismaService } from "../prisma.service";
import type { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import {
  configuredLineChatMirrorStoreCodes,
  isLineChatMirrorEnabled,
  isLineChatHistoricalBackfillEnabled,
  lineChatMirrorIntervalMs,
  lineChatMirrorMaxChangedChatsPerCycle,
  managerAccountKeyFromInputs,
  managerBotIdFromRedirect,
  mirrorDirectionForManagerEvent,
  selectMirrorResolvedCandidate,
} from "./line-chat-mirror.service";

function withEnv(
  values: Record<string, string | undefined>,
  callback: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Project B mirror pilot parses and deduplicates configured store codes", () => {
  withEnv(
    { LINE_CHAT_MIRROR_STORE_CODES: "20789, 29113;20789 29737" },
    () => {
      assert.deepEqual(
        configuredLineChatMirrorStoreCodes(),
        ["20789", "29113", "29737"],
      );
    },
  );
});

test("Project B mirror remains opt-in", () => {
  withEnv({ LINE_CHAT_MIRROR_ENABLED: undefined }, () => {
    assert.equal(isLineChatMirrorEnabled(), false);
  });
  withEnv({ LINE_CHAT_MIRROR_ENABLED: "true" }, () => {
    assert.equal(isLineChatMirrorEnabled(), true);
  });
});

test("A1 historical backfill remains explicitly opt-in", () => {
  withEnv({ LINE_CHAT_HISTORICAL_BACKFILL_ENABLED: undefined }, () => {
    assert.equal(isLineChatHistoricalBackfillEnabled(), false);
  });
  withEnv({ LINE_CHAT_HISTORICAL_BACKFILL_ENABLED: "true" }, () => {
    assert.equal(isLineChatHistoricalBackfillEnabled(), true);
  });
});

test("Project B mirror cadence and per-cycle history work are bounded", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_INTERVAL_MS: "1000",
      LINE_CHAT_MIRROR_MAX_CHANGED_CHATS_PER_CYCLE: "500",
    },
    () => {
      assert.equal(lineChatMirrorIntervalMs(), 30_000);
      assert.equal(lineChatMirrorMaxChangedChatsPerCycle(), 50);
    },
  );
});

test("Manager history direction classification is fail-closed", () => {
  assert.equal(
    mirrorDirectionForManagerEvent("messageSent"),
    LineChatMirrorDirection.OUTBOUND,
  );
  assert.equal(
    mirrorDirectionForManagerEvent("messageReceived"),
    LineChatMirrorDirection.INBOUND,
  );
  assert.equal(
    mirrorDirectionForManagerEvent("message"),
    LineChatMirrorDirection.INBOUND,
  );
  assert.equal(
    mirrorDirectionForManagerEvent("someFutureEvent"),
    LineChatMirrorDirection.UNKNOWN,
  );
  assert.equal(
    mirrorDirectionForManagerEvent(undefined),
    LineChatMirrorDirection.UNKNOWN,
  );
});


test("Project B mirror derives Manager account key from configured account URL or Basic ID", () => {
  assert.equal(
    managerAccountKeyFromInputs({
      storeManagerUrl: "https://manager.line.biz/account/@688zunxx",
      basicId: "@fallback",
    }),
    "@688zunxx",
  );
  assert.equal(
    managerAccountKeyFromInputs({
      lineChatWorkspaceUrl: "https://chat.line.biz/account/@123abcd",
      storeManagerUrl: "https://manager.line.biz/account/@fallback",
    }),
    "@123abcd",
  );
  assert.equal(
    managerAccountKeyFromInputs({ basicId: "@912xjbyi" }),
    "@912xjbyi",
  );
  assert.equal(
    managerAccountKeyFromInputs({
      storeManagerUrl: "https://evil.example/account/@bad",
      basicId: null,
    }),
    null,
  );
});

test("Project B mirror accepts only canonical LINE chat bot redirects", () => {
  assert.equal(
    managerBotIdFromRedirect(
      "https://chat.line.biz/U0123456789abcdef0123456789abcdef",
    ),
    "U0123456789abcdef0123456789abcdef",
  );
  assert.equal(
    managerBotIdFromRedirect(
      "https://chat.line.biz/U0123456789abcdef0123456789abcdef/chat/Ucustomer",
    ),
    "U0123456789abcdef0123456789abcdef",
  );
  assert.equal(
    managerBotIdFromRedirect("https://chat.line.biz/account/@688zunxx"),
    null,
  );
  assert.equal(
    managerBotIdFromRedirect(
      "https://evil.example/U0123456789abcdef0123456789abcdef",
    ),
    null,
  );
});

test("Live Mirror canonical store target inputs use the read-only OA selector", async () => {
  let storeReads = 0;
  let writes = 0;
  const prisma = {
    store: {
      findFirst: async () => {
        storeReads += 1;
        return {
          id: "store-db-id",
          code: "29113",
          storeMaster: {
            externalStoreId: "29113",
            lineManagerUrl: "https://manager.line.biz/account/@pinklao",
            accountName: "OPPO Central Pinklao",
            normalizedAccountName: "oppo central pinklao",
            lineId: "@pinklao",
          },
          lineOfficialAccounts: [{
            id: "oa-pinklao",
            name: "OPPO Central Pinklao",
            basicId: "@pinklao",
            lineChatWorkspaceUrl: null,
            chatBotId: null,
            lineChatSession: null,
          }],
        };
      },
    },
    lineChatMirrorStoreState: {
      upsert: async () => { writes += 1; },
    },
  } as unknown as PrismaService;
  const service = new LineChatMirrorService(
    prisma,
    {} as LineChatSessionService,
    {} as LineChatProfileOperationCoordinator,
  );

  const target = await service.getStoreMirrorTargetInputs("29113");
  assert.equal(storeReads, 1);
  assert.equal(writes, 0);
  assert.equal(target.oa.id, "oa-pinklao");
  assert.equal(target.oa.chatBotId, null);
  assert.equal(target.oa.lineChatSession, null);
  assert.equal(target.storeManagerUrl, "https://manager.line.biz/account/@pinklao");
  assert.equal(target.selectionSource, "MASTER_LINE_ID");
});

test("canonical Mirror target resolver preserves the direct OA bot and active-session path", async () => {
  let profileResolutionCalls = 0;
  const session = {
    id: "session-direct",
    sessionKey: "direct-profile",
    status: LineChatSessionStatus.ACTIVE,
    profilePath: "/unused/profile",
    profileStorageKey: null,
  };
  const service = new LineChatMirrorService(
    {} as PrismaService,
    {
      resolveProfilePath: () => {
        profileResolutionCalls += 1;
        throw new Error("Direct target must not inspect the profile.");
      },
    } as unknown as LineChatSessionService,
    {} as LineChatProfileOperationCoordinator,
  );

  const result = await service.resolveMirrorTarget({
    lineOfficialAccountId: "oa-direct",
    chatBotId: "Uexisting-bot",
    basicId: "@direct",
    lineChatWorkspaceUrl: null,
    storeManagerUrl: null,
    lineChatSession: session,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.botId, "Uexisting-bot");
    assert.equal(result.source, "EXISTING_OA");
    assert.equal(result.session.id, "session-direct");
  }
  assert.equal(profileResolutionCalls, 0);
});

test("canonical Mirror target resolver uses Manager redirect fallback when OA bot and session are absent", async () => {
  const botId = `U${"a".repeat(32)}`;
  const session = {
    id: "session-fallback",
    sessionKey: "fallback-profile",
    status: LineChatSessionStatus.ACTIVE,
    profilePath: null,
    profileStorageKey: null,
  };
  let recentDiscoveryCalls = 0;
  let closedContexts = 0;
  const page = {
    goto: async () => {},
    waitForTimeout: async () => {},
    url: () => `https://chat.line.biz/${botId}`,
  };
  const context = {
    pages: () => [page],
    newPage: async () => page,
    close: async () => { closedContexts += 1; },
  } as unknown as import("playwright").BrowserContext;
  const prisma = {
    lineChatSession: { findMany: async () => [session] },
  } as unknown as PrismaService;
  const sessionService = {
    resolveProfilePath: () => "/tmp",
    launchManagedPersistentContext: async () => context,
    probeApiAuthentication: async () => ({ authenticated: "YES" as const }),
    closeManagedPersistentContext: async () => { closedContexts += 1; },
    discoverRecentChats: async () => {
      recentDiscoveryCalls += 1;
      return { status: "READY" as const, chats: [], pagesFetched: 1, totalRawRecords: 0 };
    },
  } as unknown as LineChatSessionService;
  const coordinator = {
    withProfileOperation: async (
      _input: unknown,
      callback: (context: { assertOwnership: () => void }) => Promise<unknown>,
    ) => ({
      acquired: true as const,
      value: await callback({ assertOwnership() {} }),
      sessionId: session.id,
      operationKind: "MIRROR_SYNC" as const,
      requestId: "request-1",
    }),
  } as unknown as LineChatProfileOperationCoordinator;
  const service = new LineChatMirrorService(prisma, sessionService, coordinator);

  const result = await service.resolveMirrorTarget({
    lineOfficialAccountId: "oa-fallback",
    chatBotId: null,
    basicId: "@fallback",
    lineChatWorkspaceUrl: null,
    storeManagerUrl: null,
    lineChatSession: null,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.botId, botId);
    assert.equal(result.source, "MANAGER_ACCOUNT_REDIRECT");
    assert.equal(result.session.id, session.id);
  }
  assert.equal(recentDiscoveryCalls, 1);
  assert.equal(closedContexts, 1);
});


test("Project B mirror accepts duplicate Manager sessions when they resolve the same bot", () => {
  const sessionA = {
    id: "session-a",
    sessionKey: "profile-b",
    status: "ACTIVE" as any,
    profilePath: "/tmp/a",
    profileStorageKey: null,
  };
  const sessionB = {
    id: "session-b",
    sessionKey: "account-1",
    status: "ACTIVE" as any,
    profilePath: "/tmp/b",
    profileStorageKey: null,
  };

  const selected = selectMirrorResolvedCandidate([
    { botId: "U0123456789abcdef0123456789abcdef", session: sessionA },
    { botId: "U0123456789abcdef0123456789abcdef", session: sessionB },
  ]);

  assert.notEqual(selected, null);
  assert.notEqual(selected, "AMBIGUOUS");
  if (selected && selected !== "AMBIGUOUS") {
    assert.equal(selected.session.id, "session-a");
    assert.equal(selected.botId, "U0123456789abcdef0123456789abcdef");
  }
});

test("Project B mirror fails closed when Manager sessions resolve different bots", () => {
  const sessionA = {
    id: "session-a",
    sessionKey: "profile-b",
    status: "ACTIVE" as any,
    profilePath: "/tmp/a",
    profileStorageKey: null,
  };
  const sessionB = {
    id: "session-b",
    sessionKey: "account-1",
    status: "ACTIVE" as any,
    profilePath: "/tmp/b",
    profileStorageKey: null,
  };

  assert.equal(
    selectMirrorResolvedCandidate([
      { botId: "U0123456789abcdef0123456789abcdef", session: sessionA },
      { botId: "Ufedcba9876543210fedcba9876543210", session: sessionB },
    ]),
    "AMBIGUOUS",
  );
});
