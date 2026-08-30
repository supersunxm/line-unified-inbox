import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/product_picker_classification.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

class _ProductPickerRepository extends ConversationRepository {
  _ProductPickerRepository(this.catalog) : super(ApiClient(TokenStore()));

  final List<ProductSelectorItem> catalog;
  final List<String> variantRequests = [];
  int saveCalls = 0;

  @override
  Future<List<ProductSelectorItem>> fetchProducts(
          {String? search, String? category}) async =>
      catalog;

  @override
  Future<List<ProductVariantSelectorItem>> fetchProductVariants(
      String productId) async {
    variantRequests.add(productId);
    return const [];
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
    saveCalls++;
    return ConversationDetail(
      id: id,
      customerName: 'Customer',
      storeName: 'Store',
      messages: const [],
    );
  }
}

const _catalog = [
  ProductSelectorItem(
    id: 'find',
    productName: 'OPPO Find X9 Pro',
    category: 'SMARTPHONE',
    seriesName: 'Find X Series',
  ),
  ProductSelectorItem(
    id: 'reno',
    productName: 'OPPO Reno16 Pro',
    category: 'SMARTPHONE',
    seriesName: 'Reno Series',
  ),
  ProductSelectorItem(
    id: 'a6',
    productName: 'OPPO A6',
    category: 'PHONE',
    seriesName: 'A Series',
  ),
  ProductSelectorItem(
    id: 'pad',
    productName: 'OPPO Pad 4 Pro',
    category: 'TABLET',
    seriesName: 'OPPO Pad Series',
  ),
  ProductSelectorItem(
    id: 'watch',
    productName: 'OPPO Watch X',
    category: 'WEARABLE',
    seriesName: 'OPPO Watch Series',
  ),
  ProductSelectorItem(
    id: 'enco',
    productName: 'OPPO Enco Air',
    category: 'AUDIO',
    seriesName: 'OPPO Enco Series',
  ),
  ProductSelectorItem(
    id: 'air-purifier',
    productName: 'OPPO Air Purifier',
    category: 'SMART_HOME_AIOT',
    seriesName: 'IoT',
  ),
];

Widget _picker(_ProductPickerRepository repository) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    );

void main() {
  test('classification is tolerant and keeps unknown devices in IoT', () {
    expect(
      classifyProductCategory(_catalog[0]),
      ProductPickerCategory.smartphone,
    );
    expect(
      classifyProductCategory(_catalog[3]),
      ProductPickerCategory.tablet,
    );
    expect(
      classifyProductCategory(_catalog[4]),
      ProductPickerCategory.watch,
    );
    expect(
      classifyProductCategory(_catalog[5]),
      ProductPickerCategory.audio,
    );
    expect(
      classifyProductCategory(_catalog[6]),
      ProductPickerCategory.iot,
    );
  });

  test('smartphone series detection does not treat arbitrary A as A Series',
      () {
    expect(
      classifySmartphoneSeries(_catalog[2]),
      ProductPickerSeries.aSeries,
    );
    expect(
      classifySmartphoneSeries(const ProductSelectorItem(
        id: 'find-a',
        productName: 'OPPO Find X9',
        category: 'SMARTPHONE',
        seriesName: 'Find Series',
      )),
      ProductPickerSeries.find,
    );
  });

  testWidgets('picker renders categories and filters by category and series',
      (tester) async {
    final repository = _ProductPickerRepository(_catalog);
    await tester.pumpWidget(_picker(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    for (final label in [
      'All',
      'Smartphone',
      'Tablet',
      'Watch',
      'Audio',
      'IoT',
    ]) {
      expect(find.widgetWithText(ChoiceChip, label), findsOneWidget);
    }
    expect(find.text('OPPO Find X9 Pro'), findsOneWidget);
    expect(find.text('OPPO Pad 4 Pro'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Smartphone'));
    await tester.pumpAndSettle();
    expect(find.text('OPPO Find X9 Pro'), findsOneWidget);
    expect(find.text('OPPO Reno16 Pro'), findsOneWidget);
    expect(find.text('OPPO Pad 4 Pro'), findsNothing);
    expect(find.widgetWithText(ChoiceChip, 'Find'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Reno'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'A Series'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'A Series'));
    await tester.pumpAndSettle();
    expect(find.text('OPPO A6'), findsOneWidget);
    expect(find.text('OPPO Reno16 Pro'), findsNothing);
  });

  testWidgets(
      'search combines with category and switching category resets series',
      (tester) async {
    final repository = _ProductPickerRepository(_catalog);
    await tester.pumpWidget(_picker(repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ChoiceChip, 'Smartphone'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, 'Reno'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'A6');
    await tester.pumpAndSettle();
    expect(find.text('OPPO A6'), findsNothing);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Tablet'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ChoiceChip, 'Find'), findsNothing);
    expect(find.text('OPPO Pad 4 Pro'), findsNothing);

    await tester.tap(find.byType(TextField));
    await tester.enterText(find.byType(TextField), 'Pad');
    await tester.pumpAndSettle();
    expect(find.text('OPPO Pad 4 Pro'), findsOneWidget);
  });

  testWidgets('whole product row selects product and keeps variant flow',
      (tester) async {
    final repository = _ProductPickerRepository(_catalog);
    await tester.pumpWidget(_picker(repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();

    await tester.tap(find.text('OPPO A6'));
    await tester.pumpAndSettle();
    expect(repository.variantRequests, ['a6']);
    expect(find.text('Selected'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
    expect(find.text('Change Product'), findsOneWidget);
    expect(
        find.widgetWithText(FilledButton, 'Confirm Selection'), findsOneWidget);
  });
}
