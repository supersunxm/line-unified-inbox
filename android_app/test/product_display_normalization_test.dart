import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

void main() {
  group('product display normalization', () {
    test('repairs split OPPO Reno 16 5G catalog tokens', () {
      final item = CustomerSalesProductItem.fromJson({
        'id': 'sales-product-1',
        'productModelId': 'reno-16-5g',
        'model': {
'id': 'reno-16-5g',
'name': 'OPPO Reno 1 6 5 G',
        },
        'status': 'INTERESTED',
      });

      expect(item.modelName, 'OPPO Reno 16 5G');
    });

    test('repairs non-breaking-space variants', () {
      expect(
        normalizeProductDisplayName('OPPO Reno 1\u00A06\u202F5\u00A0G'),
        'OPPO Reno 16 5G',
      );
    });

    test('leaves normal product names unchanged', () {
      expect(normalizeProductDisplayName('OPPO Find N6'), 'OPPO Find N6');
      expect(normalizeProductDisplayName('OPPO Reno 16 5G'), 'OPPO Reno 16 5G');
    });
  });
}
