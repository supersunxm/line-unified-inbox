import { MessageDirection, PrismaClient } from "@prisma/client";
import type { PrismaService } from "../src/prisma.service";
import { bangkokDateRangeToUtcBounds } from "../src/follower-insights/date-utils";
import { CustomerVoiceService } from "../src/store-insights/customer-voice.service";
import { CUSTOMER_VOICE_ANALYSIS_VERSION } from "../src/store-insights/customer-voice-taxonomy";

const prisma = new PrismaClient();

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return value;
}

function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Date must use YYYY-MM-DD: ${value}`);
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const storeId = requiredOption("--storeId");
  const from = isoDate(requiredOption("--from"));
  const to = isoDate(requiredOption("--to"));
  const { startUtc: start, endExclusiveUtc: end } = bangkokDateRangeToUtcBounds(from, to);
  if (end <= start) throw new Error("--to cannot be earlier than --from");
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days > 90) throw new Error("Customer Voice backfill cannot exceed 90 days");
  const limitValue = Number.parseInt(option("--limit") ?? "100", 10);
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(1000, limitValue)) : 100;
  const delayValue = Number.parseInt(option("--delay-ms") ?? "100", 10);
  const delayMs = Number.isFinite(delayValue) ? Math.max(0, Math.min(1000, delayValue)) : 100;
  const dryRun = hasFlag("--dry-run");

  const where = {
    storeId,
    isQa: false,
    lineOfficialAccount: { accountType: "STORE" as const, isActive: true, archivedAt: null },
    messages: { some: { direction: MessageDirection.INBOUND, sentAt: { gte: start, lt: end } } },
  };
  const scanned = await prisma.conversation.findMany({
    where,
    select: {
      id: true,
      messages: {
        where: { direction: MessageDirection.INBOUND },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { sentAt: true },
      },
      customerVoiceAnalyses: {
        where: { analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION },
        select: { lastAnalyzedMessageAt: true },
      },
    },
    orderBy: [{ latestMessageAt: "asc" }, { id: "asc" }],
    take: Math.min(1000, Math.max(limit, limit * 5)),
  });
  const pending = scanned.filter((candidate) => {
    const latestInbound = candidate.messages[0]?.sentAt;
    const lastAnalyzed = candidate.customerVoiceAnalyses[0]?.lastAnalyzedMessageAt;
    return !lastAnalyzed || !latestInbound || latestInbound > lastAnalyzed;
  });
  const candidates = pending.slice(0, limit);
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, requested: candidates.length, scanned: scanned.length, pending: pending.length, skippedAlreadyAnalyzed: scanned.length - pending.length, limit, dateRange: { from, to }, storeScoped: true }));
    return;
  }

  const customerVoice = new CustomerVoiceService(prisma as unknown as PrismaService);
  const models = await customerVoice.loadProductModels();
  let processed = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      const row = await customerVoice.analyzeConversation(candidate.id, models);
      if (row) processed++;
    } catch {
      failed++;
    }
    if (delayMs > 0) await delay(delayMs);
  }
  console.log(JSON.stringify({ dryRun: false, requested: candidates.length, scanned: scanned.length, pending: pending.length, skippedAlreadyAnalyzed: scanned.length - pending.length, processed, failed, dateRange: { from, to }, storeScoped: true }));
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Customer Voice backfill failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
