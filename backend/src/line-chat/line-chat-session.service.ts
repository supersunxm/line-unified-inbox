import { discoveryIdentityFingerprint, mergeNicknameDuplicate } from "./line-chat-chat-discovery";
import { Injectable, Logger, OnModuleDestroy, Optional } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import * as path from "node:path";
import * as fs from "node:fs";
import { hostname } from "node:os";
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
  LineChatDiscoveryPageObserver,
  LineChatDiscoveryContinuation,
  LineChatDiscoveryChunkResult,
  LineChatRecentDiscoveryResult,
  ObservedRequestSummary,
} from "./line-chat.types";
import { parseLineChatListPage, rejectedChatListEnvelopeShape, chatListBodyReadFailureCode } from "./line-chat-chat-discovery";
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
import { withChromiumLaunchFailureDiagnostics } from "./line-chat-chromium-launch-diagnostics";
import { collectChromiumRuntimeSnapshot } from "./line-chat-chromium-runtime-telemetry";

export type ContextLauncher = (
  userDataDir: string,
  options?: LineChatSessionOptions,
  metadata?: LineChatProfileBrowserMetadata,
) => Promise<BrowserContext>;

interface ChromiumLaunchMetadata {
  launchId: string;
  profileId: string;
  operationKind?: string;
  sessionId?: string;
  storeCode?: string;
}

type ManagedContextLauncher = (
  userDataDir: string,
  options?: LineChatSessionOptions,
  metadata?: ChromiumLaunchMetadata,
) => Promise<BrowserContext>;

export const PROFILE_BROWSER_RETRY_BACKOFF_MS = [500, 1_000, 2_000] as const;
export const PROFILE_BROWSER_RELEASE_WAIT_MS = 4_000;
export const PROFILE_BROWSER_RELEASE_POLL_INTERVAL_MS = 100;
export const PROFILE_BROWSER_BUSY_RETRY_AFTER_MS = 5_000;
export const PROFILE_BROWSER_RECOVERY_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000] as const;
export const CHROMIUM_RUNTIME_SNAPSHOT_MIN_INTERVAL_MS = 60_000;
export const PROFILE_BROWSER_MAX_CONTEXT_AGE_MS = 20 * 60_000;
export const PROFILE_BROWSER_MAX_OPERATIONS = 256;
export const PROFILE_BROWSER_CLOSE_TIMEOUT_MS = 10_000;
export const PROFILE_BROWSER_CLOSE_ESCALATION_TIMEOUT_MS = 5_000;

const CHROMIUM_SINGLETON_ARTIFACTS = ["SingletonLock", "SingletonSocket", "SingletonCookie"] as const;
const BASE_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-blink-features=AutomationControlled",
] as const;

export interface LineChatProfileBrowserMetadata {
  sessionId?: string;
  sessionKey?: string;
  profileStorageKey?: string;
  storeCode?: string;
  operationKind?: string;
  reuseContext?: boolean;
}

type ManagedContextState = "READY" | "BUSY" | "DEGRADED" | "CLOSING" | "CLOSED";

interface ManagedProfileContext {
  profilePath: string;
  profileId: string;
  launchId: string;
  generation: number;
  context: BrowserContext;
  optionsFingerprint: string;
  reusable: boolean;
  state: ManagedContextState;
  activeOperation: string | null;
  startedAt: number;
  lastHealthyAt: number;
  operationsCompleted: number;
  intentionalClose: boolean;
  unexpectedClose: boolean;
  contextCloseListener: () => void;
  browserDisconnectListener?: () => void;
  disposePromise: Promise<Error | null> | null;
}

interface ProfileRecoveryState {
  failures: number;
  cooldownUntil: number;
  lastFailure: string;
}

interface ManagedContextLease {
  record: ManagedProfileContext;
  releaseProfileLock: () => void;
}

function profileIdentifier(profilePath: string): string {
  return createHash("sha256").update(profilePath).digest("hex").slice(0, 16);
}

function canonicalPhysicalPath(pathValue: string): string {
  const resolved = path.resolve(pathValue);
  let current = resolved;
  const missingSegments: string[] = [];

  while (true) {
    try {
      const existingRealPath = fs.realpathSync.native(current);
      return path.resolve(existingRealPath, ...missingSegments);
    } catch (error: unknown) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : "";
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;

      const parent = path.dirname(current);
      if (parent === current) throw error;
      missingSegments.unshift(path.basename(current));
      current = parent;
    }
  }
}

function canonicalProfilePath(pathValue: string): string {
  const canonicalPath = canonicalPhysicalPath(pathValue);
  const configuredRoot = process.env.LINE_CHAT_PROFILE_ROOT?.trim();
  const enforcedRoot = configuredRoot || (process.env.NODE_ENV === "production"
    ? "/data/line-chat-profiles"
    : null);
  if (!enforcedRoot) return canonicalPath;

  const canonicalRoot = canonicalPhysicalPath(enforcedRoot);
  if (
    canonicalPath !== canonicalRoot
    && !canonicalPath.startsWith(`${canonicalRoot}${path.sep}`)
  ) {
    throw new Error("CANONICAL_PROFILE_PATH_ESCAPES_CONFIGURED_ROOT");
  }
  return canonicalPath;
}

function launchOptionsFingerprint(options?: LineChatSessionOptions): string {
  const environment = options?.env
    ? Object.entries(options.env).sort(([left], [right]) => left.localeCompare(right))
    : null;
  const normalized = {
    headless: options?.headless ?? true,
    channel: options?.channel ?? null,
    viewport: options?.viewport ?? { width: 1280, height: 800 },
    args: [...new Set([...BASE_CHROMIUM_ARGS, ...(options?.args ?? [])])],
    environment,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function contextIsConnected(context: BrowserContext): boolean {
  try {
    const browser = typeof context.browser === "function" ? context.browser() : null;
    if (browser && !browser.isConnected()) return false;
    if (typeof context.pages !== "function") return false;
    return context.pages().every((page) => typeof page.isClosed === "function" && typeof page.close === "function");
  } catch {
    return false;
  }
}

function safeErrorName(error: unknown): string {
  if (error instanceof Error && error.name) return error.name.slice(0, 80);
  return "UNKNOWN_ERROR";
}

export class ProfileBrowserBusyError extends Error {
  public readonly code = "PROFILE_BROWSER_BUSY";
  public readonly retryAfterMs: number;

  constructor(retryAfterMs = PROFILE_BROWSER_BUSY_RETRY_AFTER_MS) {
    super("PROFILE_BROWSER_BUSY");
    this.name = "ProfileBrowserBusyError";
    this.retryAfterMs = Math.max(0, Math.floor(retryAfterMs));
  }
}

export function isProfileBrowserBusyError(error: unknown): error is ProfileBrowserBusyError {
  return error instanceof ProfileBrowserBusyError
    || (error instanceof Error && error.message === "PROFILE_BROWSER_BUSY");
}

export function isPersistentProfileLockError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /profile[^\n]*(?:appears to be in use|in use by another Chromium process|locked)|process[_-]?singleton|singleton(?:lock|socket|cookie)|the profile appears to be in use/iu.test(message);
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function readSingletonLockIdentity(lockPath: string): { host: string; pid: number } | null {
  try {
    if (!fs.lstatSync(lockPath).isSymbolicLink()) return null;
    const target = fs.readlinkSync(lockPath);
    const match = /^(.*)-(\d+)$/u.exec(path.basename(target));
    if (!match?.[1] || !match[2]) return null;
    const pid = Number(match[2]);
    return Number.isSafeInteger(pid) && pid > 0 ? { host: match[1], pid } : null;
  } catch {
    return null;
  }
}

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
export class LineChatSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(LineChatSessionService.name);
  private readonly rawLauncher: ManagedContextLauncher;
  private readonly activeManagedContexts = new Map<string, number>();
  private readonly managedProfileContexts = new Map<string, ManagedProfileContext>();
  private readonly recoveryStates = new Map<string, ProfileRecoveryState>();
  private readonly profileLockTails = new Map<string, Promise<void>>();
  private readonly contextLeases = new WeakMap<BrowserContext, ManagedContextLease>();
  private readonly profileGenerations = new Map<string, number>();
  private isShuttingDown = false;
  private mirrorCooldownUntilMs = 0;
  private mirrorCycleActive = false;
  private lastRuntimeSnapshotAt = 0;
  private readonly discoveryContinuations = new WeakMap<LineChatDiscoveryContinuation, {
    botId: string;
    token: string;
    seenNext: Set<string>;
  }>();
  public readonly defaultLauncher: ContextLauncher;

  constructor(@Optional() customLauncher?: ContextLauncher) {
    this.rawLauncher = customLauncher ?? ((dir, opts, metadata) => this.launchPlaywrightPersistentContext(dir, opts, metadata));
    this.defaultLauncher = (dir, opts, metadata) => this.launchManagedPersistentContext(dir, opts, metadata);
  }

  public setMirrorCooldownUntil(until: Date | null): void {
    this.mirrorCooldownUntilMs = until ? Math.max(Date.now(), until.getTime()) : 0;
  }

  public isMirrorCooldownActive(now: Date = new Date()): boolean {
    return this.mirrorCooldownUntilMs > now.getTime();
  }

  public setMirrorCycleActive(active: boolean): void {
    this.mirrorCycleActive = active;
  }

  public isMirrorCycleActive(): boolean {
    return this.mirrorCycleActive;
  }

  public async closeIdleManagedContexts(
    reason = "MIRROR_CYCLE_COOLDOWN",
  ): Promise<{ closed: number; failed: number }> {
    let closed = 0;
    let failed = 0;

    for (const profilePath of [...this.managedProfileContexts.keys()]) {
      const releaseProfileLock = await this.acquireProfileLock(profilePath);
      try {
        const record = this.managedProfileContexts.get(profilePath);
        if (!record || record.state === "CLOSED") continue;
        if (record.state === "BUSY") continue;

        const closeError = await this.disposeManagedContext(record, {}, reason);
        if (closeError) failed += 1;
        else closed += 1;
      } finally {
        releaseProfileLock();
      }
    }

    this.safeLog(failed > 0 ? "warn" : "log", {
      event: "line_chat_chromium_idle_contexts_closed",
      reason,
      closed,
      failed,
      activeProfileContexts: this.countLiveManagedContexts(),
    });
    return { closed, failed };
  }

  /**
   * Acquires the single managed context for a profile. Healthy headless
   * contexts stay alive between operations; the profile-path mutex extends
   * beyond this method and is released only by closeManagedPersistentContext.
   */
  public async launchManagedPersistentContext(
    userDataDir: string,
    options?: LineChatSessionOptions,
    metadata: LineChatProfileBrowserMetadata = {},
  ): Promise<BrowserContext> {
    const resolvedProfile = canonicalProfilePath(userDataDir);
    const releaseProfileLock = await this.acquireProfileLock(resolvedProfile);
    const profileId = profileIdentifier(resolvedProfile);
    const reusable = metadata.reuseContext ?? (options?.headless !== false && options?.env === undefined);
    const optionsFingerprint = launchOptionsFingerprint(options);
    try {
      if (this.isShuttingDown) throw new ProfileBrowserBusyError();

      let existing = this.managedProfileContexts.get(resolvedProfile);
      const scheduledRotation = existing !== undefined && (
        Date.now() - existing.startedAt >= PROFILE_BROWSER_MAX_CONTEXT_AGE_MS
        || existing.operationsCompleted >= PROFILE_BROWSER_MAX_OPERATIONS
      );
      if (existing && (
        existing.state === "DEGRADED"
        || existing.state === "CLOSED"
        || !contextIsConnected(existing.context)
        || !existing.reusable
        || !reusable
        || existing.optionsFingerprint !== optionsFingerprint
        || scheduledRotation
      )) {
        const closeError = await this.disposeManagedContext(
          existing,
          metadata,
          scheduledRotation ? "SCHEDULED_ROTATION" : "UNHEALTHY_OR_INCOMPATIBLE",
        );
        if (closeError) throw closeError;
        existing = undefined;
      }

      if (existing) {
        existing.state = "BUSY";
        existing.activeOperation = metadata.operationKind ?? "UNSPECIFIED";
        existing.lastHealthyAt = Date.now();
        this.contextLeases.set(existing.context, { record: existing, releaseProfileLock });
        this.safeLog("log", {
          event: "line_chat_chromium_context_reused",
          ...this.safeRuntimeMetadata(metadata, profileId),
          launchId: existing.launchId,
          contextGeneration: existing.generation,
          workerPid: process.pid,
          operationKind: existing.activeOperation,
        });
        return existing.context;
      }

      const recovery = this.recoveryStates.get(resolvedProfile);
      if (recovery && recovery.cooldownUntil > Date.now()) {
        const retryAfterMs = recovery.cooldownUntil - Date.now();
        this.safeLog("warn", {
          event: "line_chat_chromium_profile_cooldown",
          ...this.safeRuntimeMetadata(metadata, profileId),
          consecutiveFailures: recovery.failures,
          lastFailure: recovery.lastFailure,
          retryAfterMs,
        });
        throw new ProfileBrowserBusyError(retryAfterMs);
      }

      const generation = (this.profileGenerations.get(resolvedProfile) ?? 0) + 1;
      this.profileGenerations.set(resolvedProfile, generation);
      const launchCorrelation = { launchId: "", startedAt: 0 };

      try {
        const context = await this.launchWithBoundedProfileLockRetry(
          resolvedProfile,
          options,
          metadata,
          generation,
          reusable,
          launchCorrelation,
        );
        const { launchId, startedAt } = launchCorrelation;
        const record: ManagedProfileContext = {
          profilePath: resolvedProfile,
          profileId,
          launchId,
          generation,
          context,
          optionsFingerprint,
          reusable,
          state: "BUSY",
          activeOperation: metadata.operationKind ?? "UNSPECIFIED",
          startedAt,
          lastHealthyAt: Date.now(),
          operationsCompleted: 0,
          intentionalClose: false,
          unexpectedClose: false,
          contextCloseListener: () => undefined,
          disposePromise: null,
        };
        record.contextCloseListener = () => {
          if (record.intentionalClose || record.state === "CLOSED" || record.unexpectedClose) return;
          record.unexpectedClose = true;
          record.state = "DEGRADED";
          this.noteRecoveryFailure(resolvedProfile, "CONTEXT_CLOSED");
          this.safeLog("error", {
            event: "line_chat_chromium_process_exited",
            ...this.safeRuntimeMetadata(metadata, profileId),
            launchId,
            contextGeneration: generation,
            workerPid: process.pid,
            chromiumPid: null,
            exitCode: null,
            terminationSignal: null,
            observedBy: "BROWSER_CONTEXT_CLOSED",
            recoveryState: "DEGRADED",
          });
          void this.logRuntimeSnapshot("browser_context_closed", metadata, profileId, launchId, true);
        };
        if (typeof context.on === "function") context.on("close", record.contextCloseListener);
        try {
          const browser = context.browser();
          if (browser) {
            record.browserDisconnectListener = () => {
              if (record.intentionalClose || record.state === "CLOSED" || record.unexpectedClose) return;
              record.unexpectedClose = true;
              record.state = "DEGRADED";
              this.noteRecoveryFailure(resolvedProfile, "BROWSER_DISCONNECTED");
              this.safeLog("error", {
                event: "line_chat_chromium_process_exited",
                ...this.safeRuntimeMetadata(metadata, profileId),
                launchId,
                contextGeneration: generation,
                workerPid: process.pid,
                chromiumPid: null,
                exitCode: null,
                terminationSignal: null,
                observedBy: "BROWSER_DISCONNECTED",
              recoveryState: "DEGRADED",
              });
              void this.logRuntimeSnapshot("browser_disconnected", metadata, profileId, launchId, true);
            };
            if (typeof browser.on === "function") browser.on("disconnected", record.browserDisconnectListener);
          }
        } catch {
          // Some Playwright-compatible test launchers do not expose Browser.
        }
        this.managedProfileContexts.set(resolvedProfile, record);
        this.markManagedContext(resolvedProfile, 1);
        this.recoveryStates.delete(resolvedProfile);
        this.contextLeases.set(context, { record, releaseProfileLock });
        this.safeLog("log", {
          event: "line_chat_chromium_process_spawned",
          ...this.safeRuntimeMetadata(metadata, profileId),
          launchId,
          contextGeneration: generation,
          workerPid: process.pid,
          chromiumPid: null,
          browserSpawned: true,
          observedAt: "PERSISTENT_CONTEXT_READY",
        });
        this.safeLog("log", {
          event: "line_chat_chromium_context_ready",
          ...this.safeRuntimeMetadata(metadata, profileId),
          launchId,
          contextGeneration: generation,
          workerPid: process.pid,
          chromiumPid: null,
          browserSpawned: true,
          launchDurationMs: Date.now() - startedAt,
          activeProfileContexts: this.countLiveManagedContexts(),
          reused: false,
        });
        return context;
      } catch (error: unknown) {
        this.noteRecoveryFailure(resolvedProfile, safeErrorName(error));
        await this.logRuntimeSnapshot("launch_failed", metadata, profileId, launchCorrelation.launchId, true);
        const recoveryState = this.recoveryStates.get(resolvedProfile);
        const cooldownMs = recoveryState ? Math.max(0, recoveryState.cooldownUntil - Date.now()) : 0;
        this.safeLog("error", {
          event: "line_chat_chromium_launch_recovery_deferred",
          ...this.safeRuntimeMetadata(metadata, profileId),
          launchId: launchCorrelation.launchId || null,
          contextGeneration: generation,
          workerPid: process.pid,
          errorName: safeErrorName(error),
          consecutiveFailures: recoveryState?.failures ?? 1,
          cooldownMs,
        });
        throw error;
      }
    } catch (error: unknown) {
      releaseProfileLock();
      throw error;
    }
  }

  /**
   * Resets the operation page and releases its path lock. Healthy headless
   * contexts remain supervised; exceptional, ephemeral, and shutdown paths
   * close Chromium and wait for the profile singleton files to disappear.
   */
  public async closeManagedPersistentContext(
    context: BrowserContext,
    userDataDir: string,
    metadata: LineChatProfileBrowserMetadata = {},
  ): Promise<void> {
    const requestedProfile = canonicalProfilePath(userDataDir);
    const lease = this.contextLeases.get(context);
    const record = lease?.record ?? this.managedProfileContexts.get(requestedProfile);
    if (!lease && record?.context === context) return;

    if (lease) {
      const { record: managedRecord, releaseProfileLock } = lease;
      this.contextLeases.delete(context);
      try {
        managedRecord.activeOperation = null;
        if (
          managedRecord.reusable
          && !this.isShuttingDown
          && managedRecord.state !== "DEGRADED"
          && contextIsConnected(context)
        ) {
          try {
            await this.resetManagedContextPages(managedRecord, metadata);
            managedRecord.state = "READY";
            managedRecord.lastHealthyAt = Date.now();
            managedRecord.operationsCompleted += 1;
            this.safeLog("log", {
              event: "line_chat_chromium_operation_released",
              ...this.safeRuntimeMetadata(metadata, managedRecord.profileId),
              launchId: managedRecord.launchId,
              contextGeneration: managedRecord.generation,
              workerPid: process.pid,
              activeProfileContexts: this.countLiveManagedContexts(),
              contextRetained: true,
            });
            await this.logRuntimeSnapshot("operation_released", metadata, managedRecord.profileId, managedRecord.launchId, false);
            return;
          } catch (error: unknown) {
            managedRecord.state = "DEGRADED";
            this.noteRecoveryFailure(managedRecord.profilePath, "PAGE_RESET_FAILED");
            const closeError = await this.disposeManagedContext(managedRecord, metadata, "PAGE_RESET_FAILED");
            throw closeError ?? error;
          }
        }

        const closeError = await this.disposeManagedContext(
          managedRecord,
          metadata,
          this.isShuttingDown ? "WORKER_SHUTDOWN" : managedRecord.unexpectedClose ? "BROWSER_UNHEALTHY" : "EPHEMERAL_RELEASE",
        );
        if (closeError) throw closeError;
      } finally {
        releaseProfileLock();
      }
      return;
    }

    const releaseProfileLock = await this.acquireProfileLock(requestedProfile);
    let closeError: unknown;
    const startedAt = Date.now();
    try {
      try {
        await context.close();
      } catch (error: unknown) {
        closeError = error;
      } finally {
        if (!(await this.waitForProfileRelease(requestedProfile, metadata))) {
          closeError ??= new Error("CHROMIUM_PROFILE_RELEASE_UNCONFIRMED");
        }
      }
      this.safeLog(closeError ? "warn" : "log", {
        event: closeError ? "line_chat_chromium_close_failed" : "line_chat_chromium_close_completed",
        ...this.safeRuntimeMetadata(metadata, profileIdentifier(requestedProfile)),
        chromiumPid: null,
        closeDurationMs: Date.now() - startedAt,
        cleanupCompleted: !closeError,
        errorName: closeError ? safeErrorName(closeError) : null,
      });
    } finally {
      releaseProfileLock();
    }
    if (closeError) {
      throw closeError instanceof Error
        ? closeError
        : new Error(typeof closeError === "string" ? closeError : "Persistent context close failed.");
    }
  }

  public async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    for (const profilePath of [...this.managedProfileContexts.keys()]) {
      const record = this.managedProfileContexts.get(profilePath);
      if (record) await this.disposeManagedContext(record, {}, "WORKER_SHUTDOWN");
      let drainTimer: NodeJS.Timeout | null = null;
      const drained = await Promise.race([
        this.acquireProfileLock(profilePath).then((release) => { release(); return true; }),
        new Promise<boolean>((resolve) => {
          drainTimer = setTimeout(() => resolve(false), PROFILE_BROWSER_CLOSE_TIMEOUT_MS);
          drainTimer.unref?.();
        }),
      ]);
      if (drainTimer) clearTimeout(drainTimer);
      if (!drained) {
        this.safeLog("warn", {
          event: "line_chat_chromium_shutdown_operation_drain_timeout",
          profileId: profileIdentifier(profilePath),
          workerPid: process.pid,
          waitMs: PROFILE_BROWSER_CLOSE_TIMEOUT_MS,
          browserClosed: true,
        });
      }
    }
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
    pageObserver?: LineChatDiscoveryPageObserver;
    operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext;
    maxPages?: number;
    maxChats?: number;
    maxDurationMs?: number;
  }): Promise<LineChatDiscoveryResult> {
    const maxPages = Math.min(200, Math.max(1, Math.floor(input.maxPages ?? 200)));
    const maxChats = Math.min(10_000, Math.max(1, Math.floor(input.maxChats ?? 10_000)));
    const maxDurationMs = input.maxDurationMs === undefined
      ? undefined
      : Math.min(60_000, Math.max(1, Math.floor(input.maxDurationMs)));
    return this.discoverChatPages(input, maxPages, maxChats, false, input.pageObserver, maxDurationMs);
  }

  /**
   * Reads one bounded chat-list chunk and returns an opaque in-process
   * continuation handle. The raw LINE Manager `next` value never leaves this
   * service and cannot survive a process restart.
   */
  public async discoverChatsChunk(input: {
    botId: string;
    profilePath: string;
    headless?: boolean;
    customLauncher?: ContextLauncher;
    pageObserver?: LineChatDiscoveryPageObserver;
    operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext;
    continuation?: LineChatDiscoveryContinuation | null;
    maxPages?: number;
    maxChats?: number;
    maxDurationMs?: number;
  }): Promise<LineChatDiscoveryChunkResult> {
    const botId = input.botId.trim();
    const previous = input.continuation
      ? this.discoveryContinuations.get(input.continuation)
      : undefined;
    if (input.continuation && (!previous || previous.botId !== botId)) {
      throw new Error("INVALID_CHAT_LIST_CONTINUATION");
    }

    const maxPages = Math.min(20, Math.max(1, Math.floor(input.maxPages ?? 12)));
    const maxChats = Math.min(1_000, Math.max(1, Math.floor(input.maxChats ?? 600)));
    const maxDurationMs = input.maxDurationMs === undefined
      ? 15_000
      : Math.min(30_000, Math.max(1, Math.floor(input.maxDurationMs)));
    const cursorState = {
      startNext: previous?.token,
      next: null as string | null,
      seenNext: previous?.seenNext ?? new Set<string>(),
    };
    const discovery = await this.discoverChatPages(
      input,
      maxPages,
      maxChats,
      true,
      input.pageObserver,
      maxDurationMs,
      cursorState,
    );

    let continuation: LineChatDiscoveryContinuation | null = null;
    if (
      cursorState.next
      && !discovery.stoppedEarlyByObserver
      && !discovery.enumerationError
    ) {
      continuation = Object.freeze({ kind: "LINE_CHAT_DISCOVERY_CONTINUATION" as const });
      this.discoveryContinuations.set(continuation, {
        botId,
        token: cursorState.next,
        seenNext: cursorState.seenNext,
      });
    }

    return { discovery, continuation };
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
    /** Caller-owned managed context; the caller remains responsible for releasing it. */
    existingManagedContext?: BrowserContext;
    maxPages?: number;
    maxChats?: number;
    includeTransportMetadata?: boolean;
    operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext;
  }): Promise<LineChatRecentDiscoveryResult> {
    const startedAt = Date.now();
    // Keep the default realtime window small, but allow the resolver's explicit
    // expanded fallback to search deeper for older conversations. This remains
    // bounded to protect the shared LINE OA Manager profile.
    const maxPages = Math.min(20, Math.max(1, input.maxPages ?? 5));
    const maxChats = Math.min(500, Math.max(1, input.maxChats ?? 125));
    const result = await this.discoverChatPages(input, maxPages, maxChats, true);
    const transportMetadata = input.includeTransportMetadata
      ? {
          recentChatHttpStatus: result.recentChatHttpStatus ?? null,
          chatListRequestObserved: result.chatListRequestObserved ?? false,
          responseStructureValid: result.responseStructureValid ?? false,
          latestEventPresent: result.latestEventPresent ?? false,
          itemCount: result.itemCount ?? null,
          discoveryDurationMs: Math.max(0, Date.now() - startedAt),
        }
      : {};
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
        failureDetail: (result.enumerationError ?? "CHAT_LIST_DISCOVERY_FAILED").slice(0, 240),
        ...transportMetadata,
      };
    }
    return {
      status: "READY",
      chats: result.chats,
      pagesFetched: result.pagesFetched,
      totalRawRecords: result.totalRawRecords,
      ...transportMetadata,
    };
  }

  /**
   * Finds a Manager chat from a webhook inbound-message fingerprint.
   * Exact LINE message ID is authoritative. Text fallback is fail-closed and
   * requires exact text/type plus a tight timestamp match across every scanned
   * candidate.
   */
  public async findInboundMessageFingerprintMatches(input: {
    botId: string;
    profilePath: string;
    chats: readonly LineChatDiscoveredChat[];
    externalMessageId?: string | null;
    messageType?: string | null;
    text?: string | null;
    sentAt: Date;
    headless?: boolean;
    customLauncher?: ContextLauncher;
    operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext;
  }): Promise<
    | {
        status: "READY";
        matches: string[];
        scannedChats: number;
        failedChats: number;
        matchMethod: "MESSAGE_ID" | "TEXT_TIMESTAMP" | null;
      }
    | {
        status: "FAILED";
        matches: [];
        scannedChats: number;
        failedChats: number;
        matchMethod: null;
      }
  > {
    const botId = input.botId.trim();
    const externalMessageId = input.externalMessageId?.trim() || "";
    const targetType = input.messageType?.trim().toLowerCase() || "";
    const targetText = input.text ?? "";
    const targetMs = input.sentAt.getTime();
    const canUseTextFallback =
      targetType === "text"
      && targetText.length > 0
      && Number.isFinite(targetMs);

    const chatIds = [...new Set(
      input.chats
        .map((chat) => chat.chatUserId?.trim())
        .filter((value): value is string => Boolean(value)),
    )];
    if (!botId || chatIds.length === 0 || (!externalMessageId && !canUseTextFallback)) {
      return {
        status: "READY",
        matches: [],
        scannedChats: 0,
        failedChats: 0,
        matchMethod: null,
      };
    }

    const resolvedProfile = path.resolve(input.profilePath);
    if (!fs.existsSync(resolvedProfile)) {
      return {
        status: "FAILED",
        matches: [],
        scannedChats: 0,
        failedChats: chatIds.length,
        matchMethod: null,
      };
    }

    const launcher = input.customLauncher ?? this.defaultLauncher;
    input.operationContext?.assertOwnership();
    const context = await launcher(resolvedProfile, {
      profilePath: resolvedProfile,
      headless: input.headless ?? true,
    }, {
      sessionId: input.operationContext?.sessionId,
      operationKind: input.operationContext?.operationKind ?? "INBOUND_MESSAGE_MATCH",
    });

    let scannedChats = 0;
    let failedChats = 0;
    const textMatches: string[] = [];
    const batchSize = 20;

    try {
      const auth = await this.probeApiAuthentication(context);
      if (auth.authenticated !== "YES") {
        return {
          status: "FAILED",
          matches: [],
          scannedChats,
          failedChats: chatIds.length,
          matchMethod: null,
        };
      }

      const page = context.pages()[0] || await context.newPage();
      await page.goto(`https://chat.line.biz/${encodeURIComponent(botId)}`, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      }).catch(() => {});

      for (let offset = 0; offset < chatIds.length; offset += batchSize) {
        input.operationContext?.assertOwnership();
        const batch = chatIds.slice(offset, offset + batchSize);
        const results = await page.evaluate(async (args) => {
          return Promise.all(args.chatIds.map(async (chatUserId) => {
            const historyUrl =
              `https://chat.line.biz/api/v3/bots/${encodeURIComponent(args.botId)}/chats/${encodeURIComponent(chatUserId)}/messages`;
            try {
              const response = await fetch(historyUrl, {
                credentials: "include",
                headers: { Accept: "application/json, text/plain, */*" },
              });
              if (!response.ok) {
                return { chatUserId, ok: false, idMatch: false, textMatch: false };
              }
              const body = await response.json() as {
                list?: Array<{
                  type?: string;
                  timestamp?: number;
                  message?: {
                    id?: string;
                    type?: string;
                    text?: string;
                  };
                }>;
              };
              let idMatch = false;
              let textMatch = false;
              for (const item of body.list ?? []) {
                if (item.type !== "messageReceived") continue;
                const managerMessageId = typeof item.message?.id === "string"
                  ? item.message.id.trim()
                  : "";
                if (args.externalMessageId && managerMessageId === args.externalMessageId) {
                  idMatch = true;
                  break;
                }
                if (!args.canUseTextFallback) continue;
                const managerType = typeof item.message?.type === "string"
                  ? item.message.type.trim().toLowerCase()
                  : "";
                const managerText = typeof item.message?.text === "string"
                  ? item.message.text
                  : "";
                const managerTimestamp = Number(item.timestamp);
                if (
                  managerType === args.targetType
                  && managerText === args.targetText
                  && Number.isFinite(managerTimestamp)
                  && Math.abs(managerTimestamp - args.targetMs) <= 15_000
                ) {
                  textMatch = true;
                }
              }
              return { chatUserId, ok: true, idMatch, textMatch };
            } catch {
              return { chatUserId, ok: false, idMatch: false, textMatch: false };
            }
          }));
        }, {
          chatIds: batch,
          botId,
          externalMessageId,
          canUseTextFallback,
          targetType,
          targetText,
          targetMs,
        });

        scannedChats += results.length;
        for (const result of results) {
          if (!result.ok) {
            failedChats += 1;
            continue;
          }
          if (result.idMatch) {
            return {
              status: "READY",
              matches: [result.chatUserId],
              scannedChats,
              failedChats,
              matchMethod: "MESSAGE_ID",
            };
          }
          if (result.textMatch) textMatches.push(result.chatUserId);
        }

        if (textMatches.length > 1) {
          return {
            status: "READY",
            matches: [...new Set(textMatches)],
            scannedChats,
            failedChats,
            matchMethod: "TEXT_TIMESTAMP",
          };
        }
      }

      if (failedChats > 0) {
        return {
          status: "FAILED",
          matches: [],
          scannedChats,
          failedChats,
          matchMethod: null,
        };
      }

      return {
        status: "READY",
        matches: [...new Set(textMatches)],
        scannedChats,
        failedChats,
        matchMethod: textMatches.length > 0 ? "TEXT_TIMESTAMP" : null,
      };
    } finally {
      await this.closeManagedPersistentContext(context, resolvedProfile).catch(() => {});
    }
  }

  private async discoverChatPages(input: {
    botId: string;
    profilePath: string;
    headless?: boolean;
    customLauncher?: ContextLauncher;
    existingManagedContext?: BrowserContext;
    includeTransportMetadata?: boolean;
    pageObserver?: LineChatDiscoveryPageObserver;
    operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext;
  }, maxPages: number, maxChats: number, boundedWindow: boolean, pageObserver?: LineChatDiscoveryPageObserver, maxDurationMs?: number, cursorState?: {
    startNext?: string;
    next: string | null;
    seenNext: Set<string>;
  }): Promise<LineChatDiscoveryResult> {
    const startedAtMs = Date.now();
    const deadlineAtMs = maxDurationMs === undefined ? null : startedAtMs + maxDurationMs;
    const remainingTimeMs = (maximumMs: number): number => deadlineAtMs === null
      ? maximumMs
      : Math.max(0, Math.min(maximumMs, deadlineAtMs - Date.now()));
    const timeLimitReached = (): boolean => deadlineAtMs !== null && Date.now() >= deadlineAtMs;
    const botId = input.botId.trim();
    if (!botId) throw new Error("Missing LINE OA Manager bot ID.");

    const resolvedProfile = path.resolve(input.profilePath);
    if (!fs.existsSync(resolvedProfile)) {
      throw new Error(`Profile directory does not exist at "${resolvedProfile}". Run npm run line-chat:login first.`);
    }

    const launcher = input.customLauncher ?? this.defaultLauncher;
    input.operationContext?.assertOwnership();
    const context = input.existingManagedContext ?? await launcher(resolvedProfile, {
      profilePath: resolvedProfile,
      headless: input.headless ?? true,
    }, {
      sessionId: input.operationContext?.sessionId,
      operationKind: input.operationContext?.operationKind ?? "CHAT_DISCOVERY",
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

      let navigationFailure: string | null = null;
      if (remainingTimeMs(Number.MAX_SAFE_INTEGER) <= 0) {
        return {
          ...this.emptyDiscoveryResult(botId, endpoint, "Chat-list time limit reached.", "PARTIAL"),
          timeLimitReached: true,
        };
      }
      try {
        input.operationContext?.assertOwnership();
        await page.goto(`https://chat.line.biz/${encodeURIComponent(botId)}`, {
          waitUntil: "domcontentloaded",
          timeout: Math.max(1, remainingTimeMs(15_000)),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        navigationFailure = message.match(/\bnet::ERR_[A-Z_]+\b/u)?.[0]
          ?? (error instanceof Error ? error.name : "NavigationError");
        // Natural background requests may still complete after navigation timeout.
      }

      if (timeLimitReached()) {
        return {
          ...this.emptyDiscoveryResult(botId, endpoint, "Chat-list time limit reached.", "PARTIAL"),
          timeLimitReached: true,
        };
      }
      const firstRequest = await this.withTimeout(firstRequestWait, remainingTimeMs(20_000));
      if (!firstRequest) {
        let pageState = "unknown";
        try {
          const pageUrl = new URL(page.url());
          if (pageUrl.origin !== "https://chat.line.biz") pageState = "external";
          else if (/login|signin|auth/iu.test(pageUrl.pathname)) pageState = "manager-auth";
          else pageState = "manager";
        } catch {
          pageState = "blank";
        }
        const detail = [
          "LINE OA Manager v2 chat-list natural GET was not observed.",
          `page=${pageState}`,
          ...(navigationFailure ? [`navigation=${navigationFailure}`] : []),
        ].join(" ");
        const reachedTimeLimit = timeLimitReached();
        return {
          ...this.emptyDiscoveryResult(
            botId,
            endpoint,
            reachedTimeLimit ? "Chat-list time limit reached." : detail,
            reachedTimeLimit ? "PARTIAL" : "UNVERIFIED",
          ),
          timeLimitReached: reachedTimeLimit,
        };
      }
      const firstResponse = await this.withTimeout(firstResponseWait, remainingTimeMs(20_000));
      if (!firstResponse) {
        const reachedTimeLimit = timeLimitReached();
        return {
          ...this.emptyDiscoveryResult(
            botId,
            endpoint,
            reachedTimeLimit ? "Chat-list time limit reached." : "LINE OA Manager v2 chat-list response was not observed.",
            reachedTimeLimit ? "PARTIAL" : "UNVERIFIED",
          ),
          ...(input.includeTransportMetadata ? { chatListRequestObserved: true } : {}),
          timeLimitReached: reachedTimeLimit,
        };
      }
      if (firstResponse.status !== 200) {
        return {
          ...this.emptyDiscoveryResult(botId, endpoint, `LINE OA Manager chat-list returned HTTP ${firstResponse.status}`, "PARTIAL"),
          ...(input.includeTransportMetadata ? {
            recentChatHttpStatus: firstResponse.status,
            chatListRequestObserved: true,
          } : {}),
        };
      }

      const firstPageBody = await this.withTimeout(
        this.readJsonResponse(firstResponse.response, input.operationContext),
        remainingTimeMs(20_000),
      );
      if (!firstPageBody) {
        const reachedTimeLimit = timeLimitReached();
        return {
          ...this.emptyDiscoveryResult(
            botId,
            endpoint,
            reachedTimeLimit ? "Chat-list time limit reached." : "LINE OA Manager chat-list response parsing timed out.",
            "PARTIAL",
          ),
          ...(input.includeTransportMetadata ? {
            recentChatHttpStatus: firstResponse.status,
            chatListRequestObserved: true,
          } : {}),
          timeLimitReached: reachedTimeLimit,
        };
      }
      if (!firstPageBody.ok) {
        return {
          ...this.emptyDiscoveryResult(botId, endpoint, firstPageBody.error, "PARTIAL"),
          ...(input.includeTransportMetadata ? {
            recentChatHttpStatus: firstResponse.status,
            chatListRequestObserved: true,
          } : {}),
        };
      }
      let firstPage;
      try {
        firstPage = parseLineChatListPage(firstPageBody.body);
      } catch {
        this.logger.warn(JSON.stringify({
          event: "line_chat_rejected_chat_list_envelope",
          sessionId: input.operationContext?.sessionId,
          operationKind: input.operationContext?.operationKind,
          httpStatus: firstResponse.status,
          ...rejectedChatListEnvelopeShape(firstPageBody.body),
        }));
        return {
          ...this.emptyDiscoveryResult(botId, endpoint, "LINE OA Manager v2 chat-list response had an unsupported or malformed envelope.", "PARTIAL"),
          ...(input.includeTransportMetadata ? {
            recentChatHttpStatus: firstResponse.status,
            chatListRequestObserved: true,
            responseStructureValid: false,
          } : {}),
        };
      }
      const continuing = typeof cursorState?.startNext === "string" && cursorState.startNext.length > 0;
      const pages: Array<typeof firstPage> = [];
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
            if (discoveryIdentityFingerprint(previous) !== discoveryIdentityFingerprint(chat)) conflictingIds.add(chat.chatUserId);
            byId.set(chat.chatUserId, mergeNicknameDuplicate(previous, chat));
          }
        }
      };
      const observePage = (pageResult: typeof firstPage): boolean => pageObserver?.({
        responseShape: pageResult.responseShape,
        chats: pageResult.chats,
        totalRawRecords: pageResult.totalRawRecords,
        validUserChats: pageResult.validUserChats,
        ignoredNonUserRecords: pageResult.ignoredNonUserRecords,
        invalidUserRecords: pageResult.invalidUserRecords,
      }) === true;
      let stoppedEarlyByObserver = false;
      let next: string | null;
      if (continuing) {
        next = cursorState.startNext ?? null;
      } else {
        pages.push(firstPage);
        mergePage(firstPage);
        stoppedEarlyByObserver = observePage(firstPage);
        next = firstPage.next;
      }
      const seenNext = cursorState?.seenNext ?? new Set<string>();
      let enumerationError: string | undefined = !boundedWindow && byId.size > maxChats
        ? "Chat-list discovered-chat limit reached."
        : undefined;
      let pageLimitReached = false;
      let chatLimitReached = byId.size > maxChats;
      let discoveryTimeLimitReached = false;
      while (next !== null && !stoppedEarlyByObserver) {
        if (pages.length >= maxPages) {
          pageLimitReached = true;
          if (!boundedWindow) enumerationError = "Chat-list page limit reached.";
          break;
        }
        if (byId.size >= maxChats) {
          chatLimitReached = true;
          if (!boundedWindow) enumerationError = "Chat-list discovered-chat limit reached.";
          break;
        }
        if (remainingTimeMs(Number.MAX_SAFE_INTEGER) <= 0) {
          discoveryTimeLimitReached = true;
          if (!boundedWindow) enumerationError = "Chat-list time limit reached.";
          break;
        }
        if (seenNext.has(next)) {
          enumerationError = "Repeated chat-list next token detected.";
          break;
        }
        seenNext.add(next);
        const nextUrl = new URL(firstRequest.url);
        nextUrl.searchParams.set("next", next);
        let response;
        try {
          input.operationContext?.assertOwnership();
          response = await requestContext.get(nextUrl.toString(), {
            headers: firstRequest.headers,
            timeout: Math.max(1, remainingTimeMs(15_000)),
          });
        } catch {
          if (timeLimitReached()) {
            discoveryTimeLimitReached = true;
            enumerationError = "Chat-list time limit reached.";
          } else {
            enumerationError = "LINE OA Manager chat-list transport failed on a subsequent page.";
          }
          break;
        }
        if (response.status() !== 200) {
          enumerationError = `LINE OA Manager chat-list returned HTTP ${response.status()} on a subsequent page`;
          break;
        }
        const body = await this.withTimeout(
          this.readJsonResponse(response, input.operationContext),
          remainingTimeMs(20_000),
        );
        if (!body) {
          discoveryTimeLimitReached = timeLimitReached();
          enumerationError = discoveryTimeLimitReached
            ? "Chat-list time limit reached."
            : "LINE OA Manager chat-list response parsing timed out.";
          break;
        }
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
        stoppedEarlyByObserver = observePage(parsedPage);
        if (!boundedWindow && byId.size > maxChats) {
          chatLimitReached = true;
          enumerationError = "Chat-list discovered-chat limit reached.";
          break;
        }
        if (timeLimitReached() && parsedPage.next !== null) {
          discoveryTimeLimitReached = true;
          enumerationError = "Chat-list time limit reached.";
          break;
        }
        next = parsedPage.next;
      }

      const invalidUserRecords = pages.reduce((sum, item) => sum + item.invalidUserRecords, 0);
      const complete = next === null && !enumerationError && invalidUserRecords === 0 && conflictingIds.size === 0;
      if (cursorState) cursorState.next = next;
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
        pageLimitReached,
        chatLimitReached,
        timeLimitReached: discoveryTimeLimitReached,
        ...(enumerationError ? { enumerationError } : {}),
        ...(stoppedEarlyByObserver ? { stoppedEarlyByObserver: true } : {}),
        ...(input.includeTransportMetadata ? {
          recentChatHttpStatus: firstResponse.status,
          chatListRequestObserved: true,
          responseStructureValid: true,
          latestEventPresent: firstPage.chats.some((chat) => chat.lastMessageTimestampStatus !== "NO_LATEST_EVENT"),
          itemCount: firstPage.totalRawRecords,
          discoveryDurationMs: Math.max(0, Date.now() - startedAtMs),
        } : {}),
      };
    } finally {
      if (!input.existingManagedContext) {
        await this.closeManagedPersistentContext(context, resolvedProfile);
      }
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
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<undefined>((resolve) => {
          timer = setTimeout(() => resolve(undefined), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async readJsonResponse(response: { json: () => Promise<unknown>; headers?: () => Record<string, string> }, operationContext?: import("./line-chat-profile-operation-coordinator.service").LineChatProfileOperationContext): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
    try {
      return { ok: true, body: await response.json() };
    } catch (error: unknown) {
      let responseFormat = "UNKNOWN";
      try {
        const mediaType = response.headers?.()["content-type"]?.split(";")[0]?.trim().toLowerCase();
        responseFormat = mediaType === "application/json" ? "JSON" : mediaType === "text/html" ? "HTML" : mediaType ? "OTHER" : "UNKNOWN";
      } catch { /* A disposed response may not expose headers either. */ }
      this.logger.warn(JSON.stringify({
        event: "line_chat_chat_list_body_read_failed",
        sessionId: operationContext?.sessionId,
        operationKind: operationContext?.operationKind,
        failureCode: chatListBodyReadFailureCode(error),
        responseFormat,
      }));
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
      }, {
        sessionId: input.operationContext?.sessionId,
        operationKind: input.operationContext?.operationKind ?? "NICKNAME_UPDATE",
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

      if (status === 400) {
        return {
          success: false,
          dryRun: false,
          botId,
          lineUserId,
          nickname,
          profilePath: resolvedProfile,
          status: 400,
          error: "LINE chat nickname rejected: HTTP 400 (NICKNAME_VALIDATION_FAILED)",
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
      if (isProfileBrowserBusyError(err)) {
        return {
          success: false,
          dryRun: false,
          botId,
          lineUserId,
          nickname,
          profilePath: resolvedProfile,
          error: err.code,
        };
      }
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
          await this.closeManagedPersistentContext(context, resolvedProfile);
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
    }, { operationKind: "MANUAL_DIAGNOSTIC" });

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
      await this.closeManagedPersistentContext(context, resolvedProfile);
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

    const context = await this.launchManagedPersistentContext(resolvedProfile, {
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
      await this.closeManagedPersistentContext(context, resolvedProfile);
    }
  }

  private safeProfileMetadata(metadata: LineChatProfileBrowserMetadata): LineChatProfileBrowserMetadata {
    return {
      ...(metadata.sessionId ? { sessionId: metadata.sessionId } : {}),
      ...(metadata.sessionKey ? { sessionKey: metadata.sessionKey } : {}),
      ...(metadata.profileStorageKey ? { profileStorageKey: metadata.profileStorageKey } : {}),
    };
  }

  private safeRuntimeMetadata(metadata: LineChatProfileBrowserMetadata, profileId: string): Record<string, string> {
    return {
      profileId,
      ...(metadata.sessionId ? { sessionId: metadata.sessionId } : {}),
      ...(metadata.storeCode ? { storeCode: metadata.storeCode } : {}),
      ...(metadata.operationKind ? { operationKind: metadata.operationKind } : {}),
    };
  }

  private safeLog(level: "log" | "warn" | "error", event: Record<string, unknown>): void {
    try {
      const serialized = JSON.stringify(event);
      if (level === "error") this.logger.error(serialized);
      else if (level === "warn") this.logger.warn(serialized);
      else this.logger.log(serialized);
    } catch {
      // Runtime diagnostics must never interrupt a Manager operation.
    }
  }

  private async logRuntimeSnapshot(
    reason: string,
    metadata: LineChatProfileBrowserMetadata,
    profileId: string,
    launchId: string,
    force: boolean,
  ): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastRuntimeSnapshotAt < CHROMIUM_RUNTIME_SNAPSHOT_MIN_INTERVAL_MS) return;
    this.lastRuntimeSnapshotAt = now;
    try {
      const snapshot = await collectChromiumRuntimeSnapshot();
      this.safeLog("log", {
        event: "line_chat_chromium_runtime_snapshot",
        ...this.safeRuntimeMetadata(metadata, profileId),
        launchId,
        reason,
        activeProfileContexts: this.countLiveManagedContexts(),
        snapshot,
      });
    } catch {
      // Telemetry is best-effort and contains no operation outcome data.
    }
  }

  private countLiveManagedContexts(): number {
    let count = 0;
    for (const record of this.managedProfileContexts.values()) {
      if (record.state !== "CLOSED") count += 1;
    }
    return count;
  }

  private async acquireProfileLock(profilePath: string): Promise<() => void> {
    const canonicalPath = canonicalProfilePath(profilePath);
    const previous = this.profileLockTails.get(canonicalPath) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => current);
    this.profileLockTails.set(canonicalPath, tail);
    await previous;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release();
      if (this.profileLockTails.get(canonicalPath) === tail) this.profileLockTails.delete(canonicalPath);
    };
  }

  private async launchWithBoundedProfileLockRetry(
    profilePath: string,
    options: LineChatSessionOptions | undefined,
    metadata: LineChatProfileBrowserMetadata,
    generation: number,
    reusable: boolean,
    launchCorrelation: { launchId: string; startedAt: number },
  ): Promise<BrowserContext> {
    const launchOnce = async (attempt: number): Promise<BrowserContext> => {
      launchCorrelation.launchId = randomUUID();
      launchCorrelation.startedAt = Date.now();
      this.safeLog("log", {
        event: "line_chat_chromium_launch_started",
        ...this.safeRuntimeMetadata(metadata, profileIdentifier(profilePath)),
        launchId: launchCorrelation.launchId,
        contextGeneration: generation,
        launchAttempt: attempt,
        workerPid: process.pid,
        workerUptimeSeconds: Math.floor(process.uptime()),
        headless: options?.headless ?? true,
        reuseContext: reusable,
        activeProfileContexts: this.countLiveManagedContexts(),
      });
      await this.logRuntimeSnapshot("launch_started", metadata, profileIdentifier(profilePath), launchCorrelation.launchId, false);
      return this.rawLauncher(profilePath, options, {
        launchId: launchCorrelation.launchId,
        profileId: profileIdentifier(profilePath),
        ...(metadata.operationKind ? { operationKind: metadata.operationKind } : {}),
        ...(metadata.sessionId ? { sessionId: metadata.sessionId } : {}),
        ...(metadata.storeCode ? { storeCode: metadata.storeCode } : {}),
      });
    };

    let lastLockError: unknown;
    for (let attempt = 1; attempt <= PROFILE_BROWSER_RETRY_BACKOFF_MS.length + 1; attempt += 1) {
      try {
        return await launchOnce(attempt);
      } catch (error: unknown) {
        if (!isPersistentProfileLockError(error)) throw error;
        lastLockError = error;
        this.safeLog("warn", {
          event: "line_chat_profile_browser_busy",
          ...this.safeRuntimeMetadata(metadata, profileIdentifier(profilePath)),
          launchId: launchCorrelation.launchId,
          attempt,
          retryAfterMs: PROFILE_BROWSER_RETRY_BACKOFF_MS[attempt - 1] ?? 0,
        });
        const waitMs = PROFILE_BROWSER_RETRY_BACKOFF_MS[attempt - 1];
        if (waitMs !== undefined) {
          this.safeLog("log", {
            event: "line_chat_profile_launch_retry",
            ...this.safeRuntimeMetadata(metadata, profileIdentifier(profilePath)),
            launchId: launchCorrelation.launchId,
            attempt: attempt + 1,
            waitMs,
          });
          await this.delay(waitMs);
        }
      }
    }

    if (this.recoverStaleProfileLock(profilePath, metadata)) {
      this.safeLog("warn", {
        event: "line_chat_profile_stale_lock_recovered",
        ...this.safeRuntimeMetadata(metadata, profileIdentifier(profilePath)),
        launchId: launchCorrelation.launchId,
      });
      try {
        return await launchOnce(PROFILE_BROWSER_RETRY_BACKOFF_MS.length + 2);
      } catch (error: unknown) {
        if (!isPersistentProfileLockError(error)) throw error;
        lastLockError = error;
      }
    }

    if (lastLockError) {
      this.safeLog("warn", {
        event: "line_chat_profile_browser_busy",
        ...this.safeRuntimeMetadata(metadata, profileIdentifier(profilePath)),
        launchId: launchCorrelation.launchId,
        attempt: PROFILE_BROWSER_RETRY_BACKOFF_MS.length + 1,
        outcome: "RETRYABLE",
      });
    }
    throw new ProfileBrowserBusyError();
  }

  private noteRecoveryFailure(profilePath: string, failure: string): ProfileRecoveryState {
    const previous = this.recoveryStates.get(profilePath);
    const failures = Math.min((previous?.failures ?? 0) + 1, PROFILE_BROWSER_RECOVERY_BACKOFF_MS.length);
    const cooldownMs = PROFILE_BROWSER_RECOVERY_BACKOFF_MS[failures - 1] ?? PROFILE_BROWSER_RECOVERY_BACKOFF_MS.at(-1)!;
    const state = { failures, cooldownUntil: Date.now() + cooldownMs, lastFailure: failure.slice(0, 80) };
    this.recoveryStates.set(profilePath, state);
    return state;
  }

  private async resetManagedContextPages(
    record: ManagedProfileContext,
    metadata: LineChatProfileBrowserMetadata,
  ): Promise<void> {
    const pages = record.context.pages();
    for (const page of pages) {
      if (!page.isClosed()) await page.close({ runBeforeUnload: false });
    }
    if (!contextIsConnected(record.context)) throw new Error("CHROMIUM_CONTEXT_DISCONNECTED_DURING_RELEASE");
    this.safeLog("log", {
      event: "line_chat_chromium_operation_pages_reset",
      ...this.safeRuntimeMetadata(metadata, record.profileId),
      launchId: record.launchId,
      contextGeneration: record.generation,
      pagesClosed: pages.length,
    });
  }

  private disposeManagedContext(
    record: ManagedProfileContext,
    metadata: LineChatProfileBrowserMetadata,
    reason: string,
  ): Promise<Error | null> {
    if (record.disposePromise) return record.disposePromise;
    if (record.state === "CLOSED") return Promise.resolve(null);
    record.intentionalClose = true;
    record.state = "CLOSING";
    record.disposePromise = this.performManagedContextClose(record, metadata, reason);
    return record.disposePromise;
  }

  private async performManagedContextClose(
    record: ManagedProfileContext,
    metadata: LineChatProfileBrowserMetadata,
    reason: string,
  ): Promise<Error | null> {
    const startedAt = Date.now();
    this.safeLog("log", {
      event: "line_chat_chromium_close_started",
      ...this.safeRuntimeMetadata(metadata, record.profileId),
      launchId: record.launchId,
      contextGeneration: record.generation,
      workerPid: process.pid,
      chromiumPid: null,
      reason,
    });
    const closeResult = await this.closeContextBounded(record, metadata);
    let profileReleased = false;
    try {
      profileReleased = await this.waitForProfileRelease(record.profilePath, metadata);
    } finally {
      record.state = "CLOSED";
      if (this.managedProfileContexts.get(record.profilePath) === record) {
        this.managedProfileContexts.delete(record.profilePath);
      }
      this.markManagedContext(record.profilePath, -1);
      try {
        record.context.off("close", record.contextCloseListener);
        const browser = record.context.browser();
        if (browser && record.browserDisconnectListener) browser.off("disconnected", record.browserDisconnectListener);
      } catch {
        // The context may already be disconnected; ownership has still been released.
      }
    }
    let closeError = closeResult.error;
    if (!profileReleased) closeError ??= new Error("CHROMIUM_PROFILE_RELEASE_UNCONFIRMED");
    if (closeError) {
      this.noteRecoveryFailure(record.profilePath, profileReleased ? "CONTEXT_CLOSE_FAILED" : "PROFILE_RELEASE_UNCONFIRMED");
      this.safeLog("error", {
        event: "line_chat_chromium_close_failed",
        ...this.safeRuntimeMetadata(metadata, record.profileId),
        launchId: record.launchId,
        contextGeneration: record.generation,
        workerPid: process.pid,
        chromiumPid: null,
        closeDurationMs: Date.now() - startedAt,
        errorName: safeErrorName(closeError),
        cleanupCompleted: false,
        profileReleased,
        closeEscalationUsed: closeResult.escalationUsed,
      });
      await this.logRuntimeSnapshot("close_failed", metadata, record.profileId, record.launchId, true);
      return closeError;
    }
    this.safeLog("log", {
      event: "line_chat_chromium_close_completed",
      ...this.safeRuntimeMetadata(metadata, record.profileId),
      launchId: record.launchId,
      contextGeneration: record.generation,
      workerPid: process.pid,
      chromiumPid: null,
      closeDurationMs: Date.now() - startedAt,
      cleanupCompleted: true,
      closeEscalationUsed: closeResult.escalationUsed,
      profileReleased,
      activeProfileContexts: this.countLiveManagedContexts(),
    });
    await this.logRuntimeSnapshot("close_completed", metadata, record.profileId, record.launchId, false);
    return null;
  }

  private async closeContextBounded(
    record: ManagedProfileContext,
    metadata: LineChatProfileBrowserMetadata,
  ): Promise<{ error: Error | null; escalationUsed: boolean }> {
    let closePromise: Promise<{ outcome: "CLOSED"; error: null } | { outcome: "FAILED"; error: Error }>;
    try {
      closePromise = record.context.close()
        .then(() => ({ outcome: "CLOSED" as const, error: null }))
        .catch((error: unknown) => ({
          outcome: "FAILED" as const,
          error: error instanceof Error ? error : new Error("Chromium context close failed."),
        }));
    } catch (error: unknown) {
      return {
        error: error instanceof Error ? error : new Error("Chromium context close failed."),
        escalationUsed: false,
      };
    }
    let closeTimer: NodeJS.Timeout | null = null;
    const closeOutcome = await Promise.race([
      closePromise,
      new Promise<{ outcome: "TIMEOUT"; error: null }>((resolve) => {
        closeTimer = setTimeout(() => resolve({ outcome: "TIMEOUT", error: null }), PROFILE_BROWSER_CLOSE_TIMEOUT_MS);
        closeTimer.unref?.();
      }),
    ]);
    if (closeTimer) clearTimeout(closeTimer);
    if (closeOutcome.outcome === "CLOSED") return { error: null, escalationUsed: false };
    if (closeOutcome.outcome === "FAILED") return { error: closeOutcome.error, escalationUsed: false };

    this.safeLog("warn", {
      event: "line_chat_chromium_close_escalation_started",
      ...this.safeRuntimeMetadata(metadata, record.profileId),
      launchId: record.launchId,
      contextGeneration: record.generation,
      workerPid: process.pid,
      chromiumPid: null,
      action: "OWNED_BROWSER_CLOSE",
    });
    let browser: ReturnType<BrowserContext["browser"]> = null;
    try {
      browser = record.context.browser();
    } catch {
      browser = null;
    }
    if (!browser) return { error: new Error("CHROMIUM_CONTEXT_CLOSE_TIMEOUT"), escalationUsed: true };

    let escalationTimer: NodeJS.Timeout | null = null;
    let escalationPromise: Promise<{ completed: true; error: null } | { completed: false; error: Error }>;
    try {
      escalationPromise = browser.close()
        .then(() => ({ completed: true as const, error: null }))
        .catch((error: unknown) => ({
          completed: false as const,
          error: error instanceof Error ? error : new Error("Chromium browser close failed."),
        }));
    } catch (error: unknown) {
      return {
        error: error instanceof Error ? error : new Error("Chromium browser close failed."),
        escalationUsed: true,
      };
    }
    const escalationResult = await Promise.race([
      escalationPromise,
      new Promise<{ completed: false; error: Error | null }>((resolve) => {
        escalationTimer = setTimeout(() => resolve({ completed: false, error: null }), PROFILE_BROWSER_CLOSE_ESCALATION_TIMEOUT_MS);
        escalationTimer.unref?.();
      }),
    ]);
    if (escalationTimer) clearTimeout(escalationTimer);
    this.safeLog(escalationResult.completed ? "log" : "error", {
      event: escalationResult.completed
        ? "line_chat_chromium_close_escalation_completed"
        : "line_chat_chromium_close_escalation_failed",
      ...this.safeRuntimeMetadata(metadata, record.profileId),
      launchId: record.launchId,
      contextGeneration: record.generation,
      workerPid: process.pid,
      chromiumPid: null,
      cleanupCompleted: escalationResult.completed,
      errorName: escalationResult.error ? safeErrorName(escalationResult.error) : null,
    });
    return {
      error: escalationResult.completed ? null : escalationResult.error ?? new Error("CHROMIUM_CONTEXT_CLOSE_TIMEOUT"),
      escalationUsed: true,
    };
  }

  private markManagedContext(profilePath: string, delta: 1 | -1): void {
    const current = this.activeManagedContexts.get(profilePath) ?? 0;
    const next = current + delta;
    if (next > 0) this.activeManagedContexts.set(profilePath, next);
    else this.activeManagedContexts.delete(profilePath);
  }

  private async waitForProfileRelease(
    profilePath: string,
    metadata: LineChatProfileBrowserMetadata,
  ): Promise<boolean> {
    const initiallyPresent = this.singletonArtifactNames(profilePath);
    if (initiallyPresent.length === 0) return true;

    this.safeLog("log", {
      event: "line_chat_profile_release_wait",
      ...this.safeRuntimeMetadata(metadata, profileIdentifier(profilePath)),
      artifactNames: initiallyPresent,
      maxWaitMs: PROFILE_BROWSER_RELEASE_WAIT_MS,
    });

    const startedAt = Date.now();
    let remaining = initiallyPresent;
    while (remaining.length > 0 && Date.now() - startedAt < PROFILE_BROWSER_RELEASE_WAIT_MS) {
      await this.delay(PROFILE_BROWSER_RELEASE_POLL_INTERVAL_MS);
      remaining = this.singletonArtifactNames(profilePath);
    }

    if (remaining.length > 0) {
      this.safeLog("warn", {
        event: "line_chat_profile_release_wait",
        ...this.safeRuntimeMetadata(metadata, profileIdentifier(profilePath)),
        artifactNames: remaining,
        outcome: "TIMEOUT_BUSY",
        waitedMs: Math.min(PROFILE_BROWSER_RELEASE_WAIT_MS, Date.now() - startedAt),
      });
    }
    return remaining.length === 0;
  }

  private singletonArtifactNames(profilePath: string): string[] {
    return CHROMIUM_SINGLETON_ARTIFACTS.filter((name) => {
      try {
        fs.lstatSync(path.join(profilePath, name));
        return true;
      } catch {
        return false;
      }
    });
  }

  private recoverStaleProfileLock(
    profilePath: string,
    metadata: LineChatProfileBrowserMetadata,
  ): boolean {
    const lockPath = path.join(profilePath, "SingletonLock");
    const identity = readSingletonLockIdentity(lockPath);
    if (!identity) {
      if (this.singletonArtifactNames(profilePath).length > 0) {
        this.logger.warn(JSON.stringify({
          event: "line_chat_profile_stale_lock_detected",
          ...this.safeProfileMetadata(metadata),
          outcome: "UNCERTAIN_LOCK_OWNER",
        }));
      }
      return false;
    }

    const currentHost = hostname();
    if (identity.host !== currentHost) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_profile_stale_lock_detected",
        ...this.safeProfileMetadata(metadata),
        lockHost: identity.host,
        currentHost,
        lockPid: identity.pid,
        outcome: "REMOTE_OR_UNKNOWN_OWNER",
      }));
      return false;
    }

    if ((this.activeManagedContexts.get(profilePath) ?? 0) > 0 || processExists(identity.pid)) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_profile_stale_lock_detected",
        ...this.safeProfileMetadata(metadata),
        lockHost: identity.host,
        lockPid: identity.pid,
        outcome: "LIVE_OWNER",
      }));
      return false;
    }

    const artifacts = this.singletonArtifactNames(profilePath);
    if (artifacts.length === 0) return false;
    this.logger.warn(JSON.stringify({
      event: "line_chat_profile_stale_lock_detected",
      ...this.safeProfileMetadata(metadata),
      lockHost: identity.host,
      lockPid: identity.pid,
      artifactNames: artifacts,
      outcome: "STALE_CONFIRMED",
    }));
    for (const artifact of artifacts) {
      try {
        fs.unlinkSync(path.join(profilePath, artifact));
      } catch (error: unknown) {
        if (!(error instanceof Error) || !("code" in error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
          this.logger.warn(JSON.stringify({
            event: "line_chat_profile_stale_lock_detected",
            ...this.safeProfileMetadata(metadata),
            lockHost: identity.host,
            lockPid: identity.pid,
            artifact,
            outcome: "RECOVERY_FAILED",
          }));
          return false;
        }
      }
    }
    return true;
  }

  private delay(waitMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  private async launchPlaywrightPersistentContext(
    userDataDir: string,
    options?: LineChatSessionOptions,
    metadata?: ChromiumLaunchMetadata,
  ): Promise<BrowserContext> {
    return withChromiumLaunchFailureDiagnostics(
      () => chromium.launchPersistentContext(userDataDir, {
        headless: options?.headless ?? true,
        viewport: options?.viewport ?? { width: 1280, height: 800 },
        args: [...BASE_CHROMIUM_ARGS, ...(options?.args || [])],
        ...(options?.channel ? { channel: options.channel } : {}),
        ...(options?.env ? { env: options.env } : {}),
        ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
      }),
      userDataDir,
      (event) => this.logger.error(event),
      {
        ...(metadata ?? {}),
        workerPid: process.pid,
      },
    );
  }
}
