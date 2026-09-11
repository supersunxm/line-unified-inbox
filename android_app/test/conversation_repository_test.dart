import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

class _FakeApiClient extends ApiClient {
  _FakeApiClient() : super(TokenStore());

  Map<String, dynamic>? lastPatchBody;

  @override
  Future<Map<String, dynamic>> patch(String path,
      {Map<String, dynamic>? body, bool authenticated = true}) async {
    lastPatchBody = body;
    return {
      'id': 'conversation-film',
      'customer': {'displayName': 'Customer'},
      'store': {'name': 'Store'},
      'messages': <dynamic>[],
      'customerSalesInformation': {
        'status': 'FILM',
        'filmBrand': 'Samsung',
        'interestLevel': null,
        'purchaseChannel': <String>[],
        'paymentMethod': null,
        'products': <dynamic>[],
      },
    };
  }
}

void main() {
  test('customer sales repository serializes FILM brand and parses response',
      () async {
    final api = _FakeApiClient();
    final repository = ConversationRepository(api);

    final detail = await repository.updateCustomerSalesInfo(
      'conversation-film',
      status: 'FILM',
      filmBrand: 'Samsung',
      interestLevel: null,
      purchaseChannel: <String>[],
      paymentMethod: null,
      products: <CustomerSalesProductItem>[],
    );

    expect(api.lastPatchBody, {
      'status': 'FILM',
      'filmBrand': 'Samsung',
      'interestLevel': null,
      'purchaseChannel': <String>[],
      'paymentMethod': null,
      'products': <dynamic>[],
    });
    expect(detail.customerSalesInformation?.isFilm, isTrue);
    expect(detail.customerSalesInformation?.filmBrand, 'Samsung');
  });
}
