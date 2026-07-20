import { PrismaClient } from "@prisma/client";
import { syncConnectedLineOaMetadata } from "../src/store-master/sync-connected-line-oa";

async function main() {
  const prisma = new PrismaClient();
  try { process.stdout.write(`${JSON.stringify(await syncConnectedLineOaMetadata(prisma, process.argv.includes("--dry-run")), null, 2)}\n`); }
  finally { await prisma.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Store Master sync failed"); process.exitCode = 1; });
