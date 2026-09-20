import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/chat_delivery_reconciliation.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

void main() {
  final targetSentAt = DateTime.utc(2026, 9, 19, 20, 43);

  ChatMessage message({
    required String id,
    required DateTime sentAt,
    String status = 'DELIVERED',
    String text = 'message',
  }) =>
      ChatMessage(
        id: id,
        text: text,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        sentAt: sentAt,
        deliveryStatus: status,
      );

  ConversationDetail detail(List<ChatMessage> messages, {String? nextCursor}) =>
      ConversationDetail(
        id: 'conversation-a',
        customerName: 'Customer A',
        storeName: 'Store',
        messages: messages,
        nextCursor: nextCursor,
        bmReplyStatus: 'REPLIED',
        ownerTracked: true,
      );

  test('superseded message reconciles when replacement is one minute old', () {
    final current = detail([
      message(
        id: 'stale',
        sentAt: targetSentAt,
        status: 'PENDING',
        text: 'stale retry',
      ),
    ]);
    final latest = detail([
      message(
        id: 'neighbor',
        sentAt: targetSentAt.subtract(const Duration(minutes: 1)),
      ),
      message(
        id: 'manager-reply',
        sentAt: targetSentAt.add(const Duration(minutes: 1)),
        text: 'manager reply',
      ),
    ]);

    final result = reconcileQueuedDelivery(
      current: current,
      latest: latest,
      messageId: 'stale',
      targetSentAt: targetSentAt,
    );

    expect(result.stopPolling, isTrue);
    expect(result.detail.messages.map((item) => item.id),
        ['neighbor', 'manager-reply']);
  });

  test('superseded message reconciles when replacement is over one hour old',
      () {
    final current = detail([
      message(
        id: 'stale',
        sentAt: targetSentAt,
        status: 'PENDING',
      ),
    ]);
    final latest = detail([
      message(
        id: 'neighbor',
        sentAt: targetSentAt.subtract(const Duration(minutes: 18)),
      ),
      message(
        id: 'manager-reply',
        sentAt: targetSentAt.add(const Duration(minutes: 65)),
        text: 'manager reply',
      ),
    ]);

    final result = reconcileQueuedDelivery(
      current: current,
      latest: latest,
      messageId: 'stale',
      targetSentAt: targetSentAt,
    );

    expect(result.stopPolling, isTrue);
    expect(result.detail.messages.map((item) => item.id),
        ['neighbor', 'manager-reply']);
  });

  test('message outside a limited latest page is retained', () {
    final current = detail([
      message(id: 'stale', sentAt: targetSentAt, status: 'PENDING'),
    ]);
    final latest = detail(
      [
        message(
          id: 'newer',
          sentAt: targetSentAt.add(const Duration(hours: 1)),
        ),
      ],
      nextCursor: 'older-page-cursor',
    );

    final result = reconcileQueuedDelivery(
      current: current,
      latest: latest,
      messageId: 'stale',
      targetSentAt: targetSentAt,
    );

    expect(result.stopPolling, isFalse);
    expect(result.detail.messages.map((item) => item.id), ['stale']);
  });

  test('repeated canonical polls do not duplicate imported messages', () {
    final latest = detail([
      message(
        id: 'neighbor',
        sentAt: targetSentAt.subtract(const Duration(minutes: 18)),
      ),
      message(
        id: 'manager-reply',
        sentAt: targetSentAt.add(const Duration(minutes: 65)),
        text: 'manager reply',
      ),
    ]);
    final first = reconcileQueuedDelivery(
      current: detail([
        message(id: 'stale', sentAt: targetSentAt, status: 'PENDING'),
      ]),
      latest: latest,
      messageId: 'stale',
      targetSentAt: targetSentAt,
    );
    final second = reconcileQueuedDelivery(
      current: first.detail,
      latest: latest,
      messageId: 'stale',
      targetSentAt: targetSentAt,
    );

    expect(second.detail.messages.where((item) => item.id == 'manager-reply'),
        hasLength(1));
  });

  test('PENDING to DELIVERED stops polling and preserves canonical status', () {
    final result = reconcileQueuedDelivery(
      current: detail([
        message(id: 'target', sentAt: targetSentAt, status: 'PENDING'),
      ]),
      latest: detail([
        message(id: 'target', sentAt: targetSentAt, status: 'DELIVERED'),
      ]),
      messageId: 'target',
      targetSentAt: targetSentAt,
    );

    expect(result.stopPolling, isTrue);
    expect(result.detail.messages.single.deliveryStatus, 'DELIVERED');
  });

  test(
      'PENDING lasting beyond the 90-second lease still reconciles to DELIVERED',
      () {
    expect(queuedDeliveryPollHorizon, greaterThan(const Duration(seconds: 90)));

    final pending = reconcileQueuedDelivery(
      current: detail([
        message(id: 'target', sentAt: targetSentAt, status: 'PENDING'),
      ]),
      latest: detail([
        message(id: 'target', sentAt: targetSentAt, status: 'PENDING'),
      ]),
      messageId: 'target',
      targetSentAt: targetSentAt,
    );
    expect(pending.stopPolling, isFalse);

    final delivered = reconcileQueuedDelivery(
      current: pending.detail,
      latest: detail([
        message(id: 'target', sentAt: targetSentAt, status: 'DELIVERED'),
      ]),
      messageId: 'target',
      targetSentAt: targetSentAt,
    );
    expect(delivered.stopPolling, isTrue);
    expect(delivered.detail.messages.single.deliveryStatus, 'DELIVERED');
  });

  test('PENDING lasting about three minutes remains pollable until terminal',
      () {
    expect(queuedDeliveryPollHorizon, greaterThan(const Duration(minutes: 3)));
    expect(queuedDeliveryPollDelays.last, const Duration(seconds: 30));
    expect(
      queuedDeliveryPollDelays
          .every((delay) => delay <= const Duration(seconds: 30)),
      isTrue,
    );
  });

  test('PENDING to FAILED stops polling and preserves canonical status', () {
    final result = reconcileQueuedDelivery(
      current: detail([
        message(id: 'target', sentAt: targetSentAt, status: 'PENDING'),
      ]),
      latest: detail([
        message(id: 'target', sentAt: targetSentAt, status: 'FAILED'),
      ]),
      messageId: 'target',
      targetSentAt: targetSentAt,
    );

    expect(result.stopPolling, isTrue);
    expect(result.detail.messages.single.deliveryStatus, 'FAILED');
  });

  test('disposal or navigation invalidates pending poll UI updates', () {
    expect(
      canApplyQueuedDeliveryPollResult(
        mounted: false,
        pollGeneration: 1,
        currentGeneration: 1,
      ),
      isFalse,
    );
    expect(
      canApplyQueuedDeliveryPollResult(
        mounted: true,
        pollGeneration: 1,
        currentGeneration: 2,
      ),
      isFalse,
    );
    expect(
      canApplyQueuedDeliveryPollResult(
        mounted: true,
        pollGeneration: 2,
        currentGeneration: 2,
      ),
      isTrue,
    );
  });
}
