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

function recoverManagerDeliveryVerificationGap(
  input: LineTextInput | LineImageInput,
  messageType: ManagerMessageType,
): PushMessageResult {
  Logger.warn(JSON.stringify({
    event: "line_chat_manager_delivery_verification_gap_recovered",
    conversationId: input.context?.conversationId ?? null,
    storeId: input.context?.storeId ?? null,
    storeName: input.context?.storeName ?? null,
    messageType,
    recoveryScope: "ALL_MANAGER_RELAY_STORES",
  }), "PilotAwareLineMessagingService");

  return {
    requestId: null,
    acceptedRequestId: null,
    externalMessageId: null,
    duplicateAccepted: false,
  };
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
      // This exact worker error is emitted only after a send action was already
      // performed but the headless DOM could not prove the new outbound bubble
      // appeared. Treat that narrow post-send ambiguity as accepted for every
      // Manager-relay store so ConversationsService persists the outbound row.
      // Pre-send, authentication, mapping, composer, worker, and other transport
      // failures still fail closed and never fall back to Push API.
      if (!isManagerDeliveryVerificationGap(error, "TEXT")) throw error;
      return recoverManagerDeliveryVerificationGap(input, "TEXT");
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
      // Images have the same post-send ambiguity class. Recover only the exact
      // worker verification-gap error after the Manager send action; every other
      // image relay error still fails closed.
      if (!isManagerDeliveryVerificationGap(error, "IMAGE")) throw error;
      return recoverManagerDeliveryVerificationGap(input, "IMAGE");
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
