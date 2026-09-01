import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { BrowserContext, Page, Response } from "playwright";
import { LineChatSessionService, type ContextLauncher, type LineChatCookie } from "./line-chat-session.service";

interface MockEvaluateCall {
  targetUrl: string;
  payload: { nickname: string };
  headers: Record<string, string>;
}

function createMockPageContext(options: {
  cookies?: LineChatCookie[];
  responseStatus?: number;
  responseStatusText?: string;
  networkError?: string;
  domMetaTags?: string[];
  localStorageKeys?: string[];
  sessionStorageKeys?: string[];
  finalPageUrl?: string;
  documentTitle?: string;
  navigationStatus?: number;
  navigationError?: string;
  apiProbeStatus?: number;
  apiProbeContentType?: string;
  apiProbeBody?: unknown;
  apiProbeJsonError?: boolean;
  apiProbeTransportError?: string;
  simulatedBackgroundRequests?: Array<{
    url: string;
    headers: Record<string, string>;
  }>;
  simulatedScrollRequests?: Array<{
    url: string;
    headers?: Record<string, string>;
  }>;
  simulatedResponses?: Array<{
    url: string;
    status?: number;
    contentType?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }>;
  responseDelayMs?: number;
}): {
  context: BrowserContext;
  closed: () => boolean;
  evaluateCalls: MockEvaluateCall[];
  visitedUrls: string[];
  requestCalls: Array<{ method: string; url: string }>;
  scrollCount: () => number;
} {
  let isClosed = false;
  const evaluateCalls: MockEvaluateCall[] = [];
  const visitedUrls: string[] = [];
  const requestCalls: Array<{ method: string; url: string }> = [];
  let currentPageUrl = options.finalPageUrl ?? "https://chat.line.biz/";

  const requestListeners: Array<(req: { url: () => string; method: () => string; headers: () => Record<string, string> }) => void> = [];
  const responseListeners: Array<(response: Response) => void> = [];
  let scrollCount = 0;

  const mockPage: Partial<Page> = {
    isClosed: () => isClosed,
    on: (event: string, listener: unknown) => {
      if (event === "request") {
        requestListeners.push(listener as (req: { url: () => string; method: () => string; headers: () => Record<string, string> }) => void);
      }
      if (event === "response") {
        responseListeners.push(listener as (response: Response) => void);
      }
      return mockPage as Page;
    },
    goto: async (url: string) => {
      visitedUrls.push(url);
      currentPageUrl = options.finalPageUrl ?? url;
      if (options.simulatedBackgroundRequests) {
        for (const simReq of options.simulatedBackgroundRequests) {
          for (const listener of requestListeners) {
            listener({
              url: () => simReq.url,
              method: () => "GET",
              headers: () => simReq.headers,
            });
          }
        }
      }
      const emitSimulatedResponses = () => {
        if (!options.simulatedResponses) return;
        for (const simResponse of options.simulatedResponses) {
          const request = {
            url: () => simResponse.url,
            method: () => "GET",
            headers: () => ({}),
          };
          const response = {
            url: () => simResponse.url,
            request: () => request,
            status: () => simResponse.status ?? 200,
            headers: () => ({
              "content-type": simResponse.contentType ?? "application/json",
              ...(simResponse.headers ?? {}),
            }),
            json: async () => simResponse.body ?? {},
          } as unknown as Response;
          for (const listener of responseListeners) listener(response);
        }
      }
      if (options.responseDelayMs === undefined) {
        emitSimulatedResponses();
      } else {
        setTimeout(emitSimulatedResponses, options.responseDelayMs);
      }
      if (options.navigationError) throw new Error(options.navigationError);
      return options.navigationStatus === undefined
        ? null
        : ({ status: () => options.navigationStatus } as unknown as Response);
    },
    url: () => currentPageUrl,
    title: async () => options.documentTitle ?? "LINE Official Account Manager",
    waitForTimeout: async () => {},
    evaluate: async (fn: unknown, args?: unknown) => {
      if (typeof fn === "function") {
        const fnStr = fn.toString();
        // Check if this is DOM inspection evaluation
        if (fnStr.includes("localStorageKeys") || fnStr.includes("meta[name=")) {
          return {
            localStorageKeys: options.localStorageKeys ?? [],
            sessionStorageKeys: options.sessionStorageKeys ?? [],
            domToken: undefined,
            clientVersion: undefined,
          };
        }
        // Check if this is querySelectorAll meta evaluation
        if (fnStr.includes("querySelectorAll(\"meta\")") || fnStr.includes("querySelectorAll('meta')")) {
          return options.domMetaTags ?? ["csrf-token", "viewport"];
        }
        // Otherwise this is the page fetch evaluation
        if (args && typeof args === "object" && "targetUrl" in args) {
          const evalArgs = args as MockEvaluateCall;
          evaluateCalls.push(evalArgs);

          if (options.networkError) {
            return {
              status: 0,
              statusText: "FetchException",
              ok: false,
              error: options.networkError,
            };
          }

          const status = options.responseStatus ?? 200;
          return {
            status,
            statusText: options.responseStatusText ?? (status === 200 ? "OK" : status === 403 ? "Forbidden" : status === 401 ? "Unauthorized" : "Error"),
            ok: status >= 200 && status < 300,
            body: status === 200 ? { success: true } : {},
          };
        }
      }
      return {};
    },
  };

  if (options.simulatedScrollRequests) {
    mockPage.mouse = {
      wheel: async () => {
        scrollCount += 1;
        for (const simReq of options.simulatedScrollRequests ?? []) {
          for (const listener of requestListeners) {
            listener({
              url: () => simReq.url,
              method: () => "GET",
              headers: () => simReq.headers ?? {},
            });
          }
        }
      },
    } as unknown as Page["mouse"];
  }

  const context = {
    cookies: async () => options.cookies ?? [],
    pages: () => [mockPage as Page],
    newPage: async () => mockPage as Page,
    request: {
      get: async (url: string) => {
        requestCalls.push({ method: "GET", url });
        if (options.apiProbeTransportError) throw new Error(options.apiProbeTransportError);
        const status = options.apiProbeStatus ?? 200;
        return {
          status: () => status,
          headers: () => ({ "content-type": options.apiProbeContentType ?? "application/json" }),
          json: async () => {
            if (options.apiProbeJsonError) throw new Error("invalid json");
            return options.apiProbeBody ?? { ok: true };
          },
        };
      },
    },
    close: async () => {
      isClosed = true;
    },
  } as unknown as BrowserContext;

  return {
    context,
    closed: () => isClosed,
    evaluateCalls,
    visitedUrls,
    requestCalls,
    scrollCount: () => scrollCount,
  };
}

void test("buildNicknameUrl formats canonical endpoint with encoded botId and lineUserId", () => {
  const service = new LineChatSessionService();
  const url = service.buildNicknameUrl("U1234567890abcdef", "U9876543210fedcba");
  assert.equal(
    url,
    "https://chat.line.biz/api/v1/bots/U1234567890abcdef/chats/U9876543210fedcba/nickname"
  );
});

void test("buildChatRefererUrl formats canonical chat referer URL", () => {
  const service = new LineChatSessionService();
  const referer = service.buildChatRefererUrl("Ubot123", "Uuser456");
  assert.equal(referer, "https://chat.line.biz/Ubot123/chat/Uuser456");
});

void test("buildNicknamePayload returns object with trimmed nickname", () => {
  const service = new LineChatSessionService();
  assert.deepEqual(service.buildNicknamePayload("Find X9 สด 08/26"), {
    nickname: "Find X9 สด 08/26",
  });
});

void test("extractXsrfTokenFromCookies finds and decodes XSRF tokens from cookies", () => {
  const service = new LineChatSessionService();

  assert.equal(service.extractXsrfTokenFromCookies([]), undefined);
  assert.equal(
    service.extractXsrfTokenFromCookies([{ name: "XSRF-TOKEN", value: "test-token-123" }]),
    "test-token-123"
  );
  assert.equal(
    service.extractXsrfTokenFromCookies([{ name: "xsrf-token", value: "abc%20def" }]),
    "abc def"
  );
});

void test("validateInput enforces non-empty botId, lineUserId, nickname, and profilePath", () => {
  const service = new LineChatSessionService();

  assert.throws(
    () => service.validateInput({ lineUserId: "U1", nickname: "N", profilePath: "/p" }),
    /Missing or invalid bot ID/
  );
  assert.throws(
    () => service.validateInput({ botId: "B1", nickname: "N", profilePath: "/p" }),
    /Missing or invalid LINE user ID/
  );
  assert.throws(
    () => service.validateInput({ botId: "B1", lineUserId: "U1", profilePath: "/p" }),
    /Missing or invalid nickname/
  );
  assert.throws(
    () => service.validateInput({ botId: "B1", lineUserId: "U1", nickname: "N" }),
    /Missing or invalid profile path/
  );
});

void test("updateNickname with dryRun: true validates target without launching browser", async () => {
  let launcherCalled = false;
  const customLauncher: ContextLauncher = async () => {
    launcherCalled = true;
    throw new Error("Launcher should not be called in dry-run mode");
  };

  const service = new LineChatSessionService(customLauncher);
  const result = await service.updateNickname(
    {
      botId: "Utestbot",
      lineUserId: "Utestuser",
      nickname: "Find X9 สด 08/26",
      profilePath: "./local-data/test-profile",
      dryRun: true,
    },
    customLauncher
  );

  assert.equal(launcherCalled, false);
  assert.equal(result.success, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.botId, "Utestbot");
  assert.equal(result.lineUserId, "Utestuser");
  assert.equal(result.nickname, "Find X9 สด 08/26");
});

void test("updateNickname returns error if profile directory does not exist", async () => {
  const service = new LineChatSessionService();
  const nonExistentPath = path.join(os.tmpdir(), `non-existent-profile-${Date.now()}`);

  const result = await service.updateNickname({
    botId: "Utestbot",
    lineUserId: "Utestuser",
    nickname: "Online",
    profilePath: nonExistentPath,
    dryRun: false,
  });

  assert.equal(result.success, false);
  assert.ok(result.error?.includes("Profile directory does not exist"));
});

void test("updateNickname executes page-context fetch with intercepted runtime headers and returns 200", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));

  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "session-secret" }],
      simulatedBackgroundRequests: [
        {
          url: "https://chat.line.biz/api/v1/bots/Ubot123/info",
          headers: {
            "x-xsrf-token": "runtime-intercepted-xsrf",
            "x-oa-chat-client-version": "2.14.0",
          },
        },
      ],
      responseStatus: 200,
    });

    const customLauncher: ContextLauncher = async () => mock.context;
    const service = new LineChatSessionService(customLauncher);

    const result = await service.updateNickname(
      {
        botId: "Ubot123",
        lineUserId: "Uuser456",
        nickname: "Find X9 สด 08/26",
        profilePath: tempDir,
      },
      customLauncher
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 200);
    assert.equal(result.xsrfTokenFound, true);
    assert.equal(result.tokenSource, "network");
    assert.equal(result.clientVersionFound, true);
    assert.equal(mock.closed(), true);

    assert.equal(mock.evaluateCalls.length, 1);
    const call = mock.evaluateCalls[0];
    assert.equal(
      call.targetUrl,
      "https://chat.line.biz/api/v1/bots/Ubot123/chats/Uuser456/nickname"
    );
    assert.deepEqual(call.payload, { nickname: "Find X9 สด 08/26" });
    assert.equal(call.headers["X-Xsrf-Token"], "runtime-intercepted-xsrf");
    assert.equal(call.headers["X-Oa-Chat-Client-Version"], "2.14.0");
    assert.equal(call.headers["Referer"], "https://chat.line.biz/Ubot123/chat/Uuser456");
    assert.equal(call.headers["Origin"], "https://chat.line.biz");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("updateNickname on HTTP 401 returns clear unauthenticated error", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));

  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "expired" }],
      responseStatus: 401,
      responseStatusText: "Unauthorized",
    });

    const customLauncher: ContextLauncher = async () => mock.context;
    const service = new LineChatSessionService(customLauncher);

    const result = await service.updateNickname(
      {
        botId: "Ubot123",
        lineUserId: "Uuser456",
        nickname: "Online",
        profilePath: tempDir,
      },
      customLauncher
    );

    assert.equal(result.success, false);
    assert.equal(result.status, 401);
    assert.ok(result.error?.includes("LINE chat session is not authenticated or has expired"));
    assert.equal(mock.closed(), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("updateNickname on HTTP 403 returns refined error suggesting diagnostics", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));

  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "valid-session" }],
      responseStatus: 403,
      responseStatusText: "Forbidden",
    });

    const customLauncher: ContextLauncher = async () => mock.context;
    const service = new LineChatSessionService(customLauncher);

    const result = await service.updateNickname(
      {
        botId: "Ubot123",
        lineUserId: "Uuser456",
        nickname: "Online",
        profilePath: tempDir,
      },
      customLauncher
    );

    assert.equal(result.success, false);
    assert.equal(result.status, 403);
    assert.ok(result.error?.includes("LINE chat request was forbidden (HTTP 403)"));
    assert.ok(result.error?.includes("line-chat:diagnose"));
    assert.equal(mock.closed(), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("updateNickname on HTTP 404 returns not found error with botId and lineUserId context", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));

  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "valid" }],
      responseStatus: 404,
      responseStatusText: "Not Found",
    });

    const customLauncher: ContextLauncher = async () => mock.context;
    const service = new LineChatSessionService(customLauncher);

    const result = await service.updateNickname(
      {
        botId: "Ubot123",
        lineUserId: "Uuser456",
        nickname: "Online",
        profilePath: tempDir,
      },
      customLauncher
    );

    assert.equal(result.success, false);
    assert.equal(result.status, 404);
    assert.ok(result.error?.includes("LINE chat endpoint or resource not found (HTTP 404)"));
    assert.ok(result.error?.includes("Ubot123"));
    assert.ok(result.error?.includes("Uuser456"));
    assert.equal(mock.closed(), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("updateNickname on browser fetch failure returns network error and closes context", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));

  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "valid" }],
      networkError: "Failed to fetch / network disconnected",
    });

    const customLauncher: ContextLauncher = async () => mock.context;
    const service = new LineChatSessionService(customLauncher);

    const result = await service.updateNickname(
      {
        botId: "Ubot123",
        lineUserId: "Uuser456",
        nickname: "Online",
        profilePath: tempDir,
      },
      customLauncher
    );

    assert.equal(result.success, false);
    assert.ok(result.error?.includes("Network failure communicating with chat.line.biz"));
    assert.equal(mock.closed(), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics safely inspects cookies, storage, and background requests", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));

  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "secret" }, { name: "_ga", value: "analytics" }],
      localStorageKeys: ["theme", "user_prefs"],
      sessionStorageKeys: ["tab_id"],
      domMetaTags: ["csrf-token", "viewport"],
      simulatedBackgroundRequests: [
        {
          url: "https://chat.line.biz/api/v1/bots/Ubot123/chats",
          headers: {
            "x-xsrf-token": "runtime-token",
            "x-oa-chat-client-version": "1.0.0",
            origin: "https://chat.line.biz",
            referer: "https://chat.line.biz/Ubot123",
          },
        },
      ],
    });

    const customLauncher: ContextLauncher = async () => mock.context;
    const service = new LineChatSessionService(customLauncher);

    const diag = await service.runDiagnostics({
      profilePath: tempDir,
      botId: "Ubot123",
      lineUserId: "Uuser456",
      customLauncher,
    });

    assert.equal(diag.authenticated, true);
    assert.equal(diag.sessionStatePresent, true);
    assert.equal(diag.apiAuthenticated, "YES");
    assert.deepEqual(diag.apiAuthProbe, {
      endpoint: "/api/v1/me",
      transport: "SUCCEEDED",
      status: 200,
      contentType: "application/json",
      responseWasJson: true,
      topLevelKeyNames: ["ok"],
      authenticated: "YES",
    });
    assert.deepEqual(mock.visitedUrls, ["https://chat.line.biz/Ubot123/chat/Uuser456"]);
    assert.equal(diag.targetUrl, "https://chat.line.biz/Ubot123/chat/<customer-id-redacted>");
    assert.equal(diag.surface, "bot");
    assert.equal(diag.cookiesCount, 2);
    assert.equal(diag.cookieStatePresent, true);
    assert.equal(diag.localStoragePresent, true);
    assert.equal(diag.sessionStoragePresent, true);
    assert.equal(diag.xsrfTokenFound, true);
    assert.equal(diag.tokenSource, "network");
    assert.equal(diag.clientVersionFound, true);
    assert.equal(diag.observedRequests.length, 1);
    assert.equal(diag.observedRequests[0].hasXsrfHeader, true);
    assert.equal(diag.observedRequests[0].hasClientVersionHeader, true);
    assert.deepEqual(mock.requestCalls, [{ method: "GET", url: "https://chat.line.biz/api/v1/me" }]);
    assert.equal(mock.closed(), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics chat-list surface targets only the bot chat workspace", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));

  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "secret" }],
      simulatedBackgroundRequests: [
        {
          url: "https://chat.line.biz/api/v2/bots/Ubot123/chats?folderType=ALL&limit=25&cursor=secret-cursor",
          headers: {
            "x-xsrf-token": "secret-xsrf",
            "x-oa-chat-client-version": "1.0.0",
            origin: "https://chat.line.biz",
            referer: "https://chat.line.biz/Ubot123",
            cookie: "secret-cookie",
          },
        },
        {
          url: "https://chat-streaming-api.line.biz/api/v2/sse?token=secret-stream",
          headers: {},
        },
      ],
      simulatedResponses: [
        {
          url: "https://chat.line.biz/api/v2/bots/Ubot123/chats?folderType=ALL&limit=25&cursor=secret-cursor",
          status: 200,
          body: {
            items: [
              { id: "Ud-customer-id", displayName: "Customer name", message: "Private text" },
            ],
            nextCursor: "secret-next-cursor",
          },
        },
      ],
    });
    const customLauncher: ContextLauncher = async () => mock.context;
    const service = new LineChatSessionService(customLauncher);

    const diag = await service.runDiagnostics({
      profilePath: tempDir,
      botId: "Ubot123",
      surface: "chat-list",
      customLauncher,
    });

    assert.equal(diag.surface, "chat-list");
    assert.equal(diag.targetUrl, "https://chat.line.biz/Ubot123");
    assert.deepEqual(mock.visitedUrls, ["https://chat.line.biz/Ubot123"]);
    assert.equal(diag.observedRequests.length, 2);
    assert.deepEqual(diag.observedRequests[0]?.query, {
      parameterNames: ["folderType", "limit", "cursor"],
      safeScalars: { limit: "25" },
      redactedParameters: ["cursor=PRESENT_REDACTED"],
    });
    assert.equal(diag.observedResponses.length, 1);
    assert.equal(diag.chatListResponseObserved, true);
    assert.equal(diag.observedResponses[0]?.schema.topLevelType, "object");
    assert.deepEqual(diag.observedResponses[0]?.schema.arrayLengths, [{ path: "$.items", length: 1 }]);
    assert.deepEqual(diag.observedResponses[0]?.schema.paginationKeyNames, ["nextCursor"]);
    assert.equal(diag.restApiRequestsObserved, 1);
    assert.equal(diag.streamingSseObserved, true);
    assert.equal(diag.apiAuthenticated, "YES");
    assert.doesNotMatch(JSON.stringify(diag), /secret-xsrf|secret-cookie|secret-cursor|Customer name|Private text|Ud-customer-id/);
    assert.equal(mock.closed(), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics distinguishes cookie state from an API-authenticated 401", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "cookie-secret" }],
      apiProbeStatus: 401,
      apiProbeBody: { accountName: "private account" },
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({ profilePath: tempDir, botId: "Ubot123" });

    assert.equal(diag.sessionStatePresent, true);
    assert.equal(diag.apiAuthenticated, "NO");
    assert.equal(diag.authenticated, false);
    assert.equal(diag.apiAuthProbe.status, 401);
    assert.deepEqual(mock.requestCalls, [{ method: "GET", url: "https://chat.line.biz/api/v1/me" }]);
    assert.doesNotMatch(JSON.stringify(diag), /cookie-secret|private account/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics reports API authentication YES only for a successful /me probe", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "cookie-secret" }],
      apiProbeStatus: 200,
      apiProbeBody: { accountId: "account-secret", displayName: "private account" },
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({ profilePath: tempDir, botId: "Ubot123" });

    assert.equal(diag.sessionStatePresent, true);
    assert.equal(diag.apiAuthenticated, "YES");
    assert.equal(diag.authenticated, true);
    assert.deepEqual(diag.apiAuthProbe.topLevelKeyNames, ["accountId", "displayName"]);
    assert.doesNotMatch(JSON.stringify(diag), /account-secret|private account/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics reports UNKNOWN when the API auth probe transport fails", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      cookies: [{ name: "SES", value: "cookie-secret" }],
      apiProbeTransportError: "network unavailable",
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({ profilePath: tempDir, botId: "Ubot123" });

    assert.equal(diag.sessionStatePresent, true);
    assert.equal(diag.apiAuthenticated, "UNKNOWN");
    assert.equal(diag.authenticated, false);
    assert.equal(diag.apiAuthProbe.transport, "FAILED");
    assert.equal(diag.apiAuthProbe.status, undefined);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics keeps redirected API probe responses UNKNOWN", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      apiProbeStatus: 302,
      apiProbeBody: { location: "https://accounts.line.biz/login?code=secret" },
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({ profilePath: tempDir, botId: "Ubot123" });

    assert.equal(diag.apiAuthProbe.status, 302);
    assert.equal(diag.apiAuthenticated, "UNKNOWN");
    assert.doesNotMatch(JSON.stringify(diag), /accounts\.line\.biz|secret/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics sanitizes redirects and recognizes an authentication destination", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      finalPageUrl: "https://accounts.line.biz/login?code=oauth-secret&state=state-secret",
      documentTitle: "Sign in to LINE",
      navigationStatus: 200,
      apiProbeStatus: 401,
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({
      profilePath: tempDir,
      botId: "Ubot123",
      surface: "chat-list",
      chatListResponseTimeoutMs: 5,
    });

    assert.equal(diag.navigationSucceeded, true);
    assert.equal(diag.finalPageUrl, "https://accounts.line.biz/login");
    assert.equal(diag.finalOrigin, "https://accounts.line.biz");
    assert.equal(diag.finalPath, "/login");
    assert.equal(diag.finalOriginIsChatLine, false);
    assert.equal(diag.finalPathMatchesWorkspace, false);
    assert.equal(diag.authDestinationDetected, true);
    assert.equal(diag.redirected, true);
    assert.equal(diag.documentTitle, "Sign in to LINE");
    assert.equal(diag.mainDocumentStatus, 200);
    assert.doesNotMatch(JSON.stringify(diag), /oauth-secret|state-secret/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics recognizes the requested chat-line workspace after navigation", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      finalPageUrl: "https://chat.line.biz/Ubot123",
      navigationStatus: 200,
      apiProbeStatus: 200,
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({
      profilePath: tempDir,
      botId: "Ubot123",
      surface: "chat-list",
      chatListResponseTimeoutMs: 5,
    });

    assert.equal(diag.finalOriginIsChatLine, true);
    assert.equal(diag.finalPathMatchesWorkspace, true);
    assert.equal(diag.authDestinationDetected, false);
    assert.equal(diag.redirected, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics ignores the guessed v1 chat-list path and reports NOT OBSERVED", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      apiProbeStatus: 200,
      simulatedResponses: [{
        url: "https://chat.line.biz/api/v1/bots/Ubot123/chats?limit=25",
        status: 200,
        body: { items: [{ id: "Ud-v1-id", displayName: "v1 customer" }] },
      }],
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({
      profilePath: tempDir,
      botId: "Ubot123",
      surface: "chat-list",
      chatListResponseTimeoutMs: 5,
    });

    assert.equal(diag.targetUrl, "https://chat.line.biz/Ubot123");
    assert.equal(diag.chatListResponseObserved, false);
    assert.equal(diag.observedResponses.length, 1);
    assert.doesNotMatch(JSON.stringify(diag), /Ud-v1-id|v1 customer/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics awaits a late matching chat-list response summary", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      apiProbeStatus: 200,
      responseDelayMs: 10,
      simulatedResponses: [{
        url: "https://chat.line.biz/api/v2/bots/Ubot123/chats?limit=25",
        status: 200,
        body: {
          chats: [{ id: "Ud-late-id", displayName: "Late customer", message: "Private text" }],
          nextCursor: "secret-cursor",
        },
      }],
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({
      profilePath: tempDir,
      botId: "Ubot123",
      surface: "chat-list",
      chatListResponseTimeoutMs: 100,
    });

    assert.equal(diag.chatListResponseObserved, true);
    assert.equal(diag.observedResponses.length, 1);
    assert.equal(diag.observedResponses[0]?.status, 200);
    assert.equal(diag.observedResponses[0]?.schema.topLevelType, "object");
    assert.deepEqual(diag.observedResponses[0]?.schema.arrayLengths, [{ path: "$.chats", length: 1 }]);
    assert.deepEqual(diag.observedResponses[0]?.schema.paginationKeyNames, ["nextCursor"]);
    assert.doesNotMatch(JSON.stringify(diag), /Ud-late-id|Late customer|Private text|secret-cursor/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics passively observes a natural second-page request after scrolling", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const mock = createMockPageContext({
      apiProbeStatus: 200,
      simulatedBackgroundRequests: [{
        url: "https://chat.line.biz/api/v2/bots/Ubot123/chats?folderType=ALL&limit=25",
        headers: { "x-xsrf-token": "secret-xsrf" },
      }],
      simulatedResponses: [{
        url: "https://chat.line.biz/api/v2/bots/Ubot123/chats?folderType=ALL&limit=25",
        status: 200,
        body: {
          list: [
            { chatId: "Ud1234567890abcdef", userId: "Udabcdef1234567890", name: "Customer One" },
            { chatId: "Udqwerty12345678", userId: "Udqwerty12345678" },
          ],
          next: "opaque-next-token",
        },
      }],
      simulatedScrollRequests: [{
        url: "https://chat.line.biz/api/v2/bots/Ubot123/chats?folderType=ALL&limit=25&cursor=secret-cursor",
        headers: { "x-xsrf-token": "secret-xsrf" },
      }],
    });
    const service = new LineChatSessionService(async () => mock.context);
    const diag = await service.runDiagnostics({
      profilePath: tempDir,
      botId: "Ubot123",
      surface: "chat-list",
      chatListResponseTimeoutMs: 100,
      chatListSecondPageTimeoutMs: 100,
    });

    assert.equal(mock.scrollCount(), 1);
    assert.equal(diag.chatListResponseObserved, true);
    assert.deepEqual(diag.chatListFirstPageQueryNames, ["folderType", "limit"]);
    assert.equal(diag.secondPageRequestObserved, true);
    assert.deepEqual(diag.secondPageQueryNames, ["folderType", "limit", "cursor"]);
    assert.deepEqual(diag.secondPageNewQueryNames, ["cursor"]);
    assert.equal(diag.chatListIdentifierShape?.listCount, 2);
    assert.equal(diag.chatListIdentifierShape?.chatId.matchesUdPattern, 2);
    assert.equal(diag.chatListIdentifierShape?.userId.matchesUdPattern, 2);
    assert.equal(diag.chatListPagination?.nextStringClassification, "OPAQUE_TOKEN");
    assert.equal(diag.chatListPagination?.nextLengthBucket, "1-32");
    assert.deepEqual(mock.requestCalls, [{ method: "GET", url: "https://chat.line.biz/api/v1/me" }]);
    assert.doesNotMatch(JSON.stringify(diag), /Ud1234567890abcdef|Customer One|opaque-next-token|secret-cursor|secret-xsrf/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

void test("runDiagnostics rejects the chat-list surface when no bot is supplied", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "line-chat-test-"));
  try {
    const service = new LineChatSessionService(async () => {
      throw new Error("launcher must not run");
    });
    await assert.rejects(
      () => service.runDiagnostics({ profilePath: tempDir, surface: "chat-list" }),
      /chat-list diagnostic surface requires --bot/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
