import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/widgets/app_widgets.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_card.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

void main() {
  Widget localized(Widget child) => MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: child),
      );

  ConversationSummary unreadConversation() => ConversationSummary(
        id: 'conversation-1',
        customerName: 'Aom',
        storeName: 'OBS Robinson Chonburi By OPPO',
        unreadCount: 15,
        bmReplyStatus: 'NOT_REPLIED',
        preview: 'อยู่โรบินสันบ่อวินมีไหมคะ',
      );

  void expectUnreadMarkerHidden(WidgetTester tester) {
    final badge = find.byType(UnreadBadge);
    expect(badge, findsOneWidget);
    final opacityFinder = find.ancestor(
      of: badge,
      matching: find.byType(Opacity),
    );
    expect(opacityFinder, findsOneWidget);
    expect(tester.widget<Opacity>(opacityFinder).opacity, 0);
  }

  testWidgets('store inbox cards do not render unread presentation',
      (tester) async {
    await tester.pumpWidget(localized(
      ConversationCard(
        conversation: unreadConversation(),
        onTap: () {},
      ),
    ));

    final card = tester.widget<Card>(find.byType(Card));
    expect(card.color, isNull);
    expectUnreadMarkerHidden(tester);
    expect(find.text('Need Reply'), findsOneWidget);
  });

  testWidgets('HQ inbox cards do not render unread presentation',
      (tester) async {
    await tester.pumpWidget(localized(
      ConversationCard(
        hqLayout: true,
        conversation: unreadConversation(),
        onTap: () {},
      ),
    ));

    final card = tester.widget<Card>(find.byType(Card));
    expect(card.color, isNull);
    expectUnreadMarkerHidden(tester);
    expect(find.text('Not Replied'), findsOneWidget);
  });
}
