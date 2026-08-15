import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/chat/widgets/conversation_tags_sheet.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

class _FakeTagRepository extends ConversationRepository {
  _FakeTagRepository() : super(ApiClient(TokenStore()));

  ConversationTags current = const ConversationTags();

  @override
  Future<List<ProductSelectorItem>> fetchProducts({String? search, String? category}) async => [
        const ProductSelectorItem(
          id: 'model-1',
          productName: 'OPPO Reno16 Pro 5G',
          category: 'SMARTPHONE',
          seriesName: 'Reno16',
        ),
      ];

  @override
  Future<ConversationDetail> updateConversationTags(String id,
      {Object? sourceChannels = const Object(),
      Object? isInstallment = const Object(),
      Object? productId = const Object(),
      Object? variantId = const Object()}) async {
    current = ConversationTags(
      sourceChannels: sourceChannels is List
          ? sourceChannels.whereType<String>().toList()
          : const [],
      product: productId is String
          ? const ConversationProductTag(
              id: 'model-1',
              productName: 'OPPO Reno16 Pro 5G',
              category: 'SMARTPHONE',
              seriesName: 'Reno16',
            )
          : null,
    );
    return ConversationDetail(
      id: id,
      customerName: 'Customer',
      storeName: 'Store',
      messages: const [],
      tags: current,
    );
  }
}

void main() {
  testWidgets('tag sheet supports source/product selection and save',
      (tester) async {
    final repository = _FakeTagRepository();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-1',
          repository: repository,
          initialTags: const ConversationTags(),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Conversation Tags'), findsOneWidget);
    expect(find.text('OPPO Reno16 Pro 5G'), findsOneWidget);
    await tester.tap(find.byType(FilterChip).first);
    await tester.pump();
    expect(tester.widget<FilterChip>(find.byType(FilterChip).first).selected,
        isTrue);
    await tester.tap(find.text('OPPO Reno16 Pro 5G'));
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(repository.current.sourceChannels, ['STORE']);
    expect(repository.current.product?.productName, 'OPPO Reno16 Pro 5G');
  });
}
