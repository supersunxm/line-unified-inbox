import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:oppo_line_oa_chat/core/models/models.dart';
import 'package:oppo_line_oa_chat/core/network/store_view_context.dart';

void main() {
  test('store view context enters and exits a store', () {
    final context = StoreViewContextController();
    final store = Store(id: 'store-1', name: 'RBS Chonburi', code: 'RBS-CBI');

    context.enter(store);
    expect(context.isActive, isTrue);
    expect(context.storeId, 'store-1');
    expect(context.store?.name, 'RBS Chonburi');

    context.exit();
    expect(context.isActive, isFalse);
    expect(context.storeId, isNull);
  });

  test('authenticated requests include the selected store context', () async {
    final context = StoreViewContextController()
      ..enter(Store(id: 'store-1', name: 'RBS Chonburi'));
    late http.Request captured;
    final client = StoreViewHttpClient(
      context,
      inner: MockClient((request) async {
        captured = request;
        return http.Response('{}', 200);
      }),
    );
    final request = http.Request('GET', Uri.parse('https://example.com/chats'))
      ..headers['Authorization'] = 'Bearer token';

    await http.Response.fromStream(await client.send(request));

    expect(captured.headers['x-act-as-store-id'], 'store-1');
  });

  test('public requests never include the selected store context', () async {
    final context = StoreViewContextController()
      ..enter(Store(id: 'store-1', name: 'RBS Chonburi'));
    late http.Request captured;
    final client = StoreViewHttpClient(
      context,
      inner: MockClient((request) async {
        captured = request;
        return http.Response('{}', 200);
      }),
    );
    final request = http.Request('POST', Uri.parse('https://example.com/auth/mobile/refresh'));

    await http.Response.fromStream(await client.send(request));

    expect(captured.headers.containsKey('x-act-as-store-id'), isFalse);
  });
}
