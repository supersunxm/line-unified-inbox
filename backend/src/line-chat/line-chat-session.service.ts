import { Injectable, Optional } from "@nestjs/common";
import * as path from "node:path";
import * as fs from "node:fs";
import { chromium, type BrowserContext, type Page, type Response } from "playwright";
import type {
  LineChatDiscoveredChat,
  UpdateNicknameInput,
  UpdateNicknameResult,
  LineChatSessionOptions,
  LineChatSessionValidation,
  DiagnosticsResult,
  DiagnosticApiAuthProbe,
  DiagnosticQueryMetadata,
  LineChatDiscoveryResult,
  LineChatRecentDiscoveryResult,
  ObservedRequestSummary,
} from "./line-chat.types";
import { parseLineChatListPage } from "./line-chat-chat-discovery";
import {
  diagnosticResponseParseFailure,
  isChatLineOrigin,
  isLoginLikeNavigationUrl,
  isRequestedWorkspacePath,
  isRelevantDiagnosticUrl,
  sanitizeDiagnosticUrl,
  sanitizeNavigationMetadata,
  summarizeChatListContractJson,
  summarizeDiagnosticJson,
} from "./line-chat-diagnostic-metadata";

export type ContextLauncher = (
  userDataDir: string,
  options?: LineChatSessionOptions
) => Promise<BrowserContext>;

function isObservedChatListUrl(rawUrl: string, botId: string): boolean {
  try {
    const responseUrl = new URL(rawUrl);
    const expectedPath = `/api/v2/bots/${encodeURIComponent(botId)}/chats`;
    return (
      responseUrl.origin === "https://chat.line.biz"
      && responseUrl.pathname === expectedPath
    );
  } catch {
    return false;
  }
}

function isObservedChatListResponse(response: Response, botId: string): boolean {
  try {
    return response.request().method() === "GET" && isObservedChatListUrl(response.url(), botId);
  } catch {
    return false;
  }
}

const CHAT_LIST_WHEEL_TARGETS = [0.15, 0.25, 0.35] as const;
const CHAT_LIST_WHEEL_Y_FRACTION = 0.75;
const CHAT_LIST_WHEEL_DELTAS = [600, 900, 1200] as const;

function sanitizeSecondPageQueryMetadata(query: DiagnosticQueryMetadata): DiagnosticQueryMetadata {
  const safeScalars: Record<string, string> = {};
  const redactedParameters: string[] = [];
  for (const name of query.parameterNames) {
    if (name.toLowerCase() === "limit" && query.safeScalars[name] !== undefined) {
      safeScalars[name] = query.safeScalars[name];
    } else {
      redactedParameters.push(`${name}=PRESENT_REDACTED`);
    }
  }
  return {
    parameterNames: [...query.parameterNames],
    safeScalars,
    redactedParameters,
  };
}

async function wheelChatListViewportRegion(
  page: Page,
  xFraction: number,
  shouldStop: () => boolean,
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Chat-list diagnostic viewport is unavailable.");
  await page.mouse.move(
    Math.round(viewport.width * xFraction),
    Math.round(viewport.height * CHAT_LIST_WHEEL_Y_FRACTION),
  );
  for (const deltaY of CHAT_LIST_WHEEL_DELTAS) {
    if (shouldStop()) break;
    await page.mouse.wheel(0, deltaY);
  }
}

export interface LineChatCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export interface PageEvaluateFetchResponse {
  status: number;
  statusText: string;
  ok: boolean;
  body?: unknown;
  error?: string;
}

export interface PageExecutor {
  evaluateFetch: (options: {
    targetUrl: string;
    payload: { nickname: string };
    customHeaders: Record<string, string>;
  }) => Promise<PageEvaluateFetchResponse>;
  inspectRuntime: () => Promise<{
    metaTags: string[];
    cookieNames: string[];
    localStorageKeys: string[];
    sessionStorageKeys: string[];
    windowProperties: string[];
  }>;
}

@Injectable()
export class LineChatSessionService {
  private readonly defaultLauncher: ContextLauncher;

  constructor(@Optional() customLauncher?: ContextLauncher) {
    this.defaultLauncher =
      customLauncher ??
      ((dir, opts) => this.launchPlaywrightPersistentContext(dir, opts));
  }

  /**
   * Resolves the filesystem path for a given LineChatSession model,
   * supporting logical profileStorageKey and LINE_CHAT_PROFILE_ROOT environment variable.
   * Strictly validates that the resolved path does not escape the configured profile root directory.
   */
  public resolveProfilePath(session: {
    profileStorageKey?: string | null;
    sessionKey?: string | null;
    profilePath?: string | null;
  }): string {
    const isProduction = process.env.NODE_ENV === "production";
    const configuredRoot = process.env.LINE_CHAT_PROFILE_ROOT?.trim();
    const rootDir = path.resolve(configuredRoot || (isProduction ? "/data/line-chat-profiles" : "./local-data"));

    const storageKey = session.profileStorageKey?.trim() || session.sessionKey?.trim();
    if (storageKey) {
      const sanitizedKey = storageKey.replace(/[^a-zA-Z0-9_-]/g, "");
      const directResolved = path.resolve(rootDir, sanitizedKey || "default");
      if (!isProduction && !configuredRoot) {
        // In local development, check both exact key and prefixed 'line-chat-${key}' in rootDir and backend/local-data
        const candidates = [
          directResolved,
          path.resolve(rootDir, `line-chat-${sanitizedKey}`),
          path.resolve("./backend/local-data", sanitizedKey),
          path.resolve("./backend/local-data", `line-chat-${sanitizedKey}`),
          path.resolve("../local-data", sanitizedKey),
          path.resolve("../local-data", `line-chat-${sanitizedKey}`),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) return candidate;
        }
      }
      if (directResolved !== rootDir && !directResolved.startsWith(`${rootDir}${path.sep}`)) {
        throw new Error(`Resolved profile path "${directResolved}" escapes configured root directory "${rootDir}"`);
      }
      return directResolved;
    }

    if (session.profilePath?.trim()) {
      const rawResolved = path.resolve(session.profilePath.trim());
      if ((isProduction || configuredRoot) && rawResolved !== rootDir && !rawResolved.startsWith(`${rootDir}${path.sep}`)) {
        throw new Error(`Resolved profile path "${rawResolved}" escapes configured root directory "${rootDir}"`);
      }
      return rawResolved;
    }

    return path.resolve(rootDir, "default");
  }

  /**
   * Constructs the canonical LINE Official Account Manager nickname endpoint URL.
   */
  public buildNicknameUrl(botId: string, lineUserId: string): string {
    const trimmedBotId = botId.trim();
    const trimmedUserId = lineUserId.trim();
    return `https://chat.line.biz/api/v1/bots/${encodeURIComponent(trimmedBotId)}/chats/${encodeURIComponent(trimmedUserId)}/nickname`;
  }

  /**
   * Constructs the canonical Referer URL matching the chat page for the customer.
   */
  public buildChatRefererUrl(botId: string, lineUserId: string): string {
    const trimmedBotId = botId.trim();
    const trimmedUserId = lineUserId.trim();
    return `https://chat.line.biz/${encodeURIComponent(trimmedBotId)}/chat/${encodeURIComponent(trimmedUserId)}`;
  }

  /** Builds the production-verified v2 chat-list endpoint shape. */
  public buildChatListUrl(botId: string): string {
    return `https://chat.line.biz/api/v2/bots/${encodeURIComponent(botId.trim())}/chats`;
  }

  /**
   * Enumerates the production-verified v2 chat list. Page one is captured from
   * the SPA's natural GET after navigating to the bot workspace. Later pages
   * reuse only the observed first-page query semantics and authenticated
   * request headers, adding the opaque `next` value internally. No raw values
   * are returned in the discovery result.
   */
  public async discoverChats(input: {
    botId: string;
    profilePath: string;
    headless?: boolean;
    customLauncher?: ContextLauncher;
  }): Promise<LineChatDiscoveryResult> {
    return this.discoverChatPages(input, 200, 10_000, false);
  }

  /**
   * Reads only the bounded, most-recent chat window used by the realtime
   * nickname resolver. This deliberately does not claim full enumeration.
   */
  public async discoverRecentChats(input: {
    botId: string;
    profilePath: string;
    headless?: boolean;
    customLauncher?: ContextLauncher;
    maxPages?: number;
    maxChats?: number;
    operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext;
  }): Promise<LineChatRecentDiscoveryResult> {
    const maxPages = Math.min(5, Math.max(1, input.maxPages ?? 5));
    const maxChats = Math.min(125, Math.max(1, input.maxChats ?? 125));
    const result = await this.discoverChatPages(input, maxPages, maxChats, true);
    const failure = result.pagesFetched === 0
      || Boolean(result.enumerationError)
      || result.invalidUserRecords > 0
      || result.conflictingDuplicates > 0;
    if (failure) {
      const authFailure = /HTTP (401|403)/u.test(result.enumerationError ?? "");
      return {
        status: "FAILED",
        chats: [],
        pagesFetched: result.pagesFetched,
        totalRawRecords: result.totalRawRecords,
        failureReason: authFailure ? "SESSION_AUTH" : "TRANSPORT",
      };
    }
    return {
      status: "READY",
      chats: result.chats,
      pagesFetched: result.pagesFetched,
      totalRawRecords: result.totalRawRecords,
    };
  }

  private async discoverChatPages(input: {
    botId: string;
    profilePath: string;
    headless?: boolean;
    customLauncher?: ContextLauncher;
    operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext;
  }, maxPages: number, maxChats: number, boundedWindow: boolean): Promise<LineChatDiscoveryResult> {
    const botId = input.botId.trim();
    if (!botId) throw new Error("Missing LINE OA Manager bot ID.");

    const resolvedProfile = path.resolve(input.profilePath);
    if (!fs.existsSync(resolvedProfile)) {
      throw new Error(`Profile directory does not exist at "${resolvedProfile}". Run npm run line-chat:login first.`);
    }

    const launcher = input.customLauncher ?? this.defaultLauncher;
    input.operationContext?.assertOwnership();
    const context = await launcher(resolvedProfile, {
      profilePath: resolvedProfile,
      headless: input.headless ?? true,
    });
    const endpoint = this.buildChatListUrl(botId);

    try {
      const page = context.pages()[0] || (await context.newPage());
      const requestContext = context.request;
      if (!requestContext || typeof requestContext.get !== "function") {
        return this.emptyDiscoveryResult(botId, endpoint, "LINE OA Manager chat-list natural GET was not available.");
      }

      const firstRequestWait = new Promise<{ url: string; headers: Record<string, string> }>((resolve) => {
        const onRequest = (request: { method: () => string; url: () => string; headers: () => Record<string, string> }) => {
          if (request.method() !== "GET" || !this.isChatListEndpoint(request.url(), botId)) return;
          const allHeaders = request.headers();
          const headers: Record<string, string> = { Accept: "application/json, text/plain, */*" };
          for (const [name, value] of Object.entries(allHeaders)) {
            if (["x-xsrf-token", "x-oa-chat-client-version", "referer", "origin"].includes(name.toLowerCase())) {
              headers[name] = value;
            }
          }
          resolve({ url: request.url(), headers });
        };
        page.on("request", onRequest);
      });
      const firstResponseWait = new Promise<{ status: number; response: Response }>((resolve) => {
        page.on("response", (response: Response) => {
          if (this.isChatListResponse(response, botId)) resolve({ status: response.status(), response });
        });
      });

      try {
        input.operationContext?.assertOwnership();
        await page.goto(`https://chat.line.biz/${encodeURIComponent(botId)}`, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
      } catch {
        // Natural background requests may still complete after navigation timeout.
      }

      const firstRequest = await this.withTimeout(firstRequestWait, 20000);
      if (!firstRequest) return this.emptyDiscoveryResult(botId, endpoint, "LINE OA Manager v2 chat-list natural GET was not observed.");
      const firstResponse = await this.withTimeout(firstResponseWait, 20000);
      if (!firstResponse) return this.emptyDiscoveryResult(botId, endpoint, "LINE OA Manager v2 chat-list response was not observed.", "UNVERIFIED");
      if (firstResponse.status !== 200) {
        return this.emptyDiscoveryResult(botId, endpoint, `LINE OA Manager chat-list returned HTTP ${firstResponse.status}`, "PARTIAL");
      }

      const firstPageBody = await this.readJsonResponse(firstResponse.response);
      if (!firstPageBody.ok) return this.emptyDiscoveryResult(botId, endpoint, firstPageBody.error, "PARTIAL");
      let firstPage;
      try {
        firstPage = parseLineChatListPage(firstPageBody.body);
      } catch {
        return this.emptyDiscoveryResult(botId, endpoint, "LINE OA Manager v2 chat-list response had an unsupported or malformed envelope.", "PARTIAL");
      }
      const pages = [firstPage];
      const byId = new Map<string, LineChatDiscoveredChat>();
      let duplicateIds = 0;
      const conflictingIds = new Set<string>();
      const mergePage = (pageResult: typeof firstPage): void => {
        for (const chat of pageResult.chats) {
          const previous = byId.get(chat.chatUserId);
          if (!previous) {
            byId.set(chat.chatUserId, chat);
          } else {
            duplicateIds += 1;
            if (JSON.stringify(previous) !== JSON.stringify(chat)) conflictingIds.add(chat.chatUserId);
          }
        }
      };
      mergePage(firstPage);
      let next = firstPage.next;
      const seenNext = new Set<string>();
      let enumerationError: string | undefined = byId.size > maxChats
        ? "Chat-list discovered-chat limit reached."
        : undefined;
      while (next !== null) {
        if (seenNext.has(next)) {
          enumerationError = "Repeated chat-list next token detected.";
          break;
        }
        seenNext.add(next);
        if (pages.length >= maxPages) {
          if (!boundedWindow) enumerationError = "Chat-list page limit reached.";
          break;
        }
        if (byId.size >= maxChats) {
          if (!boundedWindow) enumerationError = "Chat-list discovered-chat limit reached.";
          break;
        }
        const nextUrl = new URL(firstRequest.url);
        nextUrl.searchParams.set("next", next);
        let response;
        try {
          input.operationContext?.assertOwnership();
          response = await requestContext.get(nextUrl.toString(), {
            headers: firstRequest.headers,
            timeout: 15000,
          });
        } catch {
          enumerationError = "LINE OA Manager chat-list transport failed on a subsequent page.";
          break;
        }
        if (response.status() !== 200) {
          enumerationError = `LINE OA Manager chat-list returned HTTP ${response.status()} on a subsequent page`;
          break;
        }
        const body = await this.readJsonResponse(response);
        if (!body.ok) {
          enumerationError = body.error;
          break;
        }
        let parsedPage;
        try {
          parsedPage = parseLineChatListPage(body.body);
        } catch {
          enumerationError = "LINE OA Manager v2 chat-list response had an unsupported or malformed envelope.";
          break;
        }
        pages.push(parsedPage);
        mergePage(parsedPage);
        if (byId.size > maxChats) {
          enumerationError = "Chat-list discovered-chat limit reached.";
          break;
        }
        next = parsedPage.next;
      }

      const invalidUserRecords = pages.reduce((sum, item) => sum + item.invalidUserRecords, 0);
      const complete = next === null && !enumerationError && invalidUserRecords === 0 && conflictingIds.size === 0;
      return {
        botId,
        endpoint,
        responseShape: "list",
        enumerationStatus: complete ? "COMPLETE" : "PARTIAL",
        chats: [...byId.values()],
        pagesFetched: pages.length,
        totalRawRecords: pages.reduce((sum, item) => sum + item.totalRawRecords, 0),
        validUserChats: pages.reduce((sum, item) => sum + item.validUserChats, 0),
        ignoredNonUserRecords: pages.reduce((sum, item) => sum + item.ignoredNonUserRecords, 0),
        invalidUserRecords,
        duplicateIds,
        conflictingDuplicates: conflictingIds.size,
        nextTerminationObserved: next === null,
        ...(enumerationError ? { enumerationError } : {}),
      };
    } finally {
      await context.close();
    }
  }

  private isChatListEndpoint(rawUrl: string, botId: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      return parsed.origin === "https://chat.line.biz"
        && parsed.pathname === `/api/v2/bots/${encodeURIComponent(botId)}/chats`;
    } catch {
      return false;
    }
  }

  private isChatListResponse(response: Response, botId: string): boolean {
    try {
      return response.request().method() === "GET" && this.isChatListEndpoint(response.url(), botId);
    } catch {
      return false;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
    return Promise.race([
      promise,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs)),
    ]);
  }

  private async readJsonResponse(response: { json: () => Promise<unknown> }): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
    try {
      return { ok: true, body: await response.json() };
    } catch {
      return { ok: false, error: "LINE OA Manager chat-list response was not JSON" };
    }
  }

  private emptyDiscoveryResult(
    botId: string,
    endpoint: string,
    enumerationError: string,
    enumerationStatus: "PARTIAL" | "UNVERIFIED" = "UNVERIFIED",
  ): LineChatDiscoveryResult {
    return {
      botId,
      endpoint,
      responseShape: "list",
      enumerationStatus,
      chats: [],
      pagesFetched: 0,
      totalRawRecords: 0,
      validUserChats: 0,
      ignoredNonUserRecords: 0,
      invalidUserRecords: 0,
      duplicateIds: 0,
      conflictingDuplicates: 0,
      nextTerminationObserved: false,
      enumerationError,
    };
  }

  /**
   * Constructs the JSON payload for nickname update.
   */
  public buildNicknamePayload(nickname: string): { nickname: string } {
    return { nickname: nickname.trim() };
  }

  /**
   * Safely extracts XSRF token from session cookies if present.
   * Never exposes or logs raw cookie strings.
   */
  public extractXsrfTokenFromCookies(cookies: readonly LineChatCookie[]): string | undefined {
    const xsrfCookie = cookies.find((c) =>
      /^(XSRF-TOKEN|_csrf|csrf_token|X-XSRF-TOKEN|csrfToken|xsrfToken|csrf)$/i.test(c.name)
    );
    if (!xsrfCookie?.value) {
      return undefined;
    }
    try {
      return decodeURIComponent(xsrfCookie.value);
    } catch {
      return xsrfCookie.value;
    }
  }

  /**
   * Validates bot ID, LINE user ID, nickname, and profile path.
   * Throws an Error with a user-friendly message if invalid.
   */
  public validateInput(input: Partial<UpdateNicknameInput>): {
    botId: string;
    lineUserId: string;
    nickname: string;
    profilePath: string;
  } {
    const botId = input.botId?.trim();
    if (!botId) {
      throw new Error("Missing or invalid bot ID (--bot). It must be a non-empty string.");
    }

    const lineUserId = input.lineUserId?.trim();
    if (!lineUserId) {
      throw new Error("Missing or invalid LINE user ID (--user). It must be a non-empty string.");
    }

    const nickname = input.nickname?.trim();
    if (!nickname) {
      throw new Error("Missing or invalid nickname (--nickname). It must be a non-empty string.");
    }

    const profilePath = input.profilePath?.trim();
    if (!profilePath) {
      throw new Error("Missing or invalid profile path (--profile). It must be a non-empty path.");
    }

    return { botId, lineUserId, nickname, profilePath };
  }

  /**
   * Inspects browser context and page runtime state to extract CSRF/XSRF tokens and storage metadata.
   */
  public async inspectSession(
    context: BrowserContext,
    page?: Page,
    networkIntercepted?: { xsrfToken?: string; clientVersion?: string }
  ): Promise<LineChatSessionValidation> {
    try {
      const cookies = await context.cookies([
        "https://chat.line.biz",
        "https://line.biz",
        "https://manager.line.biz",
      ]);
      const cookieNames = cookies.map((c) => c.name);
      const cookieToken = this.extractXsrfTokenFromCookies(cookies);

      let localStorageKeys: string[] = [];
      let sessionStorageKeys: string[] = [];
      let domToken: string | undefined;
      let runtimeClientVersion: string | undefined;

      if (page && !page.isClosed()) {
        try {
          const domState = await page.evaluate(() => {
            const lsKeys = Object.keys(window.localStorage || {});
            const ssKeys = Object.keys(window.sessionStorage || {});

            const metaCsrf =
              document.querySelector('meta[name="csrf-token" i]')?.getAttribute("content") ||
              document.querySelector('meta[name="_csrf" i]')?.getAttribute("content") ||
              document.querySelector('meta[name="x-xsrf-token" i]')?.getAttribute("content");

            let storageCsrf: string | undefined;
            for (const k of lsKeys) {
              if (/^(xsrf|csrf|token)/i.test(k)) {
                const val = window.localStorage.getItem(k);
                if (val && val.length > 5 && !storageCsrf) storageCsrf = val;
              }
            }
            for (const k of ssKeys) {
              if (/^(xsrf|csrf|token)/i.test(k)) {
                const val = window.sessionStorage.getItem(k);
                if (val && val.length > 5 && !storageCsrf) storageCsrf = val;
              }
            }

            const win = window as unknown as Record<string, unknown>;
            const winCsrf =
              (typeof win.__CSRF_TOKEN__ === "string" && win.__CSRF_TOKEN__) ||
              (typeof win.csrfToken === "string" && win.csrfToken) ||
              (typeof win.xsrfToken === "string" && win.xsrfToken) ||
              undefined;

            const winVersion =
              (typeof win.__APP_VERSION__ === "string" && win.__APP_VERSION__) ||
              (typeof win.__CLIENT_VERSION__ === "string" && win.__CLIENT_VERSION__) ||
              undefined;

            return {
              localStorageKeys: lsKeys,
              sessionStorageKeys: ssKeys,
              domToken: metaCsrf || storageCsrf || winCsrf,
              clientVersion: winVersion,
            };
          });

          localStorageKeys = domState.localStorageKeys;
          sessionStorageKeys = domState.sessionStorageKeys;
          domToken = domState.domToken;
          runtimeClientVersion = domState.clientVersion;
        } catch {
          // Evaluation failed (e.g. navigation in flight)
        }
      }

      let resolvedToken = networkIntercepted?.xsrfToken;
      let tokenSource: "cookie" | "meta" | "storage" | "network" | "window" | "none" = "network";

      if (!resolvedToken && cookieToken) {
        resolvedToken = cookieToken;
        tokenSource = "cookie";
      } else if (!resolvedToken && domToken) {
        resolvedToken = domToken;
        tokenSource = "storage";
      } else if (!resolvedToken) {
        tokenSource = "none";
      }

      const clientVersion = networkIntercepted?.clientVersion || runtimeClientVersion;
      const hasAuth = cookies.length > 0 || Boolean(resolvedToken);

      return {
        authenticated: hasAuth,
        xsrfToken: resolvedToken,
        tokenSource,
        clientVersion,
        cookiesCount: cookies.length,
        cookieNames,
        localStorageKeys,
        sessionStorageKeys,
        message: hasAuth
          ? "Session state found."
          : "No authentication cookies or tokens found in persistent profile.",
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        authenticated: false,
        cookiesCount: 0,
        cookieNames: [],
        localStorageKeys: [],
        sessionStorageKeys: [],
        tokenSource: "none",
        message: `Failed to inspect session: ${errorMsg}`,
      };
    }
  }

  /**
   * Updates a customer's nickname in LINE OA Chat via the authenticated page session.
   */
  public async updateNickname(
    input: UpdateNicknameInput,
    customLauncher?: ContextLauncher
  ): Promise<UpdateNicknameResult> {
    const { botId, lineUserId, nickname, profilePath } = this.validateInput(input);
    const resolvedProfile = path.resolve(profilePath);
    input.operationContext?.assertOwnership();

    if (input.dryRun) {
      return {
        success: true,
        dryRun: true,
        botId,
        lineUserId,
        nickname,
        profilePath: resolvedProfile,
        message: `[DRY-RUN] Target verified: Bot ID = ${botId}, User ID = ${lineUserId}, Nickname = "${nickname}". No request sent.`,
      };
    }

    if (!fs.existsSync(resolvedProfile)) {
      return {
        success: false,
        dryRun: false,
        botId,
        lineUserId,
        nickname,
        profilePath: resolvedProfile,
        error: `Profile directory does not exist at "${resolvedProfile}". Please run the login command first: npm run line-chat:login -- --profile ${profilePath}`,
      };
    }

    const launcher = customLauncher ?? this.defaultLauncher;
    let context: BrowserContext | null = null;

    try {
      context = await launcher(resolvedProfile, {
        profilePath: resolvedProfile,
        headless: input.headless ?? true,
      });

      const page = context.pages()[0] || (await context.newPage());
      input.operationContext?.assertOwnership();

      // Network listener to intercept headers used by the real LINE web application
      let interceptedXsrfToken: string | undefined;
      let interceptedClientVersion: string | undefined;

      page.on("request", (req) => {
        try {
          const headers = req.headers();
          const xsrf = headers["x-xsrf-token"];
          const ver = headers["x-oa-chat-client-version"];
          if (xsrf && !interceptedXsrfToken) {
            interceptedXsrfToken = xsrf;
          }
          if (ver && !interceptedClientVersion) {
            interceptedClientVersion = ver;
          }
        } catch {
          // Ignore header access errors
        }
      });

      const chatPageUrl = this.buildChatRefererUrl(botId, lineUserId);
      const nicknameUrl = this.buildNicknameUrl(botId, lineUserId);

      // Navigate to the target chat page to initialize LINE app session context
      try {
        input.operationContext?.assertOwnership();
        await page.goto(chatPageUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
      } catch {
        // Continue even if navigation times out waiting for external resources
      }

      // Allow background bootstrap requests to fire
      await page.waitForTimeout(1000).catch(() => {});

      input.operationContext?.assertOwnership();
      const sessionValidation = await this.inspectSession(context, page, {
        xsrfToken: interceptedXsrfToken,
        clientVersion: interceptedClientVersion,
      });

      const xsrfToken = sessionValidation.xsrfToken;
      const clientVersion = sessionValidation.clientVersion;
      const tokenSource = sessionValidation.tokenSource ?? "none";

      const customHeaders: Record<string, string> = {
        Referer: chatPageUrl,
        Origin: "https://chat.line.biz",
      };

      if (xsrfToken) {
        customHeaders["X-Xsrf-Token"] = xsrfToken;
      }
      if (clientVersion) {
        customHeaders["X-Oa-Chat-Client-Version"] = clientVersion;
      }

      // Execute PUT request from within the authenticated page's execution context
      input.operationContext?.assertOwnership();
      const fetchResult = await page.evaluate(
        async ({ targetUrl, payload, headers }) => {
          try {
            const response = await fetch(targetUrl, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/plain, */*",
                ...headers,
              },
              body: JSON.stringify(payload),
              credentials: "include",
            });

            let responseData: unknown = null;
            try {
              responseData = await response.json();
            } catch {
              // Non-JSON response
            }

            return {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              body: responseData,
            };
          } catch (fetchErr: unknown) {
            return {
              status: 0,
              statusText: "FetchException",
              ok: false,
              error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
            };
          }
        },
        {
          targetUrl: nicknameUrl,
          payload: { nickname },
          headers: customHeaders,
        }
      );

      const status = fetchResult.status;

      if (status >= 200 && status < 300) {
        return {
          success: true,
          dryRun: false,
          botId,
          lineUserId,
          nickname,
          profilePath: resolvedProfile,
          status,
          message: `Successfully updated customer nickname to "${nickname}" on LINE Official Account Chat.`,
          xsrfTokenFound: Boolean(xsrfToken),
          tokenSource,
          clientVersionFound: Boolean(clientVersion),
        };
      }

      if (status === 401) {
        return {
          success: false,
          dryRun: false,
          botId,
          lineUserId,
          nickname,
          profilePath: resolvedProfile,
          status: 401,
          error: `LINE chat session is not authenticated or has expired (HTTP 401). Please re-run the login command for this profile: npm run line-chat:login -- --profile ${profilePath}`,
          xsrfTokenFound: Boolean(xsrfToken),
          tokenSource,
        };
      }

      if (status === 403) {
        return {
          success: false,
          dryRun: false,
          botId,
          lineUserId,
          nickname,
          profilePath: resolvedProfile,
          status: 403,
          error: `LINE chat request was forbidden (HTTP 403). Possible causes: missing/invalid CSRF token, insufficient bot permissions, or missing client headers. Run diagnostics to inspect session: npm run line-chat:diagnose -- --profile ${profilePath} --bot ${botId} --user ${lineUserId}`,
          xsrfTokenFound: Boolean(xsrfToken),
          tokenSource,
        };
      }

      if (status === 404) {
        return {
          success: false,
          dryRun: false,
          botId,
          lineUserId,
          nickname,
          profilePath: resolvedProfile,
          status: 404,
          error: `LINE chat endpoint or resource not found (HTTP 404). Verify that bot ID (${botId}) and LINE User ID (${lineUserId}) exist on this account.`,
          xsrfTokenFound: Boolean(xsrfToken),
          tokenSource,
        };
      }

      if (status === 0) {
        return {
          success: false,
          dryRun: false,
          botId,
          lineUserId,
          nickname,
          profilePath: resolvedProfile,
          error: `Network failure communicating with chat.line.biz: ${fetchResult.error || "Fetch failed inside browser context"}`,
          xsrfTokenFound: Boolean(xsrfToken),
          tokenSource,
        };
      }

      return {
        success: false,
        dryRun: false,
        botId,
        lineUserId,
        nickname,
        profilePath: resolvedProfile,
        status,
        error: `Unexpected response from LINE chat: HTTP ${status} (${fetchResult.statusText})`,
        xsrfTokenFound: Boolean(xsrfToken),
        tokenSource,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        dryRun: false,
        botId,
        lineUserId,
        nickname,
        profilePath: resolvedProfile,
        error: `Session execution error: ${errorMsg}`,
      };
    } finally {
      if (context) {
        try {
          await context.close();
        } catch {
          // Context close errors should not override the main result
        }
      }
    }
  }

  /**
   * Performs the single explicit read-only API authentication probe used by
   * diagnostics. The response body is inspected only for JSON-ness and
   * top-level key names; values are never retained or logged.
   */
  public async probeApiAuthentication(context: BrowserContext): Promise<DiagnosticApiAuthProbe> {
    const endpoint = "https://chat.line.biz/api/v1/me";
    const safeProbe: DiagnosticApiAuthProbe = {
      endpoint: "/api/v1/me",
      transport: "FAILED",
      responseWasJson: false,
      topLevelKeyNames: [],
      authenticated: "UNKNOWN",
    };

    try {
      const requestContext = context.request;
      if (!requestContext || typeof requestContext.get !== "function") return safeProbe;

      const response = await requestContext.get(endpoint, {
        headers: { Accept: "application/json, text/plain, */*" },
        timeout: 15000,
        maxRedirects: 0,
      });
      const status = response.status();
      const contentType = response.headers()["content-type"] || "(absent)";
      let responseWasJson = false;
      let topLevelKeyNames: string[] = [];
      try {
        const body: unknown = await response.json();
        responseWasJson = true;
        if (body && typeof body === "object" && !Array.isArray(body)) {
          topLevelKeyNames = Object.keys(body).slice(0, 100).sort();
        }
      } catch {
        // A non-JSON or malformed body is represented by responseWasJson=false.
      }

      return {
        endpoint: "/api/v1/me",
        transport: "SUCCEEDED",
        status,
        contentType,
        responseWasJson,
        topLevelKeyNames,
        authenticated: status === 200 ? "YES" : status === 401 || status === 403 ? "NO" : "UNKNOWN",
      };
    } catch {
      return safeProbe;
    }
  }

  /**
   * Runs diagnostic inspection on a persistent profile without logging secret values.
   */
  public async runDiagnostics(options: {
    profilePath: string;
    botId?: string;
    lineUserId?: string;
    knownChatId?: string;
    headless?: boolean;
    surface?: "bot" | "chat-list";
    /** Test-only override; production diagnostics use the bounded default. */
    chatListResponseTimeoutMs?: number;
    /** Test-only override for the natural wheel-probe second-page observation. */
    chatListSecondPageTimeoutMs?: number;
    customLauncher?: ContextLauncher;
  }): Promise<DiagnosticsResult> {
    const resolvedProfile = path.resolve(options.profilePath);
    const surface = options.surface ?? "bot";

    if (surface === "chat-list" && !options.botId?.trim()) {
      throw new Error("The chat-list diagnostic surface requires --bot <botId>.");
    }

    if (!fs.existsSync(resolvedProfile)) {
      throw new Error(
        `Profile directory does not exist at "${resolvedProfile}". Run npm run line-chat:login first.`
      );
    }

    const launcher = options.customLauncher ?? this.defaultLauncher;
    const context = await launcher(resolvedProfile, {
      profilePath: resolvedProfile,
      headless: options.headless ?? true,
    });

    const observedRequests: ObservedRequestSummary[] = [];
    const observedResponses: DiagnosticsResult["observedResponses"] = [];
    let responseSummaryTail: Promise<void> = Promise.resolve();
    let chatListResponseObserved = false;
    let chatListContractSummary: DiagnosticsResult["chatListIdentifierShape"];
    let chatIdStructureSummary: DiagnosticsResult["chatIdStructure"];
    let chatTypeCorrelationSummary: DiagnosticsResult["chatTypeCorrelation"];
    let chatListPaginationSummary: DiagnosticsResult["chatListPagination"];
    let knownChatIdMatchSummary: DiagnosticsResult["knownChatIdMatch"];
    let chatListFirstRequestCaptured = false;
    let chatListFirstPageQueryNames: string[] = [];
    let chatListFirstResponseCompleted = false;
    let secondPageRequestObserved = false;
    let secondPageQueryNames: string[] = [];
    let secondPageQueryMetadata: DiagnosticQueryMetadata | undefined;
    let wheelProbeAttempts = 0;
    let resolveSecondPageRequest: () => void = () => {};
    let resolveChatListResponse: () => void = () => {};
    const chatListResponseWait = surface === "chat-list"
      ? new Promise<void>((resolve) => {
        resolveChatListResponse = resolve;
      })
      : Promise.resolve();
    const secondPageRequestWait = surface === "chat-list"
      ? new Promise<void>((resolve) => {
        resolveSecondPageRequest = resolve;
      })
      : Promise.resolve();
    let interceptedXsrfToken: string | undefined;
    let interceptedClientVersion: string | undefined;
    let restApiRequestsObserved = 0;
    let streamingSseObserved = false;
    const botIdForDiagnostic = options.botId?.trim() ?? "";
    const knownChatIdForDiagnostic = options.knownChatId?.trim();

    try {
      const page = context.pages()[0] || (await context.newPage());

      page.on("request", (req) => {
        try {
          const reqUrl = req.url();
          const relevance = isRelevantDiagnosticUrl(reqUrl);
          if (!relevance.relevant) return;

          const headers = req.headers();
          const hasXsrf = Boolean(headers["x-xsrf-token"]);
          const hasVer = Boolean(headers["x-oa-chat-client-version"]);

          if (hasXsrf && !interceptedXsrfToken) {
            interceptedXsrfToken = headers["x-xsrf-token"];
          }
          if (hasVer && !interceptedClientVersion) {
            interceptedClientVersion = headers["x-oa-chat-client-version"];
          }

          const sanitized = sanitizeDiagnosticUrl(reqUrl);
          const isMatchingChatListGet = surface === "chat-list"
            && req.method() === "GET"
            && isObservedChatListUrl(reqUrl, botIdForDiagnostic);
          const isSecondPageRequest = isMatchingChatListGet
            && chatListFirstRequestCaptured
            && chatListFirstResponseCompleted;
          const reportedQuery = isSecondPageRequest
            ? sanitizeSecondPageQueryMetadata(sanitized.query)
            : sanitized.query;
          observedRequests.push({
            method: req.method(),
            url: sanitized.url,
            query: reportedQuery,
            hasXsrfHeader: hasXsrf,
            hasClientVersionHeader: hasVer,
            hasOriginHeader: Boolean(headers["origin"]),
            hasRefererHeader: Boolean(headers["referer"]),
            headerNames: Object.keys(headers).sort(),
            timestamp: new Date().toISOString(),
          });
          if (isMatchingChatListGet) {
            if (!chatListFirstRequestCaptured) {
              chatListFirstRequestCaptured = true;
              chatListFirstPageQueryNames = sanitized.query.parameterNames;
            } else if (chatListFirstResponseCompleted && !secondPageRequestObserved) {
              secondPageRequestObserved = true;
              secondPageQueryNames = sanitized.query.parameterNames;
              secondPageQueryMetadata = sanitizeSecondPageQueryMetadata(sanitized.query);
              resolveSecondPageRequest();
            }
          }
          if (relevance.isRestApi) restApiRequestsObserved += 1;
          if (relevance.isStreamingSse) streamingSseObserved = true;
        } catch {
          // Ignore request header access errors
        }
      });

      page.on("response", (response: Response) => {
        const summaryPromise = (async () => {
          try {
            const responseUrl = response.url();
            const relevance = isRelevantDiagnosticUrl(responseUrl);
            if (!relevance.relevant) return;

            const sanitized = sanitizeDiagnosticUrl(responseUrl);
            const isMatchingChatListGet = surface === "chat-list"
              && isObservedChatListResponse(response, botIdForDiagnostic);
            const reportedQuery = isMatchingChatListGet && chatListFirstResponseCompleted
              ? sanitizeSecondPageQueryMetadata(sanitized.query)
              : sanitized.query;
            const headers = response.headers();
            const contentType = headers["content-type"] || "(absent)";
            let schema;
            let responseBody: unknown;
            let responseWasJson = false;
            if (/\b(?:application|text)\/[^;]*json\b|\+json\b/i.test(contentType)) {
              try {
                responseBody = await response.json();
                responseWasJson = true;
                schema = summarizeDiagnosticJson(responseBody);
              } catch {
                schema = diagnosticResponseParseFailure("PARSE_FAILED");
              }
            } else {
              schema = diagnosticResponseParseFailure("NOT_JSON");
            }

            observedResponses.push({
              status: response.status(),
              contentType,
              url: sanitized.url,
              query: reportedQuery,
              schema,
              ...(
                surface === "chat-list"
                && isMatchingChatListGet
                && responseWasJson
                ? (() => {
                  const contract = summarizeChatListContractJson(responseBody, knownChatIdForDiagnostic);
                  if (contract) {
                    chatListContractSummary = contract.identifierShape;
                    chatIdStructureSummary = contract.chatIdStructure;
                    chatTypeCorrelationSummary = contract.chatTypeCorrelation;
                    chatListPaginationSummary = contract.pagination;
                    knownChatIdMatchSummary = contract.knownChatIdMatch;
                  }
                  return contract ? { chatListContract: contract } : {};
                })()
                : {}
              ),
              timestamp: new Date().toISOString(),
            });
            if (isMatchingChatListGet) {
              chatListResponseObserved = true;
              chatListFirstResponseCompleted = true;
              resolveChatListResponse();
            }
            if (relevance.isStreamingSse) streamingSseObserved = true;
          } catch {
            // Ignore response metadata access errors; no raw response is logged.
          }
        })();
        responseSummaryTail = responseSummaryTail.then(() => summaryPromise).catch(() => {});
      });

      const botId = options.botId?.trim();
      const targetUrl = surface === "chat-list"
        ? `https://chat.line.biz/${encodeURIComponent(botId ?? "")}`
        : botId && options.lineUserId
          ? this.buildChatRefererUrl(botId, options.lineUserId)
          : botId
            ? `https://chat.line.biz/${encodeURIComponent(botId)}`
            : "https://chat.line.biz/";
      const safeTargetUrl = sanitizeDiagnosticUrl(targetUrl).url;
      let navigationSucceeded = true;
      let navigationError: string | undefined;
      let navigationResponse: Response | null = null;

      try {
        navigationResponse = await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
      } catch {
        navigationSucceeded = false;
        navigationError = "navigation failed";
      }

      let finalRawUrl = targetUrl;
      try {
        const pageUrl = page.url();
        if (pageUrl) finalRawUrl = pageUrl;
      } catch {
        // Fall back to the requested URL when the page URL is unavailable.
      }

      let rawDocumentTitle: string | null = null;
      try {
        rawDocumentTitle = await page.title();
      } catch {
        // Title is optional diagnostic metadata.
      }

      const navigationMetadata = sanitizeNavigationMetadata(finalRawUrl, rawDocumentTitle);
      const apiAuthProbe = await this.probeApiAuthentication(context);

      await page.waitForTimeout(1500).catch(() => {});
      if (surface === "chat-list") {
        const timeoutMs = options.chatListResponseTimeoutMs ?? 10000;
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          chatListResponseWait,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, timeoutMs);
          }),
        ]);
        if (timer) clearTimeout(timer);

        // Probe at most three left-side viewport regions with bounded positive
        // wheel deltas. This uses viewport geometry only and never reads DOM
        // content, clicks, or navigates to a customer item.
        if (chatListResponseObserved) {
          const totalSecondPageTimeoutMs = options.chatListSecondPageTimeoutMs ?? 6000;
          const perProbeTimeoutMs = Math.max(
            1,
            Math.floor(totalSecondPageTimeoutMs / CHAT_LIST_WHEEL_TARGETS.length),
          );
          for (const xFraction of CHAT_LIST_WHEEL_TARGETS) {
            if (secondPageRequestObserved) break;
            try {
              await wheelChatListViewportRegion(page, xFraction, () => secondPageRequestObserved);
            } catch {
              break;
            }
            wheelProbeAttempts += 1;
            if (secondPageRequestObserved) break;

            let secondPageTimer: ReturnType<typeof setTimeout> | undefined;
            await Promise.race([
              secondPageRequestWait,
              new Promise<void>((resolve) => {
                secondPageTimer = setTimeout(resolve, perProbeTimeoutMs);
              }),
            ]);
            if (secondPageTimer) clearTimeout(secondPageTimer);
          }
        }
      }

      // The response listener can append summaries while the bounded wait is
      // in progress. Follow the tail until it stays stable so late JSON
      // parsing is included in the returned report.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const tail = responseSummaryTail;
        await tail;
        await Promise.resolve();
        if (tail === responseSummaryTail) break;
      }

      const sessionValidation = await this.inspectSession(context, page, {
        xsrfToken: interceptedXsrfToken,
        clientVersion: interceptedClientVersion,
      });

      const metaTags: string[] = [];
      try {
        const metas = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("meta")).map(
            (m) => m.getAttribute("name") || m.getAttribute("property") || m.getAttribute("http-equiv") || "unnamed"
          );
        });
        metaTags.push(...metas);
      } catch {
        // Ignore evaluation error
      }

      return {
        profilePath: resolvedProfile,
        surface,
        targetUrl: safeTargetUrl,
        finalPageUrl: navigationMetadata.url,
        finalOrigin: navigationMetadata.origin,
        finalPath: navigationMetadata.pathname,
        documentTitle: navigationMetadata.documentTitle,
        ...(navigationResponse ? { mainDocumentStatus: navigationResponse.status() } : {}),
        finalOriginIsChatLine: isChatLineOrigin(finalRawUrl),
        finalPathMatchesWorkspace: isRequestedWorkspacePath(finalRawUrl, targetUrl),
        authDestinationDetected: isLoginLikeNavigationUrl(finalRawUrl),
        redirected: navigationMetadata.url !== safeTargetUrl,
        navigationSucceeded,
        ...(navigationError ? { navigationError } : {}),
        authenticated: apiAuthProbe.authenticated === "YES",
        sessionStatePresent: sessionValidation.authenticated,
        cookieStatePresent: sessionValidation.cookiesCount > 0,
        localStoragePresent: sessionValidation.localStorageKeys.length > 0,
        sessionStoragePresent: sessionValidation.sessionStorageKeys.length > 0,
        apiAuthenticated: apiAuthProbe.authenticated,
        apiAuthProbe,
        cookiesCount: sessionValidation.cookiesCount,
        metaTags,
        xsrfTokenFound: Boolean(sessionValidation.xsrfToken),
        tokenSource: sessionValidation.tokenSource ?? "none",
        clientVersionFound: Boolean(sessionValidation.clientVersion),
        observedRequests,
        observedResponses,
        chatListResponseObserved,
        chatListIdentifierShape: chatListContractSummary,
        chatIdStructure: chatIdStructureSummary,
        chatTypeCorrelation: chatTypeCorrelationSummary,
        chatListPagination: chatListPaginationSummary,
        knownChatIdMatch: knownChatIdMatchSummary,
        chatListFirstPageQueryNames,
        wheelProbeAttempts,
        secondPageRequestObserved,
        secondPageQueryNames,
        secondPageQueryMetadata,
        secondPageNewQueryNames: secondPageQueryNames.filter(
          (name) => !chatListFirstPageQueryNames.includes(name),
        ),
        restApiRequestsObserved,
        streamingSseObserved,
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Launches visible Chromium for manual user authentication and cleanly saves profile.
   */
  public async launchLoginSession(options: {
    profilePath: string;
    url?: string;
    onReady?: (url: string) => void;
    waitForConfirmation?: () => Promise<void>;
  }): Promise<{ profilePath: string; success: boolean; message: string }> {
    const resolvedProfile = path.resolve(options.profilePath);

    const parentDir = path.dirname(resolvedProfile);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const targetUrl = options.url || "https://chat.line.biz/";

    const context = await this.launchPlaywrightPersistentContext(resolvedProfile, {
      profilePath: resolvedProfile,
      headless: false,
    });

    try {
      const page = context.pages()[0] || (await context.newPage());
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" }).catch(() => {});

      if (options.onReady) {
        options.onReady(targetUrl);
      }

      if (options.waitForConfirmation) {
        await options.waitForConfirmation();
      }

      return {
        profilePath: resolvedProfile,
        success: true,
        message: `Persistent session cleanly saved to "${resolvedProfile}".`,
      };
    } finally {
      await context.close();
    }
  }

  private async launchPlaywrightPersistentContext(
    userDataDir: string,
    options?: LineChatSessionOptions
  ): Promise<BrowserContext> {
    return chromium.launchPersistentContext(userDataDir, {
      headless: options?.headless ?? true,
      viewport: { width: 1280, height: 800 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        ...(options?.args || []),
      ],
      ...(options?.channel ? { channel: options.channel } : {}),
    });
  }
}
