import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  LineMessagingService,
  type LineImageInput,
  type LineTextInput,
  type PushMessageResult,
} from "./line-messaging.service";
import { LineChatManagerMessageRelayService } from "../line-chat/line-chat-manager-message-relay.service";

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
    const relay = await this.managerRelay.relayText({
      conversationId: input.context?.conversationId,
      text: input.text,
      idempotencyKey: input.retryKey,
    });

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
