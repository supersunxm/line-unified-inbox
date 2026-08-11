import 'package:flutter/material.dart';
import 'core/network/api_client.dart';
import 'core/storage/token_store.dart';
import 'core/models/models.dart';
import 'features/auth/auth_repository.dart';
import 'features/auth/login_page.dart';
import 'features/auth/otp_page.dart';
import 'features/auth/waiting_approval_page.dart';
import 'features/chat/chat_page.dart';
import 'features/inbox/conversation_repository.dart';
import 'features/inbox/inbox_page.dart';
import 'features/notifications/notification_service.dart';
import 'features/profile/profile_page.dart';

void main() => runApp(const LineOaApp());

class LineOaApp extends StatefulWidget {
  const LineOaApp({super.key});
  @override State<LineOaApp> createState() => _LineOaAppState();
}

class _LineOaAppState extends State<LineOaApp> {
  final _navigator = GlobalKey<NavigatorState>();
  late final TokenStore _tokens;
  late final AuthRepository _auth;
  late final ConversationRepository _conversations;
  CurrentUser? _user;
  String? _otpPhone;
  OtpChallenge? _challenge;
  bool _loading = true;

  @override void initState() { super.initState(); _tokens = TokenStore(); final api = ApiClient(_tokens); _auth = AuthRepository(api, _tokens); _conversations = ConversationRepository(api); _restore(); }
  Future<void> _restore() async {
    if (await _auth.hasToken()) { try { _user = await _auth.me(); } catch (_) { await _tokens.clear(); } }
    if (mounted) setState(() => _loading = false);
    if (_user != null) { NotificationService(ApiClient(_tokens)).initialize(_openConversation); }
  }
  void _openConversation(String id, [String? notificationId]) {
    if (notificationId != null) _conversations.markOpened(notificationId);
    _navigator.currentState?.push(MaterialPageRoute(builder: (_) => ChatPage(conversationId: id, repository: _conversations)));
  }
  Future<void> _finishLogin() async { _user = await _auth.me(); if (mounted) setState(() {}); NotificationService(ApiClient(_tokens)).initialize(_openConversation); }
  Future<void> _logout() async { await _auth.logout(); if (mounted) setState(() => _user = null); }
  @override Widget build(BuildContext context) => MaterialApp(navigatorKey: _navigator, title: 'LINE OA Chat Hub', theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Colors.green), useMaterial3: true), home: _loading ? const Scaffold(body: Center(child: CircularProgressIndicator())) : _home());
  Widget _home() {
    if (_user == null) {
      if (_challenge != null && _otpPhone != null) return OtpPage(auth: _auth, phone: _otpPhone!, challenge: _challenge!, onVerified: _finishLogin);
      return LoginPage(auth: _auth, onOtpRequested: (phone, challenge) => setState(() { _otpPhone = phone; _challenge = challenge; }));
    }
    if (_user!.memberships.isEmpty) return WaitingApprovalPage(onRefresh: () => _finishLogin(), onLogout: _logout);
    return InboxPage(repository: _conversations, onOpen: _openConversation, onProfile: () => _navigator.currentState?.push(MaterialPageRoute(builder: (_) => ProfilePage(user: _user!, onLogout: _logout))));
  }
}
