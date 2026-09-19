import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  LineMessagingService,
  type LineImageInput,
  type LineTextInput,
  type PushMessageResult,
} from "./line-messaging.service";
import { LineChatManagerMessageRelayService } from "../line-chat/line-chat-manager-message-relay.service";

const MANAGER_TEXT_DELIVERY_NOT_VERIFIED_MESSAGE =
  "ยังยืนยันการส่งจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกข้อความว่าส่งสำเร็จ";
const MANAGER_IMAGE_DELIVERY_NOT_VERIFIED_MESSAGE =
  "ยังยืนยันการส่งรูปจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกว่าส่งสำเร็จ";

type ManagerMessageType = "TEXT" | "IMAGE";

function isManagerDeliveryVerificationGap(
  error: unknown,
  messageType: ManagerMessageType,
): boolean {
  if (!(error instanceof Error)) return false;
  const expectedMessage = messageType === "IMAGE"
    ? MANAGER_IMAGE_DELIVERY_NOT_VERIFIED_MESSAGE
    : MANAGER_TEXT_DELIVERY_NOT_VERIFIED_MESSAGE;
  return error.message.includes(expectedMessage);
}

function logManagerDeliveryVerificationGap(
  input: LineTextInput | LineImageInput,
  messageType: ManagerMessageType,
): void {
  Logger.warn(JSON.stringify({
    event: "line_chat_manager_delivery_verification_gap_failed_closed",
    conversationId: input.context?.conversationId ?? null,
    storeId: input.context?.storeId ?? null,
    storeName: input.context?.storeName ?? null,
    messageType,
    recoveryScope: "ALL_MANAGER_RELAY_STORES",
  }), "PilotAwareLineMessagingService");
}

/**
 * Manager-aware transport adapter.
 *
 * Reply API remains unchanged because it is quota-free and already appears in
 * LINE OA Manager. Whenever ConversationsService would otherwise use Push API,
 * enabled rollout stores are intercepted and sent through authenticated
 * chat.line.biz 1:1 chat instead. Non-enabled stores keep existing Messaging
 * API behavior unchanged.
 */
@Injectable()
export class PilotAwareLineMessagingService extends LineMessagingService {
  constructor(
    @Inject(LineChatManagerMessageRelayService)
    private readonly managerRelay: LineChatManagerMessageRelayService,
  ) {
    super();
  }

  override async pushText(input: LineTextInput): Promise<PushMessageResult> {
    let relay;
    try {
      relay = await this.managerRelay.relayText({
        conversationId: input.context?.conversationId,
        text: input.text,
        idempotencyKey: input.retryKey,
      });
    } catch (error) {
      // A post-send verification gap is NOT delivery success. The worker owns
      // recovery/verification; if it still cannot prove delivery, fail closed
      // so ConversationsService never persists a false DELIVERED row.
      if (isManagerDeliveryVerificationGap(error, "TEXT")) {
        logManagerDeliveryVerificationGap(input, "TEXT");
      }
      throw error;
    }

    if (!relay.handled) return super.pushText(input);

    Logger.log(JSON.stringify({
      event: "line_push_replaced_by_manager_relay",
      conversationId: input.context?.conversationId ?? null,
      storeId: input.context?.storeId ?? null,
      storeName: input.context?.storeName ?? null,
      messageType: "TEXT",
      duplicate: relay.duplicate,
    }), "PilotAwareLineMessagingService");

    return {
      requestId: null,
      acceptedRequestId: null,
      externalMessageId: null,
      duplicateAccepted: relay.duplicate,
    };
  }

  override async pushImage(input: LineImageInput): Promise<PushMessageResult> {
    let relay;
    try {
      relay = await this.managerRelay.relayImage({
        conversationId: input.context?.conversationId,
        imageUrl: input.originalContentUrl,
        idempotencyKey: input.retryKey,
      });
    } catch (error) {
      if (isManagerDeliveryVerificationGap(error, "IMAGE")) {
        logManagerDeliveryVerificationGap(input, "IMAGE");
      }
      throw error;
    }

    if (!relay.handled) return super.pushImage(input);

    Logger.log(JSON.stringify({
      event: "line_image_push_replaced_by_manager_relay",
      conversationId: input.context?.conversationId ?? null,
      storeId: input.context?.storeId ?? null,
      storeName: input.context?.storeName ?? null,
      messageType: "IMAGE",
      duplicate: relay.duplicate,
    }), "PilotAwareLineMessagingService");

    return {
      requestId: null,
      acceptedRequestId: null,
      externalMessageId: null,
      duplicateAccepted: relay.duplicate,
    };
  }
}
