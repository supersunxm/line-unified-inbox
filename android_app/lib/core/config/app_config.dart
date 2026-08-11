class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static Uri uri(String path, [Map<String, String>? query]) {
    if (apiBaseUrl.isEmpty) {
      throw StateError('API_BASE_URL must be provided with --dart-define');
    }
    final base = Uri.parse(apiBaseUrl);
    return base.replace(path: '${base.path}${path}', queryParameters: query);
  }
}
