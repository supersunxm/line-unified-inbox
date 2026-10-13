import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from "@nestjs/common";
import { WebhookProcessingStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma.service";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import { SunnSecretaryEventReceiptService } from "./sunn-secretary-event-receipt";
import { classifySunnInbound, configuredSunnUsers, parseInboundPlan, prepareSunnReadOnlyCommand, SUNN_INBOUND_PREFIX, type InboundPlan, type InboundState } from "./sunn-secretary-inbound";

const LEASE_MS = 30_000;
const MAX_ATTEMPTS = 3;

/** Injectable, deterministic preparation interface. No SQL queries, AI or LINE delivery. */
@Injectable()
export class SunnSecretaryCommandPreparation {
  prepare(plan: InboundPlan): InboundState {
    let scopes: unknown;
    try { scopes = JSON.parse(process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER ?? "{}"); }
    catch { return "BLOCKED_SCOPE"; }
    return prepareSunnReadOnlyCommand(plan, configuredSunnUsers(), scopes);
  }
}

@Injectable()
export class SunnSecretaryInboundService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(SunnSecretaryInboundService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: SunnSecretaryEventReceiptService,
    private readonly credentials: SunnSecretaryCredentialsService,
    private readonly preparation: SunnSecretaryCommandPreparation,
  ) {}

  onModuleInit(): void {
    if (process.env.SUNN_SECRETARY_WEBHOOK_ENABLED === "true") {
      this.timer = setInterval(() => { void this.recoverAndPrepare(); }, 10_000);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  async accept(botUserId: string, events: readonly unknown[], now = new Date()): Promise<void> {
    if (process.env.SUNN_SECRETARY_WEBHOOK_ENABLED !== "true") return;
    const users = configuredSunnUsers();
    for (const event of events) {
      const { eventId, plan } = classifySunnInbound(event, botUserId, users, now);
      // Malformed events lacking a usable replay identity are safely discarded.
      if (eventId) await this.receipts.reserveInbound(botUserId, eventId, plan);
    }
  }

  /** At most 20 preparations per tick. The flag gates all reads and writes. */
  async recoverAndPrepare(): Promise<void> {
    if (process.env.SUNN_SECRETARY_WEBHOOK_ENABLED !== "true" || this.running) return;
    this.running = true;
    try {
      const { botUserId } = await this.credentials.inboundIdentity();
      const now = new Date();
      const staleBefore = new Date(now.getTime() - LEASE_MS);
      const rows = await this.prisma.webhookEvent.findMany({
        where: {
          destination: botUserId, processingStatus: WebhookProcessingStatus.IGNORED,
          externalWebhookEventId: { startsWith: "sunn-secretary:v1:" },
          OR: [
            { eventType: SUNN_INBOUND_PREFIX + "RECEIVED" },
            { eventType: { in: [SUNN_INBOUND_PREFIX + "PROCESSING", SUNN_INBOUND_PREFIX + "FAILED_RETRYABLE"] }, updatedAt: { lt: staleBefore } },
          ],
        }, orderBy: { receivedAt: "asc" }, take: 20,
      });
      for (const row of rows) {
        // Optimistic compare-and-set owns a single attempt across processes. No transaction spans preparation.
        const where = { id: row.id, destination: botUserId, processingStatus: WebhookProcessingStatus.IGNORED,
          eventType: row.eventType, updatedAt: row.updatedAt, errorMessage: row.errorMessage };
        let plan: InboundPlan;
        try { plan = parseInboundPlan(row.errorMessage); }
        catch {
          await this.prisma.webhookEvent.updateMany({ where, data: { eventType: SUNN_INBOUND_PREFIX + "FAILED_FINAL", errorMessage: "INVALID_PLAN", processedAt: now } });
          continue;
        }
        if (plan.classification !== "AUTHORIZED" || plan.attempts >= MAX_ATTEMPTS) {
          await this.prisma.webhookEvent.updateMany({ where, data: { eventType: SUNN_INBOUND_PREFIX + "FAILED_FINAL", processedAt: now } });
          continue;
        }
        const claimed = { ...plan, attempts: plan.attempts + 1, lease: randomUUID() };
        const claimText = JSON.stringify(claimed);
        const claim = await this.prisma.webhookEvent.updateMany({ where, data: {
          eventType: SUNN_INBOUND_PREFIX + "PROCESSING", errorMessage: claimText, processedAt: null,
        } });
        if (claim.count !== 1) continue;
        let state: InboundState;
        try { state = this.preparation.prepare(claimed); }
        catch { state = claimed.attempts < MAX_ATTEMPTS ? "FAILED_RETRYABLE" : "FAILED_FINAL"; }
        // A crashed/expired worker cannot finalize another worker's lease.
        await this.prisma.webhookEvent.updateMany({ where: {
          id: row.id, destination: botUserId, processingStatus: WebhookProcessingStatus.IGNORED,
          eventType: SUNN_INBOUND_PREFIX + "PROCESSING", errorMessage: claimText,
        }, data: { eventType: SUNN_INBOUND_PREFIX + state,
          errorMessage: JSON.stringify({ ...claimed, lease: undefined }),
          processedAt: state === "FAILED_RETRYABLE" ? null : new Date() } });
      }
    } catch {
      // Never log request bodies, identities, tokens, SQL or raw exceptions.
      this.logger.warn("SUNN_INBOUND_RECOVERY_UNAVAILABLE");
    } finally { this.running = false; }
  }
}
