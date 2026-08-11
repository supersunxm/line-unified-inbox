import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';

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
}
