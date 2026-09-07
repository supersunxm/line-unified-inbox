import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { LineChatSessionStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  getLineChatManagerRelayStoreConfig,
  isLineChatManagerRelayStoreEnabled,
} from "./line-chat-pilot.constants";

export type ManagerRelayResult =
  | { handled: false }
  | { handled: true; duplicate: boolean; lineChatUserId: string };

type RelayConversation = {
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

function storeCodeOf(conversation: RelayConversation): string {
  return conversation.store?.code?.trim()
    || conversation.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

@Injectable()
export class LineChatManagerMessageRelayService {
  private readonly logger = new Logger(LineChatManagerMessageRelayService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async relayText(input: {
    conversationId?: string;
    text: string;
    idempotencyKey: string;
  }): Promise<ManagerRelayResult> {
    return this.relay({
      conversationId: input.conversationId,
      idempotencyKey: input.idempotencyKey,
      endpoint: "/internal/line-chat/send-text",
      payload: { text: input.text },
      mediaType: "TEXT",
    });
  }

  public async relayImage(input: {
    conversationId?: string;
    imageUrl: string;
    idempotencyKey: string;
  }): Promise<ManagerRelayResult> {
    return this.relay({
      conversationId: input.conversationId,
      idempotencyKey: input.idempotencyKey,
      endpoint: "/internal/line-chat/send-image",
      payload: { imageUrl: input.imageUrl },
      mediaType: "IMAGE",
    });
  }

  private async relay(input: {
    conversationId?: string;
    idempotencyKey: string;
    endpoint: string;
    payload: Record<string, string>;
    mediaType: "TEXT" | "IMAGE";
  }): Promise<ManagerRelayResult> {
    const conversationId = input.conversationId?.trim();
    if (!conversationId) return { handled: false };

    const conversation = await this.loadConversation(conversationId);
    if (!conversation) return { handled: false };

    const storeCode = storeCodeOf(conversation);
    if (!isLineChatManagerRelayStoreEnabled(storeCode)) return { handled: false };

    this.assertRelayConfiguration(conversation, storeCode);

    const workerUrl = process.env.LINE_CHAT_WORKER_INTERNAL_URL?.trim().replace(/\/+$/u, "");
    const secret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET?.trim();
    if (!workerUrl || !secret) {
      throw new ServiceUnavailableException(
        `ระบบส่ง${input.mediaType === "IMAGE" ? "รูป" : "ข้อความ"}ผ่าน LINE OA Manager ยังไม่ได้เชื่อมต่อกับ worker จึงยกเลิกการส่งเพื่อป้องกันการใช้ Push quota`,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.mediaType === "IMAGE" ? 60_000 : 45_000);
    try {
      const response = await fetch(`${workerUrl}${input.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Line-Chat-Internal-Secret": secret,
        },
        body: JSON.stringify({
          conversationId,
          idempotencyKey: input.idempotencyKey,
          ...input.payload,
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
        this.logger.log(JSON.stringify({
          event: input.mediaType === "IMAGE"
            ? "line_chat_manager_image_relay_api_success"
            : "line_chat_manager_relay_api_success",
          conversationId,
          storeCode,
          lineOfficialAccountId: conversation.lineOfficialAccount.id,
          sessionKey: conversation.lineOfficialAccount.lineChatSession?.sessionKey ?? null,
          duplicate: body.duplicate === true,
        }));
        return {
          handled: true,
          duplicate: body.duplicate === true,
          lineChatUserId: body.lineChatUserId.trim(),
        };
      }

      this.logger.warn(JSON.stringify({
        event: input.mediaType === "IMAGE"
          ? "line_chat_manager_image_relay_worker_rejected"
          : "line_chat_manager_relay_worker_rejected",
        conversationId,
        storeCode,
        statusCode: response.status,
        workerError: typeof body.error === "string" ? body.error.slice(0, 250) : null,
      }));
      throw new ServiceUnavailableException(
        typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : `ส่ง${input.mediaType === "IMAGE" ? "รูป" : "ข้อความ"}ผ่าน LINE OA Manager ไม่สำเร็จ กรุณาลองอีกครั้ง`,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const aborted = error instanceof Error && error.name === "AbortError";
      this.logger.error(JSON.stringify({
        event: input.mediaType === "IMAGE"
          ? "line_chat_manager_image_relay_worker_unavailable"
          : "line_chat_manager_relay_worker_unavailable",
        conversationId,
        storeCode,
        aborted,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw new ServiceUnavailableException(
        aborted
          ? `LINE OA Manager ใช้เวลาส่ง${input.mediaType === "IMAGE" ? "รูป" : "ข้อความ"}นานเกินกำหนด กรุณาลองอีกครั้ง`
          : "เชื่อมต่อ LINE OA Manager worker ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async loadConversation(id: string): Promise<RelayConversation | null> {
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
    }) as Promise<RelayConversation | null>;
  }

  private assertRelayConfiguration(conversation: RelayConversation, storeCode: string): void {
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    const config = getLineChatManagerRelayStoreConfig(storeCode);
    if (
      !config
      || conversation.storeId !== oa.storeId
      || oa.accountType !== "STORE"
      || !oa.isActive
      || oa.archivedAt !== null
      || oa.name.trim() !== config.storeName
      || !oa.chatBotId?.trim()
      || ("expectedBotId" in config && oa.chatBotId.trim() !== config.expectedBotId)
      || !session
      || session.sessionKey.trim() !== config.sessionKey
      || session.status !== LineChatSessionStatus.ACTIVE
    ) {
      throw new ServiceUnavailableException(
        `การตั้งค่า LINE OA Manager ของร้าน ${storeCode} ไม่พร้อมใช้งาน จึงยกเลิกการส่งเพื่อป้องกันการใช้ Push quota`,
      );
    }
  }
}
