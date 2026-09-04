import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LineChatOaHealthProbeService } from "./line-chat-oa-health-probe.service";
import type { DiagnosticsResult } from "./line-chat.types";

function validIdentifierShape(): NonNullable<DiagnosticsResult["chatListIdentifierShape"]> {
  return {
    listCount: 0,
    chatId: { stringCount: 0, matchesUserIdPattern: 0, otherStringCount: 0, nullOrMissing: 0 },
    userId: { stringCount: 0, matchesUserIdPattern: 0, otherStringCount: 0, nullOrMissing: 0 },
    presenceCounts: { bothPresent: 0, chatIdOnly: 0, userIdOnly: 0, neither: 0 },
  };
}

function validPagination(): NonNullable<DiagnosticsResult["chatListPagination"]> {
  return {
    nextPresent: "NO",
    nextType: "null",
    nextStringClassification: "NOT_APPLICABLE",
    nextLengthBucket: "NOT_APPLICABLE",
    nextObjectKeys: [],
  };
}

function diagnosticsFixture(overrides: Partial<DiagnosticsResult> = {}): DiagnosticsResult {
  return {
    profilePath: "/tmp/profile",
    surface: "chat-list",
    targetUrl: "https://chat.line.biz/Ubot1",
    finalPageUrl: "https://chat.line.biz/Ubot1",
    finalOrigin: "https://chat.line.biz",
    finalPath: "/Ubot1",
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
    observedResponses: [{
      status: 200,
      contentType: "application/json",
      url: "https://chat.line.biz/api/v2/bots/Ubot1/chats",
      query: { parameterNames: [], safeScalars: {}, redactedParameters: [] },
      schema: {
        parseStatus: "JSON",
        topLevelType: "object",
        topLevelKeyNames: ["chats", "next"],
        nestedKeyNames: [],
        arrayLengths: [{ path: "chats", length: 0 }],
        paginationKeyNames: ["next"],
        candidateFieldNames: [],
      },
      timestamp: "2026-09-04T00:00:00.000Z",
    }],
    chatListResponseObserved: true,
    chatListIdentifierShape: validIdentifierShape(),
    chatListPagination: validPagination(),
    chatListFirstPageQueryNames: [],
    wheelProbeAttempts: 0,
    secondPageRequestObserved: false,
    secondPageQueryNames: [],
    secondPageNewQueryNames: [],
    restApiRequestsObserved: 2,
    streamingSseObserved: false,
    ...overrides,
  };
}

function makeFixture(options: {
  diagnostics?: DiagnosticsResult;
  runDiagnosticsError?: Error;
  coordinatorBusy?: boolean;
  missingBotId?: boolean;
  missingSession?: boolean;
  resolveProfilePathError?: Error;
} = {}) {
  const profilePath = mkdtempSync(join(tmpdir(), "line-chat-oa-health-probe-"));
  const oaRecorded: Array<Record<string, unknown>> = [];
  const sessionRecorded: Array<Record<string, unknown>> = [];
  const diagnosticsCalls: Array<Record<string, unknown>> = [];
  let coordinatorCalls = 0;

  const session = options.missingSession ? null : {
    id: "session-1",
    sessionKey: "profile-b",
    profileStorageKey: "profile-b-linux-v2",
    profilePath: null,
  };
  const prisma = {
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-1",
        chatBotId: options.missingBotId ? null : "Ubot1",
        lineChatSessionId: session?.id ?? null,
        lineChatSession: session,
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
          operationKind: "HEALTH_OA" as const,
        };
      }
      return {
        acquired: true as const,
        value: await callback(),
        sessionId: String(input.sessionId),
        operationKind: "HEALTH_OA" as const,
      };
    },
  };
  const healthService = {
    recordSessionHealthResult: async (input: Record<string, unknown>) => {
      sessionRecorded.push(input);
      return {
        status: input.status,
        failureStage: input.failureStage ?? null,
        transitionEventCreated: true,
      };
    },
    recordOaHealthResult: async (input: Record<string, unknown>) => {
      oaRecorded.push(input);
      return {
        status: input.status,
        failureStage: input.failureStage ?? null,
        transitionEventCreated: true,
      };
    },
  };

  const service = new LineChatOaHealthProbeService(
    prisma as never,
    sessionService as never,
    coordinator as never,
    healthService as never,
  );

  return {
    service,
    profilePath,
    oaRecorded,
    sessionRecorded,
    diagnosticsCalls,
    coordinatorCalls: () => coordinatorCalls,
    cleanup: () => rmSync(profilePath, { recursive: true, force: true }),
  };
}

test("known-good Manager plus valid OA chat list records CONNECTED for session and OA", async () => {
  const fixture = makeFixture();
  try {
    const result = await fixture.service.probeOa("oa-1", "MANUAL");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "CONNECTED");
    assert.equal(result.failureStage, null);
    assert.equal(result.sessionStatus, "CONNECTED");
    assert.equal(fixture.sessionRecorded.length, 1);
    assert.equal(fixture.oaRecorded.length, 1);
    assert.ok(fixture.oaRecorded[0].healthSessionSnapshotAt instanceof Date);
    assert.deepEqual(fixture.diagnosticsCalls[0], {
      profilePath: fixture.profilePath,
      botId: "Ubot1",
      surface: "chat-list",
      headless: true,
    });
  } finally {
    fixture.cleanup();
  }
});

test("explicit Manager auth failure records parent and OA AUTH_REQUIRED", async () => {
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
      observedResponses: [],
      chatListResponseObserved: false,
      chatListIdentifierShape: undefined,
      chatListPagination: undefined,
    }),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "AUTH_REQUIRED");
    assert.equal(result.failureStage, "MANAGER_AUTH");
    assert.equal(result.sessionStatus, "AUTH_REQUIRED");
  } finally {
    fixture.cleanup();
  }
});

test("known-good Manager redirected away from requested workspace records OA_ACCESS_LOST", async () => {
  const fixture = makeFixture({
    diagnostics: diagnosticsFixture({
      finalPageUrl: "https://chat.line.biz/another-bot",
      finalPath: "/another-bot",
      finalPathMatchesWorkspace: false,
      redirected: true,
      observedResponses: [],
      chatListResponseObserved: false,
      chatListIdentifierShape: undefined,
      chatListPagination: undefined,
    }),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "OA_ACCESS_LOST");
    assert.equal(result.failureStage, "OA_ACCESS");
    assert.equal(result.sessionStatus, "CONNECTED");
  } finally {
    fixture.cleanup();
  }
});

test("chat-list 403 with known-good Manager records OA_ACCESS_LOST CHAT_AUTH", async () => {
  const fixture = makeFixture({
    diagnostics: diagnosticsFixture({
      observedResponses: [{
        ...diagnosticsFixture().observedResponses[0],
        status: 403,
      }],
      chatListIdentifierShape: undefined,
      chatListPagination: undefined,
    }),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "OA_ACCESS_LOST");
    assert.equal(result.failureStage, "CHAT_AUTH");
  } finally {
    fixture.cleanup();
  }
});

test("malformed chat-list 200 records DEGRADED CHAT_LIST_PARSE", async () => {
  const fixture = makeFixture({
    diagnostics: diagnosticsFixture({
      chatListIdentifierShape: undefined,
      chatListPagination: undefined,
    }),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "DEGRADED");
    assert.equal(result.failureStage, "CHAT_LIST_PARSE");
  } finally {
    fixture.cleanup();
  }
});

test("missing natural chat-list request records DEGRADED CHAT_LIST_REQUEST", async () => {
  const fixture = makeFixture({
    diagnostics: diagnosticsFixture({
      observedResponses: [],
      chatListResponseObserved: false,
      chatListIdentifierShape: undefined,
      chatListPagination: undefined,
    }),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "DEGRADED");
    assert.equal(result.failureStage, "CHAT_LIST_REQUEST");
  } finally {
    fixture.cleanup();
  }
});

test("chat-list 500 records DEGRADED CHAT_LIST_RESPONSE", async () => {
  const fixture = makeFixture({
    diagnostics: diagnosticsFixture({
      observedResponses: [{ ...diagnosticsFixture().observedResponses[0], status: 500 }],
      chatListIdentifierShape: undefined,
      chatListPagination: undefined,
    }),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "DEGRADED");
    assert.equal(result.failureStage, "CHAT_LIST_RESPONSE");
  } finally {
    fixture.cleanup();
  }
});

test("chat-list 429 records DEGRADED RATE_LIMIT", async () => {
  const fixture = makeFixture({
    diagnostics: diagnosticsFixture({
      observedResponses: [{ ...diagnosticsFixture().observedResponses[0], status: 429 }],
      chatListIdentifierShape: undefined,
      chatListPagination: undefined,
    }),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "DEGRADED");
    assert.equal(result.failureStage, "RATE_LIMIT");
  } finally {
    fixture.cleanup();
  }
});

test("busy shared profile skips OA probe and writes no snapshots", async () => {
  const fixture = makeFixture({ coordinatorBusy: true });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.deepEqual(result, {
      outcome: "SKIPPED_BUSY",
      lineOfficialAccountId: "oa-1",
      retryAfterMs: 5_000,
    });
    assert.equal(fixture.diagnosticsCalls.length, 0);
    assert.equal(fixture.sessionRecorded.length, 0);
    assert.equal(fixture.oaRecorded.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("missing bot/session configuration records CONFIG_ERROR before browser work", async () => {
  for (const options of [{ missingBotId: true }, { missingSession: true }]) {
    const fixture = makeFixture(options);
    try {
      const result = await fixture.service.probeOa("oa-1");
      assert.equal(result.outcome, "RECORDED");
      assert.equal(result.status, "CONFIG_ERROR");
      assert.equal(result.failureStage, "CONFIG_ERROR");
      assert.equal(fixture.coordinatorCalls(), 0);
      assert.equal(fixture.diagnosticsCalls.length, 0);
    } finally {
      fixture.cleanup();
    }
  }
});

test("missing profile records CONFIG_ERROR PROFILE_MISSING before browser work", async () => {
  const fixture = makeFixture();
  fixture.cleanup();
  const result = await fixture.service.probeOa("oa-1");
  assert.equal(result.outcome, "RECORDED");
  assert.equal(result.status, "CONFIG_ERROR");
  assert.equal(result.failureStage, "PROFILE_MISSING");
  assert.equal(fixture.coordinatorCalls(), 0);
});

test("invalid resolved profile path records CONFIG_ERROR PROFILE_PATH_INVALID", async () => {
  const fixture = makeFixture({ resolveProfilePathError: new Error("path escapes profile root") });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "CONFIG_ERROR");
    assert.equal(result.failureStage, "PROFILE_PATH_INVALID");
    assert.equal(fixture.coordinatorCalls(), 0);
  } finally {
    fixture.cleanup();
  }
});

test("stale Chromium singleton error records DEGRADED PROFILE_LOCK", async () => {
  const fixture = makeFixture({
    runDiagnosticsError: new Error("Failed to create a ProcessSingleton for SingletonLock: profile is locked"),
  });
  try {
    const result = await fixture.service.probeOa("oa-1");
    assert.equal(result.outcome, "RECORDED");
    assert.equal(result.status, "DEGRADED");
    assert.equal(result.failureStage, "PROFILE_LOCK");
  } finally {
    fixture.cleanup();
  }
});
