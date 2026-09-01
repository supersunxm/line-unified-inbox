import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

void main() {
  group('product display normalization helper', () {
    test('repairs split Reno model number and 5G tokens', () {
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6 5 G'),
        'OPPO Reno 16 5G',
      );
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6 5G'),
        'OPPO Reno 16 5G',
      );
      expect(
        normalizeProductDisplayName('OPPO Reno 1 6 Pro 5 G'),
        'OPPO Reno 16 Pro 5G',
      );
    });

    test('normalizes one-letter model families without a family whitelist', () {
      final cases = <String, String>{
        'OPPO A 6': 'OPPO A6',
        'OPPO A 5 5 G': 'OPPO A5 5G',
        'OPPO Find N 6': 'OPPO Find N6',
        'OPPO Find X 8 Pro': 'OPPO Find X8 Pro',
        'OPPO K 1 3 5 G': 'OPPO K13 5G',
        'OPPO F 2 7': 'OPPO F27',
        'OPPO R 1 1': 'OPPO R11',
        'OPPO Watch X 2': 'OPPO Watch X2',
        'OPPO Enco X 3': 'OPPO Enco X3',
      };

      for (final entry in cases.entries) {
        expect(normalizeProductDisplayName(entry.key), entry.value,
            reason: entry.key);
      }
    });

    test('repairs Unicode whitespace variants with the same generic rules', () {
      expect(
        normalizeProductDisplayName('OPPO A\u00A06'),
        'OPPO A6',
      );
      expect(
        normalizeProductDisplayName('OPPO Reno 1\u00A06\u202F5\u00A0G'),
        'OPPO Reno 16 5G',
      );
      expect(
        normalizeProductDisplayName('OPPO Find X\u20078 Pro'),
        'OPPO Find X8 Pro',
      );
    });

    test('leaves already-correct names and multiword product families unchanged', () {
      final names = [
        'OPPO Find N6',
        'OPPO Reno 16 5G',
        'OPPO Find X8 Pro',
        'OPPO Watch X',
        'OPPO Pad 3 Pro',
        'OPPO Enco Air 4 Pro',
        'OPPO A3 Pro 5G',
        'OPPO A5 Pro 5G',
      ];

      for (final name in names) {
        expect(normalizeProductDisplayName(name), name, reason: name);
      }
    });
  });

  group('product capacity normalization helper', () {
    test('repairs spaced RAM and ROM values independently of product model', () {
      expect(normalizeProductCapacity('6 '), '6');
      expect(normalizeProductCapacity('1 2 8 '), '128');
      expect(normalizeProductCapacity('12 GB'), '12');
      expect(normalizeProductCapacity('2 5 6 G B'), '256');
      expect(normalizeProductCapacity('1\u00A00\u202F2\u200B4 GB'), '1024');
    });

    test('keeps null, empty and non-capacity text safe', () {
      expect(normalizeProductCapacity(null), isNull);
      expect(normalizeProductCapacity('   '), isNull);
      expect(normalizeProductCapacity('Unknown'), 'Unknown');
    });
  });

  group('product display normalization through DTO and model parsing paths', () {
    test('CustomerSalesSummaryProduct and ConversationSummary use generic model rules', () {
      final summaryProduct = CustomerSalesSummaryProduct.fromJson({
        'modelName': 'OPPO A 6',
        'quantity': 1,
      });
      expect(summaryProduct.modelName, 'OPPO A6');

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
            {'modelName': 'OPPO K 1 3 5 G', 'quantity': 1},
          ],
        },
      });

      expect(summary.customerSalesSummary, isNotNull);
      expect(summary.customerSalesSummary!.products.first.modelName,
          'OPPO K13 5G');
    });

    test('CustomerSalesProductItem repairs model and capacity on detail cards', () {
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

    test('CustomerSalesProductItem works for arbitrary one-letter families', () {
      final cases = <String, String>{
        'OPPO Find N 6': 'OPPO Find N6',
        'OPPO Find X 8 Pro': 'OPPO Find X8 Pro',
        'OPPO K 1 3 5 G': 'OPPO K13 5G',
        'OPPO F 2 7': 'OPPO F27',
        'OPPO R 1 1': 'OPPO R11',
      };

      for (final entry in cases.entries) {
        final product = CustomerSalesProductItem.fromJson({
          'id': 'generic',
          'productModelId': 'generic',
          'modelName': entry.key,
          'status': 'INTERESTED',
        });
        expect(product.modelName, entry.value, reason: entry.key);
      }
    });

    test('ConversationProductTag and ProductSelectorItem use the same model normalizer', () {
      final tag = ConversationProductTag.fromJson({
        'id': 'tag-1',
        'productName': 'OPPO A 6',
        'category': 'SMARTPHONE',
        'seriesName': 'A Series',
      });
      expect(tag.productName, 'OPPO A6');

      final selector = ProductSelectorItem.fromJson({
        'id': 'prod-1',
        'productName': 'OPPO Find X 8 Pro',
        'category': 'SMARTPHONE',
        'seriesName': 'Find',
      });
      expect(selector.productName, 'OPPO Find X8 Pro');
    });

    test('ConversationProductVariant and ProductVariantSelectorItem normalize capacities', () {
      final tagVariant = ConversationProductVariant.fromJson({
        'id': 'variant-1',
        'ram': '1 2 GB',
        'rom': '2 5 6 G B',
        'color': ' Graphite ',
      });
      expect(tagVariant.ram, '12');
      expect(tagVariant.rom, '256');
      expect(tagVariant.color, 'Graphite');
      expect(tagVariant.label, '12GB / 256GB / Graphite');

      final selectorVariant = ProductVariantSelectorItem.fromJson({
        'id': 'variant-2',
        'ram': '1 6 ',
        'rom': '5 1 2 GB',
        'color': ' Velvet Red ',
      });
      expect(selectorVariant.ram, '16');
      expect(selectorVariant.rom, '512');
      expect(selectorVariant.color, 'Velvet Red');
    });

    test('SummaryProduct and SummaryVariant normalize model and capacities', () {
      final summaryProd = SummaryProduct.fromJson({
        'productId': 'p-1',
        'productName': 'OPPO K 1 3 5 G',
        'count': 5,
      });
      expect(summaryProd.productName, 'OPPO K13 5G');

      final summaryVar = SummaryVariant.fromJson({
        'productName': 'OPPO A 6',
        'ram': '6 ',
        'rom': '1 2 8 ',
        'color': ' Blue ',
        'count': 3,
      });
      expect(summaryVar.productName, 'OPPO A6');
      expect(summaryVar.ram, '6');
      expect(summaryVar.rom, '128');
      expect(summaryVar.color, 'Blue');
    });
  });
}
