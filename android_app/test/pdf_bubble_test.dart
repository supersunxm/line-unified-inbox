import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/pdf_bubble.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

Widget _app(Widget child) => MaterialApp(
      locale: const Locale('th'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

ChatMedia _media(String status) => ChatMedia(
      processingStatus: status,
      mimeType: 'application/pdf',
      fileSize: 2048,
      url: '/messages/pdf-message/media',
    );

void main() {
  testWidgets('ready PDF bubble shows filename, size, and opens on tap',
      (tester) async {
    var opened = false;
    await tester.pumpWidget(_app(PdfBubble(
      filename: 'quote.pdf',
      media: _media('READY'),
      onOpen: () async => opened = true,
    )));
    expect(find.text('quote.pdf'), findsOneWidget);
    expect(find.textContaining('2.0 KB'), findsOneWidget);
    await tester.tap(find.text('quote.pdf'));
    await tester.pump();
    expect(opened, isTrue);
  });

  testWidgets('PDF bubble exposes friendly processing and failed states',
      (tester) async {
    await tester.pumpWidget(_app(PdfBubble(
      filename: 'pending.pdf',
      media: _media('PENDING'),
    )));
    expect(find.text('กำลังส่ง…'), findsOneWidget);

    await tester.pumpWidget(_app(PdfBubble(
      filename: 'failed.pdf',
      media: _media('FAILED'),
    )));
    expect(find.text('ไม่สามารถใช้ไฟล์ PDF ได้'), findsOneWidget);
  });

  testWidgets('failed PDF bubble supports an explicit retry callback',
      (tester) async {
    var retries = 0;
    await tester.pumpWidget(_app(PdfBubble(
      filename: 'failed.pdf',
      media: _media('FAILED'),
      onRetry: () => retries += 1,
    )));
    await tester.tap(find.text('ลองอีกครั้ง'));
    expect(retries, 1);
  });
}
