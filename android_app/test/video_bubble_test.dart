import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/video_bubble.dart';
import 'package:line_oa_chat_hub/features/inbox/widgets/conversation_preview.dart';

Widget _app(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

ChatMedia _media(String status) => ChatMedia(
      processingStatus: status,
      mimeType: 'video/mp4',
      fileSize: 128,
      url: '/messages/video-message/media',
    );

void main() {
  testWidgets('video bubble shows a play area without initializing playback',
      (tester) async {
    var loadCalls = 0;
    await tester.pumpWidget(_app(VideoBubble(
      messageId: 'video-message',
      media: _media('READY'),
      onLoad: () async {
        loadCalls += 1;
        return Uint8List.fromList([1, 2, 3]);
      },
    )));

    expect(find.byIcon(Icons.play_circle_fill), findsOneWidget);
    expect(find.byTooltip('Play video'), findsOneWidget);
    expect(loadCalls, 0);
  });

  testWidgets('video bubble shows localized processing and unavailable states',
      (tester) async {
    await tester.pumpWidget(_app(VideoBubble(
      messageId: 'pending-video',
      media: _media('PENDING'),
      onLoad: () async => Uint8List(0),
    )));
    expect(find.text('Video processing…'), findsOneWidget);

    await tester.pumpWidget(_app(VideoBubble(
      messageId: 'failed-video',
      media: _media('FAILED'),
      onLoad: () async => Uint8List(0),
    )));
    expect(find.text('Video unavailable'), findsOneWidget);
  });

  testWidgets(
      'video bubble converts backend loader failures to a fallback state',
      (tester) async {
    await tester.pumpWidget(_app(VideoBubble(
      messageId: 'broken-video',
      media: _media('READY'),
      onLoad: () => Future<Uint8List>.error(StateError('proxy unavailable')),
    )));
    await tester.tap(find.byTooltip('Play video'));
    await tester.pumpAndSettle();
    expect(find.text('Video unavailable'), findsOneWidget);
  });

  testWidgets('video inbox preview has Thai and Chinese localized labels',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('th'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const Scaffold(
        body: ConversationPreview(preview: 'Sent a video'),
      ),
    ));
    expect(find.text('ส่งวิดีโอ'), findsOneWidget);

    await tester.pumpWidget(MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const Scaffold(
        body: ConversationPreview(preview: 'Sent a video'),
      ),
    ));
    expect(find.text('发送视频'), findsOneWidget);
  });
}
