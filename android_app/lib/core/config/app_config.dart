import 'package:flutter/foundation.dart';

class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const appEnvironment = String.fromEnvironment('APP_ENV', defaultValue: 'development');

  static String get resolvedApiBaseUrl {
    if (apiBaseUrl.isNotEmpty) return apiBaseUrl;
    if (!kReleaseMode && appEnvironment == 'development') return 'http://10.0.2.2:3001';
    throw const AppConfigException('API_BASE_URL is required for production builds. Pass --dart-define=API_BASE_URL=https://your-backend.example');
  }

  static Uri uri(String path, [Map<String, String>? query]) {
    final base = Uri.parse(resolvedApiBaseUrl);
    return base.replace(path: '${base.path}$path', queryParameters: query);
  }
}

class AppConfigException implements Exception {
  const AppConfigException(this.message);
  final String message;
  @override String toString() => message;
}
