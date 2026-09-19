import "reflect-metadata";
import { MessageDirection, MessageDeliveryStatus, PrismaClient } from "@prisma/client";
import {
  LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES,
} from "../src/line-chat/line-chat-pilot.constants";

type Raw = Record<string, unknown>;

function asRaw(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}

function storeCodeOf(message: {
  conversation: {
    store: {
      code: string | null;
      storeMaster: { externalStoreId: string | null } | null;
    } | null;
  };
}): string {
  return message.conversation.store?.code?.trim()
    || message.conversation.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

function managerLikeDelivered(raw: Raw): boolean {
  return raw.provider === "LINE"
    && raw.deliveryMethod === "PUSH"
    && !raw.providerMessageId
    && !raw.requestId
    && !raw.acceptedRequestId;
}

function autoResponse(raw: Raw, senderDisplayName: string | null): boolean {
  return raw.source === "AUTO_RESPONSE" || senderDisplayName?.trim() === "Auto Reply Bot";
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const fromRaw = process.env.LINE_CHAT_AUDIT_MANAGER_OUTBOUNDS_FROM || "2026-09-07T00:00:00.000Z";
    const toRaw = process.env.LINE_CHAT_AUDIT_MANAGER_OUTBOUNDS_TO || new Date().toISOString();
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new Error("INVALID_AUDIT_WINDOW");
    }

    const storeCodes = [...LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES];

    const messages = await prisma.message.findMany({
      where: {
        direction: MessageDirection.OUTBOUND,
        senderUserId: { not: null },
        sentAt: { gte: from, lt: to },
        conversation: {
          store: {
            OR: [
              { code: { in: storeCodes } },
              { storeMaster: { externalStoreId: { in: storeCodes } } },
            ],
          },
        },
      },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        conversationId: true,
        deliveryStatus: true,
        messageType: true,
        originalText: true,
        sentAt: true,
        senderUserId: true,
        senderDisplayName: true,
        rawPayload: true,
        conversation: {
          select: {
            lineChatUserId: true,
            customer: { select: { displayName: true } },
            store: {
              select: {
                name: true,
                code: true,
                storeMaster: { select: { externalStoreId: true } },
              },
            },
          },
        },
      },
    });

    const perStore = new Map<string, {
      humanOutbound: number;
      delivered: number;
      failed: number;
      managerLikeDelivered: number;
      failedPotentialManager: number;
      unmappedRisk: number;
    }>();

    const deliveredCandidates: Array<Record<string, unknown>> = [];
    const failedCandidates: Array<Record<string, unknown>> = [];

    for (const message of messages) {
      const raw = asRaw(message.rawPayload);
      if (autoResponse(raw, message.senderDisplayName)) continue;

      const storeCode = storeCodeOf(message);
      const row = perStore.get(storeCode) ?? {
        humanOutbound: 0,
        delivered: 0,
        failed: 0,
        managerLikeDelivered: 0,
        failedPotentialManager: 0,
        unmappedRisk: 0,
      };
      row.humanOutbound += 1;

      if (message.deliveryStatus === MessageDeliveryStatus.DELIVERED) row.delivered += 1;
      if (message.deliveryStatus === MessageDeliveryStatus.FAILED) row.failed += 1;

      if (
        message.deliveryStatus === MessageDeliveryStatus.DELIVERED
        && managerLikeDelivered(raw)
      ) {
        row.managerLikeDelivered += 1;
        if (!message.conversation.lineChatUserId) row.unmappedRisk += 1;
        deliveredCandidates.push({
          storeCode,
          storeName: message.conversation.store?.name ?? null,
          conversationId: message.conversationId,
          customerName: message.conversation.customer.displayName,
          messageId: message.id,
          messageType: message.messageType,
          sentAt: message.sentAt.toISOString(),
          lineChatMapped: Boolean(message.conversation.lineChatUserId),
          textPreview: message.originalText.slice(0, 160),
        });
      }

      if (message.deliveryStatus === MessageDeliveryStatus.FAILED) {
        const error = typeof raw.error === "string" ? raw.error : "";
        const likelyManagerFailure =
          error.includes("LINE OA Manager")
          || error.includes("RESOLVE_")
          || error.includes("PROFILE_BROWSER")
          || error.includes("จับคู่ลูกค้า")
          || managerLikeDelivered(raw);

        if (likelyManagerFailure) row.failedPotentialManager += 1;
        if (likelyManagerFailure) {
          failedCandidates.push({
            storeCode,
            storeName: message.conversation.store?.name ?? null,
            conversationId: message.conversationId,
            customerName: message.conversation.customer.displayName,
            messageId: message.id,
            messageType: message.messageType,
            sentAt: message.sentAt.toISOString(),
            lineChatMapped: Boolean(message.conversation.lineChatUserId),
            error: error.slice(0, 240),
            textPreview: message.originalText.slice(0, 160),
          });
        }
      }

      perStore.set(storeCode, row);
    }

    const summary = {
      event: "manager_outbound_delivery_audit_summary",
      from: from.toISOString(),
      to: to.toISOString(),
      storeCodes,
      totalHumanOutbound: [...perStore.values()].reduce((sum, row) => sum + row.humanOutbound, 0),
      totalDelivered: [...perStore.values()].reduce((sum, row) => sum + row.delivered, 0),
      totalFailed: [...perStore.values()].reduce((sum, row) => sum + row.failed, 0),
      managerLikeDelivered: deliveredCandidates.length,
      failedPotentialManager: failedCandidates.length,
      unmappedManagerLikeDelivered: [...perStore.values()].reduce((sum, row) => sum + row.unmappedRisk, 0),
      perStore: Object.fromEntries([...perStore.entries()].sort(([a], [b]) => a.localeCompare(b))),
    };

    console.log(JSON.stringify(summary));
    console.log(JSON.stringify({
      event: "manager_outbound_delivery_audit_delivered_candidates",
      count: deliveredCandidates.length,
      candidates: deliveredCandidates,
    }));
    console.log(JSON.stringify({
      event: "manager_outbound_delivery_audit_failed_candidates",
      count: failedCandidates.length,
      candidates: failedCandidates,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "manager_outbound_delivery_audit_fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
