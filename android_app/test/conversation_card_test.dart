import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_card.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

ConversationSummary _summary({CustomerSalesSummary? sales}) =>
    ConversationSummary(
      id: 'conversation-1',
      customerName: 'Customer',
      storeName: 'OPPO CentralWorld',
      unreadCount: 0,
      bmReplyStatus: 'NOT_REPLIED',
      customerSalesSummary: sales,
      preview: 'Hello',
      sentAt: DateTime(2026, 8, 29, 12, 0),
    );

Widget _app(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  for (final (status, label) in [
    ('ONLINE', '🌐 Online'),
    ('INTERESTED', '🎯 Interested'),
    ('PURCHASED', '🛍️ Purchased'),
  ]) {
    testWidgets('conversation card renders $status sales tag', (tester) async {
      await tester.pumpWidget(_app(ConversationCard(
        conversation: _summary(
          sales: CustomerSalesSummary(status: status),
        ),
        onTap: () {},
      )));
      expect(find.text(label), findsOneWidget);
    });
  }

  testWidgets('conversation card renders first product and additional count',
      (tester) async {
    await tester.pumpWidget(_app(ConversationCard(
      conversation: _summary(
        sales: const CustomerSalesSummary(
          status: 'INTERESTED',
          products: [
            CustomerSalesSummaryProduct(modelName: 'OPPO Reno16'),
            CustomerSalesSummaryProduct(modelName: 'OPPO Watch X'),
            CustomerSalesSummaryProduct(modelName: 'OPPO Pad'),
          ],
        ),
      ),
      onTap: () {},
    )));
    expect(find.text('📱 OPPO Reno16 +2'), findsOneWidget);
  });

  testWidgets('conversation card hides sales tag when no sales data exists',
      (tester) async {
    await tester.pumpWidget(_app(ConversationCard(
      conversation: _summary(),
      onTap: () {},
    )));
    expect(find.textContaining('Online'), findsNothing);
    expect(find.textContaining('Interested'), findsNothing);
    expect(find.textContaining('Purchased'), findsNothing);
  });

  testWidgets(
      'single-store conversation card hides store context but keeps owner',
      (tester) async {
    await tester.pumpWidget(_app(ConversationCard(
      conversation: ConversationSummary(
        id: 'conversation-1',
        customerName: 'Customer',
        storeName: 'OPPO CentralWorld',
        unreadCount: 0,
        bmReplyStatus: 'NOT_REPLIED',
        preview: 'Hello',
        owner: const ConversationOwner(id: 'owner-1', displayName: 'Kittiya'),
      ),
      showStoreContext: false,
      onTap: () {},
    )));

    expect(find.text('OPPO CentralWorld'), findsNothing);
    expect(find.text('Customer'), findsOneWidget);
    expect(find.text('Owner: Kittiya'), findsOneWidget);
    expect(find.text('Need Reply'), findsOneWidget);
  });

  testWidgets('multi-store conversation card keeps store context',
      (tester) async {
    await tester.pumpWidget(_app(ConversationCard(
      conversation: _summary(),
      showStoreContext: true,
      onTap: () {},
    )));

    expect(find.text('OPPO CentralWorld'), findsOneWidget);
  });
}
