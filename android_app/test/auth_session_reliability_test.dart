import 'dart:async';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/network/api_exception.dart';
import 'package:line_oa_chat_hub/core/network/connectivity_service.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/auth/auth_repository.dart';

class _Online extends ConnectivityService {
  @override
  Future<bool> get isOnline async => true;
}

MobileCredentials _credentials() => MobileCredentials(
      accessToken: 'expired-access',
      refreshToken: 'refresh-one',
      accessExpiresAt: DateTime.utc(2026, 8, 26),
      refreshExpiresAt: DateTime.utc(2026, 9, 25),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('valid stored session survives a new TokenStore instance', () async {
    await TokenStore().saveCredentials(_credentials());
    final restored = await TokenStore().readCredentials();
    expect(restored?.accessToken, 'expired-access');
    expect(restored?.refreshToken, 'refresh-one');
  });

  test('expired access refreshes and retries the original request', () async {
    final store = TokenStore();
    await store.saveCredentials(_credentials());
    var refreshes = 0;
    var resourceCalls = 0;
    final client = ApiClient(store, connectivity: _Online(),
        httpClient: MockClient((request) async {
      if (request.url.path == '/auth/mobile/refresh') {
        refreshes++;
        return http.Response(
            jsonEncode({
              'accessToken': 'fresh-access',
              'refreshToken': 'refresh-two',
              'expiresAt': '2026-08-27T00:00:00Z',
              'refreshExpiresAt': '2026-09-25T00:00:00Z'
            }),
            200);
      }
      resourceCalls++;
      return request.headers['authorization'] == 'Bearer fresh-access'
          ? http.Response('{"ok":true}', 200)
          : http.Response('{"code":"SESSION_EXPIRED"}', 401);
    }));
    expect((await client.get('/resource'))['ok'], true);
    expect(refreshes, 1);
    expect(resourceCalls, 2);
    expect((await store.readCredentials())?.refreshToken, 'refresh-two');
  });

  test('concurrent expired requests use one refresh flight', () async {
    final store = TokenStore();
    await store.saveCredentials(_credentials());
    var refreshes = 0;
    final client = ApiClient(store, connectivity: _Online(),
        httpClient: MockClient((request) async {
      if (request.url.path == '/auth/mobile/refresh') {
        refreshes++;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return http.Response(
            '{"accessToken":"fresh","refreshToken":"next","expiresAt":"2026-08-27T00:00:00Z","refreshExpiresAt":"2026-09-25T00:00:00Z"}',
            200);
      }
      return request.headers['authorization'] == 'Bearer fresh'
          ? http.Response('{}', 200)
          : http.Response('{}', 401);
    }));
    await Future.wait(
        [client.get('/one'), client.get('/two'), client.get('/three')]);
    expect(refreshes, 1);
  });

  test('network failure and 403 never clear credentials or force logout',
      () async {
    for (final response in <http.Response?>[null, http.Response('{}', 403)]) {
      FlutterSecureStorage.setMockInitialValues({});
      final store = TokenStore();
      await store.saveCredentials(_credentials());
      var logouts = 0;
      final client =
          ApiClient(store, connectivity: _Online(), onSessionExpired: () async {
        logouts++;
      }, httpClient: MockClient((_) async {
        if (response == null) throw http.ClientException('offline');
        return response;
      }));
      await expectLater(client.get('/resource'), throwsA(isA<ApiException>()));
      expect(logouts, 0);
      expect(await store.read(), 'expired-access');
    }
  });

  test('revoked refresh forces logout only after refresh rejection', () async {
    final store = TokenStore();
    await store.saveCredentials(_credentials());
    var logouts = 0;
    final client = ApiClient(store, connectivity: _Online(),
        onSessionExpired: () async {
      logouts++;
      await store.clear();
    },
        httpClient: MockClient((request) async =>
            request.url.path == '/auth/mobile/refresh'
                ? http.Response('{"code":"SESSION_EXPIRED"}', 401)
                : http.Response('{}', 401)));
    await expectLater(client.get('/resource'), throwsA(isA<ApiException>()));
    expect(logouts, 1);
    expect(await store.readCredentials(), isNull);
  });

  test('refresh timeout preserves the session and does not force logout',
      () async {
    final store = TokenStore();
    await store.saveCredentials(_credentials());
    var logouts = 0;
    final never = Completer<http.Response>();
    final client = ApiClient(
      store,
      connectivity: _Online(),
      requestTimeout: const Duration(milliseconds: 20),
      onSessionExpired: () async => logouts++,
      httpClient: MockClient((request) async {
        if (request.url.path == '/auth/mobile/refresh') return never.future;
        return http.Response('{"code":"SESSION_EXPIRED"}', 401);
      }),
    );

    await expectLater(
      client.get('/resource'),
      throwsA(isA<ApiException>()
          .having((error) => error.code, 'code', 'SESSION_RECOVERY_TEMPORARY')),
    );
    expect(logouts, 0);
    expect(await store.readCredentials(), isNotNull);
  });

  test(
      'temporary refresh response does not turn an expired request into logout',
      () async {
    final store = TokenStore();
    await store.saveCredentials(_credentials());
    var logouts = 0;
    final client = ApiClient(
      store,
      connectivity: _Online(),
      onSessionExpired: () async => logouts++,
      httpClient: MockClient((request) async {
        if (request.url.path == '/auth/mobile/refresh') {
          return http.Response('{}', 503);
        }
        return http.Response('{"code":"SESSION_EXPIRED"}', 401);
      }),
    );

    await expectLater(
      client.get('/resource'),
      throwsA(isA<ApiException>()
          .having((error) => error.code, 'code', 'SESSION_RECOVERY_TEMPORARY')),
    );
    expect(logouts, 0);
    expect(await store.readCredentials(), isNotNull);
  });

  test('explicit logout revokes by refresh credential and clears storage',
      () async {
    final store = TokenStore();
    await store.saveCredentials(_credentials());
    String? sentRefresh;
    final api = ApiClient(store, connectivity: _Online(),
        httpClient: MockClient((request) async {
      sentRefresh = (jsonDecode(request.body)
          as Map<String, dynamic>)['refreshToken'] as String?;
      return http.Response('{"success":true}', 201);
    }));
    await AuthRepository(api, store).logout();
    expect(sentRefresh, 'refresh-one');
    expect(await store.readCredentials(), isNull);
  });
}
