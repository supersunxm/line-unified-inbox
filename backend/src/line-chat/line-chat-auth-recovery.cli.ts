import { NestFactory } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameWorkerModule } from "./line-chat-nickname-worker.module";
import { LineChatAuthRecoveryService } from "./line-chat-auth-recovery.service";

export interface LineChatAuthRecoveryCliArgs {
  sessionKey: string;
  confirmReadOnly: boolean;
  bypassCooldown: boolean;
}

export function parseLineChatAuthRecoveryCliArgs(argv: string[]): LineChatAuthRecoveryCliArgs {
  let sessionKey = "";
  let confirmReadOnly = false;
  let bypassCooldown = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--session-key") {
      sessionKey = argv[++i] || "";
    } else if (arg.startsWith("--session-key=")) {
      sessionKey = arg.slice("--session-key=".length);
    } else if (arg === "--confirm-read-only" || arg === "--confirm") {
      confirmReadOnly = true;
    } else if (arg === "--bypass-cooldown") {
      bypassCooldown = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      return { sessionKey: "", confirmReadOnly: false, bypassCooldown: false };
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { sessionKey: sessionKey.trim(), confirmReadOnly, bypassCooldown };
}

function printHelp(): void {
  console.log(`
LINE Chat Automatic Lightweight Re-authentication Recovery CLI

This operator command attempts safe remembered-account re-authentication
for a session in AUTH_REQUIRED at MANAGER_AUTH. It never automates passwords,
OTPs, QR codes, or verification challenges.

Usage:
  npm run line-chat:recover-auth -- \\
    --session-key <sessionKey> --confirm-read-only [--bypass-cooldown]

Required:
  --session-key <value>   Existing LineChatSession.sessionKey
  --confirm-read-only     Explicit operator acknowledgement

Optional:
  --bypass-cooldown       Bypass the 15-minute cooldown check
`);
}

export async function runLineChatAuthRecoveryCli(
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const args = parseLineChatAuthRecoveryCliArgs(argv);
  if (!args.sessionKey) {
    throw new Error("--session-key is required");
  }
  if (!args.confirmReadOnly) {
    throw new Error("--confirm-read-only is required");
  }

  if (process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true") {
    throw new Error("AUTH_RECOVERY_BLOCKED_MAINTENANCE");
  }

  const previousDisable = process.env.DISABLE_NICKNAME_WORKER;
  if (previousDisable === "true") {
    throw new Error("AUTH_RECOVERY_BLOCKED_WORKER_DISABLED");
  }

  // Disable queue polling only inside this one-off CLI process.
  process.env.DISABLE_NICKNAME_WORKER = "true";

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn"],
  });

  try {
    const prisma = app.get(PrismaService);
    const recoveryService = app.get(LineChatAuthRecoveryService);
    const session = await prisma.lineChatSession.findUnique({
      where: { sessionKey: args.sessionKey },
      select: { id: true, sessionKey: true },
    });

    if (!session) {
      throw new Error(`LINE_CHAT_SESSION_NOT_FOUND:${args.sessionKey}`);
    }

    const result = await recoveryService.recoverSession(session.id, "MANUAL", {
      bypassCooldown: args.bypassCooldown,
    });

    console.log(
      JSON.stringify({
        event: "line_chat_manual_auth_recovery_result",
        sessionKey: session.sessionKey,
        outcome: result.outcome,
        durationMs: result.durationMs,
        message: result.message,
      }),
    );
  } finally {
    await app.close();
  }
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith("line-chat-auth-recovery.cli.ts"))) {
  runLineChatAuthRecoveryCli().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
