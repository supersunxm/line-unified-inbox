import assert from "node:assert/strict";
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

test("managed persistent context launches normally without a profile lock", async () => {
  const profilePath = createProfile();
  let launchCount = 0;
  const service = new LineChatSessionService(async () => {
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
  const service = new LineChatSessionService(async () => {
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
  const service = new LineChatSessionService(async () => {
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
  const service = new LineChatSessionService();
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
  const service = new LineChatSessionService();
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
  const service = new LineChatSessionService(async () => {
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
  const service = new LineChatSessionService(async () => { throw new Error(LOCK_ERROR); });
  try {
    await assert.rejects(
      () => service.launchManagedPersistentContext(profilePath, { profilePath }),
      (error: unknown) => error instanceof ProfileBrowserBusyError && error.code === "PROFILE_BROWSER_BUSY",
    );
  } finally {
    removeProfile(profilePath);
  }
});
