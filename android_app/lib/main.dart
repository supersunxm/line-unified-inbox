import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/logging/safe_logger.dart';
import 'core/network/api_client.dart';
import 'core/storage/token_store.dart';
import 'core/models/models.dart';
import 'features/auth/auth_repository.dart';
import 'features/auth/login_page.dart';
import 'features/auth/registration_page.dart';
import 'features/auth/pending_approval_page.dart';
import 'features/auth/admin_approval_page.dart';
import 'features/auth/waiting_approval_page.dart';
import 'features/chat/chat_page.dart';
import 'features/inbox/conversation_repository.dart';
import 'features/inbox/inbox_page.dart';
import 'features/notifications/notification_service.dart';
import 'features/profile/profile_page.dart';
import 'features/realtime/realtime_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const LineOaApp());
}

class LineOaApp extends StatefulWidget {
  const LineOaApp({super.key});
  @override State<LineOaApp> createState() => _LineOaAppState();
}

class _LineOaAppState extends State<LineOaApp> with WidgetsBindingObserver {
  final _navigator = GlobalKey<NavigatorState>();
  late final TokenStore _tokens;
  late final AuthRepository _auth;
  late final ApiClient _api;
  late final ConversationRepository _conversations;
  late final RealtimeService _realtime;
  late final NotificationService _notifications;
  CurrentUser? _user;
  bool _registering = false;
  bool _pendingApproval = false;
  bool _loading = true;

  @override void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); _tokens = TokenStore(); _api = ApiClient(_tokens, onSessionExpired: _expireSession); _auth = AuthRepository(_api, _tokens); _conversations = ConversationRepository(_api); _realtime = RealtimeService(_tokens); _notifications = NotificationService(_api); _restore(); }
  @override void dispose() { _notifications.dispose(); _realtime.dispose(); WidgetsBinding.instance.removeObserver(this); super.dispose(); }
  @override void didChangeAppLifecycleState(AppLifecycleState state) { if (state == AppLifecycleState.resumed && _user != null) { SafeLogger.lifecycle('resumed'); _refreshSession(); } }
  Future<void> _restore() async {
    if (await _auth.hasToken()) { try { _user = await _auth.me(); } catch (_) { await _tokens.clear(); } }
    if (mounted) setState(() => _loading = false);
    if (_user != null) { _notifications.initialize(_openConversation); _realtime.connect(); }
  }
  void _openConversation(String id, [String? notificationId]) {
    if (notificationId != null) _conversations.markOpened(notificationId);
    _navigator.currentState?.push(MaterialPageRoute(builder: (_) => ChatPage(conversationId: id, repository: _conversations, events: _realtime.events)));
  }
  Future<void> _finishLogin() async { _user = await _auth.me(); if (mounted) setState(() {}); _notifications.initialize(_openConversation); _realtime.connect(); }
  Future<void> _refreshSession() async { try { _user = await _auth.me(); if (mounted) setState(() {}); } catch (_) { /* ApiClient expires session safely. */ } }
  Future<void> _expireSession() async { await _tokens.clear(); if (mounted) { _navigator.currentState?.popUntil((route) => route.isFirst); setState(() { _user = null; _registering = false; _pendingApproval = false; }); } }
  Future<void> _logout() async { _realtime.disconnect(); await _notifications.logout(); await _auth.logout(); if (mounted) setState(() => _user = null); }
  @override Widget build(BuildContext context) => MaterialApp(navigatorKey: _navigator, title: 'LINE OA Chat Hub', theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Colors.green), useMaterial3: true), home: _loading ? const Scaffold(body: Center(child: CircularProgressIndicator())) : _home());
  Widget _home() {
    if (_user == null) {
      if (_pendingApproval) return PendingApprovalPage(onBack: () => setState(() => _pendingApproval = false));
      if (_registering) return RegistrationPage(auth: _auth, onSubmitted: () => setState(() { _registering = false; _pendingApproval = true; }), onBack: () => setState(() => _registering = false));
      return LoginPage(auth: _auth, onLoggedIn: _finishLogin, onRegister: () => setState(() => _registering = true));
    }
    if (_user!.memberships.isEmpty) return WaitingApprovalPage(onRefresh: () => _finishLogin(), onLogout: _logout);
    return InboxPage(repository: _conversations, events: _realtime.events, onOpen: _openConversation, onProfile: () => _navigator.currentState?.push(MaterialPageRoute(builder: (_) => ProfilePage(user: _user!, onLogout: _logout, onApprovals: _user!.role == 'ADMIN' ? () => _navigator.currentState?.push(MaterialPageRoute(builder: (_) => AdminApprovalPage(auth: _auth))) : null))));
  }
}
