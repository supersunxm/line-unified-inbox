import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";

const RECOVERY_SESSION_KEY = "profile-b";
const DEFAULT_TTL_MS = 12 * 60 * 1000;
const DISPLAY = ":99";
const VNC_PORT = 5900;

export interface LineChatNovncRecoverySnapshot {
  active: boolean;
  sessionKey: typeof RECOVERY_SESSION_KEY;
  path?: string;
  expiresAt?: string;
}

type ActiveRecovery = {
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
  ) {}

  public snapshot(): LineChatNovncRecoverySnapshot {
    if (!this.active || this.active.expiresAt.getTime() <= Date.now()) {
      return { active: false, sessionKey: RECOVERY_SESSION_KEY };
    }
    return {
      active: true,
      sessionKey: RECOVERY_SESSION_KEY,
      path: `/recovery/${this.active.token}/vnc.html?autoconnect=true&resize=scale&path=recovery/${this.active.token}/websockify`,
      expiresAt: this.active.expiresAt.toISOString(),
    };
  }

  public authorize(token: string): boolean {
    return Boolean(
      this.active
      && this.active.token === token
      && this.active.expiresAt.getTime() > Date.now(),
    );
  }

  public async start(sessionKey: string): Promise<LineChatNovncRecoverySnapshot> {
    if (sessionKey !== RECOVERY_SESSION_KEY) {
      throw new Error("RECOVERY_SESSION_NOT_ALLOWED");
    }
    const current = this.snapshot();
    if (current.active) return current;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  public async stop(sessionKey: string, reason = "operator_stop"): Promise<LineChatNovncRecoverySnapshot> {
    if (sessionKey !== RECOVERY_SESSION_KEY) {
      throw new Error("RECOVERY_SESSION_NOT_ALLOWED");
    }
    const active = this.active;
    if (active) await active.stop(reason);
    return this.snapshot();
  }

  private async startInternal(): Promise<LineChatNovncRecoverySnapshot> {
    const session = await this.prisma.lineChatSession.findUnique({
      where: { sessionKey: RECOVERY_SESSION_KEY },
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
        let stopped = false;
        let stopResolve!: () => void;
        const stoppedPromise = new Promise<void>((resolve) => { stopResolve = resolve; });
        const token = randomBytes(32).toString("base64url");
        const ttlMs = Math.min(15 * 60 * 1000, Math.max(5 * 60 * 1000, Number(process.env.LINE_CHAT_NOVNC_TTL_MS || DEFAULT_TTL_MS)));
        const expiresAt = new Date(Date.now() + ttlMs);

        const spawnManaged = (command: string, args: string[], env?: NodeJS.ProcessEnv) => {
          const child = spawn(command, args, {
            env: { ...process.env, ...env },
            stdio: ["ignore", "ignore", "pipe"],
          });
          children.push(child);
          child.stderr?.on("data", () => undefined);
          return child;
        };

        const cleanup = async (reason: string) => {
          if (stopped) return;
          stopped = true;
          for (const child of [...children].reverse()) {
            if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
          }
          await Promise.all(children.map((child) => waitForExit(child)));
          for (const child of children) {
            if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
          }
          if (this.active?.token === token) this.active = null;
          this.logger.log(JSON.stringify({
            event: "line_chat_novnc_recovery_stopped",
            sessionKey: RECOVERY_SESSION_KEY,
            reason,
          }));
          stopResolve();
        };

        try {
          lease.assertOwnership();
          spawnManaged("Xvfb", [DISPLAY, "-screen", "0", "1440x900x24", "-nolisten", "tcp"]);
          await new Promise((resolve) => setTimeout(resolve, 500));
          spawnManaged("fluxbox", [], { DISPLAY });
          spawnManaged("x11vnc", ["-display", DISPLAY, "-localhost", "-forever", "-shared", "-nopw", "-rfbport", String(VNC_PORT)]);
          await new Promise((resolve) => setTimeout(resolve, 500));
          const chrome = spawnManaged("chromium", [
            `--user-data-dir=${profilePath}`,
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--window-size=1440,900",
            "https://chat.line.biz/",
          ], { DISPLAY });
          chrome.once("exit", () => void cleanup("browser_exit"));

          this.active = {
            token,
            expiresAt,
            stop: cleanup,
          };
          const timer = setTimeout(() => void cleanup("ttl_expired"), ttlMs);
          timer.unref?.();

          this.logger.log(JSON.stringify({
            event: "line_chat_novnc_recovery_started",
            sessionKey: RECOVERY_SESSION_KEY,
            expiresAt: expiresAt.toISOString(),
          }));
          resolveStarted(this.snapshot());
          await stoppedPromise;
          clearTimeout(timer);
        } catch (error) {
          await cleanup("startup_error");
          rejectStarted(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
    ).then((result) => {
      if (!result.acquired) rejectStarted(new Error("PROFILE_OPERATION_BUSY"));
    }).catch((error: unknown) => {
      rejectStarted(error instanceof Error ? error : new Error(String(error)));
    });

    return started;
  }
}
