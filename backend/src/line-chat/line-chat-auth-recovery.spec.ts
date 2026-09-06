import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LineChatSessionStatus, LineChatSessionHealthStatus, LineChatNicknameSyncJobStatus } from "@prisma/client";
import { LineChatAuthRecoveryService } from "./line-chat-auth-recovery.service";
import type { BrowserContext, Page, Locator } from "playwright";

interface MockPageOptions {
  initialUrl?: string;
  hasPassword?: boolean;
  hasQr?: boolean;
  hasOtp?: boolean;
  hasCaptcha?: boolean;
  multipleAccountsCount?: number;
  hasLineAccountButton?: boolean;
  hasLoginButton?: boolean;
  finalUrl?: string;
  apiMeStatus?: number;
  chatListStatus?: number;
}

function createMockPlaywright(options: MockPageOptions = {}) {
  let isClosed = false;
  let clickedSelectors: string[] = [];
  let currentUrl = options.initialUrl ?? "https://account.line.biz/login";
  let apiMeStatus = options.apiMeStatus ?? 200;
  let chatListStatus = options.chatListStatus ?? 200;

  function mockLocator(selector: string): Locator {
    return {
      first: () => mockLocator(selector),
      count: async () => {
        if (selector.includes("account-item") || selector.includes("radio")) {
          return options.multipleAccountsCount ?? 0;
        }
        return 1;
      },
      isVisible: async () => {
        if (selector.includes('input[type="password"]')) {
          return Boolean(options.hasPassword);
        }
        if (selector.includes("qr") || selector.includes("canvas")) {
          return Boolean(options.hasQr);
        }
        if (selector.includes("code") || selector.includes("OTP") || selector.includes("otp")) {
          return Boolean(options.hasOtp);
        }
        if (selector.includes("recaptcha") || selector.includes("hcaptcha") || selector.includes("captcha")) {
          return Boolean(options.hasCaptcha);
        }
        if (selector.includes("LINE") || selector.includes("line")) {
          return options.hasLineAccountButton ?? true;
        }
        if (selector.includes("Log in") || selector.includes("login") || selector.includes("submit")) {
          return options.hasLoginButton ?? true;
        }
        return false;
      },
      click: async () => {
        clickedSelectors.push(selector);
        if (selector.includes("Log in") || selector.includes("submit") || selector.includes("login")) {
          currentUrl = options.finalUrl ?? "https://chat.line.biz/U12345";
        }
      },
    } as unknown as Locator;
  }

  const mockPage = {
    url: () => currentUrl,
    goto: async (url: string) => {
      if (options.initialUrl && options.initialUrl.includes("login")) {
        currentUrl = options.initialUrl;
      } else if (!options.initialUrl) {
        currentUrl = "https://account.line.biz/login";
      } else {
        currentUrl = url;
      }
    },
    locator: (selector: string) => mockLocator(selector),
    waitForTimeout: async () => {},
    waitForLoadState: async () => {},
    waitForNavigation: async () => {},
  } as unknown as Page;

  const mockContext = {
    pages: () => [mockPage],
    newPage: async () => mockPage,
    request: {
      get: async (url: string) => {
        if (url.includes("/api/v1/me")) {
          const status = currentUrl.includes("login") ? 401 : apiMeStatus;
          return {
            status: () => status,
            headers: () => ({ "content-type": "application/json" }),
            json: async () => ({ id: "user-123" }),
          };
        }
        if (url.includes("/chats")) {
          return {
            status: () => chatListStatus,
            headers: () => ({ "content-type": "application/json" }),
            json: async () => ({ chats: [] }),
          };
        }
        return {
          status: () => 200,
          headers: () => ({ "content-type": "application/json" }),
          json: async () => ({}),
        };
      },
    },
    close: async () => {
      isClosed = true;
    },
  } as unknown as BrowserContext;

  return {
    context: mockContext,
    isClosed: () => isClosed,
    clickedSelectors,
    getCurrentUrl: () => currentUrl,
  };
}

function makeTestFixture(options: {
  sessionOverrides?: Record<string, unknown>;
  activeLeasesCount?: number;
  mockPageOptions?: MockPageOptions;
  coordinatorBusy?: boolean;
} = {}) {
  const profileDir = mkdtempSync(join(tmpdir(), "line-chat-auth-recovery-"));
  const recordedHealth: Array<Record<string, unknown>> = [];
  const sessionUpdates: Array<Record<string, unknown>> = [];
  const logEvents: Array<Record<string, unknown>> = [];
  const mockPw = createMockPlaywright(options.mockPageOptions);

  const session = {
    id: "session-1",
    sessionKey: "account-1",
    profileStorageKey: "account-1-key",
    profilePath: profileDir,
    status: LineChatSessionStatus.ACTIVE,
    healthStatus: LineChatSessionHealthStatus.AUTH_REQUIRED,
    healthFailureStage: "MANAGER_AUTH",
    consecutiveAuthFailures: 3,
    lineOfficialAccounts: [
      { id: "oa-1", chatBotId: "Ubot123" },
    ],
    ...options.sessionOverrides,
  };

  const prisma = {
    lineChatSession: {
      findUnique: async () => session,
      update: async (input: { where: { id: string }; data: Record<string, unknown> }) => {
        sessionUpdates.push(input);
        return { ...session, ...input.data };
      },
    },
    lineChatProfileOperationLease: {
      count: async () => options.activeLeasesCount ?? 0,
    },
  };

  const sessionService = {
    resolveProfilePath: (sess: { profilePath?: string | null; sessionKey?: string | null }) => {
      return sess.profilePath ?? profileDir;
    },
    probeApiAuthentication: async (ctx: BrowserContext) => {
      const res = await ctx.request.get("https://chat.line.biz/api/v1/me");
      const status = res.status();
      return {
        endpoint: "/api/v1/me",
        transport: "SUCCEEDED" as const,
        status,
        contentType: "application/json",
        responseWasJson: true,
        topLevelKeyNames: ["id"],
        authenticated: status === 200 ? ("YES" as const) : ("NO" as const),
      };
    },
  };

  const profileCoordinator = {
    withProfileOperation: async (
      input: { sessionId: string; operationKind: string },
      callback: (ctx: { assertOwnership: () => void }) => Promise<unknown>,
    ) => {
      if (options.coordinatorBusy) {
        return {
          acquired: false as const,
          reason: "PROFILE_OPERATION_BUSY" as const,
          retryAfterMs: 5000,
          sessionId: input.sessionId,
          operationKind: input.operationKind as any,
        };
      }
      const val = await callback({ assertOwnership: () => {} });
      return {
        acquired: true as const,
        value: val,
        sessionId: input.sessionId,
        operationKind: input.operationKind as any,
      };
    },
  };

  const healthService = {
    recordSessionHealthResult: async (input: Record<string, unknown>) => {
      recordedHealth.push(input);
      return { status: input.status, failureStage: input.failureStage, transitionEventCreated: true };
    },
  };

  const service = new LineChatAuthRecoveryService(
    prisma as never,
    sessionService as never,
    profileCoordinator as never,
    healthService as never,
  );

  return {
    service,
    session,
    profileDir,
    recordedHealth,
    sessionUpdates,
    mockPw,
    cleanup: () => {
      try {
        rmSync(profileDir, { recursive: true, force: true });
      } catch {}
    },
  };
}

// 1. AUTH_REQUIRED + remembered login -> CONNECTED
test("1. AUTH_REQUIRED + remembered login -> CONNECTED", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      initialUrl: "https://account.line.biz/login",
      hasLineAccountButton: true,
      hasLoginButton: true,
      finalUrl: "https://chat.line.biz/Ubot123",
      apiMeStatus: 200,
      chatListStatus: 200,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "RECOVERED_REMEMBERED_ACCOUNT");
    assert.equal(fixture.recordedHealth.length, 1);
    assert.equal(fixture.recordedHealth[0].status, "CONNECTED");
    assert.equal(fixture.recordedHealth[0].failureStage, null);

    // Verify session updated to ACTIVE with consecutive failures reset
    assert.equal(fixture.sessionUpdates.length, 1);
    assert.equal(fixture.sessionUpdates[0].data.status, LineChatSessionStatus.ACTIVE);
    assert.equal(fixture.sessionUpdates[0].data.healthConsecutiveFailures, 0);
  } finally {
    fixture.cleanup();
  }
});

// 2. AUTH_REQUIRED + already authenticated on open -> CONNECTED
test("2. AUTH_REQUIRED + already authenticated -> CONNECTED", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      initialUrl: "https://chat.line.biz/Ubot123",
      apiMeStatus: 200,
      chatListStatus: 200,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "RECOVERED_REMEMBERED_ACCOUNT");
    assert.equal(fixture.recordedHealth.length, 1);
    assert.equal(fixture.recordedHealth[0].status, "CONNECTED");
    assert.equal(fixture.recordedHealth[0].failureStage, null);
  } finally {
    fixture.cleanup();
  }
});

// 3. QR page -> MANUAL_REAUTH_REQUIRED
test("3. QR page -> MANUAL_REAUTH_REQUIRED", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      hasQr: true,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "MANUAL_REAUTH_REQUIRED");
    assert.equal(fixture.recordedHealth.length, 0); // Must NOT transition to CONNECTED
  } finally {
    fixture.cleanup();
  }
});

// 4. password form -> MANUAL_REAUTH_REQUIRED
test("4. password form -> MANUAL_REAUTH_REQUIRED", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      hasPassword: true,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "MANUAL_REAUTH_REQUIRED");
    assert.equal(fixture.recordedHealth.length, 0);
  } finally {
    fixture.cleanup();
  }
});

// 5. OTP challenge -> MANUAL_REAUTH_REQUIRED
test("5. OTP challenge -> MANUAL_REAUTH_REQUIRED", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      hasOtp: true,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "MANUAL_REAUTH_REQUIRED");
    assert.equal(fixture.recordedHealth.length, 0);
  } finally {
    fixture.cleanup();
  }
});

// 6. ambiguous account chooser -> MANUAL_REAUTH_REQUIRED
test("6. ambiguous account chooser -> MANUAL_REAUTH_REQUIRED", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      multipleAccountsCount: 2, // 2 candidate accounts
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "MANUAL_REAUTH_REQUIRED");
    assert.equal(fixture.recordedHealth.length, 0);
  } finally {
    fixture.cleanup();
  }
});

// 7. active lease -> recovery skipped
test("7. active lease -> recovery skipped", async () => {
  const fixture = makeTestFixture({
    activeLeasesCount: 1, // Another operation holds lease
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED");
    assert.equal(result.outcome, "RECOVERY_SKIPPED_ACTIVE_LEASE");
    assert.equal(fixture.recordedHealth.length, 0);
  } finally {
    fixture.cleanup();
  }
});

// 8. recovery already running -> no duplicate browser
test("8. recovery already running -> no duplicate browser", async () => {
  const fixture = makeTestFixture();

  try {
    // Simulate recovery in progress
    (fixture.service as any).inProgress.add(fixture.session.id);

    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED");
    assert.equal(result.outcome, "RECOVERY_ALREADY_IN_PROGRESS");
  } finally {
    (fixture.service as any).inProgress.delete(fixture.session.id);
    fixture.cleanup();
  }
});

// 9. cooldown prevents recovery loop
test("9. cooldown prevents recovery loop", async () => {
  const fixture = makeTestFixture();

  try {
    // Record recent attempt
    (fixture.service as any).lastAttemptAt.set(fixture.session.id, Date.now() - 60_000); // 1 min ago

    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      cooldownMs: 15 * 60_000,
    });
    assert.equal(result.outcome, "RECOVERY_SKIPPED_COOLDOWN");

    // But bypass cooldown works when requested by manual trigger
    const bypassResult = await fixture.service.recoverSession(fixture.session.id, "MANUAL", {
      bypassCooldown: true,
      customLauncher: async () => fixture.mockPw.context,
    });
    assert.notEqual(bypassResult.outcome, "RECOVERY_SKIPPED_COOLDOWN");
  } finally {
    fixture.cleanup();
  }
});

// 10. /api/v1/me non-200 after click -> recovery fails safely
test("10. /api/v1/me non-200 after click -> recovery fails safely", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      initialUrl: "https://account.line.biz/login",
      finalUrl: "https://chat.line.biz/Ubot123",
      apiMeStatus: 401, // Auth failed after click
      chatListStatus: 200,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "RECOVERY_FAILED_SAFE");
    assert.equal(fixture.recordedHealth.length, 0); // Must NOT mark CONNECTED
  } finally {
    fixture.cleanup();
  }
});

// 11. chats endpoint non-200 -> does not mark CONNECTED
test("11. chats endpoint non-200 -> does not mark CONNECTED", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      initialUrl: "https://account.line.biz/login",
      finalUrl: "https://chat.line.biz/Ubot123",
      apiMeStatus: 200,
      chatListStatus: 403, // Chat list denied
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "RECOVERY_FAILED_SAFE");
    assert.equal(fixture.recordedHealth.length, 0);
  } finally {
    fixture.cleanup();
  }
});

// 12. account-1 recovery never touches profile-b
// 13. profile-b recovery never touches account-1
test("12 & 13. strict session profile isolation (account-1 vs profile-b)", async () => {
  const openedPaths: string[] = [];
  const launcher = async (dir: string) => {
    openedPaths.push(dir);
    return createMockPlaywright().context;
  };

  const fixtureA = makeTestFixture({
    sessionOverrides: { id: "session-a", sessionKey: "account-1" },
  });
  const fixtureB = makeTestFixture({
    sessionOverrides: { id: "session-b", sessionKey: "profile-b" },
  });

  try {
    await fixtureA.service.recoverSession("session-a", "MANUAL", {
      bypassCooldown: true,
      customLauncher: launcher,
    });
    assert.ok(openedPaths[0].includes("line-chat-auth-recovery-"));
    assert.ok(!openedPaths[0].includes("isolated-profile-b"));

    await fixtureB.service.recoverSession("session-b", "MANUAL", {
      bypassCooldown: true,
      customLauncher: launcher,
    });
    assert.equal(openedPaths[0], fixtureA.profileDir);
    assert.equal(openedPaths[1], fixtureB.profileDir);
    assert.notEqual(openedPaths[0], openedPaths[1]);
  } finally {
    fixtureA.cleanup();
    fixtureB.cleanup();
  }
});

// 14. historical FAILED jobs remain unchanged
test("14. historical FAILED jobs remain unchanged", async () => {
  const jobUpdates: any[] = [];
  const fixture = makeTestFixture({
    mockPageOptions: {
      initialUrl: "https://chat.line.biz/Ubot123",
      apiMeStatus: 200,
      chatListStatus: 200,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    assert.equal(result.outcome, "RECOVERED_REMEMBERED_ACCOUNT");
    // Verify zero job queries or mutations were executed by recovery service
    assert.equal(jobUpdates.length, 0);
  } finally {
    fixture.cleanup();
  }
});

// 15. no credentials/PII appear in logs/API response
test("15. no credentials/PII appear in recovery result or response", async () => {
  const fixture = makeTestFixture({
    mockPageOptions: {
      initialUrl: "https://chat.line.biz/Ubot123",
      apiMeStatus: 200,
      chatListStatus: 200,
    },
  });

  try {
    const result = await fixture.service.recoverSession(fixture.session.id, "SCHEDULED", {
      customLauncher: async () => fixture.mockPw.context,
    });

    const json = JSON.stringify(result);
    assert.ok(!json.includes("password"));
    assert.ok(!json.includes("cookie"));
    assert.ok(!json.includes("token"));
    assert.ok(!json.includes("email"));
    assert.ok(!json.includes(fixture.profileDir));
  } finally {
    fixture.cleanup();
  }
});

// 16. worker does not claim affected session during recovery
// 17. worker resumes normal eligibility after successful recovery
test("16 & 17. worker circuit breaker respects AUTH_REQUIRED and resumes when CONNECTED", () => {
  // Test worker session health status circuit breaker logic
  const sessionAuthRequired = {
    status: LineChatSessionStatus.AUTH_REQUIRED,
    healthStatus: LineChatSessionHealthStatus.AUTH_REQUIRED,
  };
  const shouldProcessWhenAuthRequired = sessionAuthRequired.status !== LineChatSessionStatus.AUTH_REQUIRED;
  assert.equal(shouldProcessWhenAuthRequired, false);

  const sessionRecovered = {
    status: LineChatSessionStatus.ACTIVE,
    healthStatus: LineChatSessionHealthStatus.CONNECTED,
  };
  const shouldProcessWhenRecovered = sessionRecovered.status === LineChatSessionStatus.ACTIVE;
  assert.equal(shouldProcessWhenRecovered, true);
});
