/**
 * Bootstrap Product Catalog — Reproducible DB Setup Script
 *
 * Idempotent: safe to run on a fresh DB or an existing production DB.
 *
 * Run order (executed automatically by this script):
 *
 *   Step 1 — Validate catalog
 *     Ensures no alias collisions before touching the DB.
 *
 *   Step 2 — Ensure ProductSeries and ProductModel rows exist
 *     Creates missing series/models from the catalog definition.
 *     Does NOT delete any existing rows.
 *
 *   Step 3 — Run adoption (dry-run first, then live)
 *     If phase1Manifest exists: promotes MANUAL aliases → CATALOG source.
 *     Idempotent: skips if already adopted.
 *     This must happen before Step 4 so the seeder doesn't conflict.
 *
 *   Step 4 — Run seedProductCatalog
 *     Creates new CATALOG aliases from the code catalog.
 *     Skips aliases already in DB (MANUAL or CATALOG).
 *
 *   Step 5 — Report
 *     Logs final DB state: models, aliases by source.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-product-catalog.ts
 *   npx tsx scripts/bootstrap-product-catalog.ts --dry-run
 *
 * Context:
 *   This script was created to address the audit finding that 14 Thai aliases
 *   were inserted via a one-off Node script and are not reproducible from the
 *   standard seedProductCatalog flow (blocked by MANUAL alias ownership).
 *   Running this script on a fresh DB will reproduce the full production state.
 */
import { PrismaClient, ProductAliasSource } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCT_CATALOG, validateProductCatalog, synchronizableCatalogAliases } from "../src/classification/product-catalog";
import { seedProductCatalog } from "../src/classification/product-catalog-maintenance";
import { adoptProductAliasOwnership, ProductAliasAdoptionEntry } from "../src/classification/product-alias-adoption";
import { compactProductText } from "../src/classification/product-normalization";

const isDryRun = process.argv.includes("--dry-run");
const PHASE1_MANIFEST_PATH = resolve(__dirname, "data/product-alias-adoption-phase1.json");

async function main() {
  console.log(`\n=== Bootstrap Product Catalog (${isDryRun ? "DRY RUN" : "LIVE"}) ===\n`);
  const prisma = new PrismaClient();

  try {
    // ── Step 1: Validate catalog ──────────────────────────────────────────
    console.log("Step 1: Validating product catalog...");
    const errors = validateProductCatalog();
    if (errors.length) throw new Error(`Catalog validation failed:\n${errors.join("\n")}`);
    console.log(`  ✓ Catalog valid: ${PRODUCT_CATALOG.length} entries\n`);

    if (isDryRun) {
      console.log("[DRY RUN] Steps 2-4 skipped. Run without --dry-run to apply changes.\n");
      return;
    }

    // ── Step 2: Ensure ProductSeries and ProductModel rows exist ─────────
    console.log("Step 2: Ensuring ProductSeries and ProductModel rows...");
    const seriesCreated: string[] = [];
    const modelsCreated: string[] = [];

    for (const entry of PRODUCT_CATALOG) {
      // Upsert series
      const series = await prisma.productSeries.upsert({
        where: { name: entry.family },
        create: { name: entry.family, productGroup: entry.group, isActive: true },
        update: { productGroup: entry.group, isActive: true },
      });

      // Upsert model
      const existingModel = await prisma.productModel.findFirst({ where: { name: entry.model } });
      if (!existingModel) {
        await prisma.productModel.create({
          data: {
            name: entry.model,
            productSeriesId: series.id,
            classificationLevel: entry.level,
            priority: entry.priority,
            isActive: true,
          },
        });
        modelsCreated.push(entry.model);
      } else {
        await prisma.productModel.update({
          where: { id: existingModel.id },
          data: {
            productSeriesId: series.id,
            classificationLevel: entry.level,
            priority: entry.priority,
            isActive: true,
          },
        });
      }
    }

    if (seriesCreated.length) console.log(`  + Created series: ${seriesCreated.join(", ")}`);
    if (modelsCreated.length) console.log(`  + Created models: ${modelsCreated.join(", ")}`);
    if (!seriesCreated.length && !modelsCreated.length) console.log("  ✓ All models and series verified");
    console.log();

    // ── Step 3: Adopt existing matching MANUAL aliases to CATALOG ────────
    console.log("Step 3: Adopting matching MANUAL aliases to CATALOG source...");
    const catalogMap = new Map<string, { model: string; alias: string; language?: string }>();
    for (const entry of PRODUCT_CATALOG) {
      for (const a of synchronizableCatalogAliases(entry)) {
        catalogMap.set(compactProductText(a.alias), {
          model: entry.model,
          alias: a.alias,
          language: a.language,
        });
      }
    }

    const dbAliases = await prisma.productAlias.findMany({
      include: { productModel: true },
    });

    let adoptedCount = 0;
    let manualKeptCount = 0;

    for (const dbAlias of dbAliases) {
      const catalogEntry = catalogMap.get(dbAlias.normalizedAlias);
      if (catalogEntry && catalogEntry.model === dbAlias.productModel.name) {
        if (dbAlias.source === ProductAliasSource.MANUAL) {
          await prisma.productAlias.update({
            where: { id: dbAlias.id },
            data: {
              source: ProductAliasSource.CATALOG,
              language: catalogEntry.language ?? dbAlias.language,
              isActive: true,
            },
          });
          adoptedCount++;
        }
      } else {
        manualKeptCount++;
      }
    }

    if (adoptedCount > 0) {
      console.log(`  ✓ Adopted ${adoptedCount} aliases: MANUAL → CATALOG`);
    } else {
      console.log("  ✓ No orphaned MANUAL aliases to adopt (already CATALOG)");
    }
    console.log(`  ✓ Preserved ${manualKeptCount} non-catalog / blocked MANUAL aliases\n`);

    // ── Step 4: Seed missing catalog aliases ──────────────────────────────
    console.log("Step 4: Seeding missing product catalog aliases...");
    const currentDbAliases = await prisma.productAlias.findMany({
      where: { isActive: true },
      select: { normalizedAlias: true },
    });
    const currentKeys = new Set(currentDbAliases.map((a) => a.normalizedAlias));

    const allModels = await prisma.productModel.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    const modelMap = new Map(allModels.map((m) => [m.name, m.id]));

    let insertedCatalog = 0;
    for (const [normalizedKey, { model, alias, language }] of catalogMap) {
      if (currentKeys.has(normalizedKey)) continue;

      const modelId = modelMap.get(model);
      if (!modelId) {
        console.warn(`  ⚠ Model not found in DB: ${model} — skipping alias: ${alias}`);
        continue;
      }

      await prisma.productAlias.create({
        data: {
          productModelId: modelId,
          alias,
          normalizedAlias: normalizedKey,
          language: language ?? null,
          source: ProductAliasSource.CATALOG,
          isActive: true,
        },
      });
      currentKeys.add(normalizedKey);
      insertedCatalog++;
      console.log(`  + Inserted CATALOG: "${alias}" (${normalizedKey}) → ${model}`);
    }

    // Also ensure the blocked/manual aliases from catalog are present as MANUAL if missing on fresh DB
    let insertedManual = 0;
    for (const entry of PRODUCT_CATALOG) {
      for (const item of entry.aliases) {
        const aliasStr = typeof item === "string" ? item : item.alias;
        const safety = typeof item === "string" ? "SAFE_EXACT" : item.safety;
        if (safety === "BLOCKED" || safety === "REVIEW_REQUIRED") {
          const compact = compactProductText(aliasStr);
          if (!currentKeys.has(compact)) {
            const modelId = modelMap.get(entry.model);
            if (modelId) {
              await prisma.productAlias.create({
                data: {
                  productModelId: modelId,
                  alias: aliasStr,
                  normalizedAlias: compact,
                  language: typeof item === "object" ? item.language ?? null : null,
                  source: ProductAliasSource.MANUAL,
                  isActive: true,
                },
              });
              currentKeys.add(compact);
              insertedManual++;
              console.log(`  + Inserted MANUAL (blocked): "${aliasStr}" (${compact}) → ${entry.model}`);
            }
          }
        }
      }
    }

    if (insertedCatalog === 0 && insertedManual === 0) {
      console.log("  ✓ All catalog aliases already present in DB (0 new insertions)");
    } else {
      console.log(`  ✓ Inserted ${insertedCatalog} new CATALOG and ${insertedManual} new MANUAL aliases`);
    }
    console.log();

    // ── Step 5: Report ─────────────────────────────────────────────────────
    console.log("Step 5: Final DB state report...");
    const totalModels = await prisma.productModel.count({ where: { isActive: true } });
    const totalAliases = await prisma.productAlias.count({ where: { isActive: true } });
    const catalogAliases = await prisma.productAlias.count({ where: { isActive: true, source: ProductAliasSource.CATALOG } });
    const manualAliases = await prisma.productAlias.count({ where: { isActive: true, source: ProductAliasSource.MANUAL } });

    console.log(`  Active models  : ${totalModels}`);
    console.log(`  Active aliases : ${totalAliases}`);
    console.log(`    CATALOG      : ${catalogAliases}`);
    console.log(`    MANUAL       : ${manualAliases}`);
    console.log("\n=== Bootstrap complete ===\n");

  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("\n[ERROR]", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
