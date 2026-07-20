import { PrismaClient } from "@prisma/client";
import { PRODUCT_CATALOG, validateProductCatalog } from "../src/classification/product-catalog";
import { seedProductCatalog } from "../src/classification/product-catalog-maintenance";

async function main() {
  const command = process.argv[2] ?? "validate"; const errors = validateProductCatalog();
  if (errors.length) throw new Error(errors.join("\n"));
  if (command === "validate") console.log(`Product catalog valid: ${PRODUCT_CATALOG.length} canonical entries`);
  else if (command === "seed") { const prisma = new PrismaClient(); await seedProductCatalog(prisma).finally(() => prisma.$disconnect()); console.log(`Product catalog synchronized: ${PRODUCT_CATALOG.length} canonical entries`); }
  else throw new Error("Usage: product-catalog.ts validate|seed");
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Product catalog command failed"); process.exitCode = 1; });
