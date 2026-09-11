import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

class _StateFakeRepository extends ConversationRepository {
  _StateFakeRepository() : super(ApiClient(TokenStore()));

  CustomerSalesInformation? currentSales;
  int saveCallCount = 0;

  @override
  Future<ConversationDetail> updateCustomerSalesInfo(
    String id, {
    Object? status = const Object(),
    Object? filmBrand = const Object(),
    Object? onlineSource = const Object(),
    Object? interestLevel = const Object(),
    Object? purchaseChannel = const Object(),
    Object? paymentMethod = const Object(),
    Object? products = const Object(),
  }) async {
    saveCallCount++;
    currentSales = CustomerSalesInformation(
      status: status is String ? status : null,
      filmBrand: filmBrand is String ? filmBrand : null,
      onlineSource: onlineSource is String ? onlineSource : null,
      interestLevel: interestLevel is String ? interestLevel : null,
      purchaseChannel: purchaseChannel is List
          ? purchaseChannel.whereType<String>().toList()
          : const [],
      paymentMethod: paymentMethod is String ? paymentMethod : null,
      products: products is List
          ? products.whereType<CustomerSalesProductItem>().toList()
          : const [],
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

Widget _host({
  required _StateFakeRepository repository,
  CustomerSalesInformation? sales,
}) =>
    MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
          initialSalesInfo: sales,
        ),
      ),
    );

void main() {
  setUp(() {});

  testWidgets('purchase channel deselection persists when sheet is closed',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _StateFakeRepository();
    const sales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['ONLINE'],
      paymentMethod: 'INSTALLMENT',
      products: [],
    );

    await tester.pumpWidget(_host(repository: repository, sales: sales));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(FilterChip, '✓ 🌐 Online'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilterChip, '✓ 🌐 Online'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(FilterChip, '○ 🌐 Online'), findsOneWidget);
    expect(repository.saveCallCount, 0);

    await tester.tap(find.byIcon(Icons.close).first);
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);
    expect(repository.currentSales?.status, 'PURCHASED');
    expect(repository.currentSales?.purchaseChannel, isEmpty);
    expect(repository.currentSales?.paymentMethod, 'INSTALLMENT');
  });

  testWidgets('clear all persists a truly empty nullable sales state',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _StateFakeRepository();
    const sales = CustomerSalesInformation(
      status: 'INTERESTED',
      interestLevel: 'HOT',
      purchaseChannel: [],
      products: [
        CustomerSalesProductItem(
          id: 'sales-product-1',
          productModelId: 'model-1',
          modelName: 'OPPO Reno16 Pro 5G',
          quantity: 1,
          status: 'INTERESTED',
        ),
      ],
    );

    await tester.pumpWidget(_host(repository: repository, sales: sales));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Clear all'));
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);
    expect(repository.currentSales?.status, isNull);
    expect(repository.currentSales?.interestLevel, isNull);
    expect(repository.currentSales?.purchaseChannel, isEmpty);
    expect(repository.currentSales?.paymentMethod, isNull);
    expect(repository.currentSales?.products, isEmpty);

    for (final value in ['ONLINE', 'INTERESTED', 'PURCHASED', 'FILM']) {
      final chip = tester.widget<ChoiceChip>(
        find.byKey(ValueKey('customer-status-chip-$value')),
      );
      expect(chip.selected, isFalse);
    }
  });

  testWidgets('an untouched conversation can remain without sales status',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _StateFakeRepository();
    await tester.pumpWidget(_host(repository: repository));
    await tester.pumpAndSettle();
    for (final value in ['ONLINE', 'INTERESTED', 'PURCHASED', 'FILM']) {
      final chip = tester.widget<ChoiceChip>(
        find.byKey(ValueKey('customer-status-chip-$value')),
      );
      expect(chip.selected, isFalse);
    }
    expect(repository.saveCallCount, 0);
  });

  testWidgets('compact status chips select each status without saving drafts',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _StateFakeRepository();
    await tester.pumpWidget(_host(repository: repository));
    await tester.pumpAndSettle();

    for (final value in ['ONLINE', 'INTERESTED', 'PURCHASED', 'FILM']) {
      await tester.tap(find.byKey(ValueKey('customer-status-chip-$value')));
      await tester.pumpAndSettle();

      for (final candidate in ['ONLINE', 'INTERESTED', 'PURCHASED', 'FILM']) {
        final chip = tester.widget<ChoiceChip>(
          find.byKey(ValueKey('customer-status-chip-$candidate')),
        );
        expect(chip.selected, candidate == value);
      }
    }

    expect(repository.saveCallCount, 0);
  });

  testWidgets('compact status chips stay one line and scroll on narrow screens',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _StateFakeRepository();
    const sales = CustomerSalesInformation(
      status: 'FILM',
      filmBrand: 'OPPO',
      purchaseChannel: [],
      products: [],
    );
    await tester.pumpWidget(_host(repository: repository, sales: sales));
    await tester.pumpAndSettle();

    final selector = find.byKey(const ValueKey('customer-status-selector'));
    final scrollable = find.descendant(
      of: selector,
      matching: find.byType(Scrollable),
    );
    expect(scrollable, findsOneWidget);
    final scrollState = tester.state<ScrollableState>(scrollable);
    expect(scrollState.position.axis, Axis.horizontal);
    expect(scrollState.position.maxScrollExtent, greaterThan(0));

    for (final label in ['Online', 'Interested', 'Purchased', 'Film']) {
      final labelText = tester.widget<Text>(find.text(label));
      expect(labelText.maxLines, 1);
      expect(labelText.softWrap, isFalse);
    }

    final startOffset = scrollState.position.pixels;
    await tester.drag(selector, const Offset(-120, 0));
    await tester.pumpAndSettle();
    expect(scrollState.position.pixels, greaterThan(startOffset));
    expect(tester.takeException(), isNull);
  });
}
