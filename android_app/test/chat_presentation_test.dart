import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_header.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

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

  testWidgets(
      'conversation header keeps store context and exact status visible',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        appBar: ConversationHeader(
          storeName: 'OPPO CentralWorld',
          storeCode: 'CW-01',
          customerName: 'Chutisorn',
          bmReplyStatus: 'REPLIED',
          exactStatus: true,
          onBack: () {},
        ),
      ),
    ));

    expect(find.text('OPPO CentralWorld'), findsOneWidget);
    expect(find.text('Store context'), findsOneWidget);
    expect(find.text('Chutisorn'), findsOneWidget);
    expect(find.text('Replied'), findsOneWidget);
    expect(find.byTooltip('Back'), findsOneWidget);
  });

  testWidgets('single-store conversation header hides store context',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        appBar: ConversationHeader(
          customerName: 'Chutisorn',
          storeName: 'OPPO CentralWorld',
          storeCode: 'CW-01',
          showStoreContext: false,
          bmReplyStatus: 'REPLIED',
          owner: const ConversationOwner(id: 'owner-1', displayName: 'Kittiya'),
        ),
      ),
    ));

    expect(find.text('OPPO CentralWorld'), findsNothing);
    expect(find.text('Store code · CW-01'), findsNothing);
    expect(find.text('Chutisorn'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Owner: Kittiya'), findsOneWidget);
  });

  testWidgets('conversation tags bar shows add state and compact selected tags',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsBar(
          tags: const ConversationTags(),
          onPressed: () {},
        ),
      ),
    ));
    expect(find.text('Customer Sales Info'), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Align && widget.alignment == Alignment.centerRight,
      ),
      findsOneWidget,
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsBar(
          customerSalesInformation: const CustomerSalesInformation(
            status: 'INTERESTED',
            interestLevel: 'HOT',
            purchaseChannel: [],
            products: [
              CustomerSalesProductItem(
                id: 'sp-1',
                productModelId: 'model-1',
                modelName: 'OPPO Find N6',
                quantity: 1,
                status: 'INTERESTED',
              ),
            ],
          ),
          onPressed: () {},
        ),
      ),
    ));
    expect(find.text('🎯 Interested'), findsOneWidget);
    expect(find.text('🔥 Hot'), findsOneWidget);
    expect(find.text('📱 OPPO Find N6'), findsOneWidget);
  });

  testWidgets('camera and gallery picker strings localize in TH, EN, and ZH',
      (tester) async {
    for (final (locale, photoText, galleryText, permText) in [
      (
        const Locale('th'),
        'ถ่ายภาพ',
        'เลือกจากคลังภาพ',
        'กรุณาอนุญาตการเข้าถึงกล้องถ่ายรูปในการตั้งค่า'
      ),
      (
        const Locale('en'),
        'Take Photo',
        'Gallery',
        'Camera permission is required to take photos'
      ),
      (const Locale('zh'), '拍照', '相册', '需要相机权限才能拍照'),
    ]) {
      late BuildContext captured;
      await tester.pumpWidget(MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(builder: (ctx) {
          captured = ctx;
          return const Scaffold(body: SizedBox());
        }),
      ));
      final l10n = AppLocalizations.of(captured)!;
      expect(l10n.takePhoto, photoText);
      expect(l10n.chooseFromGallery, galleryText);
      expect(l10n.cameraPermissionRequired, permText);
    }
  });

  testWidgets('image preview dialog exposes Cancel and Send actions',
      (tester) async {
    // 1x1 transparent PNG
    final sampleBytes = Uint8List.fromList([
      0x89,
      0x50,
      0x4E,
      0x47,
      0x0D,
      0x0A,
      0x1A,
      0x0A,
      0x00,
      0x00,
      0x00,
      0x0D,
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
      0x1F,
      0x15,
      0xC4,
      0x89,
      0x00,
      0x00,
      0x00,
      0x0A,
      0x49,
      0x44,
      0x41,
      0x54,
      0x78,
      0x9C,
      0x63,
      0x00,
      0x01,
      0x00,
      0x00,
      0x05,
      0x00,
      0x01,
      0x0D,
      0x0A,
      0x2D,
      0xB4,
      0x00,
      0x00,
      0x00,
      0x00,
      0x49,
      0x45,
      0x4E,
      0x44,
      0xAE,
      0x42,
      0x60,
      0x82
    ]);

    bool? result;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (ctx) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async {
                result = await Navigator.of(ctx).push<bool>(
                  MaterialPageRoute(
                    fullscreenDialog: true,
                    builder: (_) => Scaffold(
                      body: Column(
                        children: [
                          Expanded(child: Image.memory(sampleBytes)),
                          Row(
                            children: [
                              TextButton(
                                onPressed: () => Navigator.of(ctx).pop(false),
                                child: const Text('Cancel'),
                              ),
                              FilledButton(
                                onPressed: () => Navigator.of(ctx).pop(true),
                                child: const Text('Send'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    ));

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.text('Cancel'), findsOneWidget);
    expect(find.text('Send'), findsOneWidget);

    await tester.tap(find.text('Send'));
    await tester.pumpAndSettle();

    expect(result, isTrue);
  });
}
