import { Injectable, Optional } from "@nestjs/common";
import * as path from "node:path";
import * as fs from "node:fs";
import { chromium, type BrowserContext, type Page, type Response } from "playwright";
import type {
  UpdateNicknameInput,
  UpdateNicknameResult,
  LineChatSessionOptions,
  LineChatSessionValidation,
  DiagnosticsResult,
  DiagnosticApiAuthProbe,
  DiagnosticQueryMetadata,
  LineChatDiscoveryResult,
  ObservedRequestSummary,
} from "./line-chat.types";
import { parseLineChatListResponse } from "./line-chat-chat-discovery";
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

const MAX_CHAT_LIST_SCROLL_CANDIDATES = 3;

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

async function scrollChatListGeometryCandidate(page: Page, candidateRank: number): Promise<boolean> {
  return page.evaluate((rank) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element, domIndex) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          element,
          domIndex,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          overflowY: style.overflowY,
          visible: style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity) > 0,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      })
      .filter((candidate) => (
        candidate.scrollHeight > candidate.clientHeight + 1
        && candidate.visible
        && candidate.clientHeight > 0
        && candidate.width > 0
        && candidate.height > 0
        && candidate.left < viewportWidth
        && candidate.left + candidate.width > 0
        && candidate.top < viewportHeight
        && candidate.top + candidate.height > 0
      ))
      .sort((left, right) => {
        const overflowRank = (value: string): number => /^(?:auto|scroll|overlay)$/.test(value) ? 0 : 1;
        const leftRegionRank = (value: typeof left): number => value.left < viewportWidth * 0.6 ? 0 : 1;
        const widthRank = (value: typeof left): number => value.width <= viewportWidth * 0.7 ? 0 : 1;
        return (
          leftRegionRank(left) - leftRegionRank(right)
          || overflowRank(left.overflowY) - overflowRank(right.overflowY)
          || widthRank(left) - widthRank(right)
          || left.left - right.left
          || right.height - left.height
          || left.domIndex - right.domIndex
        );
      });

    const candidate = candidates[rank];
    if (!candidate) return false;
    const maximumScrollTop = Math.max(0, candidate.scrollHeight - candidate.clientHeight);
    candidate.element.scrollTop = maximumScrollTop;
    candidate.element.dispatchEvent(new Event("scroll", { bubbles: true }));
    return true;
  }, candidateRank);
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
      if (!directResolved.startsWith(rootDir)) {
        throw new Error(`Resolved profile path "${directResolved}" escapes configured root directory "${rootDir}"`);
      }
      return directResolved;
    }

    if (session.profilePath?.trim()) {
      const rawResolved = path.resolve(session.profilePath.trim());
      if (configuredRoot && !rawResolved.startsWith(rootDir)) {
        const safeBase = path.basename(session.profilePath.trim()).replace(/[^a-zA-Z0-9_-]/g, "");
        const fallbackResolved = path.resolve(rootDir, safeBase || "default");
        return fallbackResolved;
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

  /**
   * Builds the legacy candidate endpoint used by mapping discovery. The
   * current production chat-list contract is not assumed by this diagnostic
   * surface; production observation reported no request to this path.
   */
  public buildChatListUrl(botId: string): string {
    return `https://chat.line.biz/api/v1/bots/${encodeURIComponent(botId.trim())}/chats`;
  }

  /**
   * Reads chats through the authenticated persistent browser profile. This
   * intentionally performs one BrowserContext request-context GET to the
   * retained candidate endpoint. Playwright shares the persistent context's
   * cookies and session storage with `context.request`; no page navigation is
   * required for this mapping path. The path is not claimed to be the current
   * production chat-list contract; use diagnostics to observe the natural
   * /{botId} bot surface. Non-GET chat.line.biz requests remain blocked for
   * this discovery context.
   */
  public async discoverChats(input: {
    botId: string;
    profilePath: string;
    headless?: boolean;
    customLauncher?: ContextLauncher;
  }): Promise<LineChatDiscoveryResult> {
    const botId = input.botId.trim();
    if (!botId) throw new Error("Missing LINE OA Manager bot ID.");

    const resolvedProfile = path.resolve(input.profilePath);
    if (!fs.existsSync(resolvedProfile)) {
      throw new Error(`Profile directory does not exist at "${resolvedProfile}". Run npm run line-chat:login first.`);
    }

    const launcher = input.customLauncher ?? this.defaultLauncher;
    const context = await launcher(resolvedProfile, {
      profilePath: resolvedProfile,
      headless: input.headless ?? true,
    });
    const endpoint = this.buildChatListUrl(botId);

    try {
      const requestContext = context.request;
      if (!requestContext || typeof requestContext.get !== "function") {
        throw new Error("LINE OA Manager chat-list transport failed");
      }

      let response;
      try {
        response = await requestContext.get(endpoint, {
          headers: { Accept: "application/json, text/plain, */*" },
          timeout: 15000,
        });
      } catch {
        throw new Error("LINE OA Manager chat-list transport failed");
      }

      const status = response.status();
      if (status < 200 || status >= 300) {
        throw new Error(`LINE OA Manager chat-list returned HTTP ${status}`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error("LINE OA Manager chat-list response was not JSON");
      }
      return parseLineChatListResponse(body, { botId, endpoint });
    } finally {
      await context.close();
    }
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
        await page.goto(chatPageUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
      } catch {
        // Continue even if navigation times out waiting for external resources
      }

      // Allow background bootstrap requests to fire
      await page.waitForTimeout(1000).catch(() => {});

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
    /** Test-only override for the natural-scroll second-page observation. */
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
    let scrollCandidatesAttempted = 0;
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
          observedRequests.push({
            method: req.method(),
            url: sanitized.url,
            query: sanitized.query,
            hasXsrfHeader: hasXsrf,
            hasClientVersionHeader: hasVer,
            hasOriginHeader: Boolean(headers["origin"]),
            hasRefererHeader: Boolean(headers["referer"]),
            headerNames: Object.keys(headers).sort(),
            timestamp: new Date().toISOString(),
          });
          if (
            surface === "chat-list"
            && req.method() === "GET"
            && isObservedChatListUrl(reqUrl, botIdForDiagnostic)
          ) {
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
              query: sanitized.query,
              schema,
              ...(
                surface === "chat-list"
                && isObservedChatListResponse(response, botIdForDiagnostic)
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
            if (surface === "chat-list" && isObservedChatListResponse(response, botIdForDiagnostic)) {
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

        // Scroll at most three geometry-ranked containers. The page evaluation
        // reads dimensions and overflow state only; it never reads content or
        // clicks/navigates a customer item.
        if (chatListResponseObserved) {
          const totalSecondPageTimeoutMs = options.chatListSecondPageTimeoutMs ?? 6000;
          const perCandidateTimeoutMs = Math.max(
            1,
            Math.floor(totalSecondPageTimeoutMs / MAX_CHAT_LIST_SCROLL_CANDIDATES),
          );
          for (let rank = 0; rank < MAX_CHAT_LIST_SCROLL_CANDIDATES; rank += 1) {
            if (secondPageRequestObserved) break;
            let candidateScrolled = false;
            try {
              candidateScrolled = await scrollChatListGeometryCandidate(page, rank);
            } catch {
              break;
            }
            if (!candidateScrolled) break;
            scrollCandidatesAttempted += 1;

            let secondPageTimer: ReturnType<typeof setTimeout> | undefined;
            await Promise.race([
              secondPageRequestWait,
              new Promise<void>((resolve) => {
                secondPageTimer = setTimeout(resolve, perCandidateTimeoutMs);
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
        scrollCandidatesAttempted,
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
