import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma.service";
import { parseStoreMasterApprovedChangeSet } from "../src/store-master/store-master-approval";
import { parseStoreMasterImportCliArgs } from "../src/store-master/store-master-import-cli-args";
import { StoreMasterService } from "../src/store-master/store-master.service";

async function main() {
  const options = parseStoreMasterImportCliArgs(process.argv.slice(2));
  const approvedChangeSet = options.approvedChangeSetPath
    ? parseStoreMasterApprovedChangeSet(JSON.parse(await readFile(options.approvedChangeSetPath, "utf8")) as unknown)
    : [];
  const prisma = new PrismaClient();
  const service = new StoreMasterService(prisma as PrismaService);
  try {
    const result = options.mode === "validate"
      ? await service.validate()
      : await service.importFromConfiguredSource(options.csvPath, {
          apply: options.apply,
          expectedSha256: options.expectedSha256,
          approvedChangeSet,
        });
    process.stdout.write(`${JSON.stringify({ event: options.apply ? "store_master_import_applied" : "store_master_import_preview", ...result }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    event: "store_master_import_failed",
    message: error instanceof Error ? error.message : "Store Master import failed",
  })}\n`);
  process.exitCode = 1;
});
