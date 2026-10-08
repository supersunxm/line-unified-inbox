import { Injectable } from "@nestjs/common";
import { Prisma, WebhookProcessingStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma.service";

/**
 * Durable, fail-closed idempotency reservations for Sunn Secretary.
 * Namespaced SHA-256 event keys prevent collisions with storefront webhooks.
 * This does NOT process events or authorize LINE replies.
 */
export function sunnReceiptKey(botUserId: string, eventId: string): string {
  if (!/^U[0-9a-f]{32}$/iu.test(botUserId) || !eventId || eventId.length > 256) {
    throw new Error("Invalid Sunn Secretary receipt identity");
  }
  return "sunn-secretary:v1:" + createHash("sha256").update(JSON.stringify([botUserId, eventId])).digest("hex");
}

@Injectable()
export class SunnSecretaryEventReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomic unique claim. A repeated delivery can never claim the same event.
   * Record is marked IGNORED rather than RECEIVED, preventing normal storefront
   * webhook processors from picking up this isolated assistant receipt.
   */
  async reserve(botUserId: string, eventId: string): Promise<"NEW" | "DUPLICATE"> {
    const externalWebhookEventId = sunnReceiptKey(botUserId, eventId);
    try {
      await this.prisma.webhookEvent.create({
        data: {
          externalWebhookEventId,
          eventType: "SUNN_SECRETARY_RESERVED",
          destination: botUserId,
          processingStatus: WebhookProcessingStatus.IGNORED,
          processedAt: new Date(),
        },
      });
      return "NEW";
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "DUPLICATE";
      throw error;
    }
  }
}
