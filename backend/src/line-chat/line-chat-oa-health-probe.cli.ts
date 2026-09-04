import { NestFactory } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameWorkerModule } from "./line-chat-nickname-worker.module";
import { LineChatOaHealthProbeService } from "./line-chat-oa-health-probe.service";

export interface LineChatOaHealthProbeCliArgs {
  oaId: string;
  basicId: string;
  confirmReadOnly: boolean;
}

export function parseLineChatOaHealthProbeCliArgs(argv: string[]): LineChatOaHealthProbeCliArgs {
  let oaId = "";
  let basicId = "";
  let confirmReadOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--oa-id") {
      oaId = argv[++i] || "";
    } else if (arg.startsWith("--oa-id=")) {
      oaId = arg.slice("--oa-id=".length);
    } else if (arg === "--basic-id") {
      basicId = argv[++i] || "";
    } else if (arg.startsWith("--basic-id=")) {
      basicId = arg.slice("--basic-id=".length);
    } else if (arg === "--confirm-read-only") {
      confirmReadOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      return { oaId: "", basicId: "", confirmReadOnly: false };
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { oaId: oaId.trim(), basicId: basicId.trim(), confirmReadOnly };
}

function printHelp(): void {
  console.log(`
LINE Chat Manual OA Health Probe

This operator-only command must run in the dedicated line-chat nickname worker
runtime where the persistent profile volume is mounted. It verifies Manager
auth, the selected OA workspace, and its natural chat-list response. It never
opens an individual customer chat and never performs a nickname mutation.

Usage:
  node dist/line-chat/line-chat-oa-health-probe.cli.js \\
    --oa-id <LineOfficialAccount.id> --confirm-read-only

or:
  node dist/line-chat/line-chat-oa-health-probe.cli.js \\
    --basic-id <@basicId> --confirm-read-only

Required:
  exactly one of --oa-id or --basic-id
  --confirm-read-only     Explicit operator acknowledgement
`);
}

export async function runLineChatOaHealthProbeCli(
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const args = parseLineChatOaHealthProbeCliArgs(argv);
  const selectors = Number(Boolean(args.oaId)) + Number(Boolean(args.basicId));
  if (selectors !== 1) {
    throw new Error("Exactly one of --oa-id or --basic-id is required");
  }
  if (!args.confirmReadOnly) {
    throw new Error("--confirm-read-only is required");
  }

  if (process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true") {
    throw new Error("OA_HEALTH_PROBE_BLOCKED_MAINTENANCE");
  }

  const previousDisable = process.env.DISABLE_NICKNAME_WORKER;
  if (previousDisable === "true") {
    throw new Error("OA_HEALTH_PROBE_BLOCKED_WORKER_DISABLED");
  }

  // Prevent the one-off CLI process from starting a second nickname polling
  // loop. The already-running production worker is untouched, and the shared
  // DB-backed profile coordinator serializes browser ownership.
  process.env.DISABLE_NICKNAME_WORKER = "true";

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn"],
  });

  try {
    const prisma = app.get(PrismaService);
    const probe = app.get(LineChatOaHealthProbeService);
    const oa = args.oaId
      ? await prisma.lineOfficialAccount.findUnique({
          where: { id: args.oaId },
          select: { id: true },
        })
      : await prisma.lineOfficialAccount.findUnique({
          where: { basicId: args.basicId },
          select: { id: true },
        });

    if (!oa) {
      throw new Error("LINE_OFFICIAL_ACCOUNT_NOT_FOUND");
    }

    const result = await probe.probeOa(oa.id, "MANUAL");

    if (result.outcome === "SKIPPED_BUSY") {
      console.log(JSON.stringify({
        event: "line_chat_manual_oa_health_probe",
        lineOfficialAccountId: oa.id,
        outcome: result.outcome,
        retryAfterMs: result.retryAfterMs,
      }));
      process.exitCode = 2;
      return;
    }

    console.log(JSON.stringify({
      event: "line_chat_manual_oa_health_probe",
      lineOfficialAccountId: oa.id,
      outcome: result.outcome,
      status: result.status,
      failureStage: result.failureStage,
      transitionEventCreated: result.transitionEventCreated,
      sessionStatus: result.sessionStatus,
      sessionTransitionEventCreated: result.sessionTransitionEventCreated,
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

if (require.main === module || (process.argv[1] && process.argv[1].endsWith("line-chat-oa-health-probe.cli.ts"))) {
  runLineChatOaHealthProbeCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      event: "line_chat_manual_oa_health_probe_failed",
      error: message,
    }));
    process.exitCode = 1;
  });
}
