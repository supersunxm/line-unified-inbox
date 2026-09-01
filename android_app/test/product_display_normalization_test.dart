import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

void main() {
  group('product display normalization helper', () {
    test('repairs split OPPO Reno 16 5G catalog tokens with space before G', () {
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6 5 G'),
        'OPPO Reno 16 5G',
      );
    });

    test('repairs split OPPO Reno 16 5G catalog tokens without space before G', () {
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6 5G'),
        'OPPO Reno 16 5G',
      );
    });

    test('repairs split Reno series number without 5G tag', () {
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6'),
        'OPPO Reno 16',
      );
    });

    test('repairs split Reno series number with Pro and 5G', () {
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6 Pro 5 G'),
        'OPPO Reno 16 Pro 5G',
      );
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6 Pro 5G'),
        'OPPO Reno 16 Pro 5G',
      );
    });

    test('repairs various Unicode non-breaking and thin space variants', () {
      expect(
        normalizeProductDisplayName('OPPO Reno 1\u00A06\u202F5\u00A0G'),
        'OPPO Reno 16 5G',
      );
      expect(
        normalizeProductDisplayName('OPPO Reno 1\u20076\u200B5G'),
        'OPPO Reno 16 5G',
      );
    });

    test('leaves already correct and non-malformed product names unchanged', () {
      expect(normalizeProductDisplayName('OPPO Find N6'), 'OPPO Find N6');
      expect(normalizeProductDisplayName('OPPO Reno 16 5G'), 'OPPO Reno 16 5G');
      expect(normalizeProductDisplayName('OPPO Find X8 Pro'), 'OPPO Find X8 Pro');
      expect(normalizeProductDisplayName('OPPO Watch X'), 'OPPO Watch X');
      expect(normalizeProductDisplayName('OPPO Pad 3 Pro'), 'OPPO Pad 3 Pro');
      expect(normalizeProductDisplayName('OPPO A3 Pro 5G'), 'OPPO A3 Pro 5G');
    });
  });

  group('product display normalization through DTO and model parsing paths', () {
    test('CustomerSalesSummaryProduct.fromJson normalizes malformed modelName', () {
      final summaryProduct = CustomerSalesSummaryProduct.fromJson({
        'modelName': 'OPPO Reno 1 6 5 G',
        'quantity': 1,
      });
      expect(summaryProduct.modelName, 'OPPO Reno 16 5G');
    });

    test('ConversationSummary.fromJson normalizes customerSalesSummary products', () {
      final summary = ConversationSummary.fromJson({
        'id': 'conv-1',
        'customer': {'displayName': 'Customer A', 'pictureUrl': null},
        'store': {'name': 'Central World', 'code': 'CW01'},
        'bmReplyStatus': 'NOT_REPLIED',
        'unreadCount': 0,
        'customerSalesSummary': {
          'status': 'INTERESTED',
          'interestLevel': 'HOT',
          'products': [
            {'modelName': 'OPPO Reno 1 6 5 G', 'quantity': 1},
          ],
        },
      });

      expect(summary.customerSalesSummary, isNotNull);
      expect(summary.customerSalesSummary!.products.first.modelName, 'OPPO Reno 16 5G');
    });

    test('CustomerSalesProductItem.fromJson normalizes model name from nested model or modelName', () {
      final fromNested = CustomerSalesProductItem.fromJson({
        'id': 'sales-product-1',
        'productModelId': 'reno-16-5g',
        'model': {
          'id': 'reno-16-5g',
          'name': 'OPPO Reno 1 6 5 G',
        },
        'status': 'INTERESTED',
      });
      expect(fromNested.modelName, 'OPPO Reno 16 5G');

      final fromFlat = CustomerSalesProductItem.fromJson({
        'id': 'sales-product-2',
        'productModelId': 'reno-16-5g',
        'modelName': 'OPPO Reno 1 6 5G',
        'status': 'INTERESTED',
      });
      expect(fromFlat.modelName, 'OPPO Reno 16 5G');
    });

    test('CustomerSalesProductItem repairs A-series names and spaced RAM/ROM values', () {
      final product = CustomerSalesProductItem.fromJson({
        'id': 'sales-product-a6',
        'productModelId': 'oppo-a6',
        'model': {
          'id': 'oppo-a6',
          'name': 'OPPO A 6',
          'category': 'SMARTPHONE',
        },
        'variant': {
          'id': 'a6-6-128',
          'ram': '6 ',
          'rom': '1 2 8 ',
        },
        'status': 'PURCHASED',
      });

      expect(product.modelName, 'OPPO A6');
      expect(product.ram, '6');
      expect(product.rom, '128');
      expect(product.variantLabel, '6GB RAM · 128GB ROM');
    });

    test('CustomerSalesProductItem removes optional GB text from capacity fields', () {
      final product = CustomerSalesProductItem.fromJson({
        'id': 'sales-product-a6-units',
        'productModelId': 'oppo-a6',
        'modelName': 'OPPO A 6',
        'ram': '6 G B',
        'rom': '128 GB',
        'status': 'PURCHASED',
      });

      expect(product.modelName, 'OPPO A6');
      expect(product.ram, '6');
      expect(product.rom, '128');
      expect(product.variantLabel, '6GB RAM · 128GB ROM');
    });

    test('CustomerSalesProductItem repairs split Find N and X suffixes', () {
      final findN = CustomerSalesProductItem.fromJson({
        'id': 'find-n',
        'productModelId': 'find-n6',
        'modelName': 'OPPO Find N 6',
        'status': 'INTERESTED',
      });
      final findX = CustomerSalesProductItem.fromJson({
        'id': 'find-x',
        'productModelId': 'find-x8',
        'modelName': 'OPPO Find X 8 Pro',
        'status': 'INTERESTED',
      });

      expect(findN.modelName, 'OPPO Find N6');
      expect(findX.modelName, 'OPPO Find X8 Pro');
    });

    test('ConversationProductTag and ProductSelectorItem normalize productName', () {
      final tag = ConversationProductTag.fromJson({
        'id': 'tag-1',
        'productName': 'OPPO Reno 1 6 5 G',
        'category': 'SMARTPHONE',
        'seriesName': 'Reno',
      });
      expect(tag.productName, 'OPPO Reno 16 5G');

      final selector = ProductSelectorItem.fromJson({
        'id': 'prod-1',
        'productName': 'OPPO Reno 1 6 5 G',
        'category': 'SMARTPHONE',
        'seriesName': 'Reno',
      });
      expect(selector.productName, 'OPPO Reno 16 5G');
    });

    test('SummaryProduct and SummaryVariant normalize productName', () {
      final summaryProd = SummaryProduct.fromJson({
        'productId': 'p-1',
        'productName': 'OPPO Reno 1 6 5 G',
        'count': 5,
      });
      expect(summaryProd.productName, 'OPPO Reno 16 5G');

      final summaryVar = SummaryVariant.fromJson({
        'productName': 'OPPO Reno 1 6 5 G',
        'variant': '12/256',
        'count': 3,
      });
      expect(summaryVar.productName, 'OPPO Reno 16 5G');
    });
  });
}
