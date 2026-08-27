import 'dart:async';

import '../logging/safe_logger.dart';
import '../models/models.dart';
import '../network/api_exception.dart';

typedef StoredCredentialsCheck = Future<bool> Function();
typedef AuthenticatedUserLoader = Future<CurrentUser> Function();

enum StartupRestoreStatus {
  authenticated,
  noCredentials,
  temporarilyUnavailable,
  invalidSession,
}

class StartupRestoreResult {
  const StartupRestoreResult({required this.status, this.user});

  final StartupRestoreStatus status;
  final CurrentUser? user;

  bool get isAuthenticated =>
      status == StartupRestoreStatus.authenticated && user != null;
  bool get shouldShowRetry =>
      status == StartupRestoreStatus.temporarilyUnavailable;
}

/// Restores the mobile session without allowing storage or network failures to
/// strand the app on its loading screen.
class StartupRestoreService {
  const StartupRestoreService({
    required this.hasStoredCredentials,
    required this.loadAuthenticatedUser,
    this.timeout = const Duration(seconds: 15),
  });

  final StoredCredentialsCheck hasStoredCredentials;
  final AuthenticatedUserLoader loadAuthenticatedUser;
  final Duration timeout;

  Future<StartupRestoreResult> restore() async {
    SafeLogger.startupStage('restore', 'start');
    final hasCredentials = await _readCredentials();
    if (hasCredentials == null) {
      SafeLogger.startupStage('navigation', 'retry');
      return const StartupRestoreResult(
        status: StartupRestoreStatus.temporarilyUnavailable,
      );
    }
    if (!hasCredentials) {
      SafeLogger.startupStage('navigation', 'login');
      return const StartupRestoreResult(
          status: StartupRestoreStatus.noCredentials);
    }

    final userResult = await _loadUser();
    if (userResult.user == null) {
      SafeLogger.startupStage(
        'navigation',
        userResult.status == StartupRestoreStatus.invalidSession
            ? 'login'
            : 'retry',
      );
      return StartupRestoreResult(status: userResult.status);
    }
    SafeLogger.startupStage('navigation', 'home');
    return StartupRestoreResult(
      status: StartupRestoreStatus.authenticated,
      user: userResult.user,
    );
  }

  Future<bool?> _readCredentials() async {
    final stopwatch = Stopwatch()..start();
    SafeLogger.startupStage('secure_storage', 'start');
    try {
      final hasCredentials = await hasStoredCredentials().timeout(timeout);
      SafeLogger.startupStage(
        'secure_storage',
        hasCredentials ? 'credentials_found' : 'empty',
        elapsed: stopwatch.elapsed,
      );
      return hasCredentials;
    } on TimeoutException {
      SafeLogger.startupStage(
        'secure_storage',
        'timeout',
        elapsed: stopwatch.elapsed,
      );
      return null;
    } catch (_) {
      SafeLogger.startupStage(
        'secure_storage',
        'failed',
        elapsed: stopwatch.elapsed,
      );
      return null;
    }
  }

  Future<_UserRestoreResult> _loadUser() async {
    final stopwatch = Stopwatch()..start();
    SafeLogger.startupStage('auth_me', 'start');
    try {
      final user = await loadAuthenticatedUser().timeout(timeout);
      SafeLogger.startupStage(
        'auth_me',
        'success',
        elapsed: stopwatch.elapsed,
      );
      return _UserRestoreResult(
        status: StartupRestoreStatus.authenticated,
        user: user,
      );
    } on TimeoutException {
      SafeLogger.startupStage(
        'auth_me',
        'timeout',
        elapsed: stopwatch.elapsed,
      );
      return const _UserRestoreResult(
        status: StartupRestoreStatus.temporarilyUnavailable,
      );
    } on ApiException catch (error) {
      if (error.sessionExpired) {
        SafeLogger.startupStage(
          'auth_me',
          'invalid_session',
          elapsed: stopwatch.elapsed,
        );
        return const _UserRestoreResult(
          status: StartupRestoreStatus.invalidSession,
        );
      }
      SafeLogger.startupStage(
        'auth_me',
        'temporary_failure',
        elapsed: stopwatch.elapsed,
      );
      return const _UserRestoreResult(
        status: StartupRestoreStatus.temporarilyUnavailable,
      );
    } catch (_) {
      SafeLogger.startupStage(
        'auth_me',
        'failed',
        elapsed: stopwatch.elapsed,
      );
      return const _UserRestoreResult(
        status: StartupRestoreStatus.temporarilyUnavailable,
      );
    }
  }
}

class _UserRestoreResult {
  const _UserRestoreResult({required this.status, this.user});

  final StartupRestoreStatus status;
  final CurrentUser? user;
}
