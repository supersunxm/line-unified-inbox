import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { LineChatSessionStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  LINE_CHAT_PILOT_BOT_ID,
  LINE_CHAT_PILOT_OA_NAME,
  LINE_CHAT_PILOT_SESSION_KEY,
  LINE_CHAT_PILOT_STORE_CODE,
} from "./line-chat-pilot.constants";

export type ManagerRelayResult =
  | { handled: false }
  | { handled: true; duplicate: boolean; lineChatUserId: string };

type PilotConversation = {
  id: string;
  storeId: string | null;
  lineChatUserId: string | null;
  store: {
    code: string | null;
    storeMaster: { externalStoreId: string | null } | null;
  } | null;
  lineOfficialAccount: {
    id: string;
    name: string;
    storeId: string | null;
    accountType: string;
    isActive: boolean;
    archivedAt: Date | null;
    chatBotId: string | null;
    lineChatSession: {
      sessionKey: string;
      status: LineChatSessionStatus;
    } | null;
  };
};

function storeCodeOf(conversation: PilotConversation): string {
  return conversation.store?.code?.trim()
    || conversation.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

@Injectable()
export class LineChatManagerMessageRelayService {
  private readonly logger = new Logger(LineChatManagerMessageRelayService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * The API service must never launch Chromium for this feature. The persistent
   * LINE OA Manager profile exists only on the dedicated line-chat worker
   * volume, so Chonburi requests are authenticated and forwarded over Railway
   * private networking to that worker. Non-pilot conversations return
   * handled=false and keep the existing Messaging API path unchanged.
   */
  public async relayText(input: {
    conversationId?: string;
    text: string;
    idempotencyKey: string;
  }): Promise<ManagerRelayResult> {
    const conversationId = input.conversationId?.trim();
    if (!conversationId) return { handled: false };

    const conversation = await this.loadConversation(conversationId);
    if (!conversation) return { handled: false };
    if (storeCodeOf(conversation) !== LINE_CHAT_PILOT_STORE_CODE) return { handled: false };

    this.assertPilotConfiguration(conversation);

    const workerUrl = process.env.LINE_CHAT_WORKER_INTERNAL_URL?.trim().replace(/\/+$/u, "");
    const secret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET?.trim();
    if (!workerUrl || !secret) {
      throw new ServiceUnavailableException(
        "ระบบส่งผ่าน LINE OA Manager ร้านชลบุรียังไม่ได้เชื่อมต่อกับ worker จึงยกเลิกการส่งเพื่อป้องกันการใช้ Push quota",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(`${workerUrl}/internal/line-chat/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Line-Chat-Internal-Secret": secret,
        },
        body: JSON.stringify({
          conversationId,
          text: input.text,
          idempotencyKey: input.idempotencyKey,
        }),
        signal: controller.signal,
      });

      let body: {
        success?: boolean;
        handled?: boolean;
        duplicate?: boolean;
        lineChatUserId?: string;
        error?: string;
      } = {};
      try {
        body = await response.json() as typeof body;
      } catch {
        // A malformed internal response is handled as a relay failure below.
      }

      if (
        response.ok
        && body.success === true
        && body.handled === true
        && typeof body.lineChatUserId === "string"
        && body.lineChatUserId.trim()
      ) {
        return {
          handled: true,
          duplicate: body.duplicate === true,
          lineChatUserId: body.lineChatUserId.trim(),
        };
      }

      this.logger.warn(JSON.stringify({
        event: "line_chat_manager_relay_worker_rejected",
        conversationId,
        statusCode: response.status,
        workerError: typeof body.error === "string" ? body.error.slice(0, 250) : null,
      }));
      throw new ServiceUnavailableException(
        typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : "ส่งผ่าน LINE OA Manager ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const aborted = error instanceof Error && error.name === "AbortError";
      this.logger.error(JSON.stringify({
        event: "line_chat_manager_relay_worker_unavailable",
        conversationId,
        aborted,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw new ServiceUnavailableException(
        aborted
          ? "LINE OA Manager ใช้เวลาส่งนานเกินกำหนด กรุณาลองอีกครั้ง"
          : "เชื่อมต่อ LINE OA Manager worker ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async loadConversation(id: string): Promise<PilotConversation | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        storeId: true,
        lineChatUserId: true,
        store: {
          select: {
            code: true,
            storeMaster: { select: { externalStoreId: true } },
          },
        },
        lineOfficialAccount: {
          select: {
            id: true,
            name: true,
            storeId: true,
            accountType: true,
            isActive: true,
            archivedAt: true,
            chatBotId: true,
            lineChatSession: {
              select: {
                sessionKey: true,
                status: true,
              },
            },
          },
        },
      },
    }) as Promise<PilotConversation | null>;
  }

  private assertPilotConfiguration(conversation: PilotConversation): void {
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    if (
      conversation.storeId !== oa.storeId
      || oa.accountType !== "STORE"
      || !oa.isActive
      || oa.archivedAt !== null
      || oa.name.trim() !== LINE_CHAT_PILOT_OA_NAME
      || oa.chatBotId?.trim() !== LINE_CHAT_PILOT_BOT_ID
      || !session
      || session.sessionKey.trim() !== LINE_CHAT_PILOT_SESSION_KEY
      || session.status !== LineChatSessionStatus.ACTIVE
    ) {
      throw new ServiceUnavailableException(
        "การตั้งค่า LINE OA Manager ของร้านชลบุรีไม่พร้อมใช้งาน จึงยกเลิกการส่งเพื่อป้องกันการใช้ Push quota",
      );
    }
  }
}
