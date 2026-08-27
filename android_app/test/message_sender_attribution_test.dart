import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/message_bubble.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

Widget _app(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

ChatMessage _message({
  required String direction,
  MessageSender? sender,
}) => ChatMessage(
      id: 'message-1',
      text: 'Reply text',
      direction: direction,
      messageType: 'TEXT',
      sentAt: DateTime(2026, 8, 20, 12),
      sender: sender);

void main() {
  testWidgets('outbound bubble shows the persisted sender name', (tester) async {
    await tester.pumpWidget(_app(MessageBubble(
      text: 'Reply text',
      outbound: true,
      timestamp: DateTime(2026, 8, 20, 12),
      message: _message(
        direction: 'OUTBOUND',
        sender: MessageSender(userId: 'staff-1', displayName: 'Chutisorn'),
      ),
    )));

    expect(find.text('Chutisorn'), findsOneWidget);
    expect(find.text('Store'), findsNothing);
  });

  testWidgets('outbound bubble with a missing sender does not invent an author',
      (tester) async {
    await tester.pumpWidget(_app(MessageBubble(
      text: 'Reply text',
      outbound: true,
      timestamp: DateTime(2026, 8, 20, 12),
      message: _message(direction: 'OUTBOUND'),
    )));

    expect(find.text('Store'), findsNothing);
    expect(find.text('Customer'), findsNothing);
  });

  testWidgets('inbound bubble keeps customer label and never shows staff sender',
      (tester) async {
    await tester.pumpWidget(_app(MessageBubble(
      text: 'Customer text',
      outbound: false,
      timestamp: DateTime(2026, 8, 20, 12),
      message: _message(
        direction: 'INBOUND',
        sender: MessageSender(userId: 'staff-1', displayName: 'Should not show'),
      ),
    )));

    expect(find.text('Customer'), findsOneWidget);
    expect(find.text('Should not show'), findsNothing);
  });
}
