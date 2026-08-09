/**
 * Bulk Product Re-Analysis Script
 *
 * Re-analyzes existing conversations with the latest product catalog & matcher.
 *
 * Safety Guarantees:
 *   - MANUAL ConversationProduct tags are NEVER overwritten (MANUAL always wins).
 *   - Only RULE-sourced predictions are updated.
 *   - Runs in batches (default: 50) to prevent memory spikes.
 *   - Failure in one conversation does not stop the batch.
 *   - Supports --dry-run to preview changes without database mutations.
 *
 * Usage:
 *   npx tsx scripts/reanalyze-products.ts --dry-run
 *   npx tsx scripts/reanalyze-products.ts
 *   npm run product:reanalyze -- --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { automaticCatalogAliasesForModel, storedProductAliasSafety } from "../src/classification/product-catalog";
import { matchProduct, MatchableModel } from "../src/classification/product-matcher";

export type ReanalysisReport = {
  dryRun: boolean;
  processed: number;
  changed: number;
  unchanged: number;
  manualProtected: number;
  unknown: number;
  failed: number;
};

export async function runProductReanalysis(
  prisma: PrismaClient,
  options: { dryRun?: boolean; batchSize?: number; verbose?: boolean } = {},
): Promise<ReanalysisReport> {
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ?? 50;
  const verbose = options.verbose ?? true;

  console.log(`\n=== Product Intelligence Bulk Re-Analysis (${dryRun ? "DRY RUN" : "LIVE"}) ===\n`);

  // Load all active models with their full catalog & DB aliases
  const storedModels = await prisma.productModel.findMany({
    where: { isActive: true },
    include: { aliases: { where: { isActive: true } }, productSeries: true },
    orderBy: { name: "asc" },
  });

  const models: MatchableModel[] = storedModels.map((model) => ({
    ...model,
    aliases: [
      ...model.aliases.map((alias) => ({
        ...alias,
        safety: storedProductAliasSafety(model.name, alias.alias, alias.source),
      })),
      ...automaticCatalogAliasesForModel(model.name).map(({ alias, safety, language }) => ({
        alias,
        safety,
        language,
        priority: 0,
      })),
    ],
  }));

  const modelMap = new Map(storedModels.map((m) => [m.id, m.name]));

  let cursor: string | undefined;
  let processed = 0;
  let changed = 0;
  let unchanged = 0;
  let manualProtected = 0;
  let unknown = 0;
  let failed = 0;

  const changesList: Array<{
    conversationId: string;
    customer: string;
    current: string | null;
    predicted: string | null;
    confidence: number | null;
    method: string | null;
    phrase: string | null;
  }> = [];

  do {
    const rows = await prisma.conversation.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: {
        customer: { select: { displayName: true } },
        messages: {
          where: { direction: "INBOUND" },
          orderBy: { sentAt: "asc" },
        },
        products: {
          include: { productModel: { select: { name: true } } },
        },
      },
    });

    if (!rows.length) break;

    for (const conv of rows) {
      processed++;

      // Guard: Preserve MANUAL tags unconditionally
      const hasManualProduct = conv.products.some((p) => p.source === "MANUAL");
      if (hasManualProduct) {
        manualProtected++;
        continue;
      }

      // Check inbound messages
      const validMessages = conv.messages
        .filter((m) => m.originalText?.trim())
        .map((m) => ({ id: m.id, text: m.originalText, sentAt: m.sentAt }));

      if (!validMessages.length) {
        unknown++;
        continue;
      }

      try {
        const match = matchProduct(validMessages, models);
        const currentRule = conv.products.find((p) => p.source === "RULE");
        const currentModelName = currentRule ? currentRule.productModel.name : null;
        const predictedModelName = match ? match.model.name : null;

        if (!match) {
          if (currentRule) {
            // Previously had a rule match, now no match
            changed++;
            changesList.push({
              conversationId: conv.id,
              customer: conv.customer.displayName,
              current: currentModelName,
              predicted: null,
              confidence: null,
              method: null,
              phrase: null,
            });

            if (!dryRun) {
              await prisma.conversationProduct.deleteMany({
                where: { conversationId: conv.id, source: "RULE" },
              });
            }
          } else {
            unknown++;
          }
          continue;
        }

        // We have a match
        if (currentRule && currentRule.productModelId === match.model.id) {
          unchanged++;
        } else {
          changed++;
          changesList.push({
            conversationId: conv.id,
            customer: conv.customer.displayName,
            current: currentModelName,
            predicted: predictedModelName,
            confidence: match.confidence,
            method: match.detectionMethod,
            phrase: match.matchedPhrase,
          });

          if (!dryRun) {
            await prisma.$transaction(async (tx) => {
              // Clean up non-MANUAL products (RULE or legacy SEED)
              await tx.conversationProduct.deleteMany({
                where: { conversationId: conv.id, source: { not: "MANUAL" } },
              });
              await tx.conversationProduct.upsert({
                where: {
                  conversationId_productModelId: {
                    conversationId: conv.id,
                    productModelId: match.model.id,
                  },
                },
                update: {
                  confidence: match.confidence,
                  source: "RULE",
                  matchedPhrase: match.matchedPhrase,
                  detectionMethod: match.detectionMethod,
                  sourceMessageId: match.sourceMessageId,
                },
                create: {
                  conversationId: conv.id,
                  productModelId: match.model.id,
                  confidence: match.confidence,
                  source: "RULE",
                  matchedPhrase: match.matchedPhrase,
                  detectionMethod: match.detectionMethod,
                  sourceMessageId: match.sourceMessageId,
                },
              });
            });
          }
        }
      } catch (err) {
        failed++;
        console.error(`[Error] Re-analyzing conversation ${conv.id}:`, err instanceof Error ? err.message : err);
      }
    }

    cursor = rows.at(-1)?.id;
    if (rows.length < batchSize) break;
  } while (cursor);

  // Print sample differences in dry-run mode
  if (verbose && changesList.length > 0) {
    console.log("── Changes Detected ─────────────────────────────────────────────");
    for (const c of changesList) {
      console.log(`  [${c.conversationId.slice(0, 8)}] ${c.customer}`);
      console.log(`    Current   : ${c.current ?? "None (unclassified)"}`);
      console.log(`    New       : ${c.predicted ?? "None"} (conf: ${c.confidence}, method: ${c.method}, phrase: "${c.phrase}")\n`);
    }
  }

  const report: ReanalysisReport = {
    dryRun,
    processed,
    changed,
    unchanged,
    manualProtected,
    unknown,
    failed,
  };

  console.log("── Re-Analysis Summary ──────────────────────────────────────────");
  console.log(JSON.stringify(report, null, 2));
  console.log("\n=================================================================\n");

  return report;
}

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes("--dry-run");
  const sizeArg = process.argv.find((v) => v.startsWith("--batch-size="));
  const batchSize = sizeArg ? Math.max(1, Number(sizeArg.split("=")[1])) : 50;

  try {
    await runProductReanalysis(prisma, { dryRun, batchSize });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error("\n[ERROR]", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
