import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import type { BrowserContext } from "playwright";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import {
  LineChatSessionService,
  PROFILE_BROWSER_MAX_CONTEXT_AGE_MS,
  PROFILE_BROWSER_MAX_OPERATIONS,
} from "./line-chat-session.service";
import { LineChatTargetProofService } from "./line-chat-target-proof.service";

const BOT_ID = `U${"a1".repeat(16)}`;

function makeTarget(profile: "a" | "b" = "a", profilePath = "/tmp") {
  const session = {
    id: `session-${profile}`,
    sessionKey: profile === "a" ? "account-1" : "profile-b",
    status: "ACTIVE",
    profilePath,
    profileStorageKey: profile === "a" ? "account-1-v1" : "profile-b-linux-v2",
  };
  return {
    storeId: "store-1",
    effectiveStoreCode: "25610",
    storeMasterAccountName: "OPPO Central Pinklao",
    storeMasterLineId: "@oppocentralpinklao",
    storeManagerUrl: "https://chat.line.biz/account/manager-account-1",
    selectionSource: "MASTER_LINE_ID" as const,
    oa: {
      id: "oa-1",
      name: "OPPO Central Pinklao",
      basicId: "@oppocentralpinklao",
      lineChatWorkspaceUrl: null,
      chatBotId: null,
      lineChatSession: session,
    },
  };
}

function createLeasePrisma() {
  const writes: string[] = [];
  let leaseOwner = "";
  const prisma = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(" ");
      if (query.includes('INSERT INTO "LineChatProfileOperationLease"')) {
        writes.push("ACQUIRE");
        leaseOwner = String(values[2]);
        return [{
          id: "lease-1",
          ownerToken: leaseOwner,
          acquiredAt: new Date(),
          leaseUntil: new Date(Date.now() + 90_000),
        }];
      }
      if (query.includes('UPDATE "LineChatProfileOperationLease"')) {
        writes.push("RENEW");
        assert.equal(String(values[1]), leaseOwner);
        return [{ id: "lease-1" }];
      }
      throw new Error("Unexpected target-proof coordinator query");
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      assert.match(strings.join(" "), /DELETE FROM "LineChatProfileOperationLease"/u);
      assert.equal(String(values[1]), leaseOwner);
      writes.push("RELEASE");
      return 1;
    },
  };
  return { prisma, writes };
}

function createService(options: {
  target?: ReturnType<typeof makeTarget>;
  targetError?: string;
  auth?: "YES" | "NO" | "UNKNOWN";
  recentStatus?: "READY" | "FAILED";
  closeFailure?: boolean;
} = {}) {
  const target = options.target ?? makeTarget();
  const calls = {
    targetReads: 0,
    managedLaunches: 0,
    closes: 0,
    recentReads: 0,
    recentInput: undefined as Record<string, unknown> | undefined,
  };
  const page = {
    goto: async () => undefined,
    waitForTimeout: async () => undefined,
    url: () => `https://chat.line.biz/${BOT_ID}`,
  };
  const context = {
    pages: () => [page],
    newPage: async () => page,
  };
  const mirrorService = {
    getStoreMirrorTargetInputs: async (storeCode: string) => {
      calls.targetReads += 1;
      assert.equal(storeCode, "25610");
      if (options.targetError) throw new Error(options.targetError);
      return target;
    },
  };
  const sessionService = {
    resolveProfilePath: () => "/tmp",
    launchManagedPersistentContext: async () => {
      calls.managedLaunches += 1;
      return context;
    },
    closeManagedPersistentContext: async () => {
      calls.closes += 1;
      if (options.closeFailure) throw new Error("PROFILE_PAGE_CLEANUP_FAILED");
    },
    probeApiAuthentication: async () => ({
      authenticated: options.auth ?? "YES",
      status: options.auth === "NO" ? 401 : 200,
      transport: "SUCCEEDED",
    }),
    discoverRecentChats: async (input: Record<string, unknown>) => {
      calls.recentReads += 1;
      calls.recentInput = input;
      return {
        status: options.recentStatus ?? "READY",
        chats: [{
          chatUserId: `U${"b2".repeat(16)}`,
          displayName: "PRIVATE CUSTOMER NAME",
          lastMessageText: "PRIVATE MESSAGE CONTENT",
        }],
        pagesFetched: options.recentStatus === "FAILED" ? 0 : 1,
        totalRawRecords: 1,
        recentChatHttpStatus: 200,
        chatListRequestObserved: true,
        responseStructureValid: true,
        latestEventPresent: true,
        itemCount: 1,
        discoveryDurationMs: 12,
      };
    },
  };
  const leaseDb = createLeasePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(leaseDb.prisma as never);
  const service = new LineChatTargetProofService(
    mirrorService as never,
    sessionService as never,
    coordinator,
  );
  return { service, calls, writes: leaseDb.writes, context };
}

const validInput = {
  assignedProfile: "A",
  storeCode: "25610",
  lineOfficialAccountId: "oa-1",
  basicId: "@oppocentralpinklao",
  normalizedName: "oppocentralpinklao",
};

test("target proof uses the assigned supervised profile and one recent-list page", async () => {
  const { service, calls, writes, context } = createService();
  const result = await service.prove(validInput);

  assert.ok(result);
  assert.equal(result.targetResolution, "UNIQUE_VERIFIED");
  assert.equal(result.assignedProfile, "A");
  assert.equal(result.authStatus, "AUTHENTICATED");
  assert.equal(result.managerBotId, BOT_ID);
  assert.equal(result.managerStableOaId, BOT_ID);
  assert.equal(result.targetResolutionSource, "MASTER_LINE_ID");
  assert.equal(result.recentChatHttpStatus, 200);
  assert.equal(result.chatListRequestObserved, true);
  assert.equal(result.responseStructureValid, true);
  assert.equal(result.latestEventPresent, true);
  assert.equal(result.itemCount, 1);
  assert.equal(calls.managedLaunches, 1);
  assert.equal(calls.closes, 1);
  assert.equal(calls.recentReads, 1);
  assert.equal(calls.recentInput?.existingManagedContext, context);
  assert.equal(calls.recentInput?.maxPages, 1);
  assert.equal(calls.recentInput?.maxChats, 5);
  assert.equal((calls.recentInput?.operationContext as { operationKind?: string }).operationKind, "TARGET_PROOF");
  assert.deepEqual(writes, ["ACQUIRE", "RENEW", "RELEASE"]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE CUSTOMER NAME|PRIVATE MESSAGE CONTENT|b2b2/u);
});

test("target proof accepts the explicit Profile A label used by candidate inventories", async () => {
  const { service } = createService();
  const result = await service.prove({ ...validInput, assignedProfile: "Profile A" });
  assert.equal(result?.assignedProfile, "A");
  assert.equal(result?.targetResolution, "UNIQUE_VERIFIED");
});

async function verifySingleContextAcrossSupervisorBoundary(boundary: "AGE" | "OPERATIONS"): Promise<void> {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-target-proof-supervisor-"));
  const contextEmitter = new EventEmitter();
  const openPages: Array<{
    emitter: EventEmitter;
    closed: boolean;
    close: () => Promise<void>;
  } & Record<string, unknown>> = [];
  let rawLaunches = 0;
  let navigationCount = 0;
  let chatListRequestCount = 0;
  let authProbeCount = 0;
  let managedContextAcquisitionCount = 0;
  let recentDiscoveryReacquisitionCount = 0;
  let managedContextReleaseCount = 0;
  let authenticationCompleted = false;
  let authContext: BrowserContext | null = null;
  let discoveryContext: BrowserContext | null = null;
  let rawContextCloseCount = 0;
  const context = {
    on: contextEmitter.on.bind(contextEmitter),
    off: contextEmitter.off.bind(contextEmitter),
    browser: () => null,
    pages: () => openPages.filter((page) => !page.closed),
    newPage: async () => {
      const emitter = new EventEmitter();
      let closed = false;
      let currentUrl = "about:blank";
      const page = {
        emitter,
        get closed() { return closed; },
        isClosed: () => closed,
        close: async () => { closed = true; },
        on: (event: string, listener: (...args: unknown[]) => void) => { emitter.on(event, listener); return page; },
        url: () => currentUrl,
        waitForTimeout: async () => undefined,
        goto: async (url: string) => {
          navigationCount += 1;
          currentUrl = url.includes("/account/") ? `https://chat.line.biz/${BOT_ID}` : url;
          if (!url.includes("/account/")) {
            const requestUrl = `https://chat.line.biz/api/v2/bots/${BOT_ID}/chats?folderType=ALL&limit=25`;
            chatListRequestCount += 1;
            emitter.emit("request", {
              method: () => "GET",
              url: () => requestUrl,
              headers: () => ({ accept: "application/json, text/plain, */*" }),
            });
            const response = {
              status: () => 200,
              url: () => requestUrl,
              request: () => ({ method: () => "GET", url: () => requestUrl }),
              json: async () => ({ list: [], next: null }),
            };
            emitter.emit("response", response);
          }
        },
      };
      openPages.push(page);
      return page;
    },
    close: async () => { rawContextCloseCount += 1; contextEmitter.emit("close"); },
    request: {
      get: async (url: string) => {
        assert.equal(url, "https://chat.line.biz/api/v1/me");
        authProbeCount += 1;
        return {
          status: () => 200,
          headers: () => ({ "content-type": "application/json" }),
          json: async () => ({ id: "safe-shape-only" }),
        };
      },
    },
  };
  const sessionService = new LineChatSessionService(async () => {
    rawLaunches += 1;
    return context as unknown as BrowserContext;
  });
  sessionService.resolveProfilePath = () => profilePath;
  const originalManagedAcquire = sessionService.launchManagedPersistentContext.bind(sessionService);
  sessionService.launchManagedPersistentContext = async (...args) => {
    managedContextAcquisitionCount += 1;
    if (authenticationCompleted) recentDiscoveryReacquisitionCount += 1;
    return originalManagedAcquire(...args);
  };
  const originalManagedRelease = sessionService.closeManagedPersistentContext.bind(sessionService);
  sessionService.closeManagedPersistentContext = async (...args) => {
    managedContextReleaseCount += 1;
    return originalManagedRelease(...args);
  };
  const originalAuthProbe = sessionService.probeApiAuthentication.bind(sessionService);
  sessionService.probeApiAuthentication = async (managedContext) => {
    authContext = managedContext;
    const result = await originalAuthProbe(managedContext);
    authenticationCompleted = true;
    const records = (sessionService as unknown as {
      managedProfileContexts: Map<string, { startedAt: number; operationsCompleted: number }>;
    }).managedProfileContexts;
    const record = records.get(fs.realpathSync.native(profilePath));
    assert.ok(record, "the supervised context must be registered before authentication");
    if (boundary === "AGE") {
      record.startedAt = Date.now() - PROFILE_BROWSER_MAX_CONTEXT_AGE_MS;
    } else {
      record.operationsCompleted = PROFILE_BROWSER_MAX_OPERATIONS - 1;
    }
    return result;
  };
  const originalRecentDiscovery = sessionService.discoverRecentChats.bind(sessionService);
  sessionService.discoverRecentChats = async (input) => {
    discoveryContext = input.existingManagedContext ?? null;
    return originalRecentDiscovery(input);
  };
  const target = makeTarget("a", profilePath);
  const mirrorService = {
    getStoreMirrorTargetInputs: async () => target,
  };
  const leaseDb = createLeasePrisma();
  const coordinator = new LineChatProfileOperationCoordinator(leaseDb.prisma as never);

  try {
    const service = new LineChatTargetProofService(mirrorService as never, sessionService, coordinator);
    const result = await service.prove(validInput);

    assert.equal(result?.targetResolution, "UNIQUE_VERIFIED");
    assert.equal(managedContextAcquisitionCount, 1);
    assert.equal(rawLaunches, 1);
    assert.equal(recentDiscoveryReacquisitionCount, 0);
    assert.equal(managedContextReleaseCount, 1);
    assert.equal(discoveryContext, authContext);
    assert.ok(authContext, "authentication must use the acquired context");
    assert.equal(navigationCount, 2);
    assert.equal(openPages.length, 1, "auth and recent discovery should reuse one page");
    assert.ok(openPages.every((page) => page.closed), "the diagnostic page must be reset on release");
    assert.equal(rawContextCloseCount, 0, "managed release must retain the supervisor-owned context");
    assert.equal(chatListRequestCount, 1);
    assert.equal(authProbeCount, 1);
    assert.deepEqual(leaseDb.writes, ["ACQUIRE", "RENEW", "RELEASE"]);
  } finally {
    await sessionService.onModuleDestroy();
    assert.equal(rawContextCloseCount, 1, "worker shutdown closes the retained context");
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
}

test("target proof keeps one supervised context across the age-rotation boundary", async () => {
  await verifySingleContextAcrossSupervisorBoundary("AGE");
});

test("target proof keeps one supervised context across the operation-count boundary", async () => {
  await verifySingleContextAcrossSupervisorBoundary("OPERATIONS");
});

test("an assigned-profile mismatch fails closed without trying another Manager profile", async () => {
  const { service, calls, writes } = createService({ target: makeTarget("b") });
  const result = await service.prove(validInput);

  assert.equal(result?.targetResolution, "PROFILE_MISMATCH");
  assert.equal(calls.targetReads, 1);
  assert.equal(calls.managedLaunches, 0);
  assert.equal(calls.recentReads, 0);
  assert.deepEqual(writes, []);
});

test("auth failure cleans the supervised page and releases its distributed lease", async () => {
  const { service, calls, writes } = createService({ auth: "NO" });
  const result = await service.prove(validInput);

  assert.equal(result?.targetResolution, "AUTH_FAILED");
  assert.equal(result?.authStatus, "AUTH_FAILED");
  assert.equal(calls.managedLaunches, 1);
  assert.equal(calls.closes, 1);
  assert.equal(calls.recentReads, 0);
  assert.deepEqual(writes, ["ACQUIRE", "RENEW", "RELEASE"]);
});

test("cleanup failure fails closed and still releases the distributed lease", async () => {
  const { service, calls, writes } = createService({ closeFailure: true });
  const result = await service.prove(validInput);

  assert.equal(result?.targetResolution, "TRANSPORT_FAILED");
  assert.equal(calls.closes, 1);
  assert.equal(calls.recentReads, 1);
  assert.deepEqual(writes, ["ACQUIRE", "RENEW", "RELEASE"]);
});

test("target resolution ambiguity and absence fail closed before browser access", async () => {
  const ambiguous = createService({ targetError: "MIRROR_OA_IDENTITY_MASTER_ACCOUNT_NAME_AMBIGUOUS" });
  assert.equal((await ambiguous.service.prove(validInput))?.targetResolution, "AMBIGUOUS");
  assert.equal(ambiguous.calls.managedLaunches, 0);

  const missing = createService({ targetError: "MIRROR_STORE_NOT_FOUND" });
  assert.equal((await missing.service.prove(validInput))?.targetResolution, "NOT_FOUND");
  assert.equal(missing.calls.managedLaunches, 0);
});

test("transport failure returns only safe metadata and releases the profile lease", async () => {
  const { service, calls, writes } = createService({ recentStatus: "FAILED" });
  const result = await service.prove(validInput);

  assert.equal(result?.targetResolution, "TRANSPORT_FAILED");
  assert.equal(result?.managerBotId, BOT_ID);
  assert.equal(calls.recentReads, 1);
  assert.deepEqual(writes, ["ACQUIRE", "RENEW", "RELEASE"]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE CUSTOMER NAME|PRIVATE MESSAGE CONTENT/u);
});

test("invalid target-proof requests are rejected before DB or browser access", async () => {
  const { service, calls, writes } = createService();
  const result = await service.prove({ ...validInput, assignedProfile: "C" });

  assert.equal(result, null);
  assert.equal(calls.targetReads, 0);
  assert.equal(calls.managedLaunches, 0);
  assert.deepEqual(writes, []);
});
