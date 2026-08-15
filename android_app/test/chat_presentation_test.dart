import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_header.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';

void main() {
  testWidgets(
      'conversation header keeps customer and status without store context',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        appBar: ConversationHeader(
          customerName: 'Customer Name',
          bmReplyStatus: 'NOT_REPLIED',
        ),
      ),
    ));

    expect(find.text('Customer Name'), findsOneWidget);
    expect(find.text('OBS Seacon Bangkae Floor Two By OPPO'), findsNothing);
    expect(find.text('Store code · 28243'), findsNothing);
    expect(find.text('Need Reply'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('conversation tags bar shows add state and compact selected tags',
      (tester) async {
    ConversationTags? tags;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ConversationTagsBar(
          tags: const ConversationTags(),
          onPressed: () {},
        ),
      ),
    ));
    expect(find.text('+ Add tags'), findsOneWidget);

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ConversationTagsBar(
          tags: const ConversationTags(
            sourceChannels: ['ONLINE'],
            product: ConversationProductTag(
              id: 'model-1',
              productName: 'OPPO Find N6',
              category: 'SMARTPHONE',
              seriesName: 'Find',
            ),
          ),
          onPressed: () => tags = const ConversationTags(sourceChannels: ['STORE']),
        ),
      ),
    ));
    expect(find.text('Online · OPPO Find N6'), findsOneWidget);
    expect(tags, isNull);
    await tester.tap(find.text('Online · OPPO Find N6'));
    expect(tags?.sourceChannels, ['STORE']);
  });
}
