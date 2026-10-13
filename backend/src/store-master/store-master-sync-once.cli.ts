import { readFile } from "node:fs/promises";
import { PrismaService } from "../prisma.service";
import { parseStoreMasterApprovedChangeSet } from "./store-master-approval";
import { getStoreMasterPreviewCliOutcome, parseStoreMasterSyncCliArgs } from "./store-master-cli-args";
import { StoreMasterService } from "./store-master.service";
import { fetchStoreMasterCsvSnapshot } from "./store-master-source";

async function main() {
  const options = parseStoreMasterSyncCliArgs(process.argv.slice(2));
  const approvedChangeSet = options.approvedChangeSetPath
    ? parseStoreMasterApprovedChangeSet(JSON.parse(await readFile(options.approvedChangeSetPath, "utf8")) as unknown)
    : [];
  const snapshot = await fetchStoreMasterCsvSnapshot();
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const result = await new StoreMasterService(prisma).syncFromGoogleSheet(snapshot, {
      apply: options.apply,
      expectedSha256: options.expectedSha256,
      approvedChangeSet,
    });
    process.stdout.write(`${JSON.stringify({ event: options.apply ? "store_master_sync_applied" : "store_master_sync_preview", ...result }, null, 2)}\n`);
    if (result.mode === "PREVIEW") {
      const outcome = getStoreMasterPreviewCliOutcome(result.preview.identityConflicts);
      if (outcome.diagnostic) process.stderr.write(`${JSON.stringify(outcome.diagnostic)}\n`);
      process.exitCode = outcome.exitCode;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    event: "store_master_sync_failed",
    message: error instanceof Error ? error.message : "Store Master sync failed",
  })}\n`);
  process.exitCode = 1;
});
