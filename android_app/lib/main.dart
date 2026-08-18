import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/logging/safe_logger.dart';
import 'core/localization/localization.dart';
import 'core/network/api_client.dart';
import 'core/storage/token_store.dart';
import 'core/models/models.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_scroll_behavior.dart';
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

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
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
  CurrentUser? _user;
  bool _registering = false;
  bool _pendingApproval = false;
  bool _loading = true;
  bool _loggingOut = false;

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
    if (state == AppLifecycleState.resumed && _user != null) {
      SafeLogger.lifecycle('resumed');
      _refreshSession();
    }
  }

  Future<void> _restore() async {
    if (await _auth.hasToken()) {
      try {
        _user = await _auth.me();
      } catch (_) {
        await _tokens.clear();
      }
    }
    if (mounted) setState(() => _loading = false);
    if (_user != null) {
      unawaited(_notifications.initialize(_openConversation));
      _realtime.connect();
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
    final user = await _auth.me();
    if (_loggingOut) return;
    _user = user;
    if (mounted) setState(() {});
    unawaited(_notifications.initialize(_openConversation));
    _realtime.connect();
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
    if (user.memberships.isEmpty) {
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
        onConversationOpened: _notifications.clearConversationNotifications);
  }
}
