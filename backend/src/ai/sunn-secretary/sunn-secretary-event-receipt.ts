import { Injectable } from "@nestjs/common";
import { Prisma, WebhookProcessingStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { SUNN_INBOUND_PREFIX, type InboundPlan } from "./sunn-secretary-inbound";
import { PrismaService } from "../../prisma.service";

/**
 * Durable, fail-closed idempotency reservations for Sunn Secretary.
 * Namespaced SHA-256 event keys prevent collisions with storefront webhooks.
 * This does NOT process events or authorize LINE replies.
 */
type SunnReceiptIdentity = { botUserId: string; eventId: string };

function validateSunnReceiptIdentity(botUserId: unknown, eventId: unknown): SunnReceiptIdentity {
  if (
    typeof botUserId !== "string" || !/^U[0-9a-fA-F]{32}$/u.test(botUserId) ||
    typeof eventId !== "string" || eventId.length === 0 || eventId.length > 256
  ) {
    throw new Error("Invalid Sunn Secretary receipt identity");
  }

  return { botUserId, eventId };
}

function receiptKeyForIdentity({ botUserId, eventId }: SunnReceiptIdentity): string {
  return "sunn-secretary:v1:" + createHash("sha256").update(JSON.stringify([botUserId, eventId])).digest("hex");
}

export function sunnReceiptKey(botUserId: unknown, eventId: unknown): string {
  return receiptKeyForIdentity(validateSunnReceiptIdentity(botUserId, eventId));
}

function isReceiptEventIdConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;

  const target = error.meta?.target;
  return Array.isArray(target) && target.length === 1 && target[0] === "externalWebhookEventId";
}

@Injectable()
export class SunnSecretaryEventReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomic unique claim. A repeated delivery can never claim the same event.
   * Record is marked IGNORED rather than RECEIVED, preventing normal storefront
   * webhook processors from picking up this isolated assistant receipt.
   */
  async reserve(botUserId: unknown, eventId: unknown): Promise<"NEW" | "DUPLICATE"> {
    return this.create(botUserId, eventId);
  }

  async reserveInbound(botUserId: unknown, eventId: unknown, plan: InboundPlan): Promise<"NEW" | "DUPLICATE"> {
    return this.create(botUserId, eventId, plan);
  }

  private async create(botUserId: unknown, eventId: unknown, plan?: InboundPlan): Promise<"NEW" | "DUPLICATE"> {
    const identity = validateSunnReceiptIdentity(botUserId, eventId);
    const externalWebhookEventId = receiptKeyForIdentity(identity);
    try {
      await this.prisma.webhookEvent.create({
        data: {
          externalWebhookEventId,
          eventType: plan ? SUNN_INBOUND_PREFIX + (plan.classification === "AUTHORIZED" ? "RECEIVED" : plan.classification) : "SUNN_SECRETARY_RESERVED",
          errorMessage: plan ? JSON.stringify(plan) : null,
          destination: identity.botUserId,
          processingStatus: WebhookProcessingStatus.IGNORED,
          processedAt: plan?.classification === "AUTHORIZED" ? null : new Date(),
        },
      });
      return "NEW";
    } catch (error) {
      if (isReceiptEventIdConflict(error)) return "DUPLICATE";
      throw error;
    }
  }
}
