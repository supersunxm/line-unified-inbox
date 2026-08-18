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
    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    // Verify catalog shows unselected state with ○ and explicit Select button
    expect(find.textContaining('○ OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);

    // Tap Select button
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    expect(repository.variantCalls, ['model-1']);

    // Verify selected state badge and Change Product button
    expect(find.text('Selected'), findsOneWidget);
    expect(find.text('Change Product'), findsOneWidget);

    // Select configuration chip (starts with ○)
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'));
    await tester.pumpAndSettle();

    // Confirm configuration chip now shows ✓
    expect(find.widgetWithText(ChoiceChip, '✓ 16GB RAM · 512GB ROM · Graphite'), findsOneWidget);

    // Confirm adding product to list
    await tester.tap(find.widgetWithText(FilledButton, 'Add to List'));
    await tester.pumpAndSettle();

    // Select Warm interest level (starts with ○)
    await tester.tap(find.widgetWithText(ChoiceChip, '○ ⚡ Warm'));
    await tester.pumpAndSettle();

    // Save entire sheet -> shows confirmation dialog
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    // Verify confirmation modal
    expect(find.text('Confirm Customer Information'), findsOneWidget);
    expect(find.text('Confirm Save'), findsOneWidget);

    // Tap Confirm Save
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

    // Switch to Purchased
    await tester.tap(find.text('Purchased'));
    await tester.pumpAndSettle();

    // Select Store channel and Installment payment
    await tester.tap(find.widgetWithText(FilterChip, '○ 🏪 Store'));
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 💳 Installment'));
    await tester.pumpAndSettle();

    // Add product
    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Add to List'));
    await tester.pumpAndSettle();

    // Save entire sheet -> confirmation modal
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

    // Verify Convert to Purchased button is displayed
    expect(find.text('Convert to Purchased'), findsAtLeastNWidgets(1));

    // Tap Convert to Purchased
    await tester.tap(find.widgetWithText(FilledButton, 'Convert to Purchased'));
    await tester.pumpAndSettle();

    // Verify it switched to Purchased while keeping the product
    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);

    // Select Store channel and Cash payment
    await tester.tap(find.widgetWithText(FilterChip, '○ 🏪 Store'));
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 💵 Cash'));
    await tester.pumpAndSettle();

    // Save -> shows Confirm Purchase modal
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

  testWidgets('Product & Variant Selection UX: initial unselected state, Change Product, and explicit chips', (tester) async {
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

    // Open Add Product
    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    // 1. Initial State: Catalog is shown with radio ○ and Select button.
    expect(find.textContaining('○ OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);
    expect(find.text('Selected'), findsNothing);

    // 2. Select product via Select CTA
    await tester.tap(find.widgetWithText(OutlinedButton, 'Select'));
    await tester.pumpAndSettle();

    // 3. Visual Confirmation: Badge shows 'Selected' and action shows 'Change Product'
    expect(find.text('Selected'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Change Product'), findsOneWidget);

    // 4. Test Change Product resets back to catalog
    await tester.tap(find.widgetWithText(OutlinedButton, 'Change Product'));
    await tester.pumpAndSettle();

    expect(find.textContaining('○ OPPO Reno16 Pro 5G'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Select'), findsOneWidget);

    // 5. Re-select product via tapping the list tile directly
    await tester.tap(find.textContaining('○ OPPO Reno16 Pro 5G'));
    await tester.pumpAndSettle();

    expect(find.text('Selected'), findsOneWidget);

    // 6. Variants initially unselected with ○
    expect(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'), findsOneWidget);

    // 7. Select variant -> updates to ✓
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(ChoiceChip, '✓ 12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, '○ 16GB RAM · 512GB ROM · Graphite'), findsOneWidget);

    // 8. Add to List
    await tester.tap(find.widgetWithText(FilledButton, 'Add to List'));
    await tester.pumpAndSettle();

    // Picker closes, item appears in main sheet
    expect(find.text('12GB RAM · 256GB ROM · Graphite'), findsOneWidget);
  });
}
