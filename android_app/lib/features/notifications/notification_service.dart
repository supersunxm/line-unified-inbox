import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../core/network/api_client.dart';

typedef ConversationDeepLink = void Function(String conversationId, String? notificationId);

class NotificationService {
  NotificationService(this._api);
  final ApiClient _api;

  Future<void> initialize(ConversationDeepLink onConversation) async {
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) await _api.post('/device-tokens', body: {'token': token, 'platform': 'ANDROID'});
      FirebaseMessaging.onMessageOpenedApp.listen((message) => _open(message, onConversation));
      final initial = await messaging.getInitialMessage();
      if (initial != null) _open(initial, onConversation);
    } catch (_) {
      // FCM is optional until Firebase project files are provisioned for this build flavor.
    }
  }

  void _open(RemoteMessage message, ConversationDeepLink onConversation) {
    final conversationId = message.data['conversationId'];
    if (conversationId is String && conversationId.isNotEmpty) onConversation(conversationId, message.data['notificationId'] as String?);
  }
}
