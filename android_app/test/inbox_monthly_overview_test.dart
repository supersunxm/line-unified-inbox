import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_overview_card.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

void main() {
  Widget localized(Widget child) => MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: child),
      );

  test('monthly overview parses canonical summary counters', () {
    final overview = InboxMonthlyOverview.fromSummary({
      'overview': {
        'incomingConversations': 42,
        'waitingConversations': 7,
        'repliedConversations': 35,
      },
    });
    expect(overview.incomingConversations, 42);
    expect(overview.waitingConversations, 7);
    expect(overview.repliedConversations, 35);
  });

  testWidgets('inbox overview prefers coherent monthly counters',
      (tester) async {
    await tester.pumpWidget(localized(const ConversationOverviewCard(
      conversations: [],
      monthlyTotal: 42,
      monthlyNeedReply: 7,
      monthlyCompleted: 35,
    )));

    expect(find.text('42'), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    expect(find.text('35'), findsOneWidget);
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('Need Reply'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
  });
}
