import 'dart:async';
import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../../core/network/api_client.dart';

typedef ConversationDeepLink = void Function(String conversationId, String? notificationId);

const _channelId = 'line_oa_messages';
const _channelName = 'Customer messages';
final _localNotifications = FlutterLocalNotificationsPlugin();

int _notificationId(String value) {
  var hash = 0;
  for (final unit in value.codeUnits) {
    hash = ((hash * 31) + unit) & 0x7fffffff;
  }
  return hash;
}

Future<void> _initializeLocalNotifications([ConversationDeepLink? onConversation]) async {
  await _localNotifications.initialize(
    const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
    onDidReceiveNotificationResponse: onConversation == null
        ? null
        : (response) {
            final payload = response.payload;
            if (payload == null) return;
            final data = jsonDecode(payload);
            if (data is! Map<String, dynamic>) return;
            final conversationId = data['conversationId'];
            if (conversationId is String && conversationId.isNotEmpty) {
              onConversation(conversationId, data['notificationId'] as String?);
            }
          },
  );
  await _localNotifications
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(
        const AndroidNotificationChannel(
          _channelId,
          _channelName,
          description: 'New LINE OA customer messages',
          importance: Importance.high,
        ),
      );
}

Future<void> _showRemoteNotification(RemoteMessage message) async {
  final notificationId = message.data['notificationId'];
  final conversationId = message.data['conversationId'];
  final messageId = message.data['messageId'];
  if (notificationId is! String || notificationId.isEmpty || conversationId is! String || conversationId.isEmpty || messageId is! String || messageId.isEmpty) return;
  await _initializeLocalNotifications();
  await _localNotifications.show(
    _notificationId(notificationId),
    message.data['title'] ?? 'New customer message',
    message.data['body'] ?? 'Tap to open the conversation',
    const NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: 'New LINE OA customer messages',
        importance: Importance.high,
        priority: Priority.high,
      ),
    ),
    payload: jsonEncode({'conversationId': conversationId, 'messageId': messageId, 'notificationId': notificationId}),
  );
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await _showRemoteNotification(message);
}

class NotificationService {
  NotificationService(this._api);
  final ApiClient _api;
  String? _token;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  bool _initialized = false;

  Future<void> initialize(ConversationDeepLink onConversation) async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
      await _initializeLocalNotifications(onConversation);
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) { _token = token; await _register(token); }
      _tokenSubscription = messaging.onTokenRefresh.listen((value) { _token = value; _register(value); });
      _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen((message) => _open(message, onConversation));
      _messageSubscription = FirebaseMessaging.onMessage.listen(_showRemoteNotification);
      final initial = await messaging.getInitialMessage();
      if (initial != null) _open(initial, onConversation);
      final localLaunch = await _localNotifications.getNotificationAppLaunchDetails();
      final payload = localLaunch?.notificationResponse?.payload;
      if (localLaunch?.didNotificationLaunchApp == true && payload != null) {
        final data = jsonDecode(payload);
        if (data is Map<String, dynamic>) {
          final conversationId = data['conversationId'];
          if (conversationId is String && conversationId.isNotEmpty) onConversation(conversationId, data['notificationId'] as String?);
        }
      }
      _initialized = true;
    } catch (_) {
      // FCM is optional until Firebase project files are provisioned for this build flavor.
    }
  }

  Future<void> _register(String token) => _api.post('/device-tokens', body: {'token': token, 'platform': 'ANDROID'}).then((_) {});
  Future<void> logout() async { final token = _token; if (token != null) { try { await _api.delete('/device-tokens', body: {'token': token}); } catch (_) {} } await dispose(); }
  Future<void> dispose() async { await _tokenSubscription?.cancel(); await _openedSubscription?.cancel(); await _messageSubscription?.cancel(); _tokenSubscription = null; _openedSubscription = null; _messageSubscription = null; _token = null; _initialized = false; }

  void _open(RemoteMessage message, ConversationDeepLink onConversation) {
    final conversationId = message.data['conversationId'];
    if (conversationId is String && conversationId.isNotEmpty) onConversation(conversationId, message.data['notificationId'] as String?);
  }
}
