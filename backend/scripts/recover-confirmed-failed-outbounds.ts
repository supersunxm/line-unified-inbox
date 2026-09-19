import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { MessageDeliveryStatus, MessageDirection, MessageType, Prisma } from "@prisma/client";
import { LineChatNicknameWorkerModule } from "../src/line-chat/line-chat-nickname-worker.module";
import { LineChatManagerMessageRelayWorkerService } from "../src/line-chat/line-chat-manager-message-relay-worker.service";
import { PrismaService } from "../src/prisma.service";
import {
  AUTO_REPLY_BOT_DISPLAY_NAME,
  reconcileStaffOutboundReplyState,
} from "../src/conversation-reply-state";

type Args = {
  storeCode: string;
  customerNames: string[];
  from: Date;
  to: Date;
  apply: boolean;
};

function parseArgs(argv: string[]): Args {
  const value = (name: string): string | undefined => {
    const direct = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (direct) return direct.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const storeCode = value("store")?.trim() || "";
  const customerNames = (value("customers") || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const fromRaw = value("from")?.trim() || "";
  const toRaw = value("to")?.trim() || "";
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  const apply = argv.includes("--apply");

  if (!storeCode) throw new Error("MISSING_STORE");
  if (customerNames.length === 0) throw new Error("MISSING_CUSTOMERS");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error("INVALID_TIME_WINDOW");
  }
  return { storeCode, customerNames, from, to, apply };
}

function isAutoResponse(rawPayload: unknown): boolean {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return false;
  return (rawPayload as { source?: unknown }).source === "AUTO_RESPONSE";
}

function rawObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });
  const prisma = app.get(PrismaService);
  const relay = app.get(LineChatManagerMessageRelayWorkerService);

  const conversations = await prisma.conversation.findMany({
    where: {
      customer: { displayName: { in: args.customerNames } },
      store: {
        OR: [
          { code: args.storeCode },
          { storeMaster: { externalStoreId: args.storeCode } },
        ],
      },
    },
    select: {
      id: true,
      customer: { select: { displayName: true } },
      store: {
        select: {
          name: true,
          code: true,
          storeMaster: { select: { externalStoreId: true } },
        },
      },
      messages: {
        where: {
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.TEXT,
          sentAt: { gte: args.from, lt: args.to },
          senderUserId: { not: null },
        },
        orderBy: [{ sentAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          externalMessageId: true,
          deliveryStatus: true,
          originalText: true,
          sentAt: true,
          senderUserId: true,
          senderDisplayName: true,
          rawPayload: true,
        },
      },
    },
  });

  let failures = 0;
  let recovered = 0;
  let alreadyPresent = 0;

  for (const targetName of args.customerNames) {
    const targetConversations = conversations.filter(
      (conversation) => conversation.customer.displayName === targetName,
    );
    const candidates: Array<{
      conversationId: string;
      storeName: string;
      message: (typeof targetConversations)[number]["messages"][number];
    }> = [];

    for (const conversation of targetConversations) {
      const byText = new Map<string, (typeof conversation.messages)[number]>();
      for (const message of conversation.messages) {
        const text = message.originalText.trim();
        if (!text) continue;
        if (message.senderDisplayName?.trim() === AUTO_REPLY_BOT_DISPLAY_NAME) continue;
        if (isAutoResponse(message.rawPayload)) continue;
        byText.set(text, message);
      }
      for (const message of byText.values()) {
        candidates.push({
          conversationId: conversation.id,
          storeName: conversation.store?.name || args.storeCode,
          message,
        });
      }
    }

    if (candidates.length !== 1) {
      console.log(JSON.stringify({
        event: "confirmed_outbound_recovery_target_ambiguous",
        customerName: targetName,
        storeCode: args.storeCode,
        candidateCount: candidates.length,
        conversationIds: [...new Set(candidates.map((candidate) => candidate.conversationId))],
      }));
      failures += 1;
      continue;
    }

    const candidate = candidates[0];
    const message = candidate.message;
    console.log(JSON.stringify({
      event: "confirmed_outbound_recovery_candidate",
      customerName: targetName,
      storeCode: args.storeCode,
      storeName: candidate.storeName,
      conversationId: candidate.conversationId,
      messageId: message.id,
      deliveryStatus: message.deliveryStatus,
      sentAt: message.sentAt.toISOString(),
      textPreview: message.originalText.slice(0, 160),
      apply: args.apply,
    }));

    if (!args.apply) continue;

    try {
      const result = await relay.recoverTextIfMissing({
        conversationId: candidate.conversationId,
        text: message.originalText,
      });
      if (!result.handled) throw new Error("NOT_MANAGER_RELAY_CONVERSATION");

      const recoveryAt = new Date();
      const effectiveSentAt = result.alreadyPresent ? message.sentAt : recoveryAt;
      const previousRaw = rawObject(message.rawPayload);
      await prisma.message.update({
        where: { id: message.id },
        data: {
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          sentAt: effectiveSentAt,
          rawPayload: {
            ...previousRaw,
            managerRecovery: {
              checkedAt: recoveryAt.toISOString(),
              alreadyPresent: result.alreadyPresent,
              resent: !result.alreadyPresent,
              source: "CONFIRMED_MISSING_OUTBOUND_RECOVERY",
            },
          } as Prisma.InputJsonValue,
        },
      });

      await reconcileStaffOutboundReplyState(prisma, {
        conversationId: candidate.conversationId,
        sentAt: effectiveSentAt,
        actor: {
          id: message.senderUserId!,
          displayName: message.senderDisplayName?.trim() || "Staff",
        },
      });

      if (result.alreadyPresent) alreadyPresent += 1;
      else recovered += 1;

      console.log(JSON.stringify({
        event: "confirmed_outbound_recovery_success",
        customerName: targetName,
        conversationId: candidate.conversationId,
        messageId: message.id,
        alreadyPresent: result.alreadyPresent,
        resent: !result.alreadyPresent,
        effectiveSentAt: effectiveSentAt.toISOString(),
      }));
    } catch (error) {
      failures += 1;
      console.log(JSON.stringify({
        event: "confirmed_outbound_recovery_failed",
        customerName: targetName,
        conversationId: candidate.conversationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  console.log(JSON.stringify({
    event: "confirmed_outbound_recovery_complete",
    storeCode: args.storeCode,
    requestedCustomers: args.customerNames.length,
    apply: args.apply,
    recovered,
    alreadyPresent,
    failures,
  }));

  await app.close();
  if (failures > 0) process.exitCode = 2;
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "confirmed_outbound_recovery_fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
