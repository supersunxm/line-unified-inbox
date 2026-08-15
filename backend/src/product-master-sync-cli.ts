import { PrismaClient } from "@prisma/client";
import {
  applyProductMasterPlan,
  buildProductMasterPlan,
  fetchProductMasterCsv,
  parseProductMasterCsv,
  readProductMasterState,
} from "./classification/product-master-sync";

async function main() {
  const apply = process.argv.includes("--apply");
  const sheetId = process.env.PRODUCT_MASTER_GOOGLE_SHEET_ID?.trim();
  const gid = process.env.PRODUCT_MASTER_GOOGLE_SHEET_GID?.trim() || "0";
  if (!sheetId) throw new Error("PRODUCT_MASTER_GOOGLE_SHEET_ID is required");
  const prisma = new PrismaClient();
  try {
    const rows = parseProductMasterCsv(await fetchProductMasterCsv(sheetId, gid));
    const state = await readProductMasterState(prisma);
    const plan = buildProductMasterPlan(rows, state.models, state.series);
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", plan }, null, 2));
    if (!apply) return;
    await applyProductMasterPlan(prisma, plan);
    const after = await readProductMasterState(prisma);
    const secondRun = buildProductMasterPlan(rows, after.models, after.series);
    console.log(JSON.stringify({ secondRun: {
      createCount: secondRun.createCount,
      updateCount: secondRun.updateCount,
      reactivateCount: secondRun.reactivateCount,
      unchangedCount: secondRun.unchangedCount,
      skippedCount: secondRun.skippedCount,
      deleteCount: secondRun.deleteCount,
      variantCreateCount: secondRun.variantCreateCount,
      variantReactivateCount: secondRun.variantReactivateCount,
      variantUnchangedCount: secondRun.variantUnchangedCount,
    } }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Product Master sync failed");
  process.exitCode = 1;
});
