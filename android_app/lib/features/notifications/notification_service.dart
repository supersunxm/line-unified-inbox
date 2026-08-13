import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../core/network/api_client.dart';

typedef ConversationDeepLink = void Function(String conversationId, String? notificationId);

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class NotificationService {
  NotificationService(this._api);
  final ApiClient _api;
  String? _token;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  bool _initialized = false;

  Future<void> initialize(ConversationDeepLink onConversation) async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) { _token = token; await _register(token); }
      _tokenSubscription = messaging.onTokenRefresh.listen((value) { _token = value; _register(value); });
      _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen((message) => _open(message, onConversation));
      final initial = await messaging.getInitialMessage();
      if (initial != null) _open(initial, onConversation);
      _initialized = true;
    } catch (_) {
      // FCM is optional until Firebase project files are provisioned for this build flavor.
    }
  }

  Future<void> _register(String token) => _api.post('/device-tokens', body: {'token': token, 'platform': 'ANDROID'}).then((_) {});
  Future<void> logout() async { final token = _token; if (token != null) { try { await _api.delete('/device-tokens', body: {'token': token}); } catch (_) {} } await dispose(); }
  Future<void> dispose() async { await _tokenSubscription?.cancel(); await _openedSubscription?.cancel(); _tokenSubscription = null; _openedSubscription = null; _token = null; _initialized = false; }

  void _open(RemoteMessage message, ConversationDeepLink onConversation) {
    final conversationId = message.data['conversationId'];
    if (conversationId is String && conversationId.isNotEmpty) onConversation(conversationId, message.data['notificationId'] as String?);
  }
}
