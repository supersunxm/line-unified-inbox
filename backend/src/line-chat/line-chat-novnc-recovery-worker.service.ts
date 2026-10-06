import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import { type BrowserContext } from "playwright";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatMirrorService } from "./line-chat-mirror.service";

const RECOVERY_SESSION_KEYS = new Set(["account-1", "profile-b"]);
const DEFAULT_TTL_MS = 12 * 60 * 1000;
const DISPLAY = ":99";
const VNC_PORT = 5900;
const WEBSOCKIFY_PORT = 6080;

export interface LineChatNovncRecoverySnapshot {
  active: boolean;
  pending?: boolean;
  error?: string;
  sessionKey: string | null;
  path?: string;
  expiresAt?: string;
}

type ActiveRecovery = {
  sessionKey: string;
  token: string;
  expiresAt: Date;
  stop: (reason: string) => Promise<void>;
};

function waitForExit(child: ChildProcess, timeoutMs = 2_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

@Injectable()
export class LineChatNovncRecoveryWorkerService {
  private readonly logger = new Logger(LineChatNovncRecoveryWorkerService.name);
  private active: ActiveRecovery | null = null;
  private startingSessionKey: string | null = null;
  private startupError: string | undefined;
  private mirrorPaused = false;
  private contextCloseFailed = false;
  private operationPromise: Promise<void> | null = null;
  private startPromise: Promise<LineChatNovncRecoverySnapshot> | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly profileCoordinator: LineChatProfileOperationCoordinator,
    @Inject(LineChatMirrorService)
    private readonly mirrorService: LineChatMirrorService,
  ) {}

  public snapshot(): LineChatNovncRecoverySnapshot {
    if (!this.active || this.active.expiresAt.getTime() <= Date.now()) {
      return { active: false, pending: Boolean(this.startPromise), sessionKey: this.startingSessionKey, error: this.startupError };
    }
    return {
      active: true,
      sessionKey: this.active.sessionKey,
      path: `/recovery/${this.active.token}/vnc.html?autoconnect=true&resize=scale&path=recovery/${this.active.token}/websockify`,
      expiresAt: this.active.expiresAt.toISOString(),
    };
  }

  public authorize(token: string): boolean {
    return Boolean(this.active && this.active.token === token && this.active.expiresAt.getTime() > Date.now());
  }

  public async start(sessionKey: string): Promise<LineChatNovncRecoverySnapshot> {
    if (!RECOVERY_SESSION_KEYS.has(sessionKey)) throw new Error("RECOVERY_SESSION_NOT_ALLOWED");
    if (this.active && this.active.expiresAt.getTime() <= Date.now()) throw new Error("RECOVERY_STOPPING");
    const current = this.snapshot();
    if (current.active) {
      if (current.sessionKey !== sessionKey) throw new Error("RECOVERY_OTHER_SESSION_ACTIVE");
      return current;
    }
    if (this.startPromise) {
      if (this.startingSessionKey !== sessionKey) throw new Error("RECOVERY_OTHER_SESSION_STARTING");
      return this.startPromise;
    }
    this.startingSessionKey = sessionKey;
    this.startupError = undefined;
    this.operationPromise = null;
    this.mirrorPaused = true;
    this.startPromise = (async () => {
      try {
        await this.mirrorService.pauseForManualRecovery();
        this.contextCloseFailed = false;
        return await this.startInternal(sessionKey);
      } catch (error) {
        await this.operationPromise;
        const code = error instanceof Error ? error.message : "RECOVERY_START_FAILED";
        if (code === "RECOVERY_CONTEXT_CLOSE_FAILED") this.contextCloseFailed = true;
        this.resumeMirror();
        this.startupError = /^(RECOVERY_|PROFILE_OPERATION_|LIVE_MIRROR_)[A-Z_]+$/u.test(code) ? code : "RECOVERY_START_FAILED";
        throw error;
      }
    })().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  // HTTP starts acknowledge immediately; status polling survives proxy disconnects.
  public requestStart(sessionKey: string): LineChatNovncRecoverySnapshot {
    if (!RECOVERY_SESSION_KEYS.has(sessionKey)) throw new Error("RECOVERY_SESSION_NOT_ALLOWED");
    if (this.active && this.active.expiresAt.getTime() <= Date.now()) throw new Error("RECOVERY_STOPPING");
    if (this.startPromise && this.startingSessionKey !== sessionKey) throw new Error("RECOVERY_OTHER_SESSION_STARTING");
    if (this.active && this.active.sessionKey !== sessionKey) throw new Error("RECOVERY_OTHER_SESSION_ACTIVE");
    void this.start(sessionKey).catch(() => undefined); // Failure remains observable through snapshot().
    return this.snapshot();
  }

  private resumeMirror(): void {
    if (!this.mirrorPaused || this.contextCloseFailed) return;
    this.mirrorPaused = false;
    this.mirrorService.resumeAfterManualRecovery();
  }

  public async stop(sessionKey: string, reason = "operator_stop"): Promise<LineChatNovncRecoverySnapshot> {
    if (!RECOVERY_SESSION_KEYS.has(sessionKey)) throw new Error("RECOVERY_SESSION_NOT_ALLOWED");
    if (this.startPromise) throw new Error("RECOVERY_STARTING_WAIT_FOR_STATUS");
    if (this.active) {
      if (this.active.sessionKey !== sessionKey) throw new Error("RECOVERY_OTHER_SESSION_ACTIVE");
      await this.active.stop(reason);
      await this.operationPromise;
    }
    return this.snapshot();
  }

  private async startInternal(sessionKey: string): Promise<LineChatNovncRecoverySnapshot> {
    const session = await this.prisma.lineChatSession.findUnique({
      where: { sessionKey },
      select: { id: true, sessionKey: true, profileStorageKey: true, profilePath: true },
    });
    if (!session) throw new Error("RECOVERY_SESSION_NOT_FOUND");
    const profilePath = this.sessionService.resolveProfilePath(session);
    if (!fs.existsSync(profilePath)) throw new Error("RECOVERY_PROFILE_MISSING");

    let resolveStarted!: (value: LineChatNovncRecoverySnapshot) => void;
    let rejectStarted!: (error: Error) => void;
    const started = new Promise<LineChatNovncRecoverySnapshot>((resolve, reject) => {
      resolveStarted = resolve;
      rejectStarted = reject;
    });

    const operation = this.profileCoordinator.withProfileOperation(
      { sessionId: session.id, operationKind: "MANUAL_DIAGNOSTIC" },
      async (lease) => {
        const children: ChildProcess[] = [];
        let browserContext: BrowserContext | null = null;
        let stopped = false;
        let stopResolve!: () => void;
        const stoppedPromise = new Promise<void>((resolve) => { stopResolve = resolve; });
        const token = randomBytes(32).toString("base64url");
        const requestedTtl = Number(process.env.LINE_CHAT_NOVNC_TTL_MS || DEFAULT_TTL_MS);
        const ttlMs = Math.min(15 * 60 * 1000, Math.max(5 * 60 * 1000, Number.isFinite(requestedTtl) ? requestedTtl : DEFAULT_TTL_MS));
        const expiresAt = new Date(Date.now() + ttlMs);

        const spawnManaged = (command: string, args: string[], env?: NodeJS.ProcessEnv) => {
          const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "pipe"] });
          children.push(child);
          child.stderr?.on("data", () => undefined);
          child.once("error", () => {
            rejectStarted(new Error("RECOVERY_DISPLAY_PROCESS_FAILED"));
            void cleanup("display_process_error");
          });
          child.once("exit", () => {
            if (!stopped) {
              rejectStarted(new Error("RECOVERY_DISPLAY_PROCESS_EXITED"));
              void cleanup("display_process_exit");
            }
          });
          return child;
        };

        const cleanup = async (reason: string) => {
          if (stopped) return stoppedPromise;
          stopped = true;
          const context = browserContext;
          browserContext = null;
          if (context) await this.sessionService.closeManagedPersistentContext(context, profilePath, {
            sessionId: session.id,
            sessionKey,
            profileStorageKey: session.profileStorageKey ?? undefined,
          }).catch(() => {
            this.contextCloseFailed = true;
            this.startupError = "RECOVERY_CONTEXT_CLOSE_FAILED";
            this.logger.error(JSON.stringify({ event: "line_chat_novnc_context_close_failed", sessionKey }));
          });
          for (const child of [...children].reverse()) if (child.exitCode === null && child.signalCode === null && !child.killed) child.kill("SIGTERM");
          await Promise.all(children.map((child) => waitForExit(child)));
          for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");

          this.logger.log(JSON.stringify({ event: "line_chat_novnc_recovery_stopped", sessionKey, reason }));
          stopResolve();
        };

        try {
          lease.assertOwnership();
          if (this.sessionService.isMirrorCycleActive()) throw new Error("LIVE_MIRROR_ACTIVE");
          spawnManaged("Xvfb", [DISPLAY, "-screen", "0", "1440x900x24", "-nolisten", "tcp"]);
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (stopped) throw new Error("RECOVERY_DISPLAY_PROCESS_FAILED");
          spawnManaged("fluxbox", [], { DISPLAY });
          spawnManaged("x11vnc", ["-display", DISPLAY, "-localhost", "-forever", "-shared", "-nopw", "-rfbport", String(VNC_PORT)]);
          spawnManaged("websockify", [`127.0.0.1:${WEBSOCKIFY_PORT}`, `127.0.0.1:${VNC_PORT}`, "--web=/usr/share/novnc"]);
          await new Promise((resolve) => setTimeout(resolve, 750));

          if (stopped) throw new Error("RECOVERY_DISPLAY_PROCESS_FAILED");
          browserContext = await this.sessionService.launchManagedPersistentContext(profilePath, {
            profilePath,
            headless: false,
            viewport: { width: 1440, height: 900 },
            env: { ...process.env, DISPLAY },
            args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
          }, {
            sessionId: session.id,
            sessionKey,
            profileStorageKey: session.profileStorageKey ?? undefined,
            operationKind: "NOVNC_RECOVERY",
            reuseContext: false,
          });
          if (stopped) {
            await this.sessionService.closeManagedPersistentContext(browserContext, profilePath);
            browserContext = null;
            throw new Error("RECOVERY_DISPLAY_PROCESS_FAILED");
          }
          const contextForCloseHandler = browserContext;
          contextForCloseHandler.once("close", () => {
            if (!stopped && browserContext === contextForCloseHandler) void cleanup("browser_exit");
          });
          const page = contextForCloseHandler.pages()[0] || await contextForCloseHandler.newPage();
          await page.goto("https://chat.line.biz/", { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => undefined);
          lease.assertOwnership();

          if (this.sessionService.isMirrorCycleActive()) throw new Error("LIVE_MIRROR_ACTIVE");
          if (stopped) throw new Error("RECOVERY_BROWSER_EXITED_DURING_STARTUP");
          this.active = { sessionKey, token, expiresAt, stop: cleanup };
          const timer = setTimeout(() => void cleanup("ttl_expired"), ttlMs);
          timer.unref?.();
          this.logger.log(JSON.stringify({ event: "line_chat_novnc_recovery_started", sessionKey, expiresAt: expiresAt.toISOString() }));
          resolveStarted(this.snapshot());
          await stoppedPromise;
          clearTimeout(timer);
        } catch (error) {
          await cleanup("startup_error");
          rejectStarted(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
      { waitForLock: true },
    ).then((result) => {
      if (!result.acquired) rejectStarted(new Error("PROFILE_OPERATION_BUSY"));
    }).catch((error: unknown) => rejectStarted(error instanceof Error ? error : new Error(String(error)))).finally(() => {
      this.active = null;
      this.resumeMirror();
    });
    this.operationPromise = operation;

    return started;
  }
}
