import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";
import {
  applyPilotMappings,
  assertPilotMappingStore,
  buildPilotMappingPlan,
  formatMappingApplySummary,
  formatPilotMappingReport,
  loadPilotMappingContext,
  type PilotMappingPlan,
} from "../src/line-chat/line-chat-chat-mapping";

export interface MappingDiscoveryCliOptions {
  storeCode: string;
  apply: boolean;
}

export interface MappingDiscoveryCliDependencies {
  prisma: PrismaClient;
  session: Pick<LineChatSessionService, "discoverChats" | "resolveProfilePath">;
  output: (message: string) => void;
}

export function parseMappingDiscoveryArgs(args: readonly string[]): MappingDiscoveryCliOptions {
  let storeCode = "";
  let apply = false;
  let dryRun = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--store") storeCode = args[++index] ?? "";
    else if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`Unknown argument "${arg}".`);
  }
  if (!storeCode) throw new Error("Missing --store. Usage: npm run line-chat:mapping:discover -- --store 28375 [--dry-run | --apply]");
  if (apply && dryRun) throw new Error("Choose either --dry-run or --apply, not both.");
  assertPilotMappingStore(storeCode);
  return { storeCode, apply };
}

export async function runMappingDiscoveryCli(
  args: readonly string[],
  dependencies?: MappingDiscoveryCliDependencies,
): Promise<PilotMappingPlan> {
  const options = parseMappingDiscoveryArgs(args);
  const ownsPrisma = !dependencies;
  const prisma = dependencies?.prisma ?? new PrismaClient();
  const session = dependencies?.session ?? new LineChatSessionService();
  const output = dependencies?.output ?? console.log;

  try {
    const context = await loadPilotMappingContext(prisma, options.storeCode);
    const profilePath = session.resolveProfilePath({
      profilePath: context.lineOfficialAccount.profilePath,
      sessionKey: context.lineOfficialAccount.sessionKey,
    });
    const discovery = await session.discoverChats({
      botId: context.lineOfficialAccount.chatBotId,
      profilePath,
      headless: true,
    });
    const plan = buildPilotMappingPlan(context, discovery);
    output(formatPilotMappingReport(plan, options.apply));
    if (!options.apply) {
      output("[DRY-RUN] Completed with zero database mutations, zero nickname changes, and zero queue creation.");
      return plan;
    }
    const result = await applyPilotMappings(plan, prisma);
    output(formatMappingApplySummary(result));
    if (result.applyBlocked) throw new Error(result.blockReason || "Mapping apply is blocked by safety preconditions.");
    if (result.failedWrites > 0) throw new Error(`Mapping apply failed for ${result.failedWrites} write(s).`);
    return plan;
  } finally {
    if (ownsPrisma) await prisma.$disconnect();
  }
}

if (require.main === module) {
  runMappingDiscoveryCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Mapping discovery failed: ${message}`);
    process.exitCode = 1;
  });
}
