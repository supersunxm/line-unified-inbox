import { Injectable, Optional } from "@nestjs/common";
import * as path from "node:path";
import * as fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import type {
  UpdateNicknameInput,
  UpdateNicknameResult,
  LineChatSessionOptions,
  LineChatSessionValidation,
  DiagnosticsResult,
  LineChatDiscoveryResult,
  ObservedRequestSummary,
} from "./line-chat.types";
import { parseLineChatListResponse } from "./line-chat-chat-discovery";

export type ContextLauncher = (
  userDataDir: string,
  options?: LineChatSessionOptions
) => Promise<BrowserContext>;

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
   * Builds the read-only chat-list endpoint observed in the authenticated
   * chat.line.biz page bootstrap flow. The response contract is not claimed
   * to be production-verified by this method.
   */
  public buildChatListUrl(botId: string): string {
    return `https://chat.line.biz/api/v1/bots/${encodeURIComponent(botId.trim())}/chats`;
  }

  /**
   * Reads chats through the authenticated persistent browser profile. This
   * intentionally performs one browser-context GET to the observed endpoint,
   * with non-GET chat.line.biz requests blocked for this discovery context.
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
      const page = context.pages()[0] || (await context.newPage());
      const routeableContext = context as BrowserContext & {
        route?: BrowserContext["route"];
        unroute?: BrowserContext["unroute"];
      };
      if (routeableContext.route) {
        await routeableContext.route("https://chat.line.biz/**", async (route) => {
          if (route.request().method() === "GET") await route.continue();
          else await route.abort();
        });
      }

      await page.goto("https://chat.line.biz/", {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      }).catch(() => {});

      const fetchResult = await page.evaluate(async (targetUrl) => {
        try {
          const response = await fetch(targetUrl, {
            method: "GET",
            headers: { Accept: "application/json, text/plain, */*" },
            credentials: "include",
          });
          let body: unknown = null;
          try { body = await response.json(); } catch { /* non-JSON response */ }
          return { status: response.status, body };
        } catch (error: unknown) {
          return { status: 0, body: null, error: error instanceof Error ? error.message : String(error) };
        }
      }, endpoint);
      if (fetchResult.status < 200 || fetchResult.status >= 300) {
        throw new Error(
          fetchResult.status > 0
            ? `LINE OA Manager chat-list request returned HTTP ${fetchResult.status}.`
            : `LINE OA Manager chat-list GET failed: ${fetchResult.error || "network error"}.`,
        );
      }
      if (fetchResult.body === null) throw new Error("LINE OA Manager chat-list response was empty or not JSON.");
      return parseLineChatListResponse(fetchResult.body, { botId, endpoint });
    } finally {
      const routeableContext = context as BrowserContext & { unroute?: BrowserContext["unroute"] };
      if (routeableContext.unroute) await routeableContext.unroute("https://chat.line.biz/**").catch(() => {});
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
   * Runs diagnostic inspection on a persistent profile without logging secret values.
   */
  public async runDiagnostics(options: {
    profilePath: string;
    botId?: string;
    lineUserId?: string;
    headless?: boolean;
    customLauncher?: ContextLauncher;
  }): Promise<DiagnosticsResult> {
    const resolvedProfile = path.resolve(options.profilePath);

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
    let interceptedXsrfToken: string | undefined;
    let interceptedClientVersion: string | undefined;

    try {
      const page = context.pages()[0] || (await context.newPage());

      page.on("request", (req) => {
        try {
          const reqUrl = req.url();
          const headers = req.headers();
          const hasXsrf = Boolean(headers["x-xsrf-token"]);
          const hasVer = Boolean(headers["x-oa-chat-client-version"]);

          if (hasXsrf && !interceptedXsrfToken) {
            interceptedXsrfToken = headers["x-xsrf-token"];
          }
          if (hasVer && !interceptedClientVersion) {
            interceptedClientVersion = headers["x-oa-chat-client-version"];
          }

          if (reqUrl.includes("/api/") || reqUrl.includes("chat.line.biz")) {
            observedRequests.push({
              method: req.method(),
              url: reqUrl.replace(/\?.*/, ""),
              hasXsrfHeader: hasXsrf,
              hasClientVersionHeader: hasVer,
              hasOriginHeader: Boolean(headers["origin"]),
              hasRefererHeader: Boolean(headers["referer"]),
              headerNames: Object.keys(headers),
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          // Ignore request header access errors
        }
      });

      const targetUrl =
        options.botId && options.lineUserId
          ? this.buildChatRefererUrl(options.botId, options.lineUserId)
          : options.botId
            ? `https://chat.line.biz/${encodeURIComponent(options.botId)}`
            : "https://chat.line.biz/";

      try {
        await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
      } catch {
        // Proceed even if timeout
      }

      await page.waitForTimeout(1500).catch(() => {});

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
        targetUrl,
        authenticated: sessionValidation.authenticated,
        cookiesCount: sessionValidation.cookiesCount,
        cookieNames: sessionValidation.cookieNames,
        localStorageKeys: sessionValidation.localStorageKeys,
        sessionStorageKeys: sessionValidation.sessionStorageKeys,
        metaTags,
        xsrfTokenFound: Boolean(sessionValidation.xsrfToken),
        tokenSource: sessionValidation.tokenSource ?? "none",
        clientVersionFound: Boolean(sessionValidation.clientVersion),
        observedRequests,
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
