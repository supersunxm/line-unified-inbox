import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:flutter/services.dart';
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
typedef NotificationPermissionLoader = Future<NotificationPermissionStatus>
    Function();
typedef NotificationPermissionRequester = Future<NotificationPermissionStatus>
    Function();
typedef NotificationSettingsOpener = Future<bool> Function();
typedef FcmTokenDeleter = Future<void> Function();
typedef FcmTokenRefreshStream = Stream<String> Function();

enum NotificationPermissionStatus {
  authorized,
  denied,
  notDetermined,
  unavailable,
}

enum NotificationReceivePath { foreground, background }

bool shouldDisplayLocalNotification({
  required NotificationReceivePath path,
  required bool hasSystemNotification,
}) =>
    path == NotificationReceivePath.foreground || !hasSystemNotification;

bool isDuplicateNotification({
  required ConversationNotificationHistory? history,
  required String messageId,
}) =>
    history?.messages.any((message) => message.messageId == messageId) ?? false;

String? notificationConversationId(Map<String, dynamic> data) {
  final value = data['conversationId'];
  return value is String && value.isNotEmpty ? value : null;
}

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
            final conversationId = notificationConversationId(decoded);
            if (conversationId != null) {
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

Future<void> _showRemoteNotification(
  RemoteMessage message, {
  NotificationReceivePath path = NotificationReceivePath.foreground,
}) async {
  if (!shouldDisplayLocalNotification(
      path: path, hasSystemNotification: message.notification != null)) {
    return;
  }
  final notificationId = message.data['notificationId'];
  final conversationId = message.data['conversationId'];
  final messageId = message.data['messageId'];
  final customerName = message.data['customerName'];
  final storeName = message.data['storeName'];
  final messageType = message.data['messageType'];
  final preview = message.data['preview'];
  final remoteTitle = message.data['title'];
  final remoteBody = message.data['body'];
  final sentAt = message.data['sentAt'];
  SafeLogger.fcmMessageReceived(
    hasNotificationId: notificationId is String && notificationId.isNotEmpty,
    hasConversationId: conversationId is String && conversationId.isNotEmpty,
    hasMessageId: messageId is String && messageId.isNotEmpty,
    notificationId: notificationId is String ? notificationId : null,
    conversationId: conversationId is String ? conversationId : null,
    messageId: messageId is String ? messageId : null,
    path: path.name,
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
    final title = remoteTitle is String && remoteTitle.trim().isNotEmpty
        ? normalizeNotificationText(remoteTitle,
            fallback: localizations.customer, maxLength: 180)
        : notificationTitle(
            customerName: customerName is String ? customerName : null,
            storeName: storeName is String ? storeName : null,
            fallbackCustomer: localizations.customer,
          );
    final body = remoteBody is String && remoteBody.trim().isNotEmpty
        ? normalizeNotificationText(
            remoteBody,
            fallback: localizations.unsupportedCustomerMessage,
          )
        : localizedNotificationPreview(
            localizations: localizations,
            messageType: messageType is String ? messageType : 'UNSUPPORTED',
            preview: preview is String ? preview : null,
          );
    await _initializeLocalNotifications();
    if (await _effectiveBackgroundHistory.contains(
        conversationId: conversationId, messageId: messageId)) {
      SafeLogger.fcmDuplicateSuppressed();
      return;
    }
    final history = await _effectiveBackgroundHistory.append(
      conversationId: conversationId,
      customerName: customerName is String && customerName.trim().isNotEmpty
          ? customerName
          : localizations.customer,
      message: ConversationNotificationMessage(
        messageId: messageId,
        preview: body,
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
      title,
      body,
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
            conversationTitle: title,
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
  SafeLogger.fcmReceivePath(NotificationReceivePath.background.name);
  final notificationId = message.data['notificationId'];
  final conversationId = message.data['conversationId'];
  final messageId = message.data['messageId'];
  SafeLogger.fcmMessageReceived(
    hasNotificationId: notificationId is String && notificationId.isNotEmpty,
    hasConversationId: conversationId is String && conversationId.isNotEmpty,
    hasMessageId: messageId is String && messageId.isNotEmpty,
    notificationId: notificationId is String ? notificationId : null,
    conversationId: conversationId is String ? conversationId : null,
    messageId: messageId is String ? messageId : null,
    path: NotificationReceivePath.background.name,
  );
  if (!shouldDisplayLocalNotification(
      path: NotificationReceivePath.background,
      hasSystemNotification: message.notification != null)) {
    return;
  }
  await _ensureFirebaseInitialized();
  await _showRemoteNotification(message,
      path: NotificationReceivePath.background);
}

class NotificationService {
  NotificationService(this._api, this._tokens,
      {FcmTokenLoader? tokenLoader,
      DeviceTokenRegistrar? tokenRegistrar,
      AuthenticationChecker? authenticationChecker,
      DeviceTokenDeactivator? deviceTokenDeactivator,
      NotificationCleanup? cancelNotifications,
      ConversationNotificationHistoryStore? historyStore,
      NotificationPermissionLoader? permissionLoader,
      NotificationPermissionRequester? permissionRequester,
      NotificationSettingsOpener? settingsOpener,
      FcmTokenDeleter? tokenDeleter,
      FcmTokenRefreshStream? tokenRefreshStream})
      : _tokenLoader = tokenLoader,
        _tokenRegistrar = tokenRegistrar,
        _authenticationChecker = authenticationChecker,
        _deviceTokenDeactivator = deviceTokenDeactivator,
        _cancelNotifications = cancelNotifications,
        _historyStore = historyStore,
        _permissionLoader = permissionLoader,
        _permissionRequester = permissionRequester,
        _settingsOpener = settingsOpener,
        _tokenDeleter = tokenDeleter,
        _tokenRefreshStream = tokenRefreshStream;

  final ApiClient _api;
  final TokenStore _tokens;
  final FcmTokenLoader? _tokenLoader;
  final DeviceTokenRegistrar? _tokenRegistrar;
  final AuthenticationChecker? _authenticationChecker;
  final DeviceTokenDeactivator? _deviceTokenDeactivator;
  final NotificationCleanup? _cancelNotifications;
  final NotificationPermissionLoader? _permissionLoader;
  final NotificationPermissionRequester? _permissionRequester;
  final NotificationSettingsOpener? _settingsOpener;
  final FcmTokenDeleter? _tokenDeleter;
  final FcmTokenRefreshStream? _tokenRefreshStream;
  ConversationNotificationHistoryStore? _historyStore;
  String? _token;
  final Set<String> _registeredTokens = <String>{};
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  bool _initialized = false;
  bool _loggingOut = false;
  Future<void>? _initializationInFlight;
  Future<void>? _registrationInFlight;
  Future<void>? _tokenRefreshRegistrationInFlight;
  String? _pendingRefreshToken;
  NotificationPermissionStatus _permissionStatus =
      NotificationPermissionStatus.unavailable;

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
      final settings = await messaging.requestPermission();
      _permissionStatus =
          _permissionStatusFromFirebase(settings.authorizationStatus);
      final android = _localNotifications.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await android?.requestNotificationsPermission();
      _permissionStatus = await notificationPermissionStatus();
      SafeLogger.fcmPermissionStatus(_permissionStatus.name);
    } catch (error) {
      _logFailure('permission_request', error);
    }

    _tokenSubscription =
        (_tokenRefreshStream?.call() ?? messaging.onTokenRefresh)
            .listen((value) => unawaited(handleTokenRefresh(value)));
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
          final conversationId = notificationConversationId(decoded);
          if (conversationId != null) {
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

  Future<void> handleTokenRefresh(String value) async {
    final token = value.trim();
    if (token.isEmpty || _loggingOut) return;
    _token = token;
    _pendingRefreshToken = token;
    final inFlight = _tokenRefreshRegistrationInFlight;
    if (inFlight != null) {
      await inFlight;
      return;
    }
    final operation = _drainTokenRefreshes();
    _tokenRefreshRegistrationInFlight = operation;
    try {
      await operation;
    } finally {
      if (identical(_tokenRefreshRegistrationInFlight, operation)) {
        _tokenRefreshRegistrationInFlight = null;
      }
    }
  }

  Future<void> _drainTokenRefreshes() async {
    while (_pendingRefreshToken != null && !_loggingOut) {
      final token = _pendingRefreshToken!;
      _pendingRefreshToken = null;
      await _registerAuthenticatedToken(token);
    }
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
      _registeredTokens.add(token);
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
      if (_tokenRegistrar != null) {
        await _tokenRegistrar(token);
      } else {
        await _api.post('/device-tokens',
            body: {'token': token, 'platform': 'ANDROID'});
      }
      _registeredTokens.add(token);
      SafeLogger.fcmTokenRegistered();
    } catch (error) {
      _logFailure('device_token_request', error);
    }
  }

  Future<NotificationPermissionStatus> notificationPermissionStatus() async {
    if (_permissionLoader != null) {
      _permissionStatus = await _permissionLoader();
      return _permissionStatus;
    }
    try {
      final settings =
          await FirebaseMessaging.instance.getNotificationSettings();
      final firebaseStatus =
          _permissionStatusFromFirebase(settings.authorizationStatus);
      final enabled = await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.areNotificationsEnabled();
      _permissionStatus = enabled == false
          ? NotificationPermissionStatus.denied
          : firebaseStatus;
    } catch (_) {
      _permissionStatus = NotificationPermissionStatus.unavailable;
    }
    SafeLogger.fcmPermissionStatus(_permissionStatus.name);
    return _permissionStatus;
  }

  Future<NotificationPermissionStatus> requestNotificationPermission() async {
    if (_permissionRequester != null) {
      _permissionStatus = await _permissionRequester();
      return _permissionStatus;
    }
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      _permissionStatus =
          _permissionStatusFromFirebase(settings.authorizationStatus);
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      return await notificationPermissionStatus();
    } catch (_) {
      _permissionStatus = NotificationPermissionStatus.unavailable;
      return _permissionStatus;
    }
  }

  Future<bool> openNotificationSettings() async {
    if (_settingsOpener != null) return _settingsOpener();
    try {
      return await const MethodChannel(
                  'click.lineoppo.chat/notification_settings')
              .invokeMethod<bool>('openNotificationSettings') ??
          false;
    } catch (_) {
      return false;
    }
  }

  NotificationPermissionStatus _permissionStatusFromFirebase(
      AuthorizationStatus status) {
    switch (status) {
      case AuthorizationStatus.authorized:
      case AuthorizationStatus.provisional:
        return NotificationPermissionStatus.authorized;
      case AuthorizationStatus.denied:
        return NotificationPermissionStatus.denied;
      case AuthorizationStatus.notDetermined:
        return NotificationPermissionStatus.notDetermined;
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
      final tokenRefresh = _tokenRefreshRegistrationInFlight;
      if (tokenRefresh != null) {
        try {
          await tokenRefresh;
        } catch (_) {
          // Token refresh failures must never block logout.
        }
      }
      final token = _token ?? await _loadTokenForLogout();
      final tokens = <String>{
        ..._registeredTokens,
        if (token != null && token.isNotEmpty) token,
      };
      if (tokens.isNotEmpty) {
        SafeLogger.logoutDeviceTokenDeactivationStarted();
        try {
          for (final registeredToken in tokens) {
            if (_deviceTokenDeactivator != null) {
              await _deviceTokenDeactivator(registeredToken);
            } else {
              await _api
                  .delete('/device-tokens', body: {'token': registeredToken});
            }
          }
          SafeLogger.logoutDeviceTokenDeactivationCompleted();
        } catch (_) {
          SafeLogger.logoutDeviceTokenDeactivationFailed();
        } finally {
          if (_tokenDeleter != null) {
            try {
              await _tokenDeleter();
            } catch (_) {
              // Local Firebase deletion is best effort after backend cleanup.
            }
          } else if (_tokenLoader == null) {
            try {
              await FirebaseMessaging.instance.deleteToken();
            } catch (_) {
              // Local Firebase deletion is best effort after backend cleanup.
            }
          }
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

  Future<String?> _loadTokenForLogout() async {
    try {
      if (_tokenLoader != null) return await _tokenLoader();
      if (Firebase.apps.isEmpty) return null;
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
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
    _registeredTokens.clear();
    _initialized = false;
  }

  void _open(RemoteMessage message, ConversationDeepLink onConversation) {
    final conversationId = notificationConversationId(message.data);
    if (conversationId != null) {
      onConversation(conversationId, message.data['notificationId'] as String?);
    }
  }
}
