import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_exception.dart';
import 'package:line_oa_chat_hub/core/services/startup_restore_service.dart';

CurrentUser _user() => CurrentUser(
      id: 'user-1',
      displayName: 'BM User',
      role: 'BM',
      memberships: const [],
      stores: const [],
      permissions: const {},
    );

void main() {
  test('startup renders the app shell before Firebase initialization', () {
    final source = File('lib/main.dart').readAsStringSync();
    expect(source, contains('runApp(const LineOaApp());'));
    expect(source, isNot(contains('await Firebase.initializeApp')));
    expect(source, contains('unawaited(_initializeNotificationsSafely())'));
    expect(source, contains('unawaited(_realtime.connect())'));
  });

  test('resume refresh does not restart startup restoration', () {
    final source = File('lib/main.dart').readAsStringSync();
    final start = source.indexOf('void didChangeAppLifecycleState');
    final end = source.indexOf('Future<void> _restore()', start);
    expect(start, greaterThanOrEqualTo(0));
    expect(end, greaterThan(start));
    expect(source.substring(start, end), isNot(contains('_restore')));
  });

  test('valid stored session enters the app', () async {
    final result = await StartupRestoreService(
      hasStoredCredentials: () async => true,
      loadAuthenticatedUser: () async => _user(),
      timeout: const Duration(milliseconds: 50),
    ).restore();

    expect(result.status, StartupRestoreStatus.authenticated);
    expect(result.user?.id, 'user-1');
    expect(result.shouldShowRetry, false);
  });

  test('expired access token refreshes and then enters the app', () async {
    var refreshCalled = false;
    final result = await StartupRestoreService(
      hasStoredCredentials: () async => true,
      loadAuthenticatedUser: () async {
        // ApiClient performs the transparent refresh before this loader
        // completes. Model that successful post-refresh /auth/me response.
        refreshCalled = true;
        return _user();
      },
      timeout: const Duration(milliseconds: 50),
    ).restore();

    expect(refreshCalled, true);
    expect(result.isAuthenticated, true);
  });

  test('invalid refresh session goes to Login instead of retry state',
      () async {
    final result = await StartupRestoreService(
      hasStoredCredentials: () async => true,
      loadAuthenticatedUser: () async => throw ApiException(
        401,
        'SESSION_EXPIRED',
        'Session expired',
      ),
      timeout: const Duration(milliseconds: 50),
    ).restore();

    expect(result.status, StartupRestoreStatus.invalidSession);
    expect(result.shouldShowRetry, false);
    expect(result.user, isNull);
  });

  test('auth/me timeout exits startup with a retryable state', () async {
    final never = Completer<CurrentUser>();
    final stopwatch = Stopwatch()..start();
    final result = await StartupRestoreService(
      hasStoredCredentials: () async => true,
      loadAuthenticatedUser: () => never.future,
      timeout: const Duration(milliseconds: 20),
    ).restore();

    expect(result.status, StartupRestoreStatus.temporarilyUnavailable);
    expect(result.shouldShowRetry, true);
    expect(stopwatch.elapsed, lessThan(const Duration(seconds: 1)));
  });

  test('secure-storage timeout exits startup with a retryable state', () async {
    final never = Completer<bool>();
    final result = await StartupRestoreService(
      hasStoredCredentials: () => never.future,
      loadAuthenticatedUser: () async => _user(),
      timeout: const Duration(milliseconds: 20),
    ).restore();

    expect(result.status, StartupRestoreStatus.temporarilyUnavailable);
    expect(result.shouldShowRetry, true);
  });

  test('refresh timeout exits startup with a retryable state', () async {
    final never = Completer<CurrentUser>();
    final result = await StartupRestoreService(
      hasStoredCredentials: () async => true,
      loadAuthenticatedUser: () => never.future,
      timeout: const Duration(milliseconds: 20),
    ).restore();

    expect(result.shouldShowRetry, true);
  });

  test('backend 5xx preserves stored credentials and is retryable', () async {
    var credentialsPresent = true;
    final result = await StartupRestoreService(
      hasStoredCredentials: () async => credentialsPresent,
      loadAuthenticatedUser: () async => throw ApiException(
        503,
        'SERVICE_UNAVAILABLE',
        'Unavailable',
      ),
      timeout: const Duration(milliseconds: 50),
    ).restore();

    expect(result.shouldShowRetry, true);
    expect(credentialsPresent, true);
  });

  test('offline failure preserves credentials and is retryable', () async {
    var credentialsPresent = true;
    final result = await StartupRestoreService(
      hasStoredCredentials: () async => credentialsPresent,
      loadAuthenticatedUser: () async => throw ApiException(
        0,
        'OFFLINE',
        'No network connection',
      ),
      timeout: const Duration(milliseconds: 50),
    ).restore();

    expect(result.shouldShowRetry, true);
    expect(credentialsPresent, true);
  });

  test('retry can rerun restoration safely', () async {
    var attempts = 0;
    final service = StartupRestoreService(
      hasStoredCredentials: () async => true,
      loadAuthenticatedUser: () async {
        attempts++;
        if (attempts == 1) {
          throw ApiException(503, 'SERVICE_UNAVAILABLE', 'Unavailable');
        }
        return _user();
      },
      timeout: const Duration(milliseconds: 50),
    );

    expect((await service.restore()).shouldShowRetry, true);
    final retry = await service.restore();
    expect(retry.isAuthenticated, true);
    expect(attempts, 2);
  });
}
