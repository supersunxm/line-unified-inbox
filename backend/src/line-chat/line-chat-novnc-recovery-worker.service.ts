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
  if (child.exitCode !== null || child.killed) return Promise.resolve();
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
      return { active: false, sessionKey: null };
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
    if (this.startPromise) throw new Error("RECOVERY_START_IN_PROGRESS");
    this.startPromise = (async () => {
      await this.mirrorService.pauseForManualRecovery();
      try {
        return await this.startInternal(sessionKey);
      } catch (error) {
        this.mirrorService.resumeAfterManualRecovery();
        throw error;
      }
    })().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  public async stop(sessionKey: string, reason = "operator_stop"): Promise<LineChatNovncRecoverySnapshot> {
    if (!RECOVERY_SESSION_KEYS.has(sessionKey)) throw new Error("RECOVERY_SESSION_NOT_ALLOWED");
    if (this.active) {
      if (this.active.sessionKey !== sessionKey) throw new Error("RECOVERY_OTHER_SESSION_ACTIVE");
      await this.active.stop(reason);
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

    void this.profileCoordinator.withProfileOperation(
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
          return child;
        };

        const cleanup = async (reason: string) => {
          if (stopped) return;
          stopped = true;
          const context = browserContext;
          browserContext = null;
          if (context) await this.sessionService.closeManagedPersistentContext(context, profilePath, {
            sessionId: session.id,
            sessionKey,
            profileStorageKey: session.profileStorageKey ?? undefined,
          }).catch(() => undefined);
          for (const child of [...children].reverse()) if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
          await Promise.all(children.map((child) => waitForExit(child)));
          for (const child of children) if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
          if (this.active?.token === token) this.active = null;
          this.logger.log(JSON.stringify({ event: "line_chat_novnc_recovery_stopped", sessionKey, reason }));
          this.mirrorService.resumeAfterManualRecovery();
          stopResolve();
        };

        try {
          lease.assertOwnership();
          if (this.sessionService.isMirrorCycleActive()) throw new Error("LIVE_MIRROR_ACTIVE");
          spawnManaged("Xvfb", [DISPLAY, "-screen", "0", "1440x900x24", "-nolisten", "tcp"]);
          await new Promise((resolve) => setTimeout(resolve, 500));
          spawnManaged("fluxbox", [], { DISPLAY });
          spawnManaged("x11vnc", ["-display", DISPLAY, "-localhost", "-forever", "-shared", "-nopw", "-rfbport", String(VNC_PORT)]);
          spawnManaged("websockify", [`127.0.0.1:${WEBSOCKIFY_PORT}`, `127.0.0.1:${VNC_PORT}`, "--web=/usr/share/novnc"]);
          await new Promise((resolve) => setTimeout(resolve, 750));

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
          const contextForCloseHandler = browserContext;
          contextForCloseHandler.once("close", () => {
            if (!stopped && browserContext === contextForCloseHandler) void cleanup("browser_exit");
          });
          const page = contextForCloseHandler.pages()[0] || await contextForCloseHandler.newPage();
          await page.goto("https://chat.line.biz/", { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => undefined);
          lease.assertOwnership();

          if (this.sessionService.isMirrorCycleActive()) throw new Error("LIVE_MIRROR_ACTIVE");
          this.active = { sessionKey, token, expiresAt, stop: cleanup };
          // Release the existing lease as soon as the normal Mirror cycle starts.
          const mirrorYieldTimer = setInterval(() => {
            if (this.sessionService.isMirrorCycleActive()) void cleanup("live_mirror_priority");
          }, 250);
          mirrorYieldTimer.unref?.();
          const timer = setTimeout(() => void cleanup("ttl_expired"), ttlMs);
          timer.unref?.();
          this.logger.log(JSON.stringify({ event: "line_chat_novnc_recovery_started", sessionKey, expiresAt: expiresAt.toISOString() }));
          resolveStarted(this.snapshot());
          await stoppedPromise;
          clearTimeout(timer);
          clearInterval(mirrorYieldTimer);
        } catch (error) {
          await cleanup("startup_error");
          rejectStarted(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
      { waitForLock: false },
    ).then((result) => {
      if (!result.acquired) rejectStarted(new Error("PROFILE_OPERATION_BUSY"));
    }).catch((error: unknown) => rejectStarted(error instanceof Error ? error : new Error(String(error))));

    return started;
  }
}
