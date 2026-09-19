import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { MessageDeliveryStatus, MessageDirection, MessageType, Prisma } from "@prisma/client";
import { LineChatNicknameWorkerModule } from "../src/line-chat/line-chat-nickname-worker.module";
import { LineChatManagerMessageRelayWorkerService } from "../src/line-chat/line-chat-manager-message-relay-worker.service";
import { PrismaService } from "../src/prisma.service";
import { LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES } from "../src/line-chat/line-chat-pilot.constants";
import { AUTO_REPLY_BOT_DISPLAY_NAME } from "../src/conversation-reply-state";

type Raw = Record<string, unknown>;

function rawObject(value: Prisma.JsonValue | null): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}

function isAutoResponse(raw: Raw, senderDisplayName: string | null): boolean {
  return raw.source === "AUTO_RESPONSE" || senderDisplayName?.trim() === AUTO_REPLY_BOT_DISPLAY_NAME;
}

function storeCodeOf(store: {
  code: string | null;
  storeMaster: { externalStoreId: string | null } | null;
} | null): string {
  return store?.code?.trim() || store?.storeMaster?.externalStoreId?.trim() || "";
}

function managerLikeDelivered(raw: Raw): boolean {
  return raw.provider === "LINE"
    && raw.deliveryMethod === "PUSH"
    && !raw.providerMessageId
    && !raw.requestId
    && !raw.acceptedRequestId;
}

async function main(): Promise<void> {
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });
  const prisma = app.get(PrismaService);
  const inspector = app.get(LineChatManagerMessageRelayWorkerService);

  try {
    const fromRaw = process.env.LINE_CHAT_VERIFY_FAILED_OUTBOUNDS_FROM || "2026-09-17T00:00:00.000Z";
    const toRaw = process.env.LINE_CHAT_VERIFY_FAILED_OUTBOUNDS_TO || new Date().toISOString();
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new Error("INVALID_VERIFY_WINDOW");
    }

    const storeCodes = [...LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES];
    const failed = await prisma.message.findMany({
      where: {
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.TEXT,
        deliveryStatus: MessageDeliveryStatus.FAILED,
        senderUserId: { not: null },
        sentAt: { gte: from, lt: to },
        conversation: {
          lineChatUserId: { not: null },
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
        originalText: true,
        sentAt: true,
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

    const candidates = failed.filter((message) => {
      const raw = rawObject(message.rawPayload);
      return message.originalText.trim().length > 0 && !isAutoResponse(raw, message.senderDisplayName);
    });

    let present = 0;
    let notPresent = 0;
    let unverified = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const message of candidates) {
      const storeCode = storeCodeOf(message.conversation.store);
      try {
        const result = await inspector.inspectTextPresence({
          conversationId: message.conversationId,
          text: message.originalText,
        });
        if (!result.handled || result.presence === "UNMAPPED") {
          unverified += 1;
          results.push({
            messageId: message.id,
            conversationId: message.conversationId,
            customerName: message.conversation.customer.displayName,
            storeCode,
            sentAt: message.sentAt.toISOString(),
            status: "UNVERIFIED",
            reason: result.handled ? "UNMAPPED" : "NOT_HANDLED",
            textPreview: message.originalText.slice(0, 160),
          });
          continue;
        }

        if (result.presence === "PRESENT") present += 1;
        else notPresent += 1;
        results.push({
          messageId: message.id,
          conversationId: message.conversationId,
          customerName: message.conversation.customer.displayName,
          storeCode,
          sentAt: message.sentAt.toISOString(),
          status: result.presence === "PRESENT" ? "PRESENT_EXACT_TEXT" : "NOT_PRESENT_IN_LOADED_CHAT",
          outboundExactCount: result.outboundExactCount,
          textPreview: message.originalText.slice(0, 160),
        });
      } catch (error) {
        unverified += 1;
        results.push({
          messageId: message.id,
          conversationId: message.conversationId,
          customerName: message.conversation.customer.displayName,
          storeCode,
          sentAt: message.sentAt.toISOString(),
          status: "UNVERIFIED",
          reason: error instanceof Error ? error.message : String(error),
          textPreview: message.originalText.slice(0, 160),
        });
      }
    }

    const highRiskFrom = new Date("2026-09-07T00:00:00.000Z");
    const highRiskTo = new Date("2026-09-10T04:35:16.000Z");
    const historical = await prisma.message.findMany({
      where: {
        direction: MessageDirection.OUTBOUND,
        deliveryStatus: MessageDeliveryStatus.DELIVERED,
        senderUserId: { not: null },
        sentAt: { gte: highRiskFrom, lt: highRiskTo },
        conversation: {
          store: {
            OR: [
              { code: { in: storeCodes } },
              { storeMaster: { externalStoreId: { in: storeCodes } } },
            ],
          },
        },
      },
      select: {
        id: true,
        senderDisplayName: true,
        rawPayload: true,
        conversation: {
          select: {
            store: {
              select: {
                code: true,
                storeMaster: { select: { externalStoreId: true } },
              },
            },
          },
        },
      },
    });

    const historicalByStore: Record<string, number> = {};
    let historicalManagerLikeDelivered = 0;
    for (const message of historical) {
      const raw = rawObject(message.rawPayload);
      if (isAutoResponse(raw, message.senderDisplayName) || !managerLikeDelivered(raw)) continue;
      historicalManagerLikeDelivered += 1;
      const code = storeCodeOf(message.conversation.store);
      historicalByStore[code] = (historicalByStore[code] || 0) + 1;
    }

    console.log(JSON.stringify({
      event: "failed_manager_outbound_presence_audit_summary",
      from: from.toISOString(),
      to: to.toISOString(),
      candidates: candidates.length,
      presentExactText: present,
      notPresentInLoadedChat: notPresent,
      unverified,
      historicalPreVerificationWindow: {
        from: highRiskFrom.toISOString(),
        to: highRiskTo.toISOString(),
        managerLikeDelivered: historicalManagerLikeDelivered,
        byStore: historicalByStore,
      },
    }));
    console.log(JSON.stringify({
      event: "failed_manager_outbound_presence_audit_results",
      count: results.length,
      results,
    }));
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "failed_manager_outbound_presence_audit_fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
