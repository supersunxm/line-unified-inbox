import { readFileSync } from "node:fs";
import { PrismaClient, ProductAliasSource } from "@prisma/client";
import { adoptProductAliasOwnership, ProductAliasAdoptionEntry } from "../src/classification/product-alias-adoption";

const manifest = JSON.parse(
  readFileSync("scripts/data/product-alias-adoption-phase1.json", "utf8"),
) as ProductAliasAdoptionEntry[];

function fixturePrisma(entries: ProductAliasAdoptionEntry[]) {
  const rows = entries.map((entry) => ({
    id: entry.id,
    normalizedAlias: entry.normalizedAlias,
    isActive: true,
    source: ProductAliasSource.MANUAL,
    productModel: { name: entry.modelName },
  }));
  return {
    productAlias: {
      findMany: () => Promise.resolve(rows),
    },
    $transaction: () => Promise.reject(new Error("Fixture dry-run must not start a transaction")),
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  const fixture = process.argv.includes("--fixture");
  if (dryRun === apply) throw new Error("Choose exactly one of --dry-run or --apply");
  if (apply && !process.argv.includes("--confirm=ADOPT_PHASE1_PRODUCT_ALIASES")) {
    throw new Error("Ownership adoption requires --confirm=ADOPT_PHASE1_PRODUCT_ALIASES");
  }
  if (fixture && !dryRun) throw new Error("Fixture mode supports --dry-run only");
  if (fixture) {
    const result = await adoptProductAliasOwnership(fixturePrisma(manifest) as never, manifest, true);
    console.log(`Product alias adoption fixture: manifest=${result.manifestEntries} eligible=${result.eligible} updated=${result.updated} dryRun=${result.dryRun}`);
    return;
  }
  const prisma = new PrismaClient();
  try {
    const result = await adoptProductAliasOwnership(prisma, manifest, dryRun);
    console.log(`Product alias adoption ${dryRun ? "dry run" : "applied"}: manifest=${result.manifestEntries} eligible=${result.eligible} alreadyAdopted=${result.alreadyAdopted} updated=${result.updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Product alias adoption failed");
  process.exitCode = 1;
});
