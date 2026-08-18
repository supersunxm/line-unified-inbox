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

    // Tap + Add Product
    await tester.tap(find.text('+ Add Product'));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    await tester.tap(find.text('OPPO Reno16 Pro 5G'));
    await tester.pumpAndSettle();
    expect(repository.variantCalls, ['model-1']);

    // Select configuration chip
    await tester.tap(find.widgetWithText(ChoiceChip, '16GB · 512GB · Graphite'));
    await tester.pumpAndSettle();

    // Confirm adding product to list
    await tester.tap(find.text('Save').last);
    await tester.pumpAndSettle();

    // Select Warm interest level
    await tester.tap(find.widgetWithText(ChoiceChip, '⚡ Warm'));
    await tester.pumpAndSettle();

    // Save entire sheet
    await tester.tap(find.text('Save').first);
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

    // Switch to Purchased
    await tester.tap(find.text('Purchased'));
    await tester.pumpAndSettle();

    // Select Store channel and Installment payment
    await tester.tap(find.widgetWithText(FilterChip, '🏪 Store'));
    await tester.tap(find.widgetWithText(ChoiceChip, '💳 Installment'));
    await tester.pumpAndSettle();

    // Add product
    await tester.tap(find.text('+ Add Product'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OPPO Reno16 Pro 5G'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save').last);
    await tester.pumpAndSettle();

    // Save entire sheet
    await tester.tap(find.text('Save').first);
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
}
