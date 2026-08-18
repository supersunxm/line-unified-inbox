import 'dart:developer' as developer;
import 'package:flutter/foundation.dart';

class SafeLogger {
  const SafeLogger._();
  static void _write(String message) {
    developer.log(message, name: 'line_oa_chat_hub');
    debugPrint('[line_oa_chat_hub] $message');
  }

  static void networkFailure({int? statusCode, String? code}) =>
      _write('network request failed status=$statusCode code=$code');
  static void lifecycle(String event) => _write('lifecycle event=$event');
  static void fcmRegistrationStarted({required bool authenticated}) =>
      _write('fcm_registration_started authenticated=$authenticated');
  static void fcmTokenAvailable({required bool available}) =>
      _write('fcm_token_available available=$available');
  static void fcmRegistrationRequestStarted() =>
      _write('fcm_registration_request_started');
  static void fcmTokenRegistered() => _write('fcm_token_registered');
  static void fcmRegistrationSkipped(String reason) =>
      _write('fcm_registration_skipped reason=$reason');
  static void fcmRegistrationFailed(
          {required String stage, int? statusCode, String? code}) =>
      _write(
          'fcm_registration_failed stage=$stage status=$statusCode code=$code');
  static void fcmMessageReceived({
    required bool hasNotificationId,
    required bool hasConversationId,
    required bool hasMessageId,
  }) =>
      _write(
          'fcm_message_received notificationId=$hasNotificationId conversationId=$hasConversationId messageId=$hasMessageId');
  static void fcmBackgroundHandlerInvoked() =>
      _write('fcm_background_handler_invoked');
  static void fcmLocalNotificationShown() =>
      _write('fcm_local_notification_shown');
  static void fcmLocalNotificationFailed(String errorType) =>
      _write('fcm_local_notification_failed errorType=$errorType');
  static void conversationMarkReadFailed(String errorType) =>
      _write('conversation_mark_read_failed errorType=$errorType');
  static void conversationNotificationCleanupFailed(String errorType) =>
      _write('conversation_notification_cleanup_failed errorType=$errorType');
  static void logoutStarted() => _write('logout_started');
  static void logoutDeviceTokenDeactivationStarted() =>
      _write('logout_device_token_deactivation_started');
  static void logoutDeviceTokenDeactivationCompleted() =>
      _write('logout_device_token_deactivation_completed');
  static void logoutDeviceTokenDeactivationFailed() =>
      _write('logout_device_token_deactivation_failed');
  static void logoutNotificationCleanupCompleted() =>
      _write('logout_notification_cleanup_completed');
  static void logoutNotificationCleanupFailed() =>
      _write('logout_notification_cleanup_failed');
  static void logoutSessionCleared() => _write('logout_session_cleared');
  static void logoutCompleted() => _write('logout_completed');
  static void updateCheckFailed(String errorType) =>
      _write('update_check_failed errorType=$errorType');
  static void updateDownloadFailed(String errorType) =>
      _write('update_download_failed errorType=$errorType');
}
