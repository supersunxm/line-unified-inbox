import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma.service";
import {
  applyPilotBackfill,
  assertPilotStore,
  formatBackfillApplySummary,
  formatPilotBackfillReport,
  loadPilotBackfillPlan,
  type NicknameQueue,
} from "../src/line-chat/line-chat-nickname-backfill";
import { LineChatNicknameQueueService } from "../src/line-chat/line-chat-nickname-queue.service";

export interface BackfillCliOptions {
  storeCode: string;
  apply: boolean;
}

export interface BackfillCliDependencies {
  prisma: PrismaClient;
  queue: NicknameQueue;
  output: (message: string) => void;
}

export function parseBackfillArgs(args: readonly string[]): BackfillCliOptions {
  let storeCode = "";
  let apply = false;
  let explicitDryRun = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--store") {
      storeCode = args[++index] ?? "";
    } else if (arg === "--apply") {
      apply = true;
    } else if (arg === "--dry-run") {
      explicitDryRun = true;
    } else {
      throw new Error(`Unknown argument "${arg}".`);
    }
  }

  if (!storeCode) {
    throw new Error(`Missing --store. Usage: npm run line-chat:nickname:backfill -- --store 28375 [--dry-run | --apply]`);
  }
  if (apply && explicitDryRun) {
    throw new Error("Choose either --dry-run or --apply, not both.");
  }
  assertPilotStore(storeCode);
  return { storeCode, apply };
}

export async function runBackfillCli(
  args: readonly string[],
  dependencies?: BackfillCliDependencies,
): Promise<void> {
  const options = parseBackfillArgs(args);
  const ownsPrisma = !dependencies;
  const prisma = dependencies?.prisma ?? new PrismaClient();
  const queue = dependencies?.queue ?? new LineChatNicknameQueueService(
    prisma as unknown as PrismaService,
  );
  const output = dependencies?.output ?? console.log;

  try {
    const plan = await loadPilotBackfillPlan(prisma, options.storeCode);
    output(formatPilotBackfillReport(plan, options.apply));

    if (!options.apply) {
      output("[DRY-RUN] Completed with zero database mutations and zero network calls.");
      return;
    }

    const result = await applyPilotBackfill(plan, queue);
    output(formatBackfillApplySummary(result));
    if (result.failedCount > 0) {
      throw new Error(`Backfill apply completed with ${result.failedCount} queue failure(s).`);
    }
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  runBackfillCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Backfill failed: ${message}`);
    process.exitCode = 1;
  });
}
