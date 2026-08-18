import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/features/chat/chat_page.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

ConversationDetail _detail(String status) => ConversationDetail(
      id: 'conversation-1',
      customerName: 'Customer',
      storeName: 'Store',
      messages: const [],
      customerSalesInformation: CustomerSalesInformation(
        status: status,
        purchaseChannel: status == 'PURCHASED' ? const ['STORE'] : const [],
        paymentMethod: status == 'PURCHASED' ? 'CASH' : null,
        products: const [],
      ),
    );

void main() {
  test('uses sheet result without reloading when the sheet returns saved detail',
      () async {
    var reloadCalls = 0;
    final saved = _detail('PURCHASED');

    final resolved = await resolveConversationTagsDetailAfterDismiss(
      saved,
      () async {
        reloadCalls += 1;
        return _detail('INTERESTED');
      },
    );

    expect(identical(resolved, saved), isTrue);
    expect(reloadCalls, 0);
  });

  test('reloads authoritative detail when Android back dismisses the sheet',
      () async {
    var reloadCalls = 0;
    final authoritative = _detail('PURCHASED');

    final resolved = await resolveConversationTagsDetailAfterDismiss(
      null,
      () async {
        reloadCalls += 1;
        return authoritative;
      },
    );

    expect(reloadCalls, 1);
    expect(resolved?.customerSalesInformation?.status, 'PURCHASED');
    expect(resolved?.customerSalesInformation?.purchaseChannel, ['STORE']);
    expect(resolved?.customerSalesInformation?.paymentMethod, 'CASH');
  });

  test('dismiss refresh failure leaves the current chat state untouched', () async {
    final resolved = await resolveConversationTagsDetailAfterDismiss(
      null,
      () async => throw StateError('network unavailable'),
    );

    expect(resolved, isNull);
  });
}
