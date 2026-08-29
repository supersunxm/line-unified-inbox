import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/message_bubble.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/sticker_bubble.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

Widget _app(Widget child) => MaterialApp(
      locale: const Locale('th'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('sticker with keyword renders customer, LINE label, and keyword',
      (tester) async {
    await tester.pumpWidget(_app(MessageBubble(
      text: 'legacy placeholder is not rendered',
      outbound: false,
      timestamp: DateTime(2026, 8, 29, 16, 42),
      content: const StickerBubble(
        sticker: StickerPresentation(keywords: ['ขอบคุณ']),
      ),
    )));

    expect(find.text('ลูกค้า'), findsOneWidget);
    expect(find.text('ส่งสติกเกอร์ LINE'), findsOneWidget);
    expect(find.text('ขอบคุณ'), findsOneWidget);
    expect(
        find.byKey(const ValueKey('line-sticker-indicator')), findsOneWidget);
    expect(find.text('legacy placeholder is not rendered'), findsNothing);
  });

  testWidgets('sticker without keyword renders only the LINE label',
      (tester) async {
    await tester.pumpWidget(_app(MessageBubble(
      text: 'legacy placeholder is not rendered',
      outbound: false,
      timestamp: DateTime(2026, 8, 29, 16, 42),
      content: const StickerBubble(),
    )));

    expect(find.text('ลูกค้า'), findsOneWidget);
    expect(find.text('ส่งสติกเกอร์ LINE'), findsOneWidget);
    expect(find.byKey(const ValueKey('line-sticker-text')), findsNothing);
  });
}
