import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

void main() {
  test('conversation summary maps unread badge and preview', () {
    final item = ConversationSummary.fromJson({
      'id': 'conversation-1',
      'customer': {'displayName': 'Customer'},
      'store': {'name': 'Store'},
      'unreadCount': 2,
      'bmReplyStatus': 'NOT_REPLIED',
      'lastMessage': {'preview': 'Hello', 'sentAt': '2026-08-11T00:00:00.000Z'},
    });
    expect(item.unreadCount, 2);
    expect(item.preview, 'Hello');
  });

  test('conversation detail maps customer, store, timestamps, and ready media', () {
    final detail = ConversationDetail.fromJson({
      'id': 'conversation-1',
      'customer': {'displayName': 'Somchai'},
      'store': {'id': 'store-1', 'name': 'OBS Bangkae', 'code': '30194'},
      'messages': [
        {
          'id': 'message-1',
          'direction': 'INBOUND',
          'messageType': 'IMAGE',
          'text': '[Image]',
          'sentAt': '2026-08-13T02:12:00.000Z',
          'sender': {'userId': 'bm-1', 'displayName': 'Sunn'},
          'media': {'processingStatus': 'READY', 'mimeType': 'image/jpeg', 'fileSize': 123, 'url': '/messages/message-1/media'},
        },
      ],
    });
    expect(detail.customerName, 'Somchai');
    expect(detail.storeName, 'OBS Bangkae');
    expect(detail.storeCode, '30194');
    expect(detail.messages.single.sentAt, DateTime.parse('2026-08-13T02:12:00.000Z'));
    expect(detail.messages.single.media?.ready, isTrue);
    expect(detail.messages.single.media?.url, '/messages/message-1/media');
    expect(detail.messages.single.sender?.displayName, 'Sunn');
  });

  test('missing or malformed media is safe and text remains available', () {
    final message = ChatMessage.fromJson({'id': 'message-1', 'direction': 'INBOUND', 'messageType': 'TEXT', 'text': 'Hello', 'sentAt': '2026-08-13T02:12:00.000Z', 'media': {'processingStatus': null, 'fileSize': 'invalid'}});
    expect(message.text, 'Hello');
    expect(message.media?.processingStatus, 'FAILED');
    expect(message.media?.fileSize, isNull);
    expect(message.media?.ready, isFalse);
    expect(message.sender, isNull);
  });
}
