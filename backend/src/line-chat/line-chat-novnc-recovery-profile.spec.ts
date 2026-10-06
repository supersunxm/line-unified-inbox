import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import childProcess from "node:child_process";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext } from "playwright";
import type { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatMirrorService } from "./line-chat-mirror.service";
import { LineChatNovncRecoveryWorkerService } from "./line-chat-novnc-recovery-worker.service";
import { LineChatNovncRecoveryService } from "./line-chat-novnc-recovery.service";

function fixture(t: test.TestContext, options: { pause?: () => Promise<void>; launchFails?: boolean; leaseBusy?: boolean; ttl?: boolean; onLaunch?: () => void } = {}) {
  let mirrorActive = false;
  let closed = 0;
  let released = 0;
  let mirrorPauses = 0;
  let mirrorResumes = 0;
  let openedKey: string | null = null;
  t.mock.method(childProcess, "spawn", () => Object.assign(new EventEmitter(), {
    exitCode: null, signalCode: null, killed: false, stderr: new EventEmitter(),
    kill() { this.killed = true; this.exitCode = 0; this.emit("exit"); return true; },
  }));
  const context = Object.assign(new EventEmitter(), {
    pages: () => [{ goto: async () => undefined }],
  }) as unknown as BrowserContext;
  const sessionService = {
    isMirrorCycleActive: () => mirrorActive,
    resolveProfilePath: () => tmpdir(),
    launchManagedPersistentContext: async (_path: string, _options: unknown, metadata: { sessionKey: string }) => {
      options.onLaunch?.();
      if (options.launchFails) throw new Error("SYNTHETIC_LAUNCH_FAILED");
      openedKey = metadata.sessionKey;
      return context;
    },
    closeManagedPersistentContext: async () => { closed++; },
  } as unknown as LineChatSessionService;
  const prisma = { lineChatSession: { findUnique: async ({ where }: { where: { sessionKey: string } }) => ({
    id: `id-${where.sessionKey}`, sessionKey: where.sessionKey, profileStorageKey: "existing", profilePath: null,
  }) } } as unknown as PrismaService;
  const coordinator = {
    withProfileOperation: async (input: { sessionId: string }, callback: (lease: { assertOwnership: () => void }) => Promise<void>, lockOptions: { waitForLock: boolean }) => {
      assert.equal(lockOptions.waitForLock, true);
      assert.equal(input.sessionId, "id-account-1");
      if (options.leaseBusy) return { acquired: false };
      try { await callback({ assertOwnership: () => undefined }); } finally { released++; }
      return { acquired: true };
    },
  } as unknown as LineChatProfileOperationCoordinator;
  const mirrorService = {
    pauseForManualRecovery: async () => {
      mirrorPauses++;
      await options.pause?.();
      mirrorActive = false;
    },
    resumeAfterManualRecovery: () => {
      assert.equal(released, options.leaseBusy ? 0 : 1, "Mirror resumes after operation releases");
      mirrorResumes++;
    },
  } as unknown as LineChatMirrorService;
  if (options.ttl) {
    const realTimeout = globalThis.setTimeout;
    t.mock.method(globalThis, "setTimeout", (callback: () => void, delay: number) => realTimeout(callback, delay >= 300_000 ? 20 : delay));
  }
  return {
    browserExit: () => context.emit("close"),
    service: new LineChatNovncRecoveryWorkerService(prisma, sessionService, coordinator, mirrorService),
    activateMirror: () => { mirrorActive = true; },
    counts: () => ({ closed, released, mirrorPauses, mirrorResumes, openedKey }),
  };
}

test("manual recovery rejects unsupported profiles and pauses active Mirror before browser launch", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.service.start("arbitrary"), /RECOVERY_SESSION_NOT_ALLOWED/);
  f.activateMirror();
  const result = await f.service.start("account-1");
  assert.equal(result.active, true);
  assert.equal(f.counts().openedKey, "account-1");
  assert.equal(f.counts().mirrorPauses, 1);
  await f.service.stop("account-1");
  assert.equal(f.counts().mirrorResumes, 1);
});

test("profile A uses its exact existing session, blocks cross-profile token reuse, and releases for Mirror", async (t) => {
  const f = fixture(t);
  const pending = f.service.start("account-1");
  await assert.rejects(f.service.start("profile-b"), /RECOVERY_OTHER_SESSION_STARTING/);
  const result = await pending;
  assert.equal(result.sessionKey, "account-1");
  assert.equal(result.active, true);
  assert.equal(f.counts().openedKey, "account-1");
  await assert.rejects(f.service.start("profile-b"), /RECOVERY_OTHER_SESSION_ACTIVE/);
  await assert.rejects(f.service.stop("profile-b"), /RECOVERY_OTHER_SESSION_ACTIVE/);
  assert.equal(f.service.snapshot().active, true);
  await f.service.stop("account-1");
  assert.equal(f.service.snapshot().active, false);
  assert.deepEqual(f.counts(), {
    closed: 1,
    released: 1,
    mirrorPauses: 1,
    mirrorResumes: 1,
    openedKey: "account-1",
  });
});

test("public recovery returns only the requested profile and never another profile's URL", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    assert.equal(typeof options.body, "string");
    const key = (JSON.parse(options.body as string) as { sessionKey: string }).sessionKey;
    return new Response(JSON.stringify({ success: true, active: true, sessionKey: key, path: "/recovery/test/vnc.html" }), { status: 200 });
  });
  const old = { url: process.env.LINE_CHAT_WORKER_INTERNAL_URL, secret: process.env.LINE_CHAT_WORKER_INTERNAL_SECRET, base: process.env.LINE_CHAT_NOVNC_PUBLIC_BASE_URL };
  process.env.LINE_CHAT_WORKER_INTERNAL_URL = "https://worker.example";
  process.env.LINE_CHAT_WORKER_INTERNAL_SECRET = "synthetic-test-secret";
  process.env.LINE_CHAT_NOVNC_PUBLIC_BASE_URL = "https://worker.example";
  t.after(() => {
    for (const [key, value] of Object.entries({ LINE_CHAT_WORKER_INTERNAL_URL: old.url, LINE_CHAT_WORKER_INTERNAL_SECRET: old.secret, LINE_CHAT_NOVNC_PUBLIC_BASE_URL: old.base })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const service = new LineChatNovncRecoveryService();
  assert.equal((await service.start("account-1")).sessionKey, "account-1");
  assert.equal((await service.start("profile-b")).sessionKey, "profile-b");
  await assert.rejects(service.start("arbitrary"));
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ success: true, active: true, sessionKey: "profile-b", path: "/recovery/other/vnc.html" })));
  await assert.rejects(service.start("account-1"), /another profile/);
});

test("same-session HTTP starts are pending and idempotent while another profile is rejected", async (t) => {
  let yieldMirror!: () => void;
  const f = fixture(t, { pause: () => new Promise<void>((resolve) => { yieldMirror = resolve; }) });
  assert.deepEqual(f.service.requestStart("account-1"), { active: false, pending: true, sessionKey: "account-1", error: undefined });
  assert.equal(f.service.requestStart("account-1").pending, true);
  assert.throws(() => f.service.requestStart("profile-b"), /RECOVERY_OTHER_SESSION_STARTING/);
  const duplicate = f.service.start("account-1");
  assert.equal(f.counts().mirrorPauses, 1);
  yieldMirror();
  assert.equal((await duplicate).active, true);
  await f.service.stop("account-1");
  await f.service.stop("account-1");
  assert.equal(f.counts().mirrorResumes, 1);
});

for (const leaseBusy of [false, true]) {
  test(`startup failure releases ownership and resumes Mirror once (lease busy ${leaseBusy})`, async (t) => {
    const f = fixture(t, { launchFails: !leaseBusy, leaseBusy });
    await assert.rejects(f.service.start("account-1"), leaseBusy ? /PROFILE_OPERATION_BUSY/ : /SYNTHETIC_LAUNCH_FAILED/);
    assert.equal(f.counts().mirrorResumes, 1);
    assert.equal(f.service.snapshot().pending, false);
    assert.ok(f.service.snapshot().error);
  });
}

for (const ttl of [false, true]) {
  test(`${ttl ? "TTL" : "browser exit"} releases recovery and resumes Mirror exactly once`, async (t) => {
    const f = fixture(t, { ttl });
    await f.service.start("account-1");
    if (!ttl) f.browserExit();
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(f.service.snapshot().active, false);
    assert.equal(f.counts().released, 1);
    assert.equal(f.counts().mirrorResumes, 1);
    await f.service.stop("account-1");
    assert.equal(f.counts().mirrorResumes, 1);
  });
}

test("real managed retained context is closed by Mirror handoff before noVNC launches", async (t) => {
  const profile = mkdtempSync(join(tmpdir(), "recovery-handoff-"));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  let closes = 0;
  const browser = Object.assign(new EventEmitter(), { connected: true, isConnected() { return this.connected; } });
  const retained = Object.assign(new EventEmitter(), {
    pages: () => [],
    browser: () => browser,
    close: () => { closes++; browser.connected = false; return Promise.resolve(); },
  }) as unknown as BrowserContext;
  const sessions = new LineChatSessionService(() => Promise.resolve(retained));
  const headless = await sessions.launchManagedPersistentContext(profile, { headless: true });
  await sessions.closeManagedPersistentContext(headless, profile);
  assert.equal(closes, 0, "Mirror retains its reusable idle context");
  const mirror = new LineChatMirrorService({} as PrismaService, sessions, {} as LineChatProfileOperationCoordinator);
  const f = fixture(t, {
    pause: () => mirror.pauseForManualRecovery(),
    onLaunch: () => assert.equal(closes, 1, "retained Chromium closed before headed launch"),
  });
  await f.service.start("account-1");
  await f.service.stop("account-1");
  assert.equal(f.counts().mirrorResumes, 1);
});
