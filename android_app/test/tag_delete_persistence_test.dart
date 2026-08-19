import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/l10n/app_localizations.dart';

class _DeleteFakeRepository extends ConversationRepository {
  _DeleteFakeRepository() : super(ApiClient(TokenStore()));

  CustomerSalesInformation? currentSales;
  int saveCallCount = 0;

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
      status: status is String ? status : 'PURCHASED',
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

void main() {
  testWidgets('deleting the last sales product persists an empty product list',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _DeleteFakeRepository();
    const savedSales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['ONLINE'],
      paymentMethod: 'INSTALLMENT',
      products: [
        CustomerSalesProductItem(
          id: 'sales-product-1',
          productModelId: 'model-1',
          modelName: 'OPPO Enco Air4 Pro',
          seriesName: 'Enco',
          category: 'AUDIO',
          color: 'Moonlight White',
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
          initialSalesInfo: savedSales,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('OPPO Enco Air4 Pro'), findsOneWidget);
    expect(repository.saveCallCount, 0);

    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);
    expect(repository.currentSales?.products, isEmpty);
    expect(repository.currentSales?.purchaseChannel, ['ONLINE']);
    expect(repository.currentSales?.paymentMethod, 'INSTALLMENT');
    expect(find.text('OPPO Enco Air4 Pro'), findsNothing);
  });
}
