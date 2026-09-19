import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/network/api_exception.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

class _LostResponseApiClient extends ApiClient {
  _LostResponseApiClient() : super(TokenStore());

  int postCalls = 0;
  int getCalls = 0;

  @override
  Future<Map<String, dynamic>> post(String path,
      {Map<String, dynamic>? body,
      bool authenticated = true,
      bool handleSessionExpiry = true}) async {
    postCalls += 1;
    throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');
  }

  @override
  Future<Map<String, dynamic>> get(String path,
      {Map<String, String>? query, bool authenticated = true}) async {
    getCalls += 1;
    return {
      'items': [
        {
          'id': 'message-1',
          'direction': 'OUTBOUND',
          'messageType': 'TEXT',
          'deliveryStatus': 'DELIVERED',
          'originalText': 'hello',
          'sentAt': '2026-09-12T09:00:00.000Z',
          'externalMessageId': 'outbound:send-key-1',
        }
      ],
    };
  }
}

class _PersistedFailedSendApiClient extends ApiClient {
  _PersistedFailedSendApiClient() : super(TokenStore());

  int postCalls = 0;
  int getCalls = 0;

  @override
  Future<Map<String, dynamic>> post(String path,
      {Map<String, dynamic>? body,
      bool authenticated = true,
      bool handleSessionExpiry = true}) async {
    postCalls += 1;
    throw ApiException(503, 'SERVICE_UNAVAILABLE', 'Manager relay failed');
  }

  @override
  Future<Map<String, dynamic>> get(String path,
      {Map<String, String>? query, bool authenticated = true}) async {
    getCalls += 1;
    return {
      'items': [
        {
          'id': 'message-failed-1',
          'direction': 'OUTBOUND',
          'deliveryStatus': 'FAILED',
          'messageType': 'TEXT',
          'originalText': 'hello',
          'sentAt': '2026-09-19T03:56:20.000Z',
          'externalMessageId': 'outbound:send-key-failed',
        }
      ],
    };
  }
}

class _RejectedSendApiClient extends ApiClient {
  _RejectedSendApiClient() : super(TokenStore());

  int getCalls = 0;

  @override
  Future<Map<String, dynamic>> post(String path,
      {Map<String, dynamic>? body,
      bool authenticated = true,
      bool handleSessionExpiry = true}) async {
    throw ApiException(400, 'VALIDATION_ERROR', 'Invalid message');
  }

  @override
  Future<Map<String, dynamic>> get(String path,
      {Map<String, String>? query, bool authenticated = true}) async {
    getCalls += 1;
    return {'items': <dynamic>[]};
  }
}

void main() {
  test('reply recovers a server-successful send after the HTTP response is lost',
      () async {
    final api = _LostResponseApiClient();
    final repository = ConversationRepository(api);

    final message =
        await repository.reply('conversation-1', 'hello', 'send-key-1');

    expect(message, isNotNull);
    expect(message!.id, 'message-1');
    expect(message.idempotencyKey, 'send-key-1');
    expect(api.postCalls, 1,
        reason: 'reconciliation must not create a second outbound send');
    expect(api.getCalls, 1);
  });

  test('reply never recovers a persisted FAILED outbound as sent', () async {
    final api = _PersistedFailedSendApiClient();
    final repository = ConversationRepository(api);

    await expectLater(
      repository.reply(
          'conversation-1', 'hello', 'send-key-failed'),
      throwsA(isA<ApiException>().having(
          (error) => error.statusCode, 'statusCode', 503)),
    );

    expect(api.postCalls, 1,
        reason: 'a failed persisted attempt must not trigger a duplicate send');
    expect(api.getCalls, 1,
        reason: 'FAILED is authoritative and should stop reconciliation');
  });

  test('reply does not reconcile deterministic client errors', () async {
    final api = _RejectedSendApiClient();
    final repository = ConversationRepository(api);

    await expectLater(
      repository.reply('conversation-1', 'hello', 'send-key-2'),
      throwsA(isA<ApiException>().having(
          (error) => error.statusCode, 'statusCode', 400)),
    );

    expect(api.getCalls, 0);
  });
}
