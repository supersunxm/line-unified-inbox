import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  LineMessagingService,
  type LineTextInput,
  type PushMessageResult,
} from "./line-messaging.service";
import { LineChatManagerMessageRelayService } from "../line-chat/line-chat-manager-message-relay.service";

/**
 * Phase-1 transport adapter.
 *
 * Reply API remains unchanged because it is quota-free and already appears in
 * LINE OA Manager. Whenever ConversationsService would otherwise use Push API,
 * the Chonburi pilot is intercepted and sent through the authenticated
 * chat.line.biz 1:1 chat instead. Non-pilot stores continue to use the existing
 * Messaging API behavior without any change.
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
