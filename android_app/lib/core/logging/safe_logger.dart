import 'dart:developer' as developer;

class SafeLogger {
  const SafeLogger._();
  static void networkFailure({int? statusCode, String? code}) => developer.log('network request failed status=$statusCode code=$code', name: 'line_oa_chat_hub');
  static void lifecycle(String event) => developer.log('lifecycle event=$event', name: 'line_oa_chat_hub');
}
