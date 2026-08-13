import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';
import 'connectivity_service.dart';
import '../logging/safe_logger.dart';

typedef SessionExpiredHandler = Future<void> Function();

class ApiClient {
  ApiClient(this._tokens, {http.Client? httpClient, ConnectivityService? connectivity, SessionExpiredHandler? onSessionExpired}) : _http = httpClient ?? http.Client(), _connectivity = connectivity ?? ConnectivityService(), _onSessionExpired = onSessionExpired;
  final TokenStore _tokens;
  final http.Client _http;
  final ConnectivityService _connectivity;
  final SessionExpiredHandler? _onSessionExpired;

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query, bool authenticated = true}) => _request('GET', path, query: query, authenticated: authenticated);
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body, bool authenticated = true}) => _request('POST', path, body: body, authenticated: authenticated);
  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body, bool authenticated = true}) => _request('PATCH', path, body: body, authenticated: authenticated);

  Future<Uint8List> getBytes(String path, {bool authenticated = true}) async {
    if (!await _connectivity.isOnline) throw ApiException(0, 'OFFLINE', 'No network connection');
    final headers = <String, String>{'Accept': 'image/*'};
    if (authenticated) {
      final token = await _tokens.read();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    late http.Request request;
    try { request = http.Request('GET', AppConfig.uri(path)); }
    on AppConfigException catch (error) { throw ApiException(0, 'CONFIGURATION_ERROR', error.message); }
    request.headers.addAll(headers);
    late http.Response response;
    try { response = await http.Response.fromStream(await _http.send(request)); }
    catch (_) { throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service'); }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic> decoded = <String, dynamic>{};
      try { decoded = jsonDecode(response.body) as Map<String, dynamic>; } catch (_) {}
      final error = ApiException(response.statusCode, decoded['code'] as String?, decoded['message']?.toString() ?? 'Unable to load media');
      if (authenticated && error.sessionExpired) await _onSessionExpired?.call();
      throw error;
    }
    return response.bodyBytes;
  }

  Future<Map<String, dynamic>> _request(String method, String path, {Map<String, String>? query, Map<String, dynamic>? body, bool authenticated = true}) async {
    if (!await _connectivity.isOnline) throw ApiException(0, 'OFFLINE', 'No network connection');
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (authenticated) {
      final token = await _tokens.read();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    late final http.Request request;
    try {
      request = http.Request(method, AppConfig.uri(path, query));
    } on AppConfigException catch (error) {
      throw ApiException(0, 'CONFIGURATION_ERROR', error.message);
    }
    request
      ..headers.addAll(headers)
      ..body = body == null ? '' : jsonEncode(body);
    late http.Response response;
    try { response = await http.Response.fromStream(await _http.send(request)); }
    catch (_) { SafeLogger.networkFailure(code: 'NETWORK_ERROR'); throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service'); }
    Map<String, dynamic> decoded;
    try { decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>; }
    catch (_) { SafeLogger.networkFailure(statusCode: response.statusCode, code: 'INVALID_RESPONSE'); throw ApiException(response.statusCode, 'INVALID_RESPONSE', 'Service returned an invalid response'); }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = ApiException(response.statusCode, decoded['code'] as String?, decoded['message']?.toString() ?? 'Request failed');
      SafeLogger.networkFailure(statusCode: error.statusCode, code: error.code);
      if (authenticated && error.sessionExpired) await _onSessionExpired?.call();
      throw error;
    }
    return decoded;
  }
}
