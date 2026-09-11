import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  LineMessagingService,
  type LineImageInput,
  type LineTextInput,
  type PushMessageResult,
} from "./line-messaging.service";
import { LineChatManagerMessageRelayService } from "../line-chat/line-chat-manager-message-relay.service";

const CENTRAL_WORLD_STORE_NAME = "OPPO Central World";
const MANAGER_DELIVERY_NOT_VERIFIED_MESSAGE =
  "ยังยืนยันการส่งจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกข้อความว่าส่งสำเร็จ";

function isCentralWorldManagerVerificationGap(input: LineTextInput, error: unknown): boolean {
  return input.context?.storeName?.trim() === CENTRAL_WORLD_STORE_NAME
    && error instanceof Error
    && error.message.includes(MANAGER_DELIVERY_NOT_VERIFIED_MESSAGE);
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
      // Emergency recovery for Central World only. Production evidence shows
      // chat.line.biz accepts the keyboard submit and delivers to the customer,
      // while its headless DOM does not expose the newly-created outbound bubble
      // in time for the strict worker verifier. Treat only that exact post-send
      // ambiguity as accepted so ConversationsService persists the outbound row
      // and the idempotency key prevents repeated customer sends. Every other
      // Manager failure still fails closed and never falls back to Push API.
      if (!isCentralWorldManagerVerificationGap(input, error)) throw error;

      Logger.warn(JSON.stringify({
        event: "line_chat_manager_delivery_verification_gap_recovered",
        conversationId: input.context?.conversationId ?? null,
        storeId: input.context?.storeId ?? null,
        storeName: input.context?.storeName ?? null,
        messageType: "TEXT",
        recoveryScope: "CENTRAL_WORLD_ONLY",
      }), "PilotAwareLineMessagingService");

      return {
        requestId: null,
        acceptedRequestId: null,
        externalMessageId: null,
        duplicateAccepted: false,
      };
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
    const relay = await this.managerRelay.relayImage({
      conversationId: input.context?.conversationId,
      imageUrl: input.originalContentUrl,
      idempotencyKey: input.retryKey,
    });

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
