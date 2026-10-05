import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import childProcess from "node:child_process";
import { tmpdir } from "node:os";
import type { BrowserContext } from "playwright";
import type { PrismaService } from "../prisma.service";
import type { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatNovncRecoveryWorkerService } from "./line-chat-novnc-recovery-worker.service";
import { LineChatNovncRecoveryService } from "./line-chat-novnc-recovery.service";

function fixture(t: test.TestContext) {
  let mirrorActive = false;
  let closed = 0;
  let released = 0;
  let openedKey: string | null = null;
  t.mock.method(childProcess, "spawn", () => Object.assign(new EventEmitter(), {
    exitCode: null, killed: false, stderr: new EventEmitter(),
    kill() { this.killed = true; return true; },
  }));
  const context = Object.assign(new EventEmitter(), {
    pages: () => [{ goto: async () => undefined }],
  }) as unknown as BrowserContext;
  const sessionService = {
    isMirrorCycleActive: () => mirrorActive,
    resolveProfilePath: () => tmpdir(),
    launchManagedPersistentContext: async (_path: string, _options: unknown, metadata: { sessionKey: string }) => {
      openedKey = metadata.sessionKey;
      return context;
    },
    closeManagedPersistentContext: async () => { closed++; },
  } as unknown as LineChatSessionService;
  const prisma = { lineChatSession: { findUnique: async ({ where }: { where: { sessionKey: string } }) => ({
    id: `id-${where.sessionKey}`, sessionKey: where.sessionKey, profileStorageKey: "existing", profilePath: null,
  }) } } as unknown as PrismaService;
  const coordinator = {
    withProfileOperation: async (input: { sessionId: string }, callback: (lease: { assertOwnership: () => void }) => Promise<void>, options: { waitForLock: boolean }) => {
      assert.equal(options.waitForLock, false);
      assert.equal(input.sessionId, "id-account-1");
      await callback({ assertOwnership: () => undefined });
      released++;
      return { acquired: true };
    },
  } as unknown as LineChatProfileOperationCoordinator;
  return {
    service: new LineChatNovncRecoveryWorkerService(prisma, sessionService, coordinator),
    activateMirror: () => { mirrorActive = true; },
    counts: () => ({ closed, released, openedKey }),
  };
}

test("manual recovery rejects unsupported profiles and active Mirror before browser launch", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.service.start("arbitrary"), /RECOVERY_SESSION_NOT_ALLOWED/);
  f.activateMirror();
  await assert.rejects(f.service.start("account-1"), /LIVE_MIRROR_ACTIVE/);
  assert.equal(f.counts().openedKey, null);
});

test("profile A uses its exact existing session, blocks cross-profile token reuse, and releases for Mirror", async (t) => {
  const f = fixture(t);
  const pending = f.service.start("account-1");
  await assert.rejects(f.service.start("profile-b"), /RECOVERY_START_IN_PROGRESS/);
  const result = await pending;
  assert.equal(result.sessionKey, "account-1");
  assert.equal(result.active, true);
  assert.equal(f.counts().openedKey, "account-1");
  await assert.rejects(f.service.start("profile-b"), /RECOVERY_OTHER_SESSION_ACTIVE/);
  await assert.rejects(f.service.stop("profile-b"), /RECOVERY_OTHER_SESSION_ACTIVE/);
  assert.equal(f.service.snapshot().active, true);
  f.activateMirror();
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(f.service.snapshot().active, false);
  assert.deepEqual(f.counts(), { closed: 1, released: 1, openedKey: "account-1" });
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
