import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  ActivityActionType,
  BmReplyStatus,
  FollowUpStatus,
  MessageDeliveryStatus,
  MessageDirection,
  MessageType,
  Prisma,
} from "@prisma/client";
import { LineChatNicknameWorkerModule } from "../src/line-chat/line-chat-nickname-worker.module";
import { PrismaService } from "../src/prisma.service";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";
import { AUTO_REPLY_BOT_DISPLAY_NAME } from "../src/conversation-reply-state";

type ManagerEvent = {
  sendId?: string;
  type?: string;
  source?: { userId?: string };
  timestamp?: number;
  message?: { id?: string; type?: string; text?: string };
  bizId?: string;
};

type ManagerHistory = {
  list?: ManagerEvent[];
};

function rawObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function managerExternalId(id: string): string {
  return `line-chat-manager:${id}`;
}

async function main(): Promise<void> {
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
  const apply = process.env.LINE_CHAT_MANAGER_HISTORY_SYNC_APPLY === "true";
  const messageIds = (process.env.LINE_CHAT_MANAGER_HISTORY_SYNC_MESSAGE_IDS || "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
  if (messageIds.length === 0) throw new Error("MISSING_MESSAGE_IDS");

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const prisma = app.get(PrismaService);
    const sessionService = app.get(LineChatSessionService);
    const originals = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: {
        id: true,
        conversationId: true,
        externalMessageId: true,
        direction: true,
        deliveryStatus: true,
        messageType: true,
        originalText: true,
        sentAt: true,
        senderUserId: true,
        senderDisplayName: true,
        rawPayload: true,
        conversation: {
          select: {
            id: true,
            storeId: true,
            lineChatUserId: true,
            bmReplyStatus: true,
            followUpStatus: true,
            ownerUserId: true,
            latestMessageAt: true,
            customer: { select: { displayName: true } },
            lineOfficialAccount: {
              select: {
                chatBotId: true,
                lineChatSession: {
                  select: { profilePath: true, profileStorageKey: true },
                },
              },
            },
          },
        },
      },
    });

    const summary = {
      apply,
      requested: messageIds.length,
      found: originals.length,
      originalMarkedDelivered: 0,
      importedManagerMessages: 0,
      existingManagerMessagesReconciled: 0,
      conversationsReconciled: 0,
      skippedNoExactDelivery: 0,
      failures: 0,
    };

    const groups = new Map<string, typeof originals>();
    for (const original of originals) {
      const session = original.conversation.lineOfficialAccount.lineChatSession;
      const botId = original.conversation.lineOfficialAccount.chatBotId?.trim();
      if (!session || !botId || !original.conversation.lineChatUserId) {
        summary.failures += 1;
        console.log(JSON.stringify({
          event: "manager_history_sync_skipped",
          messageId: original.id,
          conversationId: original.conversationId,
          reason: "MISSING_MANAGER_MAPPING",
        }));
        continue;
      }
      const profilePath = sessionService.resolveProfilePath(session);
      const key = `${profilePath}|${botId}`;
      const list = groups.get(key) ?? [];
      list.push(original);
      groups.set(key, list);
    }

    for (const [key, group] of groups) {
      const split = key.lastIndexOf("|");
      const profilePath = key.slice(0, split);
      const botId = key.slice(split + 1);
      const context = await sessionService.launchManagedPersistentContext(profilePath, {
        profilePath,
        headless: true,
        viewport: { width: 1280, height: 800 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });

      try {
        const page = context.pages()[0] || await context.newPage();
        await page.goto(`https://chat.line.biz/${encodeURIComponent(botId)}`, {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

        const ownersResult = await page.evaluate(async (targetUrl) => {
          const response = await fetch(targetUrl, { credentials: "include" });
          if (!response.ok) return { ok: false, list: [] as Array<{ bizId?: string; name?: string }> };
          const body = await response.json() as { list?: Array<{ bizId?: string; name?: string }> };
          return { ok: true, list: body.list ?? [] };
        }, `https://chat.line.biz/api/v1/bots/${encodeURIComponent(botId)}/owners`).catch(() => ({
          ok: false,
          list: [] as Array<{ bizId?: string; name?: string }>,
        }));
        const ownerNames = [...new Set(
          ownersResult.list
            .map((owner) => owner.name?.trim())
            .filter((name): name is string => Boolean(name)),
        )];
        const matchedUsers = ownerNames.length > 0
          ? await prisma.user.findMany({
              where: { displayName: { in: ownerNames }, isActive: true },
              select: { id: true, displayName: true },
            })
          : [];
        const userByDisplayName = new Map(matchedUsers.map((user) => [user.displayName, user]));
        const ownerByBizId = new Map(
          ownersResult.list
            .filter((owner) => owner.bizId?.trim())
            .map((owner) => [owner.bizId!.trim(), owner.name?.trim() || "LINE OA Manager"]),
        );

        for (const original of group) {
          try {
            const lineChatUserId = original.conversation.lineChatUserId!.trim();
            const historyUrl = `https://chat.line.biz/api/v3/bots/${encodeURIComponent(botId)}/chats/${encodeURIComponent(lineChatUserId)}/messages`;
            const response = await page.evaluate(async (targetUrl) => {
              const res = await fetch(targetUrl, { credentials: "include" });
              let body: ManagerHistory | null = null;
              try { body = await res.json() as ManagerHistory; } catch {}
              return { ok: res.ok, status: res.status, body };
            }, historyUrl);

            if (!response.ok || !response.body) {
              throw new Error(`MESSAGE_API_${response.status}`);
            }

            const outbound = (response.body.list ?? [])
              .filter((item) =>
                item.type === "messageSent"
                && item.message?.id
                && item.message?.type === "text"
                && typeof item.message.text === "string"
                && Number.isFinite(item.timestamp)
                && Number(item.timestamp) >= original.sentAt.getTime()
                && item.bizId !== "__AUTO_RESPONSE",
              )
              .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

            const exact = outbound.filter((item) => item.message!.text === original.originalText);
            if (exact.length === 0) {
              summary.skippedNoExactDelivery += 1;
              console.log(JSON.stringify({
                event: "manager_history_sync_no_exact_delivery",
                messageId: original.id,
                conversationId: original.conversationId,
                customerName: original.conversation.customer.displayName,
                outboundAfterOriginal: outbound.length,
              }));
              continue;
            }

            const canonical = exact[0];
            const canonicalAt = new Date(Number(canonical.timestamp));
            const canonicalManagerId = canonical.message!.id!;

            if (apply) {
              const previousRaw = rawObject(original.rawPayload);
              await prisma.message.update({
                where: { id: original.id },
                data: {
                  deliveryStatus: MessageDeliveryStatus.DELIVERED,
                  sentAt: canonicalAt,
                  rawPayload: {
                    ...previousRaw,
                    managerHistoryReconcile: {
                      reconciledAt: new Date().toISOString(),
                      managerMessageId: canonicalManagerId,
                      managerSendId: canonical.sendId ?? null,
                      managerBizId: canonical.bizId ?? null,
                      source: "LINE_CHAT_MANAGER_MESSAGE_API",
                    },
                  } as Prisma.InputJsonValue,
                },
              });
            }
            summary.originalMarkedDelivered += 1;

            const existing = await prisma.message.findMany({
              where: {
                conversationId: original.conversationId,
                direction: MessageDirection.OUTBOUND,
                sentAt: { gte: new Date(original.sentAt.getTime() - 2_000) },
              },
              orderBy: [{ sentAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                externalMessageId: true,
                originalText: true,
                sentAt: true,
                deliveryStatus: true,
                rawPayload: true,
              },
            });

            for (const event of outbound) {
              const eventId = event.message!.id!;
              if (eventId === canonicalManagerId) continue;
              const eventAt = new Date(Number(event.timestamp));
              const text = event.message!.text!;
              const extId = managerExternalId(eventId);
              const matched = existing.find((message) => {
                if (message.externalMessageId === extId) return true;
                const raw = rawObject(message.rawPayload);
                const reconcile = raw.managerHistoryReconcile;
                if (reconcile && typeof reconcile === "object" && !Array.isArray(reconcile)) {
                  if ((reconcile as Record<string, unknown>).managerMessageId === eventId) return true;
                }
                return message.originalText === text
                  && Math.abs(message.sentAt.getTime() - eventAt.getTime()) <= 2_000;
              });

              if (matched) {
                if (matched.deliveryStatus !== MessageDeliveryStatus.DELIVERED && apply) {
                  await prisma.message.update({
                    where: { id: matched.id },
                    data: {
                      deliveryStatus: MessageDeliveryStatus.DELIVERED,
                      sentAt: eventAt,
                      rawPayload: {
                        ...rawObject(matched.rawPayload),
                        managerHistoryReconcile: {
                          reconciledAt: new Date().toISOString(),
                          managerMessageId: eventId,
                          managerSendId: event.sendId ?? null,
                          managerBizId: event.bizId ?? null,
                          source: "LINE_CHAT_MANAGER_MESSAGE_API",
                        },
                      } as Prisma.InputJsonValue,
                    },
                  });
                }
                summary.existingManagerMessagesReconciled += 1;
                continue;
              }

              const ownerName = event.bizId ? ownerByBizId.get(event.bizId) : undefined;
              const matchedUser = ownerName ? userByDisplayName.get(ownerName) : undefined;
              const isRetryOfOriginal = text === original.originalText;
              const senderUserId = isRetryOfOriginal
                ? original.senderUserId
                : matchedUser?.id ?? null;
              const senderDisplayName = isRetryOfOriginal
                ? original.senderDisplayName
                : matchedUser?.displayName ?? ownerName ?? "LINE OA Manager";

              if (apply) {
                await prisma.message.create({
                  data: {
                    conversationId: original.conversationId,
                    externalMessageId: extId,
                    direction: MessageDirection.OUTBOUND,
                    deliveryStatus: MessageDeliveryStatus.DELIVERED,
                    messageType: MessageType.TEXT,
                    originalText: text,
                    senderUserId,
                    senderDisplayName,
                    sentAt: eventAt,
                    rawPayload: {
                      source: "LINE_CHAT_MANAGER_HISTORY_SYNC",
                      managerMessageId: eventId,
                      managerSendId: event.sendId ?? null,
                      managerBizId: event.bizId ?? null,
                      importedAt: new Date().toISOString(),
                    } as Prisma.InputJsonValue,
                  },
                });
              }
              summary.importedManagerMessages += 1;
            }

            const conversation = await prisma.conversation.findUnique({
              where: { id: original.conversationId },
              select: {
                bmReplyStatus: true,
                followUpStatus: true,
                ownerUserId: true,
                latestMessageAt: true,
                messages: {
                  orderBy: [{ sentAt: "asc" }, { id: "asc" }],
                  select: {
                    id: true,
                    direction: true,
                    deliveryStatus: true,
                    senderUserId: true,
                    senderDisplayName: true,
                    sentAt: true,
                    rawPayload: true,
                  },
                },
              },
            });
            if (!conversation) continue;

            const latestMessage = conversation.messages.at(-1);
            const latestInbound = [...conversation.messages].reverse().find(
              (message) => message.direction === MessageDirection.INBOUND,
            );
            const latestHumanOutbound = [...conversation.messages].reverse().find((message) => {
              if (
                message.direction !== MessageDirection.OUTBOUND
                || message.deliveryStatus !== MessageDeliveryStatus.DELIVERED
                || !message.senderUserId
              ) return false;
              const raw = rawObject(message.rawPayload);
              return raw.source !== "AUTO_RESPONSE"
                && message.senderDisplayName?.trim() !== AUTO_REPLY_BOT_DISPLAY_NAME;
            });
            const replied = Boolean(
              latestInbound
              && latestHumanOutbound
              && latestHumanOutbound.sentAt >= latestInbound.sentAt,
            );
            const targetBmReplyStatus = replied ? BmReplyStatus.REPLIED : BmReplyStatus.NOT_REPLIED;
            const targetFollowUpStatus = replied
              ? FollowUpStatus.COMPLETED
              : conversation.followUpStatus;
            const ownerToAssign = replied && !conversation.ownerUserId
              ? latestHumanOutbound?.senderUserId ?? null
              : null;
            const latestMessageAt = latestMessage?.sentAt ?? conversation.latestMessageAt;

            const stateChanged =
              conversation.bmReplyStatus !== targetBmReplyStatus
              || (replied && conversation.followUpStatus !== FollowUpStatus.COMPLETED)
              || Boolean(ownerToAssign)
              || conversation.latestMessageAt.getTime() !== latestMessageAt.getTime();

            if (stateChanged && apply) {
              await prisma.$transaction(async (tx) => {
                await tx.conversation.update({
                  where: { id: original.conversationId },
                  data: {
                    bmReplyStatus: targetBmReplyStatus,
                    ...(replied ? { followUpStatus: targetFollowUpStatus } : {}),
                    latestMessageAt,
                    ...(ownerToAssign ? { ownerUserId: ownerToAssign } : {}),
                  },
                });
                await tx.activityHistory.create({
                  data: {
                    conversationId: original.conversationId,
                    actionType: ActivityActionType.STATUS_CHANGED,
                    previousStatus: conversation.followUpStatus,
                    newStatus: replied ? FollowUpStatus.COMPLETED : conversation.followUpStatus,
                    previousBmReplyStatus: conversation.bmReplyStatus,
                    newBmReplyStatus: targetBmReplyStatus,
                    createdByUserId: null,
                    createdByName: "System Manager History Sync",
                    description: "Reconciled black-app conversation with confirmed LINE OA Manager history",
                    metadata: {
                      source: "line-chat-manager-history-sync",
                      originalMessageId: original.id,
                      importedManagerMessages: outbound.length,
                    },
                  },
                });
              });
            }
            summary.conversationsReconciled += 1;

            console.log(JSON.stringify({
              event: "manager_history_sync_conversation",
              messageId: original.id,
              conversationId: original.conversationId,
              customerName: original.conversation.customer.displayName,
              exactDeliveryCount: exact.length,
              managerOutboundAfterOriginal: outbound.length,
              canonicalManagerMessageId,
              canonicalAt: canonicalAt.toISOString(),
              finalReplyState: targetBmReplyStatus,
              apply,
            }));
          } catch (error) {
            summary.failures += 1;
            console.log(JSON.stringify({
              event: "manager_history_sync_failed",
              messageId: original.id,
              conversationId: original.conversationId,
              error: error instanceof Error ? error.message : String(error),
            }));
          }
        }
      } finally {
        await sessionService.closeManagedPersistentContext(context, profilePath).catch(() => {});
      }
    }

    console.log(JSON.stringify({
      event: "manager_history_sync_complete",
      ...summary,
    }));
    if (summary.failures > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "manager_history_sync_fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
