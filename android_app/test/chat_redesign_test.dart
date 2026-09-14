import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/chat_composer.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_info_page.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

Widget _localized(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

ConversationDetail _detail() => ConversationDetail(
      id: 'conversation-1',
      customerName: 'ยัยนุ แอมม่ม 🌹',
      storeName: 'OPPO CentralWorld',
      storeCode: 'CW-01',
      messages: [
        ChatMessage(
          id: 'message-1',
          text: 'https://maps.app.goo.gl/example',
          direction: 'INBOUND',
          messageType: 'TEXT',
          sentAt: DateTime(2026, 9, 14, 11, 9),
        ),
        ChatMessage(
          id: 'message-2',
          text: '',
          direction: 'INBOUND',
          messageType: 'IMAGE',
          sentAt: DateTime(2026, 9, 14, 11, 10),
        ),
      ],
      unreadCount: 1,
      bmReplyStatus: 'NOT_REPLIED',
      customerSalesInformation: const CustomerSalesInformation(
        status: 'ONLINE',
        onlineSource: 'TikTok',
        purchaseChannel: [],
        products: [],
      ),
      owner: const ConversationOwner(id: 'owner-1', displayName: 'Thanyathep'),
    );

void main() {
  testWidgets('conversation info keeps secondary business data together',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_localized(
      ConversationInfoPage(
        detail: _detail(),
        onOwnerTap: () {},
        onSalesTap: () {},
        onStatusTap: () {},
      ),
    ));

    expect(find.text('ยัยนุ แอมม่ม 🌹'), findsOneWidget);
    expect(find.text('OPPO CentralWorld'), findsWidgets);
    expect(find.text('Owner'), findsWidgets);
    expect(find.text('Thanyathep'), findsOneWidget);
    expect(find.text('Online · TikTok'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Images'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Images'), findsOneWidget);
    expect(find.text('Links'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('metadata strip stays slim and exposes existing sales action',
      (tester) async {
    var pressed = false;
    await tester.pumpWidget(_localized(
      Scaffold(
        body: ConversationMetadataStrip(
          customerSalesInformation: const CustomerSalesInformation(
            status: 'ONLINE',
            onlineSource: 'TikTok',
            purchaseChannel: [],
            products: [],
          ),
          onPressed: () => pressed = true,
        ),
      ),
    ));

    expect(find.text('🌐 Online'), findsOneWidget);
    expect(find.text('♫ TikTok'), findsOneWidget);
    expect(find.text('Customer Sales Info'), findsOneWidget);
    await tester.tap(find.text('Customer Sales Info'));
    expect(pressed, isTrue);
  });

  testWidgets('composer action sheet only shows supplied capabilities',
      (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_localized(
      Scaffold(
        body: ChatComposer(
          controller: controller,
          onOpenConversationInfo: () {},
          onOpenSalesInfo: () {},
        ),
      ),
    ));

    await tester.tap(find.byTooltip('Add attachment'));
    await tester.pumpAndSettle();
    expect(find.text('Customer Sales Info'), findsOneWidget);
    expect(find.text('Customer profile'), findsOneWidget);
    expect(find.text('Take Photo'), findsNothing);
    expect(find.text('Gallery'), findsNothing);
  });
}
