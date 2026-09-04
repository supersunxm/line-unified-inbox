import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  classifySessionProbeExecutionFailure,
  LineChatSessionHealthProbeService,
} from "./line-chat-session-health-probe.service";
import type { DiagnosticsResult } from "./line-chat.types";

function diagnosticsFixture(overrides: Partial<DiagnosticsResult> = {}): DiagnosticsResult {
  return {
    profilePath: "/tmp/profile",
    surface: "bot",
    targetUrl: "https://chat.line.biz/",
    finalPageUrl: "https://chat.line.biz/",
    finalOrigin: "https://chat.line.biz",
    finalPath: "/",
    documentTitle: "LINE Official Account Manager",
    mainDocumentStatus: 200,
    finalOriginIsChatLine: true,
    finalPathMatchesWorkspace: true,
    authDestinationDetected: false,
    redirected: false,
    navigationSucceeded: true,
    authenticated: true,
    sessionStatePresent: true,
    cookieStatePresent: true,
    localStoragePresent: true,
    sessionStoragePresent: true,
    apiAuthenticated: "YES",
    apiAuthProbe: {
      endpoint: "/api/v1/me",
      transport: "SUCCEEDED",
      status: 200,
      contentType: "application/json",
      responseWasJson: true,
      topLevelKeyNames: ["id"],
      authenticated: "YES",
    },
    cookiesCount: 1,
    metaTags: [],
    xsrfTokenFound: true,
    tokenSource: "cookie",
    clientVersionFound: true,
    observedRequests: [],
    observedResponses: [],
    chatListResponseObserved: false,
    chatListFirstPageQueryNames: [],
    wheelProbeAttempts: 0,
    secondPageRequestObserved: false,
    secondPageQueryNames: [],
    secondPageNewQueryNames: [],
    restApiRequestsObserved: 1,
    streamingSseObserved: false,
    ...overrides,
  };
}

function makeFixture(options: {
  diagnostics?: DiagnosticsResult;
  runDiagnosticsError?: Error;
  resolveProfilePathError?: Error;
  coordinatorBusy?: boolean;
} = {}) {
  const profilePath = mkdtempSync(join(tmpdir(), "line-chat-health-probe-"));
  const recorded: Array<Record<string, unknown>> = [];
  const diagnosticsCalls: Array<Record<string, unknown>> = [];
  let coordinatorCalls = 0;

  const prisma = {
    lineChatSession: {
      findUnique: async () => ({
        id: "session-1",
        sessionKey: "profile-a",
        profileStorageKey: "profile-a-v1",
        profilePath: null,
      }),
    },
  };
  const sessionService = {
    resolveProfilePath: () => {
      if (options.resolveProfilePathError) throw options.resolveProfilePathError;
      return profilePath;
    },
    runDiagnostics: async (input: Record<string, unknown>) => {
      diagnosticsCalls.push(input);
      if (options.runDiagnosticsError) throw options.runDiagnosticsError;
      return options.diagnostics ?? diagnosticsFixture({ profilePath });
    },
  };
  const coordinator = {
    withProfileOperation: async (
      input: Record<string, unknown>,
      callback: () => Promise<unknown>,
    ) => {
      coordinatorCalls += 1;
      if (options.coordinatorBusy) {
        return {
          acquired: false as const,
          reason: "PROFILE_OPERATION_BUSY" as const,
          retryAfterMs: 5_000,
          sessionId: String(input.sessionId),
          operationKind: "HEALTH_SESSION" as const,
        };
      }
      return {
        acquired: true as const,
        value: await callback(),
        sessionId: String(input.sessionId),
        operationKind: "HEALTH_SESSION" as const,
      };
    },
  };
  const healthService = {
    recordSessionHealthResult: async (input: Record<string, unknown>) => {
      recorded.push(input);
      return {
        status: input.status,
        failureStage: input.failureStage ?? null,
        transitionEventCreated: true,
      };
    },
  };

  const service = new LineChatSessionHealthProbeService(
    prisma as never,
    sessionService as never,
    coordinator as never,
    healthService as never,
  );

  return {
    service,
    profilePath,
    recorded,
    diagnosticsCalls,
    coordinatorCalls: () => coordinatorCalls,
    cleanup: () => rmSync(profilePath, { recursive: true, force: true }),
  };
}

test("authenticated Manager diagnostics record CONNECTED without targeting a bot or customer", async () => {
  const fixture = makeFixture();
  try {
    const result = await fixture.service.probeSession("session-1", "SCHEDULED");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "CONNECTED");
    assert.equal(result.failureStage, null);
    assert.equal(fixture.recorded.length, 1);
    assert.equal(fixture.recorded[0].source, "SCHEDULED");
    assert.equal(fixture.recorded[0].httpStatus, 200);
    assert.equal(fixture.diagnosticsCalls.length, 1);
    assert.deepEqual(fixture.diagnosticsCalls[0], {
      profilePath: fixture.profilePath,
      surface: "bot",
      headless: true,
    });
  } finally {
    fixture.cleanup();
  }
});

test("explicit Manager auth failure records AUTH_REQUIRED at MANAGER_AUTH", async () => {
  const fixture = makeFixture({
    diagnostics: diagnosticsFixture({
      authenticated: false,
      apiAuthenticated: "NO",
      apiAuthProbe: {
        endpoint: "/api/v1/me",
        transport: "SUCCEEDED",
        status: 401,
        contentType: "application/json",
        responseWasJson: true,
        topLevelKeyNames: [],
        authenticated: "NO",
      },
    }),
  });
  try {
    const result = await fixture.service.probeSession("session-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "AUTH_REQUIRED");
    assert.equal(result.failureStage, "MANAGER_AUTH");
    assert.equal(fixture.recorded[0].status, "AUTH_REQUIRED");
    assert.equal(fixture.recorded[0].failureStage, "MANAGER_AUTH");
  } finally {
    fixture.cleanup();
  }
});

test("missing profile records CONFIG_ERROR without acquiring the browser coordinator", async () => {
  const fixture = makeFixture();
  fixture.cleanup();
  const result = await fixture.service.probeSession("session-1");
  assert.equal(result.outcome, "RECORDED");
  assert.equal(result.status, "CONFIG_ERROR");
  assert.equal(result.failureStage, "PROFILE_MISSING");
  assert.equal(fixture.coordinatorCalls(), 0);
  assert.equal(fixture.diagnosticsCalls.length, 0);
});

test("invalid resolved profile path records CONFIG_ERROR before browser work", async () => {
  const fixture = makeFixture({ resolveProfilePathError: new Error("path escapes profile root") });
  try {
    const result = await fixture.service.probeSession("session-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "CONFIG_ERROR");
    assert.equal(result.failureStage, "PROFILE_PATH_INVALID");
    assert.equal(fixture.coordinatorCalls(), 0);
    assert.equal(fixture.diagnosticsCalls.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("busy profile skips the probe and writes no health observation", async () => {
  const fixture = makeFixture({ coordinatorBusy: true });
  try {
    const result = await fixture.service.probeSession("session-1");
    assert.deepEqual(result, {
      outcome: "SKIPPED_BUSY",
      sessionId: "session-1",
      retryAfterMs: 5_000,
    });
    assert.equal(fixture.diagnosticsCalls.length, 0);
    assert.equal(fixture.recorded.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("stale Chromium singleton error records DEGRADED PROFILE_LOCK", async () => {
  const fixture = makeFixture({
    runDiagnosticsError: new Error("Failed to create a ProcessSingleton for SingletonLock: profile is locked"),
  });
  try {
    const result = await fixture.service.probeSession("session-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "DEGRADED");
    assert.equal(result.failureStage, "PROFILE_LOCK");
    assert.equal(fixture.recorded[0].failureStage, "PROFILE_LOCK");
  } finally {
    fixture.cleanup();
  }
});

test("execution failure classifier distinguishes Chromium launch from unknown errors", () => {
  assert.equal(
    classifySessionProbeExecutionFailure(new Error("browserType.launchPersistentContext: Failed to launch Chromium")),
    "CHROMIUM_LAUNCH",
  );
  assert.equal(classifySessionProbeExecutionFailure(new Error("unexpected runtime failure")), "UNKNOWN");
});
