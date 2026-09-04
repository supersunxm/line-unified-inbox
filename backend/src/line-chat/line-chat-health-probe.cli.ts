import { NestFactory } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameWorkerModule } from "./line-chat-nickname-worker.module";
import { LineChatSessionHealthProbeService } from "./line-chat-session-health-probe.service";

export interface LineChatHealthProbeCliArgs {
  sessionKey: string;
  confirmReadOnly: boolean;
}

export function parseLineChatHealthProbeCliArgs(argv: string[]): LineChatHealthProbeCliArgs {
  let sessionKey = "";
  let confirmReadOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--session-key") {
      sessionKey = argv[++i] || "";
    } else if (arg.startsWith("--session-key=")) {
      sessionKey = arg.slice("--session-key=".length);
    } else if (arg === "--confirm-read-only") {
      confirmReadOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      return { sessionKey: "", confirmReadOnly: false };
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { sessionKey: sessionKey.trim(), confirmReadOnly };
}

function printHelp(): void {
  console.log(`
LINE Chat Manual Session Health Probe

This operator-only command must run in the dedicated line-chat nickname worker
runtime where the persistent profile volume is mounted. It never navigates to
an individual customer chat and never performs a nickname mutation.

Usage:
  node dist/line-chat/line-chat-health-probe.cli.js \\
    --session-key <sessionKey> --confirm-read-only

Required:
  --session-key <value>   Existing LineChatSession.sessionKey
  --confirm-read-only     Explicit operator acknowledgement
`);
}

export async function runLineChatHealthProbeCli(
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const args = parseLineChatHealthProbeCliArgs(argv);
  if (!args.sessionKey) {
    throw new Error("--session-key is required");
  }
  if (!args.confirmReadOnly) {
    throw new Error("--confirm-read-only is required");
  }

  if (process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true") {
    throw new Error("HEALTH_PROBE_BLOCKED_MAINTENANCE");
  }

  const previousDisable = process.env.DISABLE_NICKNAME_WORKER;
  if (previousDisable === "true") {
    throw new Error("HEALTH_PROBE_BLOCKED_WORKER_DISABLED");
  }

  // Disable queue polling only inside this one-off CLI process. The running
  // worker service is untouched. Browser ownership is still enforced by the
  // shared DB-backed profile operation coordinator.
  process.env.DISABLE_NICKNAME_WORKER = "true";

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn"],
  });

  try {
    const prisma = app.get(PrismaService);
    const probe = app.get(LineChatSessionHealthProbeService);
    const session = await prisma.lineChatSession.findUnique({
      where: { sessionKey: args.sessionKey },
      select: { id: true, sessionKey: true },
    });

    if (!session) {
      throw new Error(`LINE_CHAT_SESSION_NOT_FOUND:${args.sessionKey}`);
    }

    const result = await probe.probeSession(session.id, "MANUAL");

    if (result.outcome === "SKIPPED_BUSY") {
      console.log(JSON.stringify({
        event: "line_chat_manual_session_health_probe",
        sessionKey: session.sessionKey,
        outcome: result.outcome,
        retryAfterMs: result.retryAfterMs,
      }));
      process.exitCode = 2;
      return;
    }

    console.log(JSON.stringify({
      event: "line_chat_manual_session_health_probe",
      sessionKey: session.sessionKey,
      outcome: result.outcome,
      status: result.status,
      failureStage: result.failureStage,
      transitionEventCreated: result.transitionEventCreated,
      durationMs: result.durationMs,
    }));
  } finally {
    await app.close();
    if (previousDisable === undefined) {
      delete process.env.DISABLE_NICKNAME_WORKER;
    } else {
      process.env.DISABLE_NICKNAME_WORKER = previousDisable;
    }
  }
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith("line-chat-health-probe.cli.ts"))) {
  runLineChatHealthProbeCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      event: "line_chat_manual_session_health_probe_failed",
      error: message,
    }));
    process.exitCode = 1;
  });
}
