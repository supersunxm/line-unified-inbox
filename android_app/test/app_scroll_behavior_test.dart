import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/theme/app_scroll_behavior.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/inbox_filter_bar.dart';

class _ScrollAuditRepository extends ConversationRepository {
  _ScrollAuditRepository() : super(ApiClient(TokenStore()));

  @override
  Future<List<ProductSelectorItem>> fetchProducts(
          {String? search, String? category}) async =>
      const [];
}

void main() {
  testWidgets('app scroll behavior removes Android overscroll indicator',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      scrollBehavior: const AppScrollBehavior(),
      home: ListView.builder(
        itemCount: 20,
        itemBuilder: (_, index) => Text('item $index'),
      ),
    ));

    final config = tester.widget<ScrollConfiguration>(
      find.byType(ScrollConfiguration).first,
    );
    expect(config.behavior, isA<AppScrollBehavior>());
    final scrollable = tester.state<ScrollableState>(find.descendant(
      of: find.byType(ListView),
      matching: find.byType(Scrollable),
    ));
    final physics = scrollable.position.physics;
    expect(physics, isA<AlwaysScrollableScrollPhysics>());
    expect(physics.parent, isA<ClampingScrollPhysics>());
  });

  testWidgets('refresh indicator remains available with short content',
      (tester) async {
    var refreshed = false;
    await tester.pumpWidget(MaterialApp(
      scrollBehavior: const AppScrollBehavior(),
      home: RefreshIndicator(
        onRefresh: () async => refreshed = true,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [Text('empty state')],
        ),
      ),
    ));
    expect(find.byType(RefreshIndicator), findsOneWidget);
    expect(
      tester
          .state<ScrollableState>(find.descendant(
            of: find.byType(ListView),
            matching: find.byType(Scrollable),
          ))
          .position
          .physics,
      isA<AlwaysScrollableScrollPhysics>(),
    );
    expect(refreshed, isFalse);
  });

  testWidgets('horizontal inbox filters inherit clamped physics',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      scrollBehavior: const AppScrollBehavior(),
      home: Scaffold(
        body: InboxFilterBar(
          selected: InboxFilter.all,
          onChanged: (_) {},
        ),
      ),
    ));

    final scrollable = tester.state<ScrollableState>(find
        .descendant(
          of: find.byType(SingleChildScrollView).first,
          matching: find.byType(Scrollable),
        )
        .first);
    expect(scrollable.position.physics, isA<ClampingScrollPhysics>());
  });

  testWidgets('conversation tags sheet remains scrollable without glow',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      scrollBehavior: const AppScrollBehavior(),
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-a',
          repository: _ScrollAuditRepository(),
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    final scrollable = tester.state<ScrollableState>(find
        .descendant(
          of: find.byType(SingleChildScrollView).first,
          matching: find.byType(Scrollable),
        )
        .first);
    expect(scrollable.position.physics, isA<ClampingScrollPhysics>());
  });
}
