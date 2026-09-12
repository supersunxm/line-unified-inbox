import { PrismaClient } from "@prisma/client";
import { auditActiveStoreLineOaIntegrity } from "../src/line-official-accounts/line-oa-integrity-audit";

async function main() {
  if (process.argv.some((argument) => argument === "--apply" || argument === "--write")) {
    throw new Error("This command is permanently read-only and does not accept mutation flags");
  }
  const prisma = new PrismaClient();
  try {
    process.stdout.write(`${JSON.stringify(await auditActiveStoreLineOaIntegrity(prisma), null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
