import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/notifications/notification_service.dart';
import 'package:line_oa_chat_hub/features/notifications/conversation_notification_history.dart';

void main() {
  test(
      'conversation notification IDs are stable, distinct, and valid Android ints',
      () {
    final first =
        conversationNotificationId('11111111-1111-4111-8111-111111111111');
    final repeated =
        conversationNotificationId('11111111-1111-4111-8111-111111111111');
    final second =
        conversationNotificationId('22222222-2222-4222-8222-222222222222');

    expect(first, repeated);
    expect(first, isNot(second));
    expect(first, inInclusiveRange(1, 0x7fffffff));
    expect(second, inInclusiveRange(1, 0x7fffffff));
  });

  test('conversation history accumulates, deduplicates, and stays bounded',
      () async {
    final store = MemoryConversationNotificationHistoryStore();
    for (var index = 0;
        index < maxConversationNotificationMessages + 2;
        index += 1) {
      await store.append(
        conversationId: 'conversation-a',
        customerName: 'Customer A',
        message: ConversationNotificationMessage(
          messageId: 'message-$index',
          preview: 'preview-$index',
          sentAt: DateTime.utc(2026, 1, 1, 0, 0, index),
        ),
      );
    }
    await store.append(
      conversationId: 'conversation-a',
      customerName: 'Customer A',
      message: ConversationNotificationMessage(
        messageId: 'message-9',
        preview: 'updated',
        sentAt: DateTime.utc(2026, 1, 1, 0, 1),
      ),
    );

    final history = store.read('conversation-a')!;
    expect(history.messages, hasLength(maxConversationNotificationMessages));
    expect(
        history.messages.where((message) => message.messageId == 'message-9'),
        hasLength(1));
    expect(history.messages.last.preview, 'updated');
  });

  test(
      'clearing one conversation preserves other history and logout clears all',
      () async {
    final store = MemoryConversationNotificationHistoryStore();
    Future<void> append(String conversationId) => store
        .append(
          conversationId: conversationId,
          customerName: conversationId,
          message: ConversationNotificationMessage(
            messageId: '$conversationId-message',
            preview: 'message',
            sentAt: DateTime.utc(2026),
          ),
        )
        .then((_) {});
    await append('conversation-a');
    await append('conversation-b');
    await store.clearConversation('conversation-a');
    expect(store.read('conversation-a'), isNull);
    expect(store.read('conversation-b'), isNotNull);
    await store.clearAll();
    expect(store.read('conversation-b'), isNull);
  });

  test('image notifications use a safe image fallback and text is bounded', () {
    expect(notificationPreview(messageType: 'IMAGE', preview: 'private URL'),
        'Sent an image');
    expect(
        notificationPreview(messageType: 'TEXT', preview: '  hello\nthere  '),
        'hello there');
    expect(notificationPreview(messageType: 'TEXT', preview: 'x' * 200).length,
        160);
  });

  test('registers the current FCM token for an authenticated session',
      () async {
    String? registeredToken;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => 'fcm-token-for-test',
      tokenRegistrar: (token) async => registeredToken = token,
    );

    await service.ensureDeviceRegistered();

    expect(registeredToken, 'fcm-token-for-test');
  });

  test('does not register a token without an authenticated session', () async {
    var tokenLoaded = false;
    var registered = false;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => false,
      tokenLoader: () async {
        tokenLoaded = true;
        return 'fcm-token-for-test';
      },
      tokenRegistrar: (_) async => registered = true,
    );

    await service.ensureDeviceRegistered();

    expect(tokenLoaded, isFalse);
    expect(registered, isFalse);
  });

  test('does not register when Firebase returns no token', () async {
    var registered = false;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => null,
      tokenRegistrar: (_) async => registered = true,
    );

    await service.ensureDeviceRegistered();

    expect(registered, isFalse);
  });

  test('registration failure is non-blocking and can be retried', () async {
    var attempts = 0;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => 'fcm-token-for-test',
      tokenRegistrar: (_) async {
        attempts += 1;
        if (attempts == 1) throw StateError('temporary registration failure');
      },
    );

    await service.ensureDeviceRegistered();
    await service.ensureDeviceRegistered();

    expect(attempts, 2);
  });

  test('logout deactivates the token, clears history, and clears notifications',
      () async {
    final history = MemoryConversationNotificationHistoryStore();
    await history.append(
      conversationId: 'conversation-a',
      customerName: 'Customer A',
      message: ConversationNotificationMessage(
        messageId: 'message-a',
        preview: 'Hello',
        sentAt: DateTime.utc(2026),
      ),
    );
    var deactivationCount = 0;
    var cleanupCount = 0;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => 'token-for-test',
      tokenRegistrar: (_) async {},
      deviceTokenDeactivator: (_) async => deactivationCount += 1,
      cancelNotifications: () async => cleanupCount += 1,
      historyStore: history,
    );

    await service.ensureDeviceRegistered();
    await service.logout();

    expect(deactivationCount, 1);
    expect(cleanupCount, 1);
    expect(history.read('conversation-a'), isNull);
  });

  test('logout succeeds when Firebase has no token', () async {
    var deactivationCount = 0;
    var cleanupCount = 0;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => null,
      deviceTokenDeactivator: (_) async => deactivationCount += 1,
      cancelNotifications: () async => cleanupCount += 1,
      historyStore: MemoryConversationNotificationHistoryStore(),
    );

    await service.ensureDeviceRegistered();
    await service.logout();

    expect(deactivationCount, 0);
    expect(cleanupCount, 1);
  });

  test('notification cleanup failure does not block logout', () async {
    var deactivationCount = 0;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => 'token-for-test',
      tokenRegistrar: (_) async {},
      deviceTokenDeactivator: (_) async => deactivationCount += 1,
      cancelNotifications: () async => throw StateError('plugin unavailable'),
      historyStore: MemoryConversationNotificationHistoryStore(),
    );

    await service.ensureDeviceRegistered();
    await service.logout();

    expect(deactivationCount, 1);
  });

  test('device token deactivation failure does not block logout', () async {
    var cleanupCount = 0;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => 'token-for-test',
      tokenRegistrar: (_) async {},
      deviceTokenDeactivator: (_) async => throw StateError('network failure'),
      cancelNotifications: () async => cleanupCount += 1,
      historyStore: MemoryConversationNotificationHistoryStore(),
    );

    await service.ensureDeviceRegistered();
    await service.logout();

    expect(cleanupCount, 1);
  });

  test('double logout has one effective cleanup', () async {
    var deactivationCount = 0;
    var cleanupCount = 0;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () async => 'token-for-test',
      tokenRegistrar: (_) async {},
      deviceTokenDeactivator: (_) async {
        deactivationCount += 1;
        await Future<void>.delayed(Duration.zero);
      },
      cancelNotifications: () async => cleanupCount += 1,
      historyStore: MemoryConversationNotificationHistoryStore(),
    );

    await service.ensureDeviceRegistered();
    await Future.wait([service.logout(), service.logout()]);

    expect(deactivationCount, 1);
    expect(cleanupCount, 1);
  });

  test('logout waits for in-flight registration safely', () async {
    final tokenReady = Completer<String?>();
    var registered = false;
    var deactivationCount = 0;
    final service = NotificationService(
      ApiClient(TokenStore()),
      TokenStore(),
      authenticationChecker: () async => true,
      tokenLoader: () => tokenReady.future,
      tokenRegistrar: (_) async => registered = true,
      deviceTokenDeactivator: (_) async => deactivationCount += 1,
      historyStore: MemoryConversationNotificationHistoryStore(),
    );

    final registration = service.ensureDeviceRegistered();
    await Future<void>.delayed(Duration.zero);
    final logout = service.logout();
    tokenReady.complete('token-for-test');
    await Future.wait([registration, logout]);

    expect(registered, isFalse);
    expect(deactivationCount, 0);
  });
}
