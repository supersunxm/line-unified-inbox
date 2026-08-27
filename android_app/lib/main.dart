import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/logging/safe_logger.dart';
import 'core/localization/localization.dart';
import 'core/network/api_client.dart';
import 'core/storage/token_store.dart';
import 'core/models/models.dart';
import 'core/models/authorization_extensions.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_scroll_behavior.dart';
import 'core/widgets/error_state.dart';
import 'core/services/app_update_service.dart';
import 'core/services/startup_restore_service.dart';
import 'features/auth/auth_repository.dart';
import 'features/auth/change_password_page.dart';
import 'features/auth/login_page.dart';
import 'features/auth/registration_page.dart';
import 'features/auth/pending_approval_page.dart';
import 'features/auth/waiting_approval_page.dart';
import 'features/inbox/conversation_repository.dart';
import 'features/notifications/notification_service.dart';
import 'features/realtime/realtime_service.dart';
import 'features/shell/authenticated_shell.dart';
import 'features/summary/summary_repository.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Register the background entry point synchronously, but leave Firebase
  // initialization to the post-navigation notification service. A provider
  // outage must never prevent Flutter from rendering Login/Home.
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const LineOaApp());
}

class LineOaApp extends StatefulWidget {
  const LineOaApp({super.key});
  @override
  State<LineOaApp> createState() => _LineOaAppState();
}

class _LineOaAppState extends State<LineOaApp> with WidgetsBindingObserver {
  final _navigator = GlobalKey<NavigatorState>();
  final _authenticatedShell = GlobalKey<AuthenticatedShellState>();
  late final TokenStore _tokens;
  late final AuthRepository _auth;
  late final ApiClient _api;
  late final ConversationRepository _conversations;
  late final SummaryRepository _summary;
  late final RealtimeService _realtime;
  late final NotificationService _notifications;
  late final AppLanguageController _language;
  late final AppUpdateService _updateService;
  late final StartupRestoreService _startupRestore;
  CurrentUser? _user;
  bool _registering = false;
  bool _pendingApproval = false;
  bool _loading = true;
  bool _loggingOut = false;
  bool _restoreDeferred = false;
  Future<void>? _restoreInFlight;
  static const _nonCriticalStartupTimeout = Duration(seconds: 15);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tokens = TokenStore();
    _api = ApiClient(_tokens, onSessionExpired: _expireSession);
    _auth = AuthRepository(_api, _tokens);
    _conversations = ConversationRepository(_api);
    _summary = SummaryRepository(_api);
    _realtime = RealtimeService(_tokens);
    _notifications = NotificationService(_api, _tokens);
    _language = AppLanguageController();
    _updateService = AppUpdateService(_api);
    _startupRestore = StartupRestoreService(
      hasStoredCredentials: _auth.hasToken,
      loadAuthenticatedUser: _auth.me,
    );
    unawaited(_language.load());
    _restore();
  }

  @override
  void dispose() {
    _notifications.dispose();
    _realtime.dispose();
    _language.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      SafeLogger.lifecycle('resumed');
      if (_user != null) {
        _refreshSession();
      }
    }
  }

  Future<void> _restore() {
    final inFlight = _restoreInFlight;
    if (inFlight != null) return inFlight;
    final operation = _performRestore();
    _restoreInFlight = operation;
    return operation.whenComplete(() {
      if (identical(_restoreInFlight, operation)) _restoreInFlight = null;
    });
  }

  Future<void> _performRestore() async {
    SafeLogger.sessionRestoration('started');
    late final StartupRestoreResult result;
    try {
      result = await _startupRestore.restore();
    } catch (_) {
      // Keep the state machine total even if a future restore dependency
      // escapes its own guarded stage.
      SafeLogger.startupStage('restore', 'failed');
      result = const StartupRestoreResult(
        status: StartupRestoreStatus.temporarilyUnavailable,
      );
    }
    if (!mounted) return;
    setState(() {
      _user = result.user;
      _restoreDeferred = result.shouldShowRetry;
      _loading = false;
    });
    SafeLogger.sessionRestoration(
      switch (result.status) {
        StartupRestoreStatus.authenticated => 'success',
        StartupRestoreStatus.noCredentials => 'no_credentials',
        StartupRestoreStatus.temporarilyUnavailable => 'deferred',
        StartupRestoreStatus.invalidSession => 'invalid',
      },
    );
    if (result.isAuthenticated) _startPostNavigationServices();
  }

  void _startPostNavigationServices() {
    SafeLogger.startupStage('navigation', 'services_start');
    unawaited(_initializeNotificationsSafely());
    SafeLogger.startupStage('realtime', 'start');
    // Realtime is intentionally long-lived and reconnecting; never await it
    // as part of the session/navigation decision.
    unawaited(_realtime.connect());
  }

  Future<void> _initializeNotificationsSafely() async {
    SafeLogger.startupStage('notifications', 'start');
    try {
      await _notifications
          .initialize(_openConversation)
          .timeout(_nonCriticalStartupTimeout);
      SafeLogger.startupStage('notifications', 'success');
    } on TimeoutException {
      SafeLogger.startupStage('notifications', 'timeout');
    } catch (_) {
      SafeLogger.startupStage('notifications', 'failed');
    }
  }

  Future<void> _openConversation(String id, [String? notificationId]) async {
    if (notificationId != null) {
      unawaited(_conversations.markOpened(notificationId));
    }
    final shell = _authenticatedShell.currentState;
    if (shell != null) {
      await shell.openConversation(id);
      return;
    }
    if (mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          unawaited(_authenticatedShell.currentState?.openConversation(id));
        }
      });
    }
  }

  Future<void> _finishLogin() async {
    final result = await _startupRestore.restore();
    if (_loggingOut) return;
    if (!mounted) return;
    setState(() {
      _user = result.user;
      _restoreDeferred = result.shouldShowRetry;
    });
    if (result.isAuthenticated) _startPostNavigationServices();
  }

  Future<void> _refreshSession() async {
    try {
      final user = await _auth.me();
      if (_loggingOut) return;
      _user = user;
      if (mounted) setState(() {});
      unawaited(_notifications.ensureDeviceRegistered());
    } catch (_) {/* ApiClient expires session safely. */}
  }

  Future<void> _expireSession() async {
    await _tokens.clear();
    if (mounted && !_loggingOut) {
      _navigator.currentState?.popUntil((route) => route.isFirst);
      setState(() {
        _user = null;
        _restoreDeferred = false;
        _registering = false;
        _pendingApproval = false;
      });
    }
  }

  Future<void> _logout() async {
    if (_loggingOut) return;
    _loggingOut = true;
    if (mounted) {
      setState(() {});
      _navigator.currentState?.popUntil((route) => route.isFirst);
    }
    try {
      _realtime.disconnect();
      try {
        await _notifications.logout();
      } catch (_) {
        SafeLogger.logoutNotificationCleanupFailed();
      }
      try {
        await _auth.logout();
      } finally {
        SafeLogger.logoutSessionCleared();
        if (mounted) {
          setState(() {
            _user = null;
            _registering = false;
            _pendingApproval = false;
          });
        }
      }
    } finally {
      _loggingOut = false;
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _language,
        builder: (_, __) => AppLanguageScope(
          controller: _language,
          child: MaterialApp(
            navigatorKey: _navigator,
            title: 'OPPO LINE OA Chat',
            locale: _language.locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.light(),
            scrollBehavior: const AppScrollBehavior(),
            home: _loading
                ? const Scaffold(
                    body: Center(child: CircularProgressIndicator()))
                : _home(),
          ),
        ),
      );
  Widget _home() {
    if (_loggingOut) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final user = _user;
    if (user == null) {
      if (_restoreDeferred) {
        return ErrorState(
          message: appLocalizations(context).cannotReachBackend,
          onRetry: () {
            setState(() => _loading = true);
            unawaited(_restore());
          },
        );
      }
      if (_pendingApproval) {
        return PendingApprovalPage(
            onBack: () => setState(() => _pendingApproval = false));
      }
      if (_registering) {
        return RegistrationPage(
            auth: _auth,
            onSubmitted: () => setState(() {
                  _registering = false;
                  _pendingApproval = true;
                }),
            onBack: () => setState(() => _registering = false));
      }
      return LoginPage(
          auth: _auth,
          onLoggedIn: _finishLogin,
          onRegister: () => setState(() => _registering = true));
    }
    if (user.mustChangePassword) {
      return ChangePasswordPage(
        auth: _auth,
        onChanged: _finishLogin,
        onLogout: _logout,
      );
    }
    final hasWorkspace = user.canAccessHqWorkspace ||
        user.canAccessStoreWorkspace ||
        user.canAccessMainOaWorkspace;
    if (!hasWorkspace) {
      return WaitingApprovalPage(
          onRefresh: () => _finishLogin(), onLogout: _logout);
    }
    return AuthenticatedShell(
        key: _authenticatedShell,
        user: user,
        auth: _auth,
        conversations: _conversations,
        summary: _summary,
        events: _realtime.events,
        onLogout: _logout,
        onConversationOpened: _notifications.clearConversationNotifications,
        updateService: _updateService,
        notifications: _notifications);
  }
}
