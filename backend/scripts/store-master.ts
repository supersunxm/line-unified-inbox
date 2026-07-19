import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma.service";
import { StoreMasterService } from "../src/store-master/store-master.service";

async function main() {
  const prisma = new PrismaClient(); const service = new StoreMasterService(prisma as PrismaService);
  try {
    const result = process.argv[2] === "validate" ? await service.validate() : await service.importFromConfiguredSource(process.argv[3]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally { await prisma.$disconnect(); }
}
void main();
