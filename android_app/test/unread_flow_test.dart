import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/core/theme/app_scroll_behavior.dart';
import 'package:line_oa_chat_hub/core/widgets/app_widgets.dart';
import 'package:line_oa_chat_hub/features/chat/chat_page.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/features/inbox/inbox_page.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_overview_card.dart';

class FakeConversationRepository extends ConversationRepository {
  FakeConversationRepository() : super(ApiClient(TokenStore()));

  int unreadCount = 28;
  int unreadCountCalls = 0;
  int detailCalls = 0;
  int inboxCalls = 0;
  int markReadCalls = 0;
  bool failMarkRead = false;
  int replyCalls = 0;
  int updateStatusCalls = 0;
  int mediaCalls = 0;
  List<ChatMessage> detailMessages = const [];
  List<ChatMessage> olderDetailMessages = const [];
  String? detailNextCursor;
  String replyStatus = 'NOT_REPLIED';
  List<ConversationSummary>? customItems;
  final List<String?> detailBeforeCalls = [];

  ConversationSummary get summary => ConversationSummary(
        id: 'conversation-a',
        customerName: 'Customer A',
        storeName: 'Store',
        unreadCount: unreadCount,
        bmReplyStatus: replyStatus,
        preview: 'Latest message',
        sentAt: DateTime.utc(2026, 8, 13),
      );

  @override
  Future<InboxPageResult> inbox(
      {int page = 1,
      String? storeId,
      String? bmReplyStatus,
      String? search}) async {
    inboxCalls += 1;
    final items = customItems ?? [summary];
    return InboxPageResult(items: items, page: page, total: items.length);
  }

  @override
  Future<int> unreadTotal() async {
    unreadCountCalls += 1;
    return unreadCount;
  }

  @override
  Future<ConversationDetail> detail(String id,
      {int limit = 50, String? before}) async {
    detailCalls += 1;
    detailBeforeCalls.add(before);
    final loadingOlder = before != null;
    return ConversationDetail(
      id: id,
      customerName: 'Customer A',
      storeName: 'Store',
      messages: loadingOlder ? olderDetailMessages : detailMessages,
      nextCursor: loadingOlder ? null : detailNextCursor,
      unreadCount: unreadCount,
      bmReplyStatus: replyStatus,
    );
  }

  @override
  Future<ChatMessage?> reply(
      String id, String text, String idempotencyKey) async {
    replyCalls += 1;
    replyStatus = 'REPLIED';
    final message = ChatMessage(
      id: 'outbound-message',
      text: text,
      direction: 'OUTBOUND',
      messageType: 'TEXT',
      sentAt: DateTime.utc(2026, 8, 13, 10),
      sender: MessageSender(userId: 'bm', displayName: 'BM'),
      idempotencyKey: idempotencyKey,
    );
    detailMessages = [message];
    return message;
  }

  @override
  Future<void> markRead(String id) async {
    markReadCalls += 1;
    if (failMarkRead) throw StateError('read service unavailable');
    unreadCount = 0;
  }

  @override
  Future<ConversationDetail> updateBmReplyStatus(
      String id, String status) async {
    updateStatusCalls += 1;
    replyStatus = status;
    return detail(id);
  }

  @override
  Future<Uint8List> media(String url) async {
    mediaCalls += 1;
    return Uint8List.fromList(const [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x01,
      0x08,
      0x06,
      0x00,
      0x00,
      0x00,
      0x1f,
      0x15,
      0xc4,
      0x89,
      0x00,
      0x00,
      0x00,
      0x0a,
      0x49,
      0x44,
      0x41,
      0x54,
      0x78,
      0x9c,
      0x63,
      0x60,
      0x00,
      0x00,
      0x00,
      0x02,
      0x00,
      0x01,
      0xe5,
      0x27,
      0xd4,
      0xa2,
      0x00,
      0x00,
      0x00,
      0x00,
      0x49,
      0x45,
      0x4e,
      0x44,
      0xae,
      0x42,
      0x60,
      0x82,
    ]);
  }
}

void main() {
  testWidgets('successful chat detail load marks read then clears notification',
      (tester) async {
    final repository = FakeConversationRepository();
    var cleanupCalls = 0;

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        onConversationOpened: (_) async => cleanupCalls += 1,
      ),
    ));
    await tester.pumpAndSettle();

    expect(repository.detailCalls, 1);
    expect(repository.markReadCalls, 1);
    expect(repository.unreadCount, 0);
    expect(cleanupCalls, 1);
    expect(find.text('Customer A'), findsOneWidget);

    await tester.tap(find.byTooltip('Customer profile'));
    await tester.pumpAndSettle();
    expect(find.text('Unread messages'), findsOneWidget);
    expect(find.text('0'), findsOneWidget);
  });

  testWidgets(
      'mark-read failure keeps chat usable and still clears notification',
      (tester) async {
    final repository = FakeConversationRepository()..failMarkRead = true;
    var cleanupCalls = 0;

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        onConversationOpened: (_) async => cleanupCalls += 1,
      ),
    ));
    await tester.pumpAndSettle();

    expect(repository.markReadCalls, 1);
    expect(cleanupCalls, 1);
    expect(find.byType(TextField), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'returning from chat refreshes unread badge without changing reply status',
      (tester) async {
    final repository = FakeConversationRepository();

    await tester.pumpWidget(MaterialApp(
      home: InboxPage(
        repository: repository,
        onOpen: (_) async => repository.unreadCount = 0,
        onProfile: () {},
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('28'), findsOneWidget);

    await tester.tap(find.text('Customer A'));
    await tester.pumpAndSettle();

    expect(find.text('28'), findsNothing);
    expect(find.text('Need Reply'), findsNWidgets(3));
    expect(find.text('Waiting BM'), findsNothing);
  });

  testWidgets('inbox search and status filters derive from loaded items',
      (tester) async {
    final repository = FakeConversationRepository();

    await tester.pumpWidget(MaterialApp(
      home: InboxPage(
        repository: repository,
        onOpen: (_) async {},
        onProfile: () {},
      ),
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'latest MESSAGE');
    await tester.pump();
    expect(find.text('Customer A'), findsOneWidget);
    expect(find.byTooltip('Clear search'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'missing');
    await tester.pump();
    expect(find.text('No matching conversations'), findsOneWidget);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pump();
    expect(find.text('Customer A'), findsOneWidget);
    expect(find.byTooltip('Clear search'), findsNothing);

    await tester.tap(find.widgetWithText(FilterChip, 'Completed'));
    await tester.pump();
    expect(find.text('No matching conversations'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'Need Reply'));
    await tester.pump();
    expect(find.text('Customer A'), findsOneWidget);
  });

  testWidgets('overview and filters combine notified BM into Need Reply',
      (tester) async {
    ConversationSummary summary(int index, String status) =>
        ConversationSummary(
          id: 'conversation-$index',
          customerName: 'Customer $index',
          storeName: 'Store',
          unreadCount: 0,
          bmReplyStatus: status,
          preview: 'Preview $index',
          sentAt: DateTime.utc(2026, 8, 14, 10, index),
        );

    final repository = FakeConversationRepository()
      ..customItems = [
        for (var index = 0; index < 10; index++) summary(index, 'NOT_REPLIED'),
        for (var index = 10; index < 13; index++) summary(index, 'NOTIFIED_BM'),
        for (var index = 13; index < 20; index++) summary(index, 'REPLIED'),
      ];

    await tester.pumpWidget(MaterialApp(
      home: InboxPage(
        repository: repository,
        onOpen: (_) async {},
        onProfile: () {},
      ),
    ));
    await tester.pumpAndSettle();

    final overview = find.byType(ConversationOverviewCard);
    expect(find.descendant(of: overview, matching: find.text('20')),
        findsOneWidget);
    expect(find.descendant(of: overview, matching: find.text('13')),
        findsOneWidget);
    expect(find.descendant(of: overview, matching: find.text('7')),
        findsOneWidget);
    expect(find.text('Waiting BM'), findsNothing);
  });

  testWidgets('Need Reply filter includes NOTIFIED_BM conversations',
      (tester) async {
    final repository = FakeConversationRepository()
      ..customItems = [
        ConversationSummary(
          id: 'notified',
          customerName: 'Notified conversation',
          storeName: 'Store',
          unreadCount: 0,
          bmReplyStatus: 'NOTIFIED_BM',
        ),
        ConversationSummary(
          id: 'replied',
          customerName: 'Replied conversation',
          storeName: 'Store',
          unreadCount: 0,
          bmReplyStatus: 'REPLIED',
        ),
      ];

    await tester.pumpWidget(MaterialApp(
      home: InboxPage(
        repository: repository,
        onOpen: (_) async {},
        onProfile: () {},
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilterChip, 'Need Reply'));
    await tester.pump();
    expect(find.text('Notified conversation'), findsOneWidget);
    expect(find.text('Replied conversation'), findsNothing);

    await tester.tap(find.widgetWithText(FilterChip, 'Completed'));
    await tester.pump();
    expect(find.text('Notified conversation'), findsNothing);
    expect(find.text('Replied conversation'), findsOneWidget);
  });

  testWidgets('returning from chat reconciles reply status', (tester) async {
    final repository = FakeConversationRepository();

    await tester.pumpWidget(MaterialApp(
      home: InboxPage(
        repository: repository,
        onOpen: (_) async {},
        onProfile: () {},
      ),
    ));
    await tester.pumpAndSettle();

    await repository.reply('conversation-a', 'reply-test-3', 'reply-key');
    final inboxCallsBeforeOpen = repository.inboxCalls;
    await tester.tap(find.text('Customer A'));
    await tester.pumpAndSettle();

    expect(repository.inboxCalls, inboxCallsBeforeOpen);
    expect(repository.detailCalls, 1);
    expect(find.text('Completed'), findsNWidgets(3));
    expect(find.text('Need Reply'), findsNWidgets(2));
    expect(find.text('You: reply-test-3'), findsOneWidget);
    final overview = find.byType(ConversationOverviewCard);
    expect(find.descendant(of: overview, matching: find.text('Need Reply')),
        findsOneWidget);
    expect(find.descendant(of: overview, matching: find.text('Completed')),
        findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'Need Reply'));
    await tester.pump();
    expect(find.text('No matching conversations'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'Completed'));
    await tester.pump();
    expect(find.text('Customer A'), findsOneWidget);
  });

  testWidgets('new realtime inbound refreshes unread badge after read',
      (tester) async {
    final repository = FakeConversationRepository()..unreadCount = 0;
    final events = StreamController<Map<String, dynamic>>();

    await tester.pumpWidget(MaterialApp(
      home: InboxPage(
        repository: repository,
        events: events.stream,
        onOpen: (_) async {},
        onProfile: () {},
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byType(UnreadBadge), findsNothing);

    repository.unreadCount = 1;
    events.add({
      'type': 'message.created',
      'conversationId': 'conversation-a',
      'message': {
        'id': 'inbound-message-1',
        'text': 'New message',
        'sentAt': '2026-08-13T10:00:00.000Z',
      },
    });
    await tester.pumpAndSettle();

    expect(find.byType(UnreadBadge), findsOneWidget);
    expect(repository.inboxCalls, 1);
    await events.close();
  });

  testWidgets('chat appends a realtime message without reloading detail',
      (tester) async {
    final repository = FakeConversationRepository();
    final events = StreamController<Map<String, dynamic>>();

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        events: events.stream,
      ),
    ));
    await tester.pumpAndSettle();
    expect(repository.detailCalls, 1);

    events.add({
      'type': 'message.created',
      'conversationId': 'conversation-a',
      'message': {
        'id': 'message-realtime-1',
        'direction': 'INBOUND',
        'messageType': 'TEXT',
        'text': 'Realtime message',
        'sentAt': '2026-08-13T10:00:00.000Z',
        'media': null,
      },
    });
    await tester.pumpAndSettle();

    expect(find.text('Realtime message'), findsOneWidget);
    expect(repository.detailCalls, 1);

    events.add({
      'type': 'message.created',
      'conversationId': 'conversation-a',
      'message': {
        'id': 'message-realtime-1',
        'direction': 'INBOUND',
        'messageType': 'TEXT',
        'text': 'Realtime message',
        'sentAt': '2026-08-13T10:00:00.000Z',
        'media': null,
      },
    });
    await tester.pumpAndSettle();

    expect(find.text('Realtime message'), findsOneWidget);
    expect(repository.detailCalls, 1);
    await events.close();
  });

  testWidgets('media update patches one message without reloading detail',
      (tester) async {
    final repository = FakeConversationRepository()
      ..detailMessages = [
        ChatMessage(
          id: 'image-message',
          text: '[Image]',
          direction: 'INBOUND',
          messageType: 'IMAGE',
          sentAt: DateTime.utc(2026, 8, 13, 9),
          media: ChatMedia(processingStatus: 'PENDING'),
        ),
      ];
    final events = StreamController<Map<String, dynamic>>();

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        events: events.stream,
      ),
    ));
    await tester.pumpAndSettle();
    expect(repository.detailCalls, 1);

    events.add({
      'type': 'message.media.updated',
      'conversationId': 'conversation-a',
      'messageId': 'image-message',
      'message': {
        'id': 'image-message',
        'media': {'processingStatus': 'FAILED'},
      },
    });
    await tester.pumpAndSettle();

    expect(find.text('Image unavailable'), findsOneWidget);
    expect(repository.detailCalls, 1);
    await events.close();
  });

  testWidgets('image realtime lifecycle appends once and patches media once',
      (tester) async {
    final repository = FakeConversationRepository();
    final events = StreamController<Map<String, dynamic>>();

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        events: events.stream,
      ),
    ));
    await tester.pumpAndSettle();

    events.add({
      'type': 'message.created',
      'conversationId': 'conversation-a',
      'message': {
        'id': 'image-message',
        'direction': 'INBOUND',
        'messageType': 'IMAGE',
        'text': '[Image]',
        'sentAt': '2026-08-13T10:00:00.000Z',
        'media': {'processingStatus': 'PENDING'},
      },
    });
    await tester.pumpAndSettle();
    expect(find.text('Image processing…'), findsOneWidget);
    expect(repository.detailCalls, 1);

    events.add({
      'type': 'message.created',
      'conversationId': 'conversation-a',
      'message': {
        'id': 'image-message',
        'direction': 'INBOUND',
        'messageType': 'IMAGE',
        'text': '[Image]',
        'sentAt': '2026-08-13T10:00:00.000Z',
        'media': {'processingStatus': 'PENDING'},
      },
    });
    await tester.pumpAndSettle();
    expect(find.text('Image processing…'), findsOneWidget);

    final mediaReadyEvent = {
      'type': 'message.media.updated',
      'conversationId': 'conversation-a',
      'message': {
        'id': 'image-message',
        'media': {'processingStatus': 'READY'},
      },
    };
    events.add(mediaReadyEvent);
    await tester.pumpAndSettle();
    events.add(mediaReadyEvent);
    await tester.pumpAndSettle();

    expect(find.byType(Image), findsOneWidget);
    expect(repository.mediaCalls, 1);
    expect(repository.detailCalls, 1);
    await events.close();
  });

  testWidgets('successful text send merges the response without reloading',
      (tester) async {
    final repository = FakeConversationRepository();

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
      ),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Reply now');
    await tester.tap(find.byTooltip('Send reply'));
    await tester.pumpAndSettle();

    expect(repository.replyCalls, 1);
    expect(repository.detailCalls, 1);
    expect(find.text('Reply now'), findsOneWidget);
  });

  testWidgets('conversation detail exposes canonical status actions',
      (tester) async {
    final repository = FakeConversationRepository();

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        canReply: true,
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('More actions'));
    await tester.pumpAndSettle();
    expect(find.text('Notified BM'), findsAtLeastNWidgets(1));

    await tester.tap(find.byIcon(Icons.notifications_active_outlined));
    await tester.pumpAndSettle();

    expect(repository.updateStatusCalls, 1);
    expect(repository.replyStatus, 'NOTIFIED_BM');
    expect(find.text('Notified BM'), findsOneWidget);
  });

  testWidgets('conversation detail is read-only when reply permission is off',
      (tester) async {
    final repository = FakeConversationRepository();

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        canReply: false,
      ),
    ));
    await tester.pumpAndSettle();

    expect(
        find.text('Read-only · Reply permission is disabled'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).enabled, isFalse);
    expect(find.byTooltip('More actions'), findsNothing);
  });

  testWidgets('initial chat scroll settles at the bottom with image rows',
      (tester) async {
    final repository = FakeConversationRepository()
      ..detailNextCursor = 'older-cursor'
      ..olderDetailMessages = [
        ChatMessage(
            id: 'older-message',
            text: 'Older page message',
            direction: 'INBOUND',
            messageType: 'TEXT',
            sentAt: DateTime.utc(2026, 8, 13, 8, 59))
      ]
      ..detailMessages = [
        ...List.generate(
            12,
            (index) => ChatMessage(
                id: 'text-$index',
                text: 'A long message $index ' * 8,
                direction: 'INBOUND',
                messageType: 'TEXT',
                sentAt: DateTime.utc(2026, 8, 13, 9, index))),
        ChatMessage(
            id: 'image-pending',
            text: '[Image]',
            direction: 'INBOUND',
            messageType: 'IMAGE',
            sentAt: DateTime.utc(2026, 8, 13, 9, 20),
            media: ChatMedia(processingStatus: 'PENDING')),
        ChatMessage(
            id: 'image-without-media',
            text: '[Image]',
            direction: 'INBOUND',
            messageType: 'IMAGE',
            sentAt: DateTime.utc(2026, 8, 13, 9, 21)),
      ];

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
      ),
    ));
    await tester.pumpAndSettle();

    expect(repository.detailBeforeCalls, [null]);
    final scrollable = tester.state<ScrollableState>(find.descendant(
        of: find.byType(ListView), matching: find.byType(Scrollable)));
    expect(scrollable.position.hasContentDimensions, isTrue);
    expect(scrollable.position.pixels,
        closeTo(scrollable.position.maxScrollExtent, 0.5));

    await tester.fling(find.byType(ListView), const Offset(0, 1000), 1000);
    await tester.pumpAndSettle();
    scrollable.position.jumpTo(0);
    await tester.pumpAndSettle();

    expect(repository.detailBeforeCalls, contains('older-cursor'));
    expect(find.text('Older page message'), findsOneWidget);
  });

  testWidgets('app scroll policy clamps chat without overscroll indicator',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      scrollBehavior: const AppScrollBehavior(),
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: FakeConversationRepository(),
      ),
    ));
    await tester.pumpAndSettle();

    final list = tester.widget<ListView>(find.byType(ListView));
    expect(list.physics, isNull);
    final configurations = tester
        .widgetList<ScrollConfiguration>(find.byType(ScrollConfiguration));
    expect(
      configurations
          .any((configuration) => configuration.behavior is AppScrollBehavior),
      isTrue,
    );
    final scrollable = tester.state<ScrollableState>(find.descendant(
        of: find.byType(ListView), matching: find.byType(Scrollable)));
    expect(scrollable.position.physics, isA<ClampingScrollPhysics>());
  });

  testWidgets('manual movement cancels pending initial scroll', (tester) async {
    final repository = FakeConversationRepository()
      ..detailMessages = List.generate(
          30,
          (index) => ChatMessage(
              id: 'initial-scroll-$index',
              text: 'Initial scroll message $index ' * 8,
              direction: 'INBOUND',
              messageType: 'TEXT',
              sentAt: DateTime.utc(2026, 8, 13, 9, index % 60)));

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
      ),
    ));
    await tester.pump();
    await tester.drag(find.byType(ListView), const Offset(0, 500));
    await tester.pumpAndSettle();

    final scrollable = tester.state<ScrollableState>(find.descendant(
        of: find.byType(ListView), matching: find.byType(Scrollable)));
    expect(scrollable.position.pixels,
        lessThan(scrollable.position.maxScrollExtent - 1));
  });

  testWidgets('manual movement cancels queued realtime auto-scroll',
      (tester) async {
    final repository = FakeConversationRepository()
      ..detailMessages = List.generate(
          30,
          (index) => ChatMessage(
              id: 'realtime-scroll-$index',
              text: 'Realtime scroll message $index ' * 8,
              direction: 'INBOUND',
              messageType: 'TEXT',
              sentAt: DateTime.utc(2026, 8, 13, 9, index % 60)));
    final events = StreamController<Map<String, dynamic>>.broadcast(sync: true);

    await tester.pumpWidget(MaterialApp(
      home: ChatPage(
        conversationId: 'conversation-a',
        repository: repository,
        events: events.stream,
      ),
    ));
    await tester.pumpAndSettle();
    final scrollable = tester.state<ScrollableState>(find.descendant(
        of: find.byType(ListView), matching: find.byType(Scrollable)));
    final beforeRealtimeMax = scrollable.position.maxScrollExtent;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      events.add({
        'type': 'message.created',
        'conversationId': 'conversation-a',
        'message': {
          'id': 'queued-realtime-message',
          'direction': 'INBOUND',
          'messageType': 'TEXT',
          'text': 'Queued realtime message',
          'sentAt': '2026-08-13T10:00:00.000Z',
          'media': null,
        },
      });
    });
    await tester.pump();
    await tester.drag(find.byType(ListView), const Offset(0, 500));
    await tester.pumpAndSettle();

    expect(scrollable.position.maxScrollExtent, greaterThan(beforeRealtimeMax));
    expect(scrollable.position.pixels,
        lessThan(scrollable.position.maxScrollExtent - 1));
    expect(repository.detailCalls, 1);
    await events.close();
  });
}
