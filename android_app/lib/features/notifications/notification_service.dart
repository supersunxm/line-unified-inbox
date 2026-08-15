import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/logging/safe_logger.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/storage/token_store.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/app_localizations_en.dart';
import '../../l10n/app_localizations_th.dart';
import '../../l10n/app_localizations_zh.dart';
import 'conversation_notification_history.dart';

typedef ConversationDeepLink = void Function(
    String conversationId, String? notificationId);
typedef FcmTokenLoader = Future<String?> Function();
typedef DeviceTokenRegistrar = Future<void> Function(String token);
typedef DeviceTokenDeactivator = Future<void> Function(String token);
typedef AuthenticationChecker = Future<bool> Function();
typedef NotificationCleanup = Future<void> Function();

const _channelId = 'line_oa_messages';
const _channelName = 'Customer messages';
const _notificationIcon = '@drawable/ic_stat_line_oa';
final _localNotifications = FlutterLocalNotificationsPlugin();
ConversationNotificationHistoryStore? _backgroundHistory;
bool _localNotificationsInitialized = false;

ConversationNotificationHistoryStore get _effectiveBackgroundHistory =>
    _backgroundHistory ??=
        SharedPreferencesConversationNotificationHistoryStore();

Future<AppLocalizations> _loadNotificationLocalizations() async {
  final value = await SharedPreferencesAsync().getString('app_language');
  switch (value) {
    case 'th':
      return AppLocalizationsTh();
    case 'zh':
    case 'zh_CN':
      return AppLocalizationsZhCn();
    default:
      return AppLocalizationsEn();
  }
}

Future<void> _ensureFirebaseInitialized() async {
  if (Firebase.apps.isEmpty) await Firebase.initializeApp();
}

int conversationNotificationId(String conversationId) {
  var hash = 0x811c9dc5;
  for (final unit in utf8.encode(conversationId)) {
    hash ^= unit;
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  final result = hash & 0x7fffffff;
  return result == 0 ? 1 : result;
}

Future<void> _initializeLocalNotifications(
    [ConversationDeepLink? onConversation]) async {
  if (_localNotificationsInitialized) return;
  await _localNotifications.initialize(
    const InitializationSettings(
        android: AndroidInitializationSettings(_notificationIcon)),
    onDidReceiveNotificationResponse: onConversation == null
        ? null
        : (response) {
            final payload = response.payload;
            if (payload == null) return;
            final decoded = jsonDecode(payload);
            if (decoded is! Map<String, dynamic>) return;
            final conversationId = decoded['conversationId'];
            if (conversationId is String && conversationId.isNotEmpty) {
              onConversation(
                  conversationId, decoded['notificationId'] as String?);
            }
          },
  );
  await _localNotifications
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(
        const AndroidNotificationChannel(
          _channelId,
          _channelName,
          description: 'New LINE OA customer messages',
          importance: Importance.high,
        ),
      );
  _localNotificationsInitialized = true;
}

Future<void> _showRemoteNotification(RemoteMessage message) async {
  final notificationId = message.data['notificationId'];
  final conversationId = message.data['conversationId'];
  final messageId = message.data['messageId'];
  final customerName = message.data['customerName'];
  final messageType = message.data['messageType'];
  final preview = message.data['preview'];
  final sentAt = message.data['sentAt'];
  SafeLogger.fcmMessageReceived(
    hasNotificationId: notificationId is String && notificationId.isNotEmpty,
    hasConversationId: conversationId is String && conversationId.isNotEmpty,
    hasMessageId: messageId is String && messageId.isNotEmpty,
  );
  if (notificationId is! String ||
      notificationId.isEmpty ||
      conversationId is! String ||
      conversationId.isEmpty ||
      messageId is! String ||
      messageId.isEmpty) {
    return;
  }
  try {
    final localizations = await _loadNotificationLocalizations();
    await _initializeLocalNotifications();
    final history = await _effectiveBackgroundHistory.append(
      conversationId: conversationId,
      customerName: customerName is String && customerName.trim().isNotEmpty
          ? customerName
          : localizations.customer,
      message: ConversationNotificationMessage(
        messageId: messageId,
        preview: localizedNotificationPreview(
          localizations: localizations,
          messageType: messageType is String ? messageType : '',
          preview: preview is String ? preview : null,
        ),
        sentAt: sentAt is String
            ? (DateTime.tryParse(sentAt)?.toUtc() ?? DateTime.now().toUtc())
            : DateTime.now().toUtc(),
      ),
    );
    final customer = Person(
      key: conversationId,
      name: history.customerName,
    );
    await _localNotifications.show(
      conversationNotificationId(conversationId),
      history.customerName,
      history.messages.length == 1
          ? history.messages.single.preview
          : localizations.newMessages(history.messages.length),
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: 'New LINE OA customer messages',
          icon: 'ic_stat_line_oa',
          importance: Importance.high,
          priority: Priority.high,
          onlyAlertOnce: false,
          playSound: true,
          enableVibration: true,
          styleInformation: MessagingStyleInformation(
            Person(name: localizations.you),
            conversationTitle: history.customerName,
            groupConversation: false,
            messages: history.messages
                .map((item) => Message(item.preview, item.sentAt, customer))
                .toList(),
          ),
        ),
      ),
      payload: jsonEncode({
        'conversationId': conversationId,
        'messageId': messageId,
        'notificationId': notificationId,
      }),
    );
    SafeLogger.fcmLocalNotificationShown();
  } catch (error) {
    SafeLogger.fcmLocalNotificationFailed(error.runtimeType.toString());
    rethrow;
  }
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  DartPluginRegistrant.ensureInitialized();
  SafeLogger.fcmBackgroundHandlerInvoked();
  await _ensureFirebaseInitialized();
  await _showRemoteNotification(message);
}

class NotificationService {
  NotificationService(this._api, this._tokens,
      {FcmTokenLoader? tokenLoader,
      DeviceTokenRegistrar? tokenRegistrar,
      AuthenticationChecker? authenticationChecker,
      DeviceTokenDeactivator? deviceTokenDeactivator,
      NotificationCleanup? cancelNotifications,
      ConversationNotificationHistoryStore? historyStore})
      : _tokenLoader = tokenLoader,
        _tokenRegistrar = tokenRegistrar,
        _authenticationChecker = authenticationChecker,
        _deviceTokenDeactivator = deviceTokenDeactivator,
        _cancelNotifications = cancelNotifications,
        _historyStore = historyStore;

  final ApiClient _api;
  final TokenStore _tokens;
  final FcmTokenLoader? _tokenLoader;
  final DeviceTokenRegistrar? _tokenRegistrar;
  final AuthenticationChecker? _authenticationChecker;
  final DeviceTokenDeactivator? _deviceTokenDeactivator;
  final NotificationCleanup? _cancelNotifications;
  ConversationNotificationHistoryStore? _historyStore;
  String? _token;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  bool _initialized = false;
  bool _loggingOut = false;
  Future<void>? _initializationInFlight;
  Future<void>? _registrationInFlight;

  Future<void> initialize(ConversationDeepLink onConversation) async {
    if (_loggingOut) return;
    final inFlight = _initializationInFlight;
    if (inFlight != null) {
      await inFlight;
      return;
    }
    final operation = _initialize(onConversation);
    _initializationInFlight = operation;
    try {
      await operation;
    } finally {
      if (identical(_initializationInFlight, operation)) {
        _initializationInFlight = null;
      }
    }
  }

  Future<void> _initialize(ConversationDeepLink onConversation) async {
    _loggingOut = false;
    if (_initialized) {
      await ensureDeviceRegistered();
      return;
    }

    try {
      await _ensureFirebaseInitialized();
    } catch (error) {
      _logFailure('firebase_initialize', error);
      return;
    }

    try {
      await _initializeLocalNotifications(onConversation);
    } catch (error) {
      _logFailure('local_notifications_initialize', error);
    }

    final messaging = FirebaseMessaging.instance;
    try {
      await messaging.requestPermission();
    } catch (error) {
      _logFailure('permission_request', error);
    }

    _tokenSubscription = messaging.onTokenRefresh.listen((value) {
      _token = value;
      unawaited(_registerAuthenticatedToken(value));
    });
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp
        .listen((message) => _open(message, onConversation));
    _messageSubscription =
        FirebaseMessaging.onMessage.listen(_showRemoteNotification);
    try {
      final initial = await messaging.getInitialMessage();
      if (initial != null) _open(initial, onConversation);
    } catch (error) {
      _logFailure('initial_message', error);
    }
    try {
      final localLaunch =
          await _localNotifications.getNotificationAppLaunchDetails();
      final payload = localLaunch?.notificationResponse?.payload;
      if (localLaunch?.didNotificationLaunchApp == true && payload != null) {
        final decoded = jsonDecode(payload);
        if (decoded is Map<String, dynamic>) {
          final conversationId = decoded['conversationId'];
          if (conversationId is String && conversationId.isNotEmpty) {
            onConversation(
                conversationId, decoded['notificationId'] as String?);
          }
        }
      }
    } catch (error) {
      _logFailure('local_launch', error);
    }
    _initialized = true;
    await ensureDeviceRegistered();
  }

  Future<void> ensureDeviceRegistered() async {
    final inFlight = _registrationInFlight;
    if (inFlight != null) {
      await inFlight;
      return;
    }
    final operation = _performDeviceRegistration();
    _registrationInFlight = operation;
    try {
      await operation;
    } finally {
      _registrationInFlight = null;
    }
  }

  Future<void> _performDeviceRegistration() async {
    if (_loggingOut) {
      SafeLogger.fcmRegistrationSkipped('logging_out');
      return;
    }
    final authenticated = _authenticationChecker == null
        ? await _tokens.read() != null
        : await _authenticationChecker();
    SafeLogger.fcmRegistrationStarted(authenticated: authenticated);
    if (!authenticated) {
      SafeLogger.fcmRegistrationSkipped('unauthenticated');
      return;
    }

    if (_tokenLoader == null) {
      try {
        await _ensureFirebaseInitialized();
      } catch (error) {
        _logFailure('firebase_initialize', error);
        return;
      }
    }

    String? token;
    try {
      token = _tokenLoader == null
          ? await FirebaseMessaging.instance.getToken()
          : await _tokenLoader();
    } catch (error) {
      _logFailure('get_token', error);
      return;
    }
    SafeLogger.fcmTokenAvailable(available: token != null && token.isNotEmpty);
    if (token == null || token.isEmpty || _loggingOut) return;
    _token = token;
    try {
      await (_tokenRegistrar == null
          ? _registerAuthenticatedToken(token)
          : _tokenRegistrar(token));
    } catch (error) {
      _logFailure('device_token_request', error);
    }
  }

  Future<void> _registerAuthenticatedToken(String token) async {
    if (_loggingOut) {
      SafeLogger.fcmRegistrationSkipped('logging_out');
      return;
    }
    if (await _tokens.read() == null) {
      SafeLogger.fcmRegistrationSkipped('unauthenticated');
      return;
    }
    if (_loggingOut) {
      SafeLogger.fcmRegistrationSkipped('logging_out');
      return;
    }
    try {
      SafeLogger.fcmRegistrationRequestStarted();
      await _api.post('/device-tokens',
          body: {'token': token, 'platform': 'ANDROID'});
      SafeLogger.fcmTokenRegistered();
    } catch (error) {
      _logFailure('device_token_request', error);
    }
  }

  void _logFailure(String stage, Object error) {
    if (error is ApiException) {
      SafeLogger.fcmRegistrationFailed(
          stage: stage, statusCode: error.statusCode, code: error.code);
    } else {
      SafeLogger.fcmRegistrationFailed(stage: stage);
    }
  }

  Future<void> logout() async {
    if (_loggingOut) return;
    _loggingOut = true;
    SafeLogger.logoutStarted();
    try {
      final initialization = _initializationInFlight;
      if (initialization != null) {
        try {
          await initialization;
        } catch (_) {
          // Initialization failures must never block logout.
        }
      }
      final inFlight = _registrationInFlight;
      if (inFlight != null) {
        try {
          await inFlight;
        } catch (_) {
          // Registration failures must never block logout.
        }
      }
      final token = _token;
      if (token != null && token.isNotEmpty) {
        SafeLogger.logoutDeviceTokenDeactivationStarted();
        try {
          if (_deviceTokenDeactivator != null) {
            await _deviceTokenDeactivator(token);
          } else {
            await _api.delete('/device-tokens', body: {'token': token});
          }
          SafeLogger.logoutDeviceTokenDeactivationCompleted();
        } catch (_) {
          SafeLogger.logoutDeviceTokenDeactivationFailed();
        }
      }
    } finally {
      try {
        if (_cancelNotifications != null) {
          await _cancelNotifications();
        } else if (_localNotificationsInitialized) {
          await _localNotifications.cancelAll();
        }
        await _effectiveHistoryStore.clearAll();
        SafeLogger.logoutNotificationCleanupCompleted();
      } catch (_) {
        SafeLogger.logoutNotificationCleanupFailed();
      }
      try {
        await dispose();
      } finally {
        SafeLogger.logoutCompleted();
        _loggingOut = false;
      }
    }
  }

  Future<void> clearConversationNotifications(String conversationId) async {
    if (_localNotificationsInitialized) {
      await _localNotifications
          .cancel(conversationNotificationId(conversationId));
    }
    await _effectiveHistoryStore.clearConversation(conversationId);
  }

  ConversationNotificationHistoryStore get _effectiveHistoryStore =>
      _historyStore ??= SharedPreferencesConversationNotificationHistoryStore();

  Future<void> dispose() async {
    await _tokenSubscription?.cancel();
    await _openedSubscription?.cancel();
    await _messageSubscription?.cancel();
    _tokenSubscription = null;
    _openedSubscription = null;
    _messageSubscription = null;
    _token = null;
    _initialized = false;
  }

  void _open(RemoteMessage message, ConversationDeepLink onConversation) {
    final conversationId = message.data['conversationId'];
    if (conversationId is String && conversationId.isNotEmpty) {
      onConversation(conversationId, message.data['notificationId'] as String?);
    }
  }
}
