import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/message_link_text.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

Widget _app(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  test('message URL parser supports http, https, www, and mixed text', () {
    final parts = parseMessageLinks(
      'Visit https://example.com/path, http://shop.example/item. Or www.example.org now.',
    );
    expect(parts.where((part) => part.isLink).map((part) => part.text), [
      'https://example.com/path',
      'http://shop.example/item',
      'www.example.org',
    ]);
    expect(parts.any((part) => part.text == 'Visit ' && !part.isLink), isTrue);
    expect(parts.any((part) => part.text == ' now.' && !part.isLink), isTrue);
  });

  testWidgets('message link text renders normal text and clickable links',
      (tester) async {
    await tester.pumpWidget(_app(const MessageLinkText(
      text: 'Ask us at https://example.com/help today',
    )));
    expect(find.textContaining('Ask us at'), findsOneWidget);
    expect(find.textContaining('https://example.com/help'), findsOneWidget);
    expect(find.textContaining('today'), findsOneWidget);
  });
}
