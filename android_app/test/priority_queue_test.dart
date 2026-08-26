import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/features/inbox/inbox_page.dart';
import 'package:line_oa_chat_hub/features/inbox/priority.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_card.dart';

class _PriorityRepository extends ConversationRepository {
  _PriorityRepository(this.items) : super(ApiClient(TokenStore()));

  final List<ConversationSummary> items;

  @override
  Future<InboxPageResult> inbox(
          {int page = 1,
          String? storeId,
          String? bmReplyStatus,
          String? search}) async =>
      InboxPageResult(items: items, page: page, total: items.length);
}

ConversationSummary _summary(
  String id, {
  required String customer,
  required String status,
  required String level,
  required int waitingSeconds,
  DateTime? waitingSince,
}) =>
    ConversationSummary(
      id: id,
      customerName: customer,
      storeName: 'Store',
      unreadCount: 0,
      bmReplyStatus: status,
      priority: ConversationPriority(
        level: level,
        waitingSeconds: waitingSeconds,
        waitingSince: waitingSince,
        reasons: const [],
      ),
    );

Widget _app(Widget home, {Locale locale = const Locale('en')}) => MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: home,
    );

void main() {
  test('priority model maps the backend contract without a score', () {
    final priority = ConversationPriority.fromJson({
      'level': 'URGENT',
      'waitingSeconds': 90000,
      'waitingSince': '2026-08-16T00:00:00.000Z',
      'reasons': ['WAITING_OVER_24H'],
    });

    expect(priority.level, 'URGENT');
    expect(priority.waitingSeconds, 90000);
    expect(priority.waitingSince, DateTime.parse('2026-08-16T00:00:00.000Z'));
    expect(priority.reasons, ['WAITING_OVER_24H']);
    expect(priority.isActionable, isTrue);
  });

  test('priority sorting ranks level then oldest waiting first', () {
    final olderNormal = _summary(
      'normal-old',
      customer: 'Older normal',
      status: 'NOT_REPLIED',
      level: 'NORMAL',
      waitingSeconds: 21600,
      waitingSince: DateTime.utc(2026, 8, 16, 6),
    );
    final newerNormal = _summary(
      'normal-new',
      customer: 'Newer normal',
      status: 'NOT_REPLIED',
      level: 'NORMAL',
      waitingSeconds: 14400,
      waitingSince: DateTime.utc(2026, 8, 16, 8),
    );
    final urgent = _summary(
      'urgent',
      customer: 'Urgent',
      status: 'NOT_REPLIED',
      level: 'URGENT',
      waitingSeconds: 90000,
      waitingSince: DateTime.utc(2026, 8, 15),
    );

    final sorted = [newerNormal, olderNormal, urgent]
      ..sort(comparePrioritySummaries);
    expect(
        sorted.map((item) => item.id), ['urgent', 'normal-old', 'normal-new']);
  });

  testWidgets('Priority tab shows actionable conversations in priority order',
      (tester) async {
    final repository = _PriorityRepository([
      _summary(
        'completed',
        customer: 'Completed customer',
        status: 'REPLIED',
        level: 'URGENT',
        waitingSeconds: 90000,
        waitingSince: DateTime.utc(2026, 8, 15),
      ),
      _summary(
        'normal',
        customer: 'Normal customer',
        status: 'NOT_REPLIED',
        level: 'NORMAL',
        waitingSeconds: 18000,
        waitingSince: DateTime.utc(2026, 8, 16, 7),
      ),
      _summary(
        'urgent',
        customer: 'Urgent customer',
        status: 'NOT_REPLIED',
        level: 'URGENT',
        waitingSeconds: 90000,
        waitingSince: DateTime.utc(2026, 8, 15),
      ),
    ]);

    await tester.pumpWidget(_app(InboxPage(
      repository: repository,
      onOpen: (_) async {},
      onProfile: () {},
    )));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilterChip, 'Priority'));
    await tester.pump();

    expect(find.text('Urgent customer'), findsOneWidget);
    expect(find.text('Normal customer'), findsOneWidget);
    expect(find.text('Completed customer'), findsNothing);
    expect(
      tester.getTopLeft(find.text('Urgent customer')).dy,
      lessThan(tester.getTopLeft(find.text('Normal customer')).dy),
    );
    expect(find.text('Urgent'), findsNothing);
    expect(find.text('Normal'), findsNothing);
    expect(find.text('Waiting 1d 1h'), findsNothing);
  });

  testWidgets('priority queue labels localize while card badges stay hidden',
      (tester) async {
    final repository = _PriorityRepository([
      _summary(
        'urgent',
        customer: 'Customer',
        status: 'NOT_REPLIED',
        level: 'URGENT',
        waitingSeconds: 18 * 60 * 60,
        waitingSince: DateTime.utc(2026, 8, 15),
      ),
    ]);

    await tester.pumpWidget(_app(
      InboxPage(repository: repository, onOpen: (_) async {}, onProfile: () {}),
      locale: const Locale('th'),
    ));
    await tester.pumpAndSettle();
    expect(find.text('คิวเร่งด่วน'), findsOneWidget);
    expect(find.text('เร่งด่วน'), findsNothing);
    expect(find.text('ปกติ'), findsNothing);
    expect(find.text('รอการตอบกลับ 18h'), findsNothing);

    await tester.pumpWidget(_app(
      InboxPage(repository: repository, onOpen: (_) async {}, onProfile: () {}),
      locale: const Locale('zh', 'CN'),
    ));
    await tester.pumpAndSettle();
    expect(find.text('优先处理'), findsOneWidget);
    expect(find.text('紧急'), findsNothing);
    expect(find.text('等待回复 18h'), findsNothing);
  });

  testWidgets('priority card remains usable at a narrow width without badges',
      (tester) async {
    final repository = _PriorityRepository([
      _summary(
        'urgent',
        customer: 'A customer with a long display name',
        status: 'NOT_REPLIED',
        level: 'URGENT',
        waitingSeconds: 90000,
        waitingSince: DateTime.utc(2026, 8, 15),
      ),
    ]);

    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_app(Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          ConversationCard(
            conversation: repository.items.single,
            onTap: () {},
          ),
        ],
      ),
    )));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Urgent'), findsNothing);
    expect(find.text('Normal'), findsNothing);
  });
}
