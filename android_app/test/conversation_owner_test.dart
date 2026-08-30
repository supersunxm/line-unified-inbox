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
    ConversationSummary summary({ConversationOwner? owner, bool ownerTracked = true}) =>
        ConversationSummary(
          id: 'conversation-1',
          customerName: 'Customer',
          storeName: 'Store',
          unreadCount: 0,
          bmReplyStatus: 'NOT_REPLIED',
          owner: owner,
          ownerTracked: ownerTracked,
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

  testWidgets('legacy unowned inbox cards hide the unassigned label',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: ConversationCard(
        conversation: ConversationSummary(
          id: 'legacy-conversation',
          customerName: 'Customer',
          storeName: 'Store',
          unreadCount: 0,
          bmReplyStatus: 'NOT_REPLIED',
          ownerTracked: false,
        ),
        onTap: () {},
      ),
    ));

    expect(find.textContaining('Unassigned'), findsNothing);
    expect(find.textContaining('Owner:'), findsNothing);
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

  testWidgets('legacy unowned chat headers hide the unassigned state',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        appBar: ConversationHeader(
          customerName: 'Customer',
          ownerTracked: false,
          onOwnerTap: () {},
        ),
      ),
    ));

    expect(find.textContaining('Unassigned'), findsNothing);
    expect(find.textContaining('Owner:'), findsNothing);
  });
}
