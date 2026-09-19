import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/message_bubble.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/message_timeline.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

void main() {
  Widget wrapWithLocalizations(Widget child) {
    return MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('th'),
      home: Scaffold(body: child),
    );
  }

  group('Durable Send Queue Delivery UX & Bubble Presentation', () {
    testWidgets('PENDING outbound message shows ✓ checkmark without implying read',
        (tester) async {
      final message = ChatMessage(
        id: 'msg-pending-1',
        direction: 'OUTBOUND',
        deliveryStatus: 'PENDING',
        messageType: 'TEXT',
        text: 'Test pending message',
        sentAt: DateTime(2026, 9, 19, 10, 0),
      );

      await tester.pumpWidget(wrapWithLocalizations(
        MessageBubble(
          text: message.text,
          outbound: true,
          timestamp: message.sentAt,
          message: message,
          footer: '✓',
        ),
      ));

      // Should show the single checkmark ✓
      expect(find.text('✓'), findsOneWidget);
      expect(find.text('Test pending message'), findsOneWidget);
      // Must NOT show error icon or schedule icon
      expect(find.byIcon(Icons.error_outline), findsNothing);
      expect(find.byIcon(Icons.done_all), findsNothing);
    });

    testWidgets('DELIVERED outbound message shows ✓✓ confirmed delivery checkmark',
        (tester) async {
      final message = ChatMessage(
        id: 'msg-delivered-1',
        direction: 'OUTBOUND',
        deliveryStatus: 'DELIVERED',
        messageType: 'TEXT',
        text: 'Test delivered message',
        sentAt: DateTime(2026, 9, 19, 10, 1),
      );

      await tester.pumpWidget(wrapWithLocalizations(
        MessageBubble(
          text: message.text,
          outbound: true,
          timestamp: message.sentAt,
          message: message,
          footer: '✓✓',
        ),
      ));

      // Should show double checkmark ✓✓
      expect(find.text('✓✓'), findsOneWidget);
      expect(find.text('Test delivered message'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline), findsNothing);
      expect(find.byIcon(Icons.done_all), findsNothing);
    });

    testWidgets(
        'FAILED outbound message shows "ส่งไม่สำเร็จ" and retry action',
        (tester) async {
      final message = ChatMessage(
        id: 'msg-failed-1',
        direction: 'OUTBOUND',
        deliveryStatus: 'FAILED',
        messageType: 'TEXT',
        text: 'Test failed message',
        sentAt: DateTime(2026, 9, 19, 10, 2),
      );

      bool retried = false;
      await tester.pumpWidget(wrapWithLocalizations(
        MessageBubble(
          text: message.text,
          outbound: true,
          timestamp: message.sentAt,
          message: message,
          footer: 'ส่งไม่สำเร็จ',
          onRetry: () => retried = true,
        ),
      ));

      // Should show error icon and "ส่งไม่สำเร็จ"
      expect(find.byIcon(Icons.error_outline), findsOneWidget);
      expect(find.text('ส่งไม่สำเร็จ'), findsOneWidget);
      // Should show retry action "ลองอีกครั้ง"
      expect(find.text('ลองอีกครั้ง'), findsOneWidget);
      expect(find.byIcon(Icons.refresh), findsOneWidget);

      // Tapping retry triggers onRetry callback
      await tester.tap(find.text('ลองอีกครั้ง'));
      await tester.pump();
      expect(retried, isTrue);
    });

    testWidgets(
        'FAILED outbound message without retry callback shows "ส่งไม่สำเร็จ" only',
        (tester) async {
      final message = ChatMessage(
        id: 'msg-failed-2',
        direction: 'OUTBOUND',
        deliveryStatus: 'FAILED',
        messageType: 'TEXT',
        text: 'Test non-retryable message',
        sentAt: DateTime(2026, 9, 19, 10, 3),
      );

      await tester.pumpWidget(wrapWithLocalizations(
        MessageBubble(
          text: message.text,
          outbound: true,
          timestamp: message.sentAt,
          message: message,
          footer: 'ส่งไม่สำเร็จ',
          onRetry: null,
        ),
      ));

      expect(find.byIcon(Icons.error_outline), findsOneWidget);
      expect(find.text('ส่งไม่สำเร็จ'), findsOneWidget);
      expect(find.text('ลองอีกครั้ง'), findsNothing);
    });

    testWidgets(
        'MessageTimeline maps delivery statuses to ✓, ✓✓, and "ส่งไม่สำเร็จ" with retry',
        (tester) async {
      final messages = [
        ChatMessage(
          id: 'msg-1',
          direction: 'OUTBOUND',
          deliveryStatus: 'PENDING',
          messageType: 'TEXT',
          text: 'Message Pending',
          sentAt: DateTime(2026, 9, 19, 10, 0),
        ),
        ChatMessage(
          id: 'msg-2',
          direction: 'OUTBOUND',
          deliveryStatus: 'DELIVERED',
          messageType: 'TEXT',
          text: 'Message Delivered',
          sentAt: DateTime(2026, 9, 19, 10, 1),
        ),
        ChatMessage(
          id: 'msg-3',
          direction: 'OUTBOUND',
          deliveryStatus: 'FAILED',
          messageType: 'TEXT',
          text: 'Message Failed',
          sentAt: DateTime(2026, 9, 19, 10, 2),
        ),
      ];

      String? retriedMessageId;

      await tester.pumpWidget(wrapWithLocalizations(
        MessageTimeline(
          controller: ScrollController(),
          messages: messages,
          pendingMessages: const [],
          loadingOlder: false,
          mediaBytes: const {},
          onRetryPersistedMessage: (id) => retriedMessageId = id,
        ),
      ));

      expect(find.text('✓'), findsOneWidget);
      expect(find.text('✓✓'), findsOneWidget);
      expect(find.text('ส่งไม่สำเร็จ'), findsOneWidget);
      expect(find.text('ลองอีกครั้ง'), findsOneWidget);

      await tester.tap(find.text('ลองอีกครั้ง'));
      await tester.pump();
      expect(retriedMessageId, 'msg-3');
    });
  });
}
