import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

class _FakeTagRepository extends ConversationRepository {
  _FakeTagRepository() : super(ApiClient(TokenStore()));

  CustomerSalesInformation? currentSales;
  bool failNextVariants = false;
  final List<String> variantCalls = [];
  int saveCallCount = 0;

  @override
  Future<List<ProductSelectorItem>> fetchProducts(
          {String? search, String? category}) async =>
      [
        const ProductSelectorItem(
          id: 'model-1',
          productName: 'OPPO Reno16 Pro 5G',
          category: 'SMARTPHONE',
          seriesName: 'Reno16',
        ),
      ];

  @override
  Future<List<ProductVariantSelectorItem>> fetchProductVariants(
      String productId) async {
    variantCalls.add(productId);
    if (failNextVariants) {
      failNextVariants = false;
      throw StateError('variant request failed');
    }
    return const [
      ProductVariantSelectorItem(
        id: 'variant-1',
        ram: '12',
        rom: '256',
        color: 'Graphite',
      ),
      ProductVariantSelectorItem(
        id: 'variant-2',
        ram: '16',
        rom: '512',
        color: 'Graphite',
      ),
    ];
  }

  @override
  Future<ConversationDetail> updateCustomerSalesInfo(
    String id, {
    Object? status = const Object(),
    Object? interestLevel = const Object(),
    Object? purchaseChannel = const Object(),
    Object? paymentMethod = const Object(),
    Object? products = const Object(),
  }) async {
    saveCallCount++;
    currentSales = CustomerSalesInformation(
      status: status is String ? status : 'INTERESTED',
      interestLevel: interestLevel is String ? interestLevel : null,
      purchaseChannel: purchaseChannel is List ? purchaseChannel.whereType<String>().toList() : [],
      paymentMethod: paymentMethod is String ? paymentMethod : null,
      products: products is List ? products.whereType<CustomerSalesProductItem>().toList() : [],
    );
    return ConversationDetail(
      id: id,
      customerName: 'Customer',
      storeName: 'Store',
      messages: const [],
      customerSalesInformation: currentSales,
    );
  }
}

void main() {
  testWidgets('CRM sales sheet supports INTERESTED lead with multi-product and interest level',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Customer Sales Info'), findsOneWidget);
    expect(find.text('Interested'), findsOneWidget);
    expect(find.text('Purchased'), findsOneWidget);

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    expect(find.textContaining('○ OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    expect(repository.variantCalls, ['model-1']);

    expect(find.text('Selected'), findsOneWidget);
    expect(find.text('Change Product'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(ChoiceChip, '✓ 16GB RAM · 512GB ROM · Graphite'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);
    expect(repository.currentSales?.products.length, 1);

    await tester.tap(find.widgetWithText(ChoiceChip, '○ ⚡ Warm'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.text('Confirm Customer Information'), findsOneWidget);
    expect(find.text('Confirm Save'), findsOneWidget);

    await tester.tap(find.text('Confirm Save'));
    await tester.pumpAndSettle();

    expect(repository.currentSales?.status, 'INTERESTED');
    expect(repository.currentSales?.interestLevel, 'WARM');
    expect(repository.currentSales?.products.length, 1);
    expect(repository.currentSales?.products[0].modelName, 'OPPO Reno16 Pro 5G');
    expect(repository.currentSales?.products[0].ram, '16');
  });

  testWidgets('CRM sales sheet supports PURCHASED customer with channels and payment method',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Purchased'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilterChip, '○ 🏪 Store'));
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 💳 Installment'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);
    expect(repository.currentSales?.status, 'PURCHASED');

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.text('Confirm Customer Information'), findsOneWidget);
    await tester.tap(find.text('Confirm Save'));
    await tester.pumpAndSettle();

    expect(repository.currentSales?.status, 'PURCHASED');
    expect(repository.currentSales?.purchaseChannel, ['STORE']);
    expect(repository.currentSales?.paymentMethod, 'INSTALLMENT');
    expect(repository.currentSales?.products.length, 1);
  });

  testWidgets('saved CRM sales info is restored on reopen', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    const savedSales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['ONLINE'],
      paymentMethod: 'CASH',
      products: [
        CustomerSalesProductItem(
          id: 'sp-1',
          productModelId: 'model-1',
          modelName: 'OPPO Reno16 Pro 5G',
          seriesName: 'Reno16',
          category: 'SMARTPHONE',
          ram: '16',
          rom: '512',
          color: 'Graphite',
          quantity: 2,
          status: 'PURCHASED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: savedSales,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
  });

  testWidgets('Interested lead converts to Purchased with preserved products and confirmation', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    const interestedLead = CustomerSalesInformation(
      status: 'INTERESTED',
      interestLevel: 'HOT',
      purchaseChannel: [],
      products: [
        CustomerSalesProductItem(
          id: 'sp-1',
          productModelId: 'model-1',
          modelName: 'OPPO Reno16 Pro 5G',
          seriesName: 'Reno16',
          category: 'SMARTPHONE',
          ram: '16',
          rom: '512',
          color: 'Graphite',
          quantity: 1,
          status: 'INTERESTED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: interestedLead,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Convert to Purchased'), findsAtLeastNWidgets(1));

    await tester.tap(find.widgetWithText(FilledButton, 'Convert to Purchased'));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, '○ 🏪 Store'));
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 💵 Cash'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.text('Confirm Purchase'), findsAtLeastNWidgets(1));
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Purchase'));
    await tester.pumpAndSettle();

    expect(repository.currentSales?.status, 'PURCHASED');
    expect(repository.currentSales?.purchaseChannel, ['STORE']);
    expect(repository.currentSales?.paymentMethod, 'CASH');
    expect(repository.currentSales?.products.length, 1);
    expect(repository.currentSales?.products[0].modelName, 'OPPO Reno16 Pro 5G');
    expect(repository.currentSales?.products[0].status, 'PURCHASED');
  });

  testWidgets('Product & Variant Selection UX: draft selection flow with Confirm Selection', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    expect(find.textContaining('○ OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);
    expect(find.text('Selected'), findsNothing);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();

    expect(find.text('Selected'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Change Product'), findsOneWidget);

    final confirmBtnBeforeVariant = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Confirm Selection'));
    expect(confirmBtnBeforeVariant.onPressed, isNull);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Change Product'));
    await tester.pumpAndSettle();

    expect(find.textContaining('○ OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);

    await tester.tap(find.textContaining('○ OPPO Reno16 Pro 5G'));
    await tester.pumpAndSettle();

    expect(find.text('Selected'), findsOneWidget);

    expect(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(ChoiceChip, '✓ 12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'), findsOneWidget);

    final confirmBtnAfterVariant = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Confirm Selection'));
    expect(confirmBtnAfterVariant.onPressed, isNotNull);

    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(repository.saveCallCount, 1);
    expect(repository.currentSales?.products.single.productVariantId, 'variant-1');
  });

  testWidgets('Draft selection flow: unconfirmed draft product is NOT added to CRM list', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.close).last);
    await tester.pumpAndSettle();

    expect(find.text('No sales information recorded'), findsOneWidget);
    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsNothing);
    expect(repository.saveCallCount, 0);
  });

  testWidgets('Multiple products POS/CRM flow: adding multiple items sequentially', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Purchased'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(repository.currentSales?.products.length, 1);

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(find.text('16GB RAM · 512GB ROM · Graphite'), findsOneWidget);
    expect(repository.currentSales?.products.length, 2);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm Save'));
    await tester.pumpAndSettle();

    expect(repository.currentSales?.products.length, 2);
  });

  testWidgets('Regression: Open picker with existing products -> new picker must start empty', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    const existingSales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['STORE'],
      paymentMethod: 'CASH',
      products: [
        CustomerSalesProductItem(
          id: 'existing-p1',
          productModelId: 'existing-model-id',
          modelName: 'OPPO Find X9 Pro',
          seriesName: 'Find Series',
          category: 'SMARTPHONE',
          ram: '16',
          rom: '512',
          color: 'Velvet Red',
          quantity: 1,
          status: 'PURCHASED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: existingSales,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Find X9 Pro'), findsOneWidget);
    expect(find.text('16GB RAM · 512GB ROM · Velvet Red'), findsOneWidget);

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    expect(find.textContaining('○ OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);

    expect(find.text('Selected'), findsNothing);
    expect(find.text('Change Product'), findsNothing);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();

    expect(find.text('Selected'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Change Product'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Find X9 Pro'), findsOneWidget);
    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(repository.currentSales?.products.length, 2);
  });

  testWidgets('Regression: Full confirmation flow with existing product + save to backend', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    const existingSales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['STORE'],
      paymentMethod: 'CASH',
      products: [
        CustomerSalesProductItem(
          id: 'existing-p1',
          productModelId: 'existing-model-id',
          modelName: 'OPPO Find X9 Pro',
          seriesName: 'Find Series',
          category: 'SMARTPHONE',
          ram: '16',
          rom: '512',
          color: 'Velvet Red',
          quantity: 1,
          status: 'PURCHASED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: existingSales,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Find X9 Pro'), findsOneWidget);

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(FilledButton, 'Confirm Selection'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Find X9 Pro'), findsOneWidget);
    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(repository.currentSales?.products.length, 2);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm Save'));
    await tester.pumpAndSettle();

    expect(repository.currentSales?.status, 'PURCHASED');
    expect(repository.currentSales?.products.length, 2);
    expect(repository.currentSales?.products[0].modelName, 'OPPO Find X9 Pro');
    expect(repository.currentSales?.products[1].modelName, 'OPPO Reno16 Pro 5G');
    expect(repository.currentSales?.products[1].ram, '12');
  });

  testWidgets('Product Card UX: long product name renders with ellipsis and maxLines 1', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    const longNameSales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['STORE'],
      paymentMethod: 'CASH',
      products: [
        CustomerSalesProductItem(
          id: 'p-long-1',
          productModelId: 'm-long',
          modelName: 'OPPO Find X9 Pro 5G Smartphone Limited Edition Midnight Black Premium Edition',
          seriesName: 'Find Series',
          category: 'SMARTPHONE',
          ram: '16',
          rom: '512',
          color: 'Midnight Black',
          quantity: 1,
          status: 'PURCHASED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: longNameSales,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    final textWidget = tester.widget<Text>(find.text(
      'OPPO Find X9 Pro 5G Smartphone Limited Edition Midnight Black Premium Edition',
    ));
    expect(textWidget.maxLines, 1);
    expect(textWidget.overflow, TextOverflow.ellipsis);
    expect(find.text('Find Series · SMARTPHONE'), findsOneWidget);
    expect(find.text('16GB RAM · 512GB ROM · Midnight Black'), findsOneWidget);
  });

  testWidgets('Scenario 1: Confirm selection persists immediately before closing the sheet', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(repository.saveCallCount, 1);
    expect(repository.currentSales, isNotNull);
    expect(repository.currentSales?.products.single.productModelId, 'model-1');
    expect(repository.currentSales?.products.single.productVariantId, 'variant-1');

    await tester.tap(find.byIcon(Icons.close).first);
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);
    expect(repository.currentSales?.products.length, 1);
  });

  testWidgets('Scenario 2: User selects product -> Confirm Selection -> Save -> backend receives full product schema', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Purchased'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm Save'));
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 2);
    final savedProduct = repository.currentSales!.products.first;
    expect(savedProduct.productModelId, 'model-1');
    expect(savedProduct.modelName, 'OPPO Reno16 Pro 5G');
    expect(savedProduct.seriesName, 'Reno16');
    expect(savedProduct.category, 'SMARTPHONE');
    expect(savedProduct.ram, '16');
    expect(savedProduct.rom, '512');
    expect(savedProduct.color, 'Graphite');
    expect(savedProduct.quantity, 1);
    expect(savedProduct.status, 'PURCHASED');
  });

  testWidgets('Scenario 3: Existing product + add new product -> UI shows both before save -> Backend contains both after save', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    const existingSales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['STORE'],
      paymentMethod: 'CASH',
      products: [
        CustomerSalesProductItem(
          id: 'existing-p1',
          productModelId: 'existing-model-id',
          modelName: 'OPPO Find X9 Pro',
          seriesName: 'Find Series',
          category: 'SMARTPHONE',
          ram: '16',
          rom: '512',
          color: 'Velvet Red',
          quantity: 1,
          status: 'PURCHASED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: existingSales,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Find X9 Pro'), findsOneWidget);
    expect(find.text('16GB RAM · 512GB ROM · Velvet Red'), findsOneWidget);
    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(repository.currentSales?.products.length, 2);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm Save'));
    await tester.pumpAndSettle();

    expect(repository.currentSales?.products.length, 2);
    expect(repository.currentSales?.products[0].modelName, 'OPPO Find X9 Pro');
    expect(repository.currentSales?.products[1].modelName, 'OPPO Reno16 Pro 5G');
  });

  testWidgets('Scenario 4: User opens Add Product and cancels -> No changes to selectedProducts', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    const initialSales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['STORE'],
      paymentMethod: 'CASH',
      products: [
        CustomerSalesProductItem(
          id: 'initial-p1',
          productModelId: 'initial-model-id',
          modelName: 'OPPO Find N6',
          seriesName: 'Find Series',
          category: 'FOLDABLE',
          ram: '16',
          rom: '1024',
          color: 'Cosmic Gold',
          quantity: 2,
          status: 'PURCHASED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: initialSales,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Find N6'), findsOneWidget);

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.close).last);
    await tester.pumpAndSettle();

    expect(find.text('OPPO Find N6'), findsOneWidget);
    expect(find.text('16GB RAM · 1024GB ROM · Cosmic Gold'), findsOneWidget);
    expect(find.text('OPPO Reno16 Pro 5G'), findsNothing);
    expect(find.text('Draft Selection'), findsNothing);
    expect(repository.saveCallCount, 0);
  });
}
