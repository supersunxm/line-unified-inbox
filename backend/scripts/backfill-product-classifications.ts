import { PrismaClient } from "@prisma/client";
import { matchProduct } from "../src/classification/product-matcher";

async function main() {
  const prisma = new PrismaClient(); const dryRun = process.argv.includes("--dry-run");
  const sizeArg = process.argv.find((value) => value.startsWith("--batch-size=")); const batchSize = Math.max(1, Number(sizeArg?.split("=")[1] ?? 100));
  let cursor: string | undefined; let processed = 0; let updated = 0; let unchanged = 0; let unknown = 0; let failed = 0; let skippedManual = 0;
  try {
    const models = await prisma.productModel.findMany({ where: { isActive: true }, include: { aliases: { where: { isActive: true } }, productSeries: true } });
    do {
      const rows = await prisma.conversation.findMany({ take: batchSize, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" }, include: { messages: { where: { direction: "INBOUND" }, orderBy: { sentAt: "asc" } }, products: true } });
      if (!rows.length) break;
      for (const conversation of rows) {
        processed++; if (conversation.products.some((item) => item.source === "MANUAL")) { skippedManual++; continue; }
        if (!conversation.messages.length) { unknown++; continue; }
        try {
          const result = matchProduct(conversation.messages.map((message) => ({ id: message.id, text: message.originalText, sentAt: message.sentAt })), models); if (!result) { unknown++; continue; }
          const current = conversation.products.find((item) => item.source === "RULE");
          if (current?.productModelId === result.model.id) { unchanged++; continue; }
          updated++;
          if (!dryRun) await prisma.$transaction([prisma.conversationProduct.deleteMany({ where: { conversationId: conversation.id, source: "RULE" } }), prisma.conversationProduct.create({ data: { conversationId: conversation.id, productModelId: result.model.id, confidence: result.confidence, source: "RULE", matchedPhrase: result.matchedPhrase, detectionMethod: result.detectionMethod, sourceMessageId: result.sourceMessageId } })]);
        } catch { failed++; }
      }
      cursor = rows.at(-1)?.id; if (rows.length < batchSize) break;
    } while (cursor);
    console.log(`${dryRun ? "Dry run" : "Backfill"}: processed=${processed} updated=${updated} unchanged=${unchanged} unknown=${unknown} failed=${failed} skippedManual=${skippedManual}`);
  } finally { await prisma.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Backfill failed"); process.exitCode = 1; });
