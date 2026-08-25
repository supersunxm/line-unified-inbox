import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/features/inbox/inbox_page.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_card.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/inbox_filter_bar.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

class _HqInboxRepository extends ConversationRepository {
  _HqInboxRepository() : super(ApiClient(TokenStore()));

  String? lastStoreId;
  String? lastStatus;

  final _items = [
    ConversationSummary(
      id: 'central',
      customerName: 'Chutisorn',
      storeName: 'OPPO CentralWorld',
      unreadCount: 0,
      bmReplyStatus: 'NOT_REPLIED',
      preview: 'สวัสดีค่ะ ขอสอบถามรุ่น Reno13',
    ),
    ConversationSummary(
      id: 'siam',
      customerName: 'Kittiya',
      storeName: 'OPPO Siam Paragon',
      unreadCount: 0,
      bmReplyStatus: 'REPLIED',
      preview: 'มีเครื่องพร้อมส่งไหมคะ',
    ),
  ];

  @override
  Future<List<Store>> storeOptions() async => [
        Store(id: 'central-store', name: 'OPPO CentralWorld'),
        Store(id: 'siam-store', name: 'OPPO Siam Paragon'),
      ];

  @override
  Future<InboxPageResult> inbox({
    int page = 1,
    String? storeId,
    String? bmReplyStatus,
    String? search,
  }) async {
    lastStoreId = storeId;
    lastStatus = bmReplyStatus;
    final filtered = _items.where((item) {
      final matchesStore = storeId == null ||
          (storeId == 'central-store' && item.id == 'central') ||
          (storeId == 'siam-store' && item.id == 'siam');
      final matchesStatus =
          bmReplyStatus == null || item.bmReplyStatus == bmReplyStatus;
      return matchesStore && matchesStatus;
    }).toList();
    return InboxPageResult(items: filtered, page: page, total: filtered.length);
  }
}

void main() {
  Widget localized(Widget child) => MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: child),
      );

  testWidgets(
      'HQ conversation cards show store/time, customer/preview, and status rows',
      (tester) async {
    await tester.pumpWidget(localized(
      ConversationCard(
        hqLayout: true,
        conversation: ConversationSummary(
          id: 'conversation-1',
          customerName: 'Chutisorn',
          storeName: 'OPPO CentralWorld',
          unreadCount: 0,
          bmReplyStatus: 'NOT_REPLIED',
          preview: 'สวัสดีค่ะ ขอสอบถามรุ่น Reno13',
          sentAt: DateTime.now().copyWith(hour: 10, minute: 24, second: 0),
        ),
        onTap: () {},
      ),
    ));

    expect(find.text('OPPO CentralWorld'), findsOneWidget);
    expect(find.text('10:24'), findsOneWidget);
    expect(find.text('Not Replied'), findsOneWidget);
    final richText = tester.widget<RichText>(find.byWidgetPredicate(
      (widget) =>
          widget is RichText &&
          widget.text.toPlainText().contains('Chutisorn :'),
    ));
    expect(richText.text.toPlainText(),
        contains('Chutisorn : สวัสดีค่ะ ขอสอบถามรุ่น Reno13'));
  });

  testWidgets('HQ status filters expose all three conversation states',
      (tester) async {
    await tester.pumpWidget(localized(
      InboxFilterBar(
        selected: InboxFilter.all,
        hqMode: true,
        onChanged: (_) {},
      ),
    ));

    expect(find.text('Not Replied'), findsOneWidget);
    expect(find.text('Notified BM'), findsOneWidget);
    expect(find.text('Replied'), findsOneWidget);
  });

  testWidgets('HQ inbox defaults to all stores and sends store/status filters',
      (tester) async {
    final repository = _HqInboxRepository();
    await tester.pumpWidget(localized(
      SizedBox(
        height: 900,
        child: InboxPage(
          repository: repository,
          isHq: true,
          showStoreFilter: true,
          onOpen: (_) async {},
          onProfile: () {},
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(repository.lastStoreId, isNull);
    expect(find.text('OPPO CentralWorld'), findsOneWidget);
    expect(find.text('OPPO Siam Paragon'), findsOneWidget);

    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OPPO Siam Paragon').last);
    await tester.pumpAndSettle();
    expect(repository.lastStoreId, 'siam-store');
    expect(find.text('OPPO CentralWorld'), findsNothing);
    expect(find.text('OPPO Siam Paragon'), findsNWidgets(2));

    await tester.tap(find.text('Notified BM'));
    await tester.pumpAndSettle();
    expect(repository.lastStatus, 'NOTIFIED_BM');
  });
}
