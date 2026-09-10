import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MessageDirection, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CUSTOMER_VOICE_ANALYSIS_VERSION } from "./customer-voice-taxonomy";
import { CustomerVoiceService } from "./customer-voice.service";

function boolEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  return value === undefined ? fallback : value === "1" || value.toLowerCase() === "true";
}

function numberEnv(key: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

export const CustomerVoiceWorkerConfig = {
  get enabled() { return boolEnv("CUSTOMER_VOICE_WORKER_ENABLED", false); },
  get pollIntervalMs() { return numberEnv("CUSTOMER_VOICE_WORKER_POLL_INTERVAL_MS", 30_000, 5_000, 300_000); },
  get batchSize() { return numberEnv("CUSTOMER_VOICE_WORKER_BATCH_SIZE", 10, 1, 100); },
};

const candidateSelect = {
  id: true,
  messages: {
    where: { direction: MessageDirection.INBOUND },
    orderBy: [{ sentAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
    select: { sentAt: true },
  },
  customerVoiceAnalyses: {
    where: { analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION },
    select: { lastAnalyzedMessageAt: true },
  },
} satisfies Prisma.ConversationSelect;

@Injectable()
export class CustomerVoiceWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomerVoiceWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerVoice: CustomerVoiceService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== "test" && CustomerVoiceWorkerConfig.enabled) {
      void this.runCycle();
      this.timer = setInterval(() => void this.runCycle(), CustomerVoiceWorkerConfig.pollIntervalMs);
      this.logger.log(`Customer Voice worker started (pollInterval=${CustomerVoiceWorkerConfig.pollIntervalMs}ms, batchSize=${CustomerVoiceWorkerConfig.batchSize})`);
    }
  }

  onModuleDestroy() {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCycle() {
    if (this.processing || this.stopping) return;
    this.processing = true;
    try {
      const candidates = await this.prisma.conversation.findMany({
        where: {
          isQa: false,
          lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
          messages: { some: { direction: MessageDirection.INBOUND } },
        },
        select: candidateSelect,
        orderBy: [{ latestMessageAt: "desc" }, { id: "desc" }],
        take: CustomerVoiceWorkerConfig.batchSize,
      });
      const models = await this.customerVoice.loadProductModels();
      let processed = 0;
      for (const candidate of candidates) {
        if (this.stopping) break;
        const latestMessageAt = candidate.messages[0]?.sentAt ?? null;
        const lastAnalyzedMessageAt = candidate.customerVoiceAnalyses[0]?.lastAnalyzedMessageAt ?? null;
        if (lastAnalyzedMessageAt && latestMessageAt && latestMessageAt <= lastAnalyzedMessageAt) continue;
        await this.customerVoice.analyzeConversation(candidate.id, models);
        processed++;
      }
      if (processed > 0) this.logger.log(`Customer Voice worker processed ${processed} conversation(s)`);
    } catch (error) {
      this.logger.error("Customer Voice worker cycle failed", error instanceof Error ? error.stack : String(error));
    } finally {
      this.processing = false;
    }
  }
}
