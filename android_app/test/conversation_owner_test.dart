import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_header.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_card.dart';

void main() {
  test('conversation owner parses a safe display contract', () {
    final owner = ConversationOwner.fromJson({
      'id': 'user-1',
      'displayName': '  Kittiya Tumsai  ',
    });
    expect(owner.id, 'user-1');
    expect(owner.displayName, 'Kittiya Tumsai');
  });

  testWidgets('inbox card shows owner and unassigned fallback', (tester) async {
    ConversationSummary summary({ConversationOwner? owner}) =>
        ConversationSummary(
          id: 'conversation-1',
          customerName: 'Customer',
          storeName: 'Store',
          unreadCount: 0,
          bmReplyStatus: 'NOT_REPLIED',
          owner: owner,
        );

    await tester.pumpWidget(MaterialApp(
      home: Column(
        children: [
          ConversationCard(
              conversation: summary(
                  owner:
                      const ConversationOwner(id: 'u', displayName: 'Kittiya')),
              onTap: () {}),
          ConversationCard(conversation: summary(), onTap: () {}),
        ],
      ),
    ));
    expect(find.textContaining('Kittiya'), findsOneWidget);
    expect(find.textContaining('Unassigned'), findsOneWidget);
  });

  testWidgets('chat header shows current owner', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        appBar: ConversationHeader(
          customerName: 'Customer',
          owner:
              const ConversationOwner(id: 'u', displayName: 'Kittiya Tumsai'),
          onOwnerTap: () {},
        ),
      ),
    ));
    expect(find.textContaining('Kittiya Tumsai'), findsOneWidget);
  });
}
