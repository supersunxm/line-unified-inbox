import assert from "node:assert/strict";
import test from "node:test";
import {
  LineChatMirrorDirection,
  LineChatMirrorSyncStatus,
  LineChatSessionStatus,
} from "@prisma/client";
import { LineChatMirrorService } from "./line-chat-mirror.service";
import type { PrismaService } from "../prisma.service";
import type { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import {
  configuredLineChatMirrorStoreCodes,
  isLineChatMirrorEnabled,
  isMirrorOperationSchemaUnavailable,
  lineChatMirrorIntervalMs,
  lineChatMirrorMaxChangedChatsPerCycle,
  managerAccountKeyFromInputs,
  managerBotIdFromRedirect,
  mirrorDirectionForManagerEvent,
  selectMirrorResolvedCandidate,
} from "./line-chat-mirror.service";

type ResolverTestSession = {
  id: string;
  sessionKey: string;
  status: LineChatSessionStatus;
  profilePath: string | null;
  profileStorageKey: null;
};

function resolverTestSession(id: string): ResolverTestSession {
  return {
    id,
    sessionKey: `profile-${id}`,
    status: LineChatSessionStatus.ACTIVE,
    profilePath: "/tmp",
    profileStorageKey: null,
  };
}

function createTargetResolverHarness(options: {
  sessions: ResolverTestSession[];
  busySessionIds?: ReadonlySet<string>;
  unusableSessionIds?: ReadonlySet<string>;
  authBySession?: ReadonlyMap<string, "YES" | "NO" | "UNKNOWN">;
  botIdBySession?: ReadonlyMap<string, string | null>;
  failedDiscoveryBotIds?: ReadonlySet<string>;
}) {
  const logs: string[] = [];
  const leaseRequests: Array<{ sessionId: string; operationKind: string; waitForLock?: boolean }> = [];
  const contexts = new Map<string, {
    resolverSessionId: string;
    pages: () => Array<{ goto: () => Promise<void>; waitForTimeout: () => Promise<void>; url: () => string }>;
    newPage: () => Promise<{ goto: () => Promise<void>; waitForTimeout: () => Promise<void>; url: () => string }>;
  }>();
  for (const session of options.sessions) {
    const botId = options.botIdBySession?.has(session.id)
      ? options.botIdBySession.get(session.id) ?? null
      : `U${"a".repeat(32)}`;
    const page = {
      goto: async () => {},
      waitForTimeout: async () => {},
      url: () => botId ? `https://chat.line.biz/${botId}` : "https://chat.line.biz/account/@manager",
    };
    contexts.set(session.id, {
      resolverSessionId: session.id,
      pages: () => [page],
      newPage: async () => page,
    });
  }
  const prisma = {
    lineChatSession: { findMany: async () => options.sessions },
  } as unknown as PrismaService;
  const sessionService = {
    resolveProfilePath: (session: ResolverTestSession) => {
      if (options.unusableSessionIds?.has(session.id)) throw new Error("profile unavailable");
      return "/tmp";
    },
    launchManagedPersistentContext: async (
      _profilePath: string,
      _launchOptions: unknown,
      metadata?: { sessionId?: string },
    ) => contexts.get(metadata?.sessionId ?? "") as unknown as import("playwright").BrowserContext,
    probeApiAuthentication: async (context: { resolverSessionId: string }) => ({
      authenticated: options.authBySession?.get(context.resolverSessionId) ?? "YES",
    }),
    closeManagedPersistentContext: async () => {},
    discoverRecentChats: async ({ botId }: { botId: string }) => options.failedDiscoveryBotIds?.has(botId)
      ? {
        status: "FAILED" as const,
        chats: [],
        pagesFetched: 1,
        totalRawRecords: 0,
        failureReason: "TRANSPORT" as const,
        failureDetail: "private customer and cursor details must not enter the summary",
      }
      : { status: "READY" as const, chats: [], pagesFetched: 1, totalRawRecords: 0 },
  } as unknown as LineChatSessionService;
  const coordinator = {
    withProfileOperation: async (
      input: { sessionId: string; operationKind: string },
      callback: (context: { assertOwnership: () => void }) => Promise<unknown>,
      lockOptions?: { waitForLock?: boolean },
    ) => {
      leaseRequests.push({ ...input, waitForLock: lockOptions?.waitForLock });
      if (options.busySessionIds?.has(input.sessionId)) {
        return {
          acquired: false as const,
          reason: "PROFILE_OPERATION_BUSY" as const,
          retryAfterMs: 5_000,
          sessionId: input.sessionId,
          operationKind: "MIRROR_SYNC" as const,
          requestId: `busy-${input.sessionId}`,
          busyStage: "DATABASE_LEASE" as const,
          waitedMs: 0,
        };
      }
      return {
        acquired: true as const,
        value: await callback({ assertOwnership() {} }),
        sessionId: input.sessionId,
        operationKind: "MIRROR_SYNC" as const,
        requestId: `acquired-${input.sessionId}`,
      };
    },
  } as unknown as LineChatProfileOperationCoordinator;
  const service = new LineChatMirrorService(prisma, sessionService, coordinator);
  Object.defineProperty(service, "logger", {
    configurable: true,
    value: {
      log: (message: string) => logs.push(message),
      warn: (message: string) => logs.push(message),
    },
  });
  const summaryRecords = () => logs
    .map((message) => {
      try { return JSON.parse(message) as Record<string, unknown>; } catch { return null; }
    })
    .filter((record): record is Record<string, unknown> =>
      record?.event === "line_chat_mirror_target_resolution_summary",
    );
  return { service, logs, leaseRequests, summaryRecords };
}

function targetResolverInput(
  overrides: Partial<Parameters<LineChatMirrorService["resolveMirrorTarget"]>[0]> = {},
): Parameters<LineChatMirrorService["resolveMirrorTarget"]>[0] {
  return {
    storeCode: "29113",
    lineOfficialAccountId: "oa-private-test",
    chatBotId: null,
    basicId: "@manager-account",
    lineChatWorkspaceUrl: null,
    storeManagerUrl: null,
    lineChatSession: null,
    ...overrides,
  };
}

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

async function withEnvAsync(
  values: Record<string, string | undefined>,
  callback: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await callback();
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
  const logs: string[] = [];
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
  Object.defineProperty(service, "logger", {
    configurable: true,
    value: { log: (message: string) => logs.push(message), warn: (message: string) => logs.push(message) },
  });

  const result = await service.resolveMirrorTarget({
    storeCode: "29113",
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
  const summary = JSON.parse(logs[0] ?? "{}") as Record<string, unknown>;
  assert.equal(summary.event, "line_chat_mirror_target_resolution_summary");
  assert.equal(summary.storeCode, "29113");
  assert.equal(summary.outcome, "EXISTING_OA");
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
  let waitForLock: boolean | undefined;
  const logs: string[] = [];
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
      options?: { waitForLock?: boolean },
    ) => {
      waitForLock = options?.waitForLock;
      return {
        acquired: true as const,
        value: await callback({ assertOwnership() {} }),
        sessionId: session.id,
        operationKind: "MIRROR_SYNC" as const,
        requestId: "request-1",
      };
    },
  } as unknown as LineChatProfileOperationCoordinator;
  const service = new LineChatMirrorService(prisma, sessionService, coordinator);
  Object.defineProperty(service, "logger", {
    configurable: true,
    value: { log: (message: string) => logs.push(message), warn: (message: string) => logs.push(message) },
  });

  const result = await service.resolveMirrorTarget({
    storeCode: "29113",
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
  assert.equal(waitForLock, false);
  const summary = logs.map((line) => JSON.parse(line) as Record<string, unknown>)
    .find((line) => line.event === "line_chat_mirror_target_resolution_summary");
  assert.equal(summary?.outcome, "MANAGER_ACCOUNT_REDIRECT");
  assert.equal(summary?.verifiedCandidates, 1);
});

test("Mirror target resolver reports cache hits without changing the cached target", async () => {
  const session = resolverTestSession("cache-session");
  const harness = createTargetResolverHarness({ sessions: [] });
  const first = await harness.service.resolveMirrorTarget(targetResolverInput({
    chatBotId: `U${"c".repeat(32)}`,
    lineChatSession: session,
  }));
  const second = await harness.service.resolveMirrorTarget(targetResolverInput());

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(first.source, "EXISTING_OA");
    assert.equal(second.source, "EXISTING_OA");
    assert.equal(second.session.id, session.id);
  }
  assert.deepEqual(harness.summaryRecords().map((record) => record.outcome), ["EXISTING_OA", "CACHE_HIT"]);
});

test("Mirror target resolver bypasses a warm cache when explicitly requested", async () => {
  const cachedSession = resolverTestSession("cache-session");
  const redirectSession = resolverTestSession("redirect-session");
  const redirectBotId = `U${"b".repeat(32)}`;
  const harness = createTargetResolverHarness({
    sessions: [redirectSession],
    botIdBySession: new Map([[redirectSession.id, redirectBotId]]),
  });

  const cached = await harness.service.resolveMirrorTarget(targetResolverInput({
    chatBotId: `U${"c".repeat(32)}`,
    lineChatSession: cachedSession,
  }));
  assert.equal(cached.ok, true);

  const fresh = await harness.service.resolveMirrorTarget(targetResolverInput({
    chatBotId: null,
    lineChatSession: null,
    bypassCache: true,
  }));

  assert.equal(fresh.ok, true);
  if (fresh.ok) {
    assert.equal(fresh.source, "MANAGER_ACCOUNT_REDIRECT");
    assert.equal(fresh.session.id, redirectSession.id);
    assert.equal(fresh.botId, redirectBotId);
  }
  assert.deepEqual(
    harness.summaryRecords().map((record) => record.outcome),
    ["EXISTING_OA", "MANAGER_ACCOUNT_REDIRECT"],
  );
});

test("Mirror target resolver reports missing account key and no usable sessions distinctly", async () => {
  const missingKeyHarness = createTargetResolverHarness({ sessions: [] });
  const missingKey = await missingKeyHarness.service.resolveMirrorTarget(targetResolverInput({ basicId: null }));
  assert.equal(missingKey.ok, false);
  if (!missingKey.ok) assert.equal(missingKey.errorCode, "MIRROR_MANAGER_ACCOUNT_KEY_MISSING");
  assert.equal(missingKeyHarness.summaryRecords()[0]?.outcome, "NO_MANAGER_ACCOUNT_KEY");

  const noSessionHarness = createTargetResolverHarness({ sessions: [] });
  const noSession = await noSessionHarness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(noSession.ok, false);
  if (!noSession.ok) assert.equal(noSession.errorCode, "MIRROR_MANAGER_TARGET_NOT_FOUND");
  assert.equal(noSessionHarness.summaryRecords()[0]?.outcome, "NO_ACTIVE_SESSION");

  const unavailable = resolverTestSession("unavailable-session");
  const noProfileHarness = createTargetResolverHarness({
    sessions: [unavailable],
    unusableSessionIds: new Set([unavailable.id]),
  });
  const noProfile = await noProfileHarness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(noProfile.ok, false);
  if (!noProfile.ok) assert.equal(noProfile.errorCode, "MIRROR_MANAGER_TARGET_NOT_FOUND");
  assert.equal(noProfileHarness.summaryRecords()[0]?.outcome, "NO_USABLE_SESSION");
});

test("Mirror target resolver continues past one busy profile and accepts another verified redirect", async () => {
  const first = resolverTestSession("busy-session");
  const second = resolverTestSession("available-session");
  const botId = `U${"b".repeat(32)}`;
  const harness = createTargetResolverHarness({
    sessions: [first, second],
    busySessionIds: new Set([first.id]),
    botIdBySession: new Map([[second.id, botId]]),
  });

  const result = await harness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.botId, botId);
    assert.equal(result.session.id, second.id);
    assert.equal(result.source, "MANAGER_ACCOUNT_REDIRECT");
  }
  assert.deepEqual(harness.leaseRequests.map((request) => request.waitForLock), [false, false]);
  const summary = harness.summaryRecords()[0];
  assert.equal(summary?.sessionsBusy, 1);
  assert.equal(summary?.sessionsAttempted, 1);
  assert.equal(summary?.verifiedCandidates, 1);
  assert.equal(summary?.outcome, "MANAGER_ACCOUNT_REDIRECT");
});

test("busy profile plus rejected attempted profile remains temporary busy", async () => {
  const busy = resolverTestSession("busy-session");
  const attempted = resolverTestSession("attempted-session");
  const attemptedBotId = `U${"d".repeat(32)}`;
  const harness = createTargetResolverHarness({
    sessions: [busy, attempted],
    busySessionIds: new Set([busy.id]),
    botIdBySession: new Map([[attempted.id, attemptedBotId]]),
    failedDiscoveryBotIds: new Set([attemptedBotId]),
  });

  const result = await harness.service.resolveMirrorTarget(targetResolverInput());

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "MIRROR_MANAGER_TARGET_BUSY");
  const summary = harness.summaryRecords()[0];
  assert.equal(summary?.sessionsBusy, 1);
  assert.equal(summary?.sessionsAttempted, 1);
  assert.equal(summary?.recentDiscoveryRejected, 1);
  assert.equal(summary?.outcome, "PROFILE_BUSY");
});

test("all eligible Mirror resolver profiles busy returns a temporary busy code, not target-not-found", async () => {
  const sessions = [resolverTestSession("busy-a"), resolverTestSession("busy-b")];
  const harness = createTargetResolverHarness({
    sessions,
    busySessionIds: new Set(sessions.map((session) => session.id)),
  });

  const result = await harness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "MIRROR_MANAGER_TARGET_BUSY");
  const summary = harness.summaryRecords()[0];
  assert.equal(summary?.sessionsConsidered, 2);
  assert.equal(summary?.sessionsBusy, 2);
  assert.equal(summary?.sessionsAttempted, 0);
  assert.equal(summary?.outcome, "PROFILE_BUSY");
  assert.doesNotMatch(JSON.stringify(summary), /oa-private-test|busy-a|busy-b|manager-account/iu);
});

test("attempted profiles without confirmed auth remain permanent target-not-found with auth diagnostics", async () => {
  const sessions = [resolverTestSession("auth-a"), resolverTestSession("auth-b")];
  const harness = createTargetResolverHarness({
    sessions,
    authBySession: new Map([["auth-a", "NO"], ["auth-b", "UNKNOWN"]]),
  });

  const result = await harness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "MIRROR_MANAGER_TARGET_NOT_FOUND");
  const summary = harness.summaryRecords()[0];
  assert.equal(summary?.sessionsAttempted, 2);
  assert.equal(summary?.authenticationNotConfirmed, 2);
  assert.equal(summary?.outcome, "AUTH_NOT_CONFIRMED");
});

test("authenticated redirect without a canonical Bot ID remains target-not-found with a distinct outcome", async () => {
  const session = resolverTestSession("redirect-without-bot");
  const harness = createTargetResolverHarness({
    sessions: [session],
    botIdBySession: new Map([[session.id, null]]),
  });

  const result = await harness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "MIRROR_MANAGER_TARGET_NOT_FOUND");
  const summary = harness.summaryRecords()[0];
  assert.equal(summary?.authenticatedSessions, 1);
  assert.equal(summary?.redirectsWithoutBotId, 1);
  assert.equal(summary?.outcome, "REDIRECT_BOT_ID_NOT_FOUND");
});

test("recent discovery rejection is distinguished without customer details in resolver summaries", async () => {
  const session = resolverTestSession("candidate-rejected");
  const botId = `U${"d".repeat(32)}`;
  const harness = createTargetResolverHarness({
    sessions: [session],
    botIdBySession: new Map([[session.id, botId]]),
    failedDiscoveryBotIds: new Set([botId]),
  });

  const result = await harness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "MIRROR_MANAGER_TARGET_NOT_FOUND");
  const summary = harness.summaryRecords()[0];
  assert.equal(summary?.recentDiscoveryRejected, 1);
  assert.equal(summary?.outcome, "RECENT_DISCOVERY_REJECTED");
  assert.doesNotMatch(JSON.stringify(summary), /customer|cursor|candidate-rejected|oa-private-test/iu);
  const rejectedLog = harness.logs
    .map((message) => JSON.parse(message) as Record<string, unknown>)
    .find((record) => record.event === "line_chat_mirror_target_candidate_rejected");
  assert.equal(rejectedLog?.storeCode, "29113");
  assert.equal("failureDetail" in (rejectedLog ?? {}), false);
});

test("multiple distinct verified redirect targets remain fail-closed as ambiguous", async () => {
  const first = resolverTestSession("candidate-a");
  const second = resolverTestSession("candidate-b");
  const harness = createTargetResolverHarness({
    sessions: [first, second],
    botIdBySession: new Map([
      [first.id, `U${"e".repeat(32)}`],
      [second.id, `U${"f".repeat(32)}`],
    ]),
  });

  const result = await harness.service.resolveMirrorTarget(targetResolverInput());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "MIRROR_MANAGER_TARGET_AMBIGUOUS");
  const summary = harness.summaryRecords()[0];
  assert.equal(summary?.verifiedCandidates, 2);
  assert.equal(summary?.outcome, "AMBIGUOUS");
});

test("Live Mirror records resolver contention as transient PARTIAL state", async () => {
  const stateUpdates: Array<Record<string, unknown>> = [];
  const store = {
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
  const prisma = {
    store: { findFirst: async () => store },
    lineChatMirrorStoreState: {
      upsert: async () => {},
      update: async (input: { data: Record<string, unknown> }) => stateUpdates.push(input.data),
    },
    lineChatMirrorMessage: { updateMany: async () => ({ count: 0 }) },
    lineChatMirrorChat: { findMany: async () => [] },
  } as unknown as PrismaService;
  const service = new LineChatMirrorService(
    prisma,
    {} as LineChatSessionService,
    {} as LineChatProfileOperationCoordinator,
  );
  Object.defineProperty(service, "resolveMirrorTarget", {
    configurable: true,
    value: async () => ({
      ok: false as const,
      errorCode: "MIRROR_MANAGER_TARGET_BUSY" as const,
      errorMessage: "temporarily busy",
    }),
  });

  const result = await (service as unknown as {
    syncStore: (storeCode: string) => Promise<{ status: LineChatMirrorSyncStatus }>;
  }).syncStore("29113");

  assert.equal(result.status, LineChatMirrorSyncStatus.PARTIAL);
  assert.equal(stateUpdates.length, 1);
  assert.equal(stateUpdates[0]?.status, LineChatMirrorSyncStatus.PARTIAL);
  assert.equal(stateUpdates[0]?.lastErrorCode, "PROFILE_OPERATION_BUSY");
  assert.notEqual(stateUpdates[0]?.lastErrorCode, "MIRROR_MANAGER_TARGET_NOT_FOUND");
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

test("operation-mode schema absence is recognized only for the expected Prisma table error", () => {
  const missing = Object.assign(
    new Error('The table `public.MirrorOperationState` does not exist in the current database.'),
    { code: "P2021" },
  );
  assert.equal(isMirrorOperationSchemaUnavailable(missing), true);
  assert.equal(
    isMirrorOperationSchemaUnavailable(Object.assign(new Error("other table"), { code: "P2021" })),
    false,
  );
  assert.equal(
    isMirrorOperationSchemaUnavailable(Object.assign(new Error("MirrorOperationState"), { code: "P1001" })),
    false,
  );
});

test("initial worker rollout temporarily keeps NORMAL behavior while the new mode table is not migrated yet", async () => {
  await withEnvAsync({ LINE_CHAT_MIRROR_STORE_CODES: "20789" }, async () => {
    const missing = Object.assign(
      new Error('The table `public.MirrorOperationState` does not exist in the current database.'),
      { code: "P2021" },
    );
    const service = new LineChatMirrorService(
      {} as PrismaService,
      {} as LineChatSessionService,
      {} as LineChatProfileOperationCoordinator,
      { getState: async () => { throw missing; } } as never,
    );
    let syncCalls = 0;
    Object.defineProperty(service, "syncStore", {
      configurable: true,
      value: async (storeCode: string) => {
        syncCalls += 1;
        return {
          storeCode,
          status: LineChatMirrorSyncStatus.SUCCESS,
          recentChatsObserved: 0,
          historiesFetched: 0,
          messagesObserved: 0,
          messagesInsertedOrUpdated: 0,
          pendingChats: 0,
          unknownDirectionEvents: 0,
          durationMs: 0,
        };
      },
    });

    const results = await service.runCycle();
    assert.equal(syncCalls, 1);
    assert.equal(results.length, 1);
  });
});

test("after operation mode has loaded once, later state-load failures fail closed", async () => {
  await withEnvAsync({ LINE_CHAT_MIRROR_STORE_CODES: "20789" }, async () => {
    const missing = Object.assign(
      new Error('The table `public.MirrorOperationState` does not exist in the current database.'),
      { code: "P2021" },
    );
    let reads = 0;
    const operationMode = {
      getState: async () => {
        reads += 1;
        if (reads > 1) throw missing;
        return {
          mode: "NORMAL" as const,
          runId: null,
          freezeAt: null,
          backfillTargetStartAt: null,
          catchUpStartAt: null,
        };
      },
    };
    const service = new LineChatMirrorService(
      {} as PrismaService,
      {} as LineChatSessionService,
      {} as LineChatProfileOperationCoordinator,
      operationMode as never,
    );
    let syncCalls = 0;
    Object.defineProperty(service, "syncStore", {
      configurable: true,
      value: async (storeCode: string) => {
        syncCalls += 1;
        return {
          storeCode,
          status: LineChatMirrorSyncStatus.SUCCESS,
          recentChatsObserved: 0,
          historiesFetched: 0,
          messagesObserved: 0,
          messagesInsertedOrUpdated: 0,
          pendingChats: 0,
          unknownDirectionEvents: 0,
          durationMs: 0,
        };
      },
    });

    assert.equal((await service.runCycle()).length, 1);
    assert.deepEqual(await service.runCycle(), []);
    assert.equal(syncCalls, 1);
  });
});

test("NORMAL mode starts a scheduled Live Mirror cycle", async () => {
  await withEnvAsync({ LINE_CHAT_MIRROR_STORE_CODES: "20789" }, async () => {
    const operationMode = {
      getState: async () => ({
        mode: "NORMAL" as const,
        freezeAt: null,
        backfillTargetStartAt: null,
        catchUpStartAt: null,
      }),
    };
    const service = new LineChatMirrorService(
      {} as PrismaService,
      {} as LineChatSessionService,
      {} as LineChatProfileOperationCoordinator,
      operationMode as never,
    );
    let syncCalls = 0;
    Object.defineProperty(service, "syncStore", {
      configurable: true,
      value: async (storeCode: string) => {
        syncCalls += 1;
        return {
          storeCode,
          status: LineChatMirrorSyncStatus.SUCCESS,
          recentChatsObserved: 0,
          historiesFetched: 0,
          messagesObserved: 0,
          messagesInsertedOrUpdated: 0,
          pendingChats: 0,
          unknownDirectionEvents: 0,
          durationMs: 0,
        };
      },
    });

    const results = await service.runCycle();
    assert.equal(syncCalls, 1);
    assert.equal(results.length, 1);
  });
});

test("CATCH_UP resumes live cycles from the persisted overlap boundary", async () => {
  await withEnvAsync({ LINE_CHAT_MIRROR_STORE_CODES: "20789" }, async () => {
    const catchUpStartAt = new Date("2026-09-24T01:10:00.000Z");
    const operationMode = {
      getState: async () => ({
        mode: "CATCH_UP" as const,
        freezeAt: new Date("2026-09-24T01:15:00.000Z"),
        backfillTargetStartAt: new Date("2026-08-31T17:00:00.000Z"),
        catchUpStartAt,
      }),
    };
    const service = new LineChatMirrorService(
      {} as PrismaService,
      {} as LineChatSessionService,
      {} as LineChatProfileOperationCoordinator,
      operationMode as never,
    );
    const observedBoundaries: Array<Date | null> = [];
    Object.defineProperty(service, "syncStore", {
      configurable: true,
      value: async (storeCode: string, boundary: Date | null) => {
        observedBoundaries.push(boundary);
        return {
          storeCode,
          status: LineChatMirrorSyncStatus.SUCCESS,
          recentChatsObserved: 0,
          historiesFetched: 0,
          messagesObserved: 0,
          messagesInsertedOrUpdated: 0,
          pendingChats: 0,
          unknownDirectionEvents: 0,
          durationMs: 0,
        };
      },
    });

    await service.runCycle();
    assert.equal(observedBoundaries.length, 1);
    assert.equal(observedBoundaries[0]?.toISOString(), catchUpStartAt.toISOString());
  });
});

test("BACKFILL keeps the worker cycle active but serializes pilot stores without Live Mirror", async () => {
  await withEnvAsync({ LINE_CHAT_MIRROR_STORE_CODES: "29113,28375,25610" }, async () => {
    const operationMode = {
      getState: async () => ({
        mode: "BACKFILL" as const,
        runId: "run-backfill",
        freezeAt: new Date("2026-09-24T01:15:00.000Z"),
        backfillTargetStartAt: new Date("2026-08-31T17:00:00.000Z"),
        catchUpStartAt: null,
      }),
    };
    const service = new LineChatMirrorService(
      {} as PrismaService,
      {} as LineChatSessionService,
      {} as LineChatProfileOperationCoordinator,
      operationMode as never,
    );
    let liveCalls = 0;
    let activeBackfill = 0;
    let maxActiveBackfill = 0;
    const backfillStores: string[] = [];
    Object.defineProperty(service, "syncStore", {
      configurable: true,
      value: async () => { liveCalls += 1; throw new Error("Live cycle must be skipped"); },
    });
    Object.defineProperty(service, "runBackfillStore", {
      configurable: true,
      value: async (_runId: string, storeCode: string) => {
        activeBackfill += 1;
        maxActiveBackfill = Math.max(maxActiveBackfill, activeBackfill);
        backfillStores.push(storeCode);
        await Promise.resolve();
        activeBackfill -= 1;
      },
    });

    await service.runCycle();
    assert.equal(liveCalls, 0);
    assert.equal(maxActiveBackfill, 1);
    assert.deepEqual(backfillStores, ["29113", "28375", "25610"]);
  });
});

test("an in-flight live cycle may finish, then BACKFILL skips later live work", async () => {
  await withEnvAsync({ LINE_CHAT_MIRROR_STORE_CODES: "29113" }, async () => {
    let mode: "NORMAL" | "BACKFILL" = "NORMAL";
    const freezeAt = new Date("2026-09-24T01:15:00.000Z");
    const operationMode = {
      getState: async () => mode === "NORMAL"
        ? {
          mode,
          freezeAt: null,
          backfillTargetStartAt: null,
          catchUpStartAt: null,
        }
        : {
          mode,
          runId: "run-backfill",
          freezeAt,
          backfillTargetStartAt: new Date("2026-08-31T17:00:00.000Z"),
          catchUpStartAt: null,
        },
    };
    const service = new LineChatMirrorService(
      {} as PrismaService,
      {} as LineChatSessionService,
      {} as LineChatProfileOperationCoordinator,
      operationMode as never,
    );
    let markStarted!: () => void;
    let finishSync!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const blocked = new Promise<void>((resolve) => { finishSync = resolve; });
    let syncCalls = 0;
    let backfillCalls = 0;
    Object.defineProperty(service, "syncStore", {
      configurable: true,
      value: async (storeCode: string) => {
        syncCalls += 1;
        markStarted();
        await blocked;
        return {
          storeCode,
          status: LineChatMirrorSyncStatus.SUCCESS,
          recentChatsObserved: 0,
          historiesFetched: 0,
          messagesObserved: 0,
          messagesInsertedOrUpdated: 0,
          pendingChats: 0,
          unknownDirectionEvents: 0,
          durationMs: 0,
        };
      },
    });
    Object.defineProperty(service, "runBackfillStore", {
      configurable: true,
      value: async () => { backfillCalls += 1; },
    });

    const inFlight = service.runCycle();
    await started;
    mode = "BACKFILL";
    finishSync();
    await inFlight;
    const nextCycle = await service.runCycle();

    assert.equal(syncCalls, 1);
    assert.equal(nextCycle.length, 0);
    assert.equal(backfillCalls, 1);
  });
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
