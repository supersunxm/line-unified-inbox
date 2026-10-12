import { readFile } from "node:fs/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseStoreMasterApprovedChangeSet } from "../src/store-master/store-master-approval";
import { parseConnectedLineOaCliArgs } from "../src/store-master/sync-connected-line-oa-cli-args";
import { syncConnectedLineOaMetadata } from "../src/store-master/sync-connected-line-oa";
import { acquireStoreMasterApplyLock } from "../src/store-master/store-master-transaction";

async function main() {
  const options = parseConnectedLineOaCliArgs(process.argv.slice(2));
  const approvedChangeSet = options.approvedChangeSetPath
    ? parseStoreMasterApprovedChangeSet(JSON.parse(await readFile(options.approvedChangeSetPath, "utf8")) as unknown)
    : [];
  const prisma = new PrismaClient();
  try {
    const report = options.apply
      ? await prisma.$transaction(async (tx) => {
          await acquireStoreMasterApplyLock(tx);
          const result = await syncConnectedLineOaMetadata(tx, false, approvedChangeSet);
          if (result.failed > 0 || result.identityConflict > 0 || result.storeIdConflicts > 0) {
            throw new Error(`Store Master reconciliation blocked (failed: ${result.failed}, identity conflicts: ${result.identityConflict}, Store ID conflicts: ${result.storeIdConflicts})`);
          }
          return result;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 60000 })
      : await syncConnectedLineOaMetadata(prisma, true);
    process.stdout.write(`${JSON.stringify({ event: options.apply ? "connected_line_oa_reconciliation_applied" : "connected_line_oa_reconciliation_preview", ...report }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    event: "connected_line_oa_reconciliation_failed",
    message: error instanceof Error ? error.message : "Store Master reconciliation failed",
  })}\n`);
  process.exitCode = 1;
});
