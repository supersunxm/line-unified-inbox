import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import * as fs from "node:fs";
import { hostname } from "node:os";
import * as os from "node:os";
import * as path from "node:path";
import type { BrowserContext } from "playwright";
import {
  isPersistentProfileLockError,
  LineChatSessionService,
  ProfileBrowserBusyError,
} from "./line-chat-session.service";

const LOCK_ERROR = "browserType.launchPersistentContext: The profile appears to be in use by another Chromium process.";

function fakeContext(onClose: () => Promise<void> = async () => undefined): BrowserContext {
  return { close: onClose } as unknown as BrowserContext;
}

function createProfile(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-profile-lifecycle-"));
}

function removeProfile(profilePath: string): void {
  fs.rmSync(profilePath, { recursive: true, force: true });
}

function createService(launcher?: (userDataDir: string) => Promise<BrowserContext>): LineChatSessionService {
  const service = new LineChatSessionService(launcher);
  const logger = (service as unknown as {
    logger: { log: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  }).logger;
  logger.log = () => undefined;
  logger.warn = () => undefined;
  logger.error = () => undefined;
  return service;
}

class FakePage {
  private closed = false;

  public isClosed(): boolean {
    return this.closed;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

class ReusableFakeContext extends EventEmitter {
  public readonly browserInstance = Object.assign(new EventEmitter(), {
    connected: true,
    isConnected() { return this.connected; },
  });
  public readonly openPages: FakePage[] = [];
  public closeCalls = 0;

  public pages(): FakePage[] {
    return this.openPages.filter((page) => !page.isClosed());
  }

  public async newPage(): Promise<FakePage> {
    const page = new FakePage();
    this.openPages.push(page);
    return page;
  }

  public browser() {
    return this.browserInstance;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
    this.browserInstance.connected = false;
    this.emit("close");
    this.browserInstance.emit("disconnected");
  }
}

test("managed persistent context launches normally without a profile lock", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const service = createService(async () => {
    launchCount += 1;
    return fakeContext();
  });

  try {
    const context = await service.launchManagedPersistentContext(profilePath, { profilePath });
    await service.closeManagedPersistentContext(context, profilePath);
    assert.equal(launchCount, 1);
  } finally {
    removeProfile(profilePath);
  }
});

test("transient Chromium profile lock retries and succeeds", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const service = createService(async () => {
    launchCount += 1;
    if (launchCount === 1) throw new Error(LOCK_ERROR);
    return fakeContext();
  });

  try {
    const context = await service.launchManagedPersistentContext(profilePath, { profilePath });
    await service.closeManagedPersistentContext(context, profilePath);
    assert.equal(launchCount, 2);
  } finally {
    removeProfile(profilePath);
  }
});

test("unrelated Chromium launch errors are not retried as profile locks", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const unrelated = new Error("browserType.launchPersistentContext: executable doesn't exist");
  const service = createService(async () => {
    launchCount += 1;
    throw unrelated;
  });

  try {
    await assert.rejects(
      () => service.launchManagedPersistentContext(profilePath, { profilePath }),
      (error: unknown) => error === unrelated,
    );
    assert.equal(launchCount, 1);
    assert.equal(isPersistentProfileLockError(unrelated), false);
  } finally {
    removeProfile(profilePath);
  }
});

test("managed close waits for singleton release before returning", async () => {
  const profilePath = createProfile();
  const singletonPaths = ["SingletonLock", "SingletonSocket", "SingletonCookie"]
    .map((name) => path.join(profilePath, name));
  for (const singletonPath of singletonPaths) {
    if (path.basename(singletonPath) === "SingletonLock") fs.symlinkSync(`${hostname()}-999999999`, singletonPath);
    else fs.writeFileSync(singletonPath, "pending");
  }
  let closeFinished = false;
  const service = createService();
  const context = fakeContext(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    for (const singletonPath of singletonPaths) fs.rmSync(singletonPath, { force: true });
    closeFinished = true;
  });

  try {
    await service.closeManagedPersistentContext(context, profilePath);
    assert.equal(closeFinished, true);
    for (const singletonPath of singletonPaths) assert.equal(fs.lstatSync(singletonPath, { throwIfNoEntry: false }), undefined);
  } finally {
    removeProfile(profilePath);
  }
});

test("live or uncertain singleton ownership stays busy and is never deleted", () => {
  const profilePath = createProfile();
  const lockPath = path.join(profilePath, "SingletonLock");
  const socketPath = path.join(profilePath, "SingletonSocket");
  const cookiePath = path.join(profilePath, "SingletonCookie");
  fs.symlinkSync(`${hostname()}-${process.pid}`, lockPath);
  fs.writeFileSync(socketPath, "live");
  fs.writeFileSync(cookiePath, "live");
  const service = createService();
  const recover = (service as unknown as {
    recoverStaleProfileLock: (profile: string, metadata: Record<string, never>) => boolean;
  }).recoverStaleProfileLock;

  try {
    assert.equal(recover.call(service, profilePath, {}), false);
    assert.equal(fs.lstatSync(lockPath).isSymbolicLink(), true);
    assert.equal(fs.existsSync(socketPath), true);
    assert.equal(fs.existsSync(cookiePath), true);
  } finally {
    removeProfile(profilePath);
  }
});

test("confirmed stale recovery removes only singleton artifacts and retries once", async () => {
  const profilePath = createProfile();
  const preservedPaths = [
    path.join(profilePath, "Cookies"),
    path.join(profilePath, "Preferences"),
    path.join(profilePath, "Local Storage", "leveldb"),
    path.join(profilePath, "IndexedDB"),
    path.join(profilePath, "storage"),
    path.join(profilePath, "Default", "Preferences"),
  ];
  for (const preservedPath of preservedPaths) {
    fs.mkdirSync(path.dirname(preservedPath), { recursive: true });
    fs.writeFileSync(preservedPath, "authenticated-profile-data");
  }
  const singletonLock = path.join(profilePath, "SingletonLock");
  const singletonSocket = path.join(profilePath, "SingletonSocket");
  const singletonCookie = path.join(profilePath, "SingletonCookie");
  fs.symlinkSync(`${hostname()}-999999999`, singletonLock);
  fs.writeFileSync(singletonSocket, "stale");
  fs.writeFileSync(singletonCookie, "stale");

  let launchCount = 0;
  const service = createService(async () => {
    launchCount += 1;
    if (launchCount <= 4) {
      if (launchCount === 4) throw new Error(LOCK_ERROR);
      throw new Error(LOCK_ERROR);
    }
    return fakeContext();
  });

  try {
    const context = await service.launchManagedPersistentContext(profilePath, { profilePath });
    await service.closeManagedPersistentContext(context, profilePath);
    assert.equal(launchCount, 5);
    assert.equal(fs.lstatSync(singletonLock, { throwIfNoEntry: false }), undefined);
    assert.equal(fs.lstatSync(singletonSocket, { throwIfNoEntry: false }), undefined);
    assert.equal(fs.lstatSync(singletonCookie, { throwIfNoEntry: false }), undefined);
    for (const preservedPath of preservedPaths) assert.equal(fs.existsSync(preservedPath), true);
  } finally {
    removeProfile(profilePath);
  }
});

test("busy launch is reported as retryable rather than an authentication error", async () => {
  const profilePath = createProfile();
  const service = createService(async () => { throw new Error(LOCK_ERROR); });
  try {
    await assert.rejects(
      () => service.launchManagedPersistentContext(profilePath, { profilePath }),
      (error: unknown) => error instanceof ProfileBrowserBusyError && error.code === "PROFILE_BROWSER_BUSY",
    );
  } finally {
    removeProfile(profilePath);
  }
});

test("concurrent operations on one profile share one context and never overlap", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const contexts: ReusableFakeContext[] = [];
  const service = createService(async () => {
    launchCount += 1;
    const context = new ReusableFakeContext();
    contexts.push(context);
    return context as unknown as BrowserContext;
  });

  try {
    const first = await service.launchManagedPersistentContext(profilePath, { profilePath });
    let secondAcquired = false;
    const secondPromise = service.launchManagedPersistentContext(profilePath, { profilePath })
      .then((context) => { secondAcquired = true; return context; });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(secondAcquired, false);

    await service.closeManagedPersistentContext(first, profilePath);
    const second = await secondPromise;
    assert.equal(second, first);
    assert.equal(launchCount, 1);
    await service.closeManagedPersistentContext(second, profilePath);
    assert.equal(contexts[0]?.closeCalls, 0);
    await service.onModuleDestroy();
    assert.equal(contexts[0]?.closeCalls, 1);
  } finally {
    removeProfile(profilePath);
  }
});

test("different profiles may run concurrently with one context each", async () => {
  const profilePaths = [createProfile(), createProfile()];
  let launchCount = 0;
  const active = new Set<ReusableFakeContext>();
  const service = createService(async () => {
    launchCount += 1;
    const context = new ReusableFakeContext();
    active.add(context);
    return context as unknown as BrowserContext;
  });

  try {
    const contexts = await Promise.all(profilePaths.map((profilePath) =>
      service.launchManagedPersistentContext(profilePath, { profilePath }),
    ));
    assert.equal(launchCount, 2);
    assert.equal(active.size, 2);
    await Promise.all(contexts.map((context, index) =>
      service.closeManagedPersistentContext(context, profilePaths[index] ?? ""),
    ));
    await service.onModuleDestroy();
    assert.equal(active.size, 2);
  } finally {
    for (const profilePath of profilePaths) removeProfile(profilePath);
  }
});

test("six direct and nine fallback Profile A stores collapse symlink and lexical aliases to one supervisor", async () => {
  const profilePath = createProfile();
  const profileAlias = path.join(path.dirname(profilePath), `${path.basename(profilePath)}-alias`);
  fs.symlinkSync(profilePath, profileAlias, "dir");
  const context = new ReusableFakeContext();
  let launchCount = 0;
  const service = createService(async () => {
    launchCount += 1;
    return context as unknown as BrowserContext;
  });
  const fallbackAliases = [
    profileAlias,
    path.join(profileAlias, "."),
    path.join(profileAlias, "..", path.basename(profileAlias)),
  ];

  try {
    const profileRequests = [
      ...Array.from({ length: 6 }, () => profilePath),
      ...Array.from({ length: 9 }, (_, index) => fallbackAliases[index % fallbackAliases.length]),
    ];
    for (const [index, requestedPath] of profileRequests.entries()) {
      const managed = await service.launchManagedPersistentContext(requestedPath, { profilePath: requestedPath }, {
        operationKind: "MIRROR_SYNC",
        storeCode: String(index + 1),
      });
      assert.strictEqual(managed, context);
      await service.closeManagedPersistentContext(managed, requestedPath);
    }

    const supervisors = (service as unknown as { managedProfileContexts: Map<string, unknown> }).managedProfileContexts;
    const activeContexts = (service as unknown as { activeManagedContexts: Map<string, number> }).activeManagedContexts;
    assert.equal(launchCount, 1);
    assert.equal(supervisors.size, 1);
    assert.equal(activeContexts.get(fs.realpathSync.native(profilePath)), 1);
    assert.equal(context.closeCalls, 0);
    await service.onModuleDestroy();
    assert.equal(context.closeCalls, 1);
  } finally {
    fs.rmSync(profileAlias, { force: true });
    removeProfile(profilePath);
  }
});

test("16 mapped store requests collapse direct and fallback filesystem aliases to two physical profile supervisors", async () => {
  const profileA = createProfile();
  const profileB = createProfile();
  const aliasA = path.join(path.dirname(profileA), `${path.basename(profileA)}-alias`);
  const aliasB = path.join(path.dirname(profileB), `${path.basename(profileB)}-alias`);
  fs.symlinkSync(profileA, aliasA, "dir");
  fs.symlinkSync(profileB, aliasB, "dir");
  const contexts = new Map<string, ReusableFakeContext>([
    [fs.realpathSync.native(profileA), new ReusableFakeContext()],
    [fs.realpathSync.native(profileB), new ReusableFakeContext()],
  ]);
  let launchCount = 0;
  const service = createService(async (userDataDir) => {
    launchCount += 1;
    const context = contexts.get(userDataDir);
    assert.ok(context, "supervisor must pass the canonical physical profile path to Chromium");
    return context as unknown as BrowserContext;
  });
  const requests = [
    ...Array.from({ length: 6 }, () => ({ profilePath: profileA, origin: "DIRECT_A" })),
    ...Array.from({ length: 6 }, (_, index) => ({ profilePath: [aliasA, path.join(aliasA, "."), path.join(aliasA, "..", path.basename(aliasA))][index % 3], origin: "FALLBACK_A" })),
    { profilePath: profileB, origin: "DIRECT_B" },
    ...Array.from({ length: 3 }, (_, index) => ({ profilePath: [aliasB, path.join(aliasB, "."), path.join(aliasB, "..", path.basename(aliasB))][index % 3], origin: "FALLBACK_B" })),
  ];

  try {
    for (const [index, request] of requests.entries()) {
      const managed = await service.launchManagedPersistentContext(request.profilePath, { profilePath: request.profilePath }, {
        operationKind: "MIRROR_SYNC",
        storeCode: String(index + 1),
      });
      assert.strictEqual(managed, contexts.get(fs.realpathSync.native(request.profilePath)));
      await service.closeManagedPersistentContext(managed, request.profilePath);
    }

    const supervisors = (service as unknown as { managedProfileContexts: Map<string, unknown> }).managedProfileContexts;
    const activeContexts = (service as unknown as { activeManagedContexts: Map<string, number> }).activeManagedContexts;
    assert.equal(requests.length, 16);
    assert.equal(launchCount, 2);
    assert.equal(supervisors.size, 2);
    assert.deepEqual(new Set(supervisors.keys()), new Set([fs.realpathSync.native(profileA), fs.realpathSync.native(profileB)]));
    assert.equal(activeContexts.size, 2);
    await service.onModuleDestroy();
    assert.deepEqual([...contexts.values()].map((context) => context.closeCalls), [1, 1]);
  } finally {
    fs.rmSync(aliasA, { force: true });
    fs.rmSync(aliasB, { force: true });
    removeProfile(profileA);
    removeProfile(profileB);
  }
});

test("repeated 16-store cycles keep browser launches bounded and pages reset", async () => {
  const profilePaths = Array.from({ length: 2 }, () => createProfile());
  let launchCount = 0;
  let activeContexts = 0;
  let peakActiveContexts = 0;
  const contexts: ReusableFakeContext[] = [];
  const service = createService(async () => {
    launchCount += 1;
    const context = new ReusableFakeContext();
    activeContexts += 1;
    peakActiveContexts = Math.max(peakActiveContexts, activeContexts);
    const close = context.close.bind(context);
    context.close = async () => {
      if (context.closeCalls === 0) activeContexts -= 1;
      await close();
    };
    contexts.push(context);
    return context as unknown as BrowserContext;
  });

  try {
    for (let cycle = 0; cycle < 120; cycle += 1) {
      for (let storeIndex = 0; storeIndex < 16; storeIndex += 1) {
        const profilePath = profilePaths[Math.floor(storeIndex / 8)];
        assert.ok(profilePath);
        const context = await service.launchManagedPersistentContext(profilePath, { profilePath });
        const page = context.pages()[0] ?? await context.newPage();
        assert.ok(page);
        await service.closeManagedPersistentContext(context, profilePath);
        assert.equal(context.pages().length, 0);
      }
    }

    assert.equal(launchCount, 8);
    assert.equal(peakActiveContexts, 2);
    assert.equal(activeContexts, 2);
    assert.equal(contexts.filter((context) => context.closeCalls === 0).length, 2);
    await service.onModuleDestroy();
    assert.equal(activeContexts, 0);
    assert.equal(contexts.filter((context) => context.closeCalls === 1).length, 8);
  } finally {
    for (const profilePath of profilePaths) removeProfile(profilePath);
  }
});

test("context crash enters cooldown and permits only one later recovery launch", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const contexts: ReusableFakeContext[] = [];
  const service = createService(async () => {
    launchCount += 1;
    const context = new ReusableFakeContext();
    contexts.push(context);
    return context as unknown as BrowserContext;
  });

  try {
    const failedGeneration = await service.launchManagedPersistentContext(profilePath, { profilePath });
    (failedGeneration as unknown as ReusableFakeContext).emit("close");
    await service.closeManagedPersistentContext(failedGeneration, profilePath);
    await assert.rejects(
      () => service.launchManagedPersistentContext(profilePath, { profilePath }),
      (error: unknown) => error instanceof ProfileBrowserBusyError && error.retryAfterMs > 0,
    );
    assert.equal(launchCount, 1);

    const states = (service as unknown as { recoveryStates: Map<string, { failures: number; cooldownUntil: number; lastFailure: string }> }).recoveryStates;
    const recovery = states.get(fs.realpathSync.native(profilePath));
    assert.ok(recovery);
    recovery.cooldownUntil = Date.now() - 1;

    const recovered = await service.launchManagedPersistentContext(profilePath, { profilePath });
    assert.equal(launchCount, 2);
    await service.closeManagedPersistentContext(recovered, profilePath);
    await service.onModuleDestroy();
    assert.equal(contexts[1]?.closeCalls, 1);
  } finally {
    removeProfile(profilePath);
  }
});

test("headful noVNC contexts are ephemeral and close on release", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const contexts: ReusableFakeContext[] = [];
  const service = createService(async () => {
    launchCount += 1;
    const context = new ReusableFakeContext();
    contexts.push(context);
    return context as unknown as BrowserContext;
  });

  try {
    for (let index = 0; index < 2; index += 1) {
      const context = await service.launchManagedPersistentContext(profilePath, {
        profilePath,
        headless: false,
      }, { reuseContext: false, operationKind: "NOVNC_RECOVERY" });
      await service.closeManagedPersistentContext(context, profilePath);
    }
    assert.equal(launchCount, 2);
    assert.equal(contexts[0]?.closeCalls, 1);
    assert.equal(contexts[1]?.closeCalls, 1);
  } finally {
    removeProfile(profilePath);
  }
});

test("spawn failure cooldown prevents store retry storms and permits one later recovery", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const recoveredContext = new ReusableFakeContext();
  const spawnError = Object.assign(new Error("spawn chromium EAGAIN"), { code: "EAGAIN", errno: 11, syscall: "spawn" });
  const service = createService(async () => {
    launchCount += 1;
    if (launchCount === 1) throw spawnError;
    return recoveredContext as unknown as BrowserContext;
  });

  try {
    await assert.rejects(
      () => service.launchManagedPersistentContext(profilePath, { profilePath }),
      (error: unknown) => error === spawnError,
    );
    await assert.rejects(
      () => service.launchManagedPersistentContext(profilePath, { profilePath }),
      (error: unknown) => error instanceof ProfileBrowserBusyError && error.retryAfterMs > 0,
    );
    assert.equal(launchCount, 1);

    const states = (service as unknown as { recoveryStates: Map<string, { cooldownUntil: number }> }).recoveryStates;
    const recovery = states.get(fs.realpathSync.native(profilePath));
    assert.ok(recovery);
    recovery.cooldownUntil = Date.now() - 1;
    const context = await service.launchManagedPersistentContext(profilePath, { profilePath });
    assert.equal(launchCount, 2);
    await service.closeManagedPersistentContext(context, profilePath);
    await service.onModuleDestroy();
  } finally {
    removeProfile(profilePath);
  }
});

test("close failure is logged, releases the operation lock, and enters cooldown", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const context = new ReusableFakeContext();
  context.close = async () => { throw new Error("owned browser close failed"); };
  const service = createService(async () => {
    launchCount += 1;
    return context as unknown as BrowserContext;
  });

  try {
    const managed = await service.launchManagedPersistentContext(profilePath, {
      profilePath,
      headless: false,
    });
    await assert.rejects(() => service.closeManagedPersistentContext(managed, profilePath), /owned browser close failed/u);
    await assert.rejects(
      () => service.launchManagedPersistentContext(profilePath, { profilePath }),
      (error: unknown) => error instanceof ProfileBrowserBusyError && error.retryAfterMs > 0,
    );
    assert.equal(launchCount, 1);
  } finally {
    removeProfile(profilePath);
  }
});

test("normal defaultLauncher health-style checks reuse the READY context", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const service = createService(async () => {
    launchCount += 1;
    return new ReusableFakeContext() as unknown as BrowserContext;
  });

  try {
    const first = await service.defaultLauncher(profilePath, { profilePath, headless: true });
    await service.closeManagedPersistentContext(first, profilePath);
    const second = await service.defaultLauncher(profilePath, { profilePath, headless: true });
    assert.equal(second, first);
    assert.equal(launchCount, 1);
    await service.closeManagedPersistentContext(second, profilePath);
    await service.onModuleDestroy();
  } finally {
    removeProfile(profilePath);
  }
});

test("managed launch forwards safe operation and launch correlation metadata", async () => {
  const profilePath = createProfile();
  let observed: unknown;
  const service = createService(async (_userDataDir, _options?, metadata?) => {
    observed = metadata;
    return new ReusableFakeContext() as unknown as BrowserContext;
  });

  try {
    const context = await service.defaultLauncher(profilePath, { profilePath }, {
      operationKind: "HEALTH_SESSION",
      sessionId: "session-safe-1",
      storeCode: "29113",
    });
    assert.ok(observed && typeof observed === "object");
    const launchMetadata = observed as Record<string, unknown>;
    assert.match(String(launchMetadata.launchId), /^[0-9a-f-]{36}$/u);
    assert.notEqual(launchMetadata.profileId, profilePath);
    assert.equal(launchMetadata.operationKind, "HEALTH_SESSION");
    assert.equal(launchMetadata.sessionId, "session-safe-1");
    assert.equal(launchMetadata.storeCode, "29113");
    await service.closeManagedPersistentContext(context, profilePath);
    await service.onModuleDestroy();
  } finally {
    removeProfile(profilePath);
  }
});

test("an aged context rotates before a new profile operation", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const contexts: ReusableFakeContext[] = [];
  const service = createService(async () => {
    launchCount += 1;
    const context = new ReusableFakeContext();
    contexts.push(context);
    return context as unknown as BrowserContext;
  });

  try {
    const first = await service.launchManagedPersistentContext(profilePath, { profilePath });
    await service.closeManagedPersistentContext(first, profilePath);
    const records = (service as unknown as { managedProfileContexts: Map<string, { startedAt: number }> }).managedProfileContexts;
    const record = records.get(fs.realpathSync.native(profilePath));
    assert.ok(record);
    record.startedAt = 0;
    const second = await service.launchManagedPersistentContext(profilePath, { profilePath });
    assert.notEqual(second, first);
    assert.equal(launchCount, 2);
    assert.equal(contexts[0]?.closeCalls, 1);
    await service.closeManagedPersistentContext(second, profilePath);
    await service.onModuleDestroy();
  } finally {
    removeProfile(profilePath);
  }
});

test("shutdown closes active managed contexts exactly once", async () => {
  const profilePath = createProfile();
  const context = new ReusableFakeContext();
  const service = createService(async () => context as unknown as BrowserContext);

  try {
    const managed = await service.launchManagedPersistentContext(profilePath, { profilePath });
    const shutdown = service.onModuleDestroy();
    await service.closeManagedPersistentContext(managed, profilePath);
    await shutdown;
    assert.equal(context.closeCalls, 1);
  } finally {
    removeProfile(profilePath);
  }
});

test("worker restart reuses the persistent profile directory without deleting its data", async () => {
  const profilePath = createProfile();
  const sentinelPath = path.join(profilePath, "profile-data-sentinel");
  fs.writeFileSync(sentinelPath, "persisted-profile-data");
  let firstLaunchCount = 0;
  let secondLaunchCount = 0;
  const firstWorker = createService(async () => {
    firstLaunchCount += 1;
    return new ReusableFakeContext() as unknown as BrowserContext;
  });
  const secondWorker = createService(async () => {
    secondLaunchCount += 1;
    return new ReusableFakeContext() as unknown as BrowserContext;
  });

  try {
    const firstContext = await firstWorker.launchManagedPersistentContext(profilePath, { profilePath });
    await firstWorker.closeManagedPersistentContext(firstContext, profilePath);
    await firstWorker.onModuleDestroy();
    assert.equal(fs.readFileSync(sentinelPath, "utf8"), "persisted-profile-data");

    const restartedContext = await secondWorker.launchManagedPersistentContext(profilePath, { profilePath });
    assert.equal(fs.readFileSync(sentinelPath, "utf8"), "persisted-profile-data");
    await secondWorker.closeManagedPersistentContext(restartedContext, profilePath);
    await secondWorker.onModuleDestroy();
    assert.equal(firstLaunchCount, 1);
    assert.equal(secondLaunchCount, 1);
  } finally {
    removeProfile(profilePath);
  }
});
