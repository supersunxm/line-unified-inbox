import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';
import 'connectivity_service.dart';
import '../logging/safe_logger.dart';

typedef SessionExpiredHandler = Future<void> Function();

class ApiClient {
  ApiClient(this._tokens,
      {http.Client? httpClient,
      ConnectivityService? connectivity,
      SessionExpiredHandler? onSessionExpired})
      : _http = httpClient ?? http.Client(),
        _connectivity = connectivity ?? ConnectivityService(),
        _onSessionExpired = onSessionExpired;
  final TokenStore _tokens;
  final http.Client _http;
  final ConnectivityService _connectivity;
  final SessionExpiredHandler? _onSessionExpired;

  Future<Map<String, dynamic>> get(String path,
          {Map<String, String>? query, bool authenticated = true}) =>
      _request('GET', path, query: query, authenticated: authenticated);
  Future<Map<String, dynamic>> post(String path,
          {Map<String, dynamic>? body,
          bool authenticated = true,
          bool handleSessionExpiry = true}) =>
      _request('POST', path,
          body: body,
          authenticated: authenticated,
          handleSessionExpiry: handleSessionExpiry);
  Future<Map<String, dynamic>> patch(String path,
          {Map<String, dynamic>? body, bool authenticated = true}) =>
      _request('PATCH', path, body: body, authenticated: authenticated);
  Future<Map<String, dynamic>> delete(String path,
          {Map<String, dynamic>? body, bool authenticated = true}) =>
      _request('DELETE', path, body: body, authenticated: authenticated);

  Future<Uint8List> getBytes(String path, {bool authenticated = true}) async {
    if (!await _connectivity.isOnline) {
      throw ApiException(0, 'OFFLINE', 'No network connection');
    }
    final headers = <String, String>{'Accept': '*/*'};
    if (authenticated) {
      final token = await _tokens.read();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    late http.Request request;
    try {
      request = http.Request('GET', AppConfig.uri(path));
    } on AppConfigException catch (error) {
      throw ApiException(0, 'CONFIGURATION_ERROR', error.message);
    }
    request.headers.addAll(headers);
    late http.Response response;
    try {
      response = await http.Response.fromStream(await _http.send(request));
    } catch (_) {
      throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic> decoded = <String, dynamic>{};
      try {
        final parsed = jsonDecode(response.body);
        if (parsed is Map<String, dynamic>) decoded = parsed;
      } catch (_) {}
      final error = ApiException(
          response.statusCode,
          decoded['code'] as String?,
          _extractErrorMessage(response.statusCode, decoded, response.body));
      if (authenticated && error.sessionExpired) {
        await _onSessionExpired?.call();
      }
      throw error;
    }
    return response.bodyBytes;
  }

  Future<Map<String, dynamic>> postMultipart(String path,
      {required String field,
      required String filename,
      String? mimeType,
      required Uint8List bytes,
      required String idempotencyKey,
      bool authenticated = true}) async {
    if (!await _connectivity.isOnline) {
      throw ApiException(0, 'OFFLINE', 'No network connection');
    }
    final request = http.MultipartRequest('POST', AppConfig.uri(path));
    if (authenticated) {
      final token = await _tokens.read();
      if (token != null) request.headers['Authorization'] = 'Bearer $token';
    }
    request.fields['idempotencyKey'] = idempotencyKey;
    request.files.add(http.MultipartFile.fromBytes(field, bytes,
        filename: filename, contentType: _imageMediaType(mimeType, filename)));
    late http.Response response;
    try {
      response = await http.Response.fromStream(await _http.send(request));
    } catch (_) {
      SafeLogger.networkFailure(code: 'NETWORK_ERROR');
      throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');
    }
    Map<String, dynamic> decoded = <String, dynamic>{};
    if (response.body.isNotEmpty) {
      try {
        final parsed = jsonDecode(response.body);
        if (parsed is Map<String, dynamic>) decoded = parsed;
      } catch (_) {
        // Non-JSON response body (e.g. gateway error or plain text)
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = ApiException(
          response.statusCode,
          decoded['code'] as String?,
          _extractErrorMessage(response.statusCode, decoded, response.body));
      SafeLogger.networkFailure(statusCode: error.statusCode, code: error.code);
      if (authenticated && error.sessionExpired) {
        await _onSessionExpired?.call();
      }
      throw error;
    }
    return decoded;
  }

  MediaType? _imageMediaType(String? mimeType, String filename) {
    final supplied = mimeType?.toLowerCase().split(';').first.trim();
    const supported = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'};
    final value = supplied != null && supported.contains(supplied)
        ? supplied
        : switch (filename.toLowerCase().split('.').last) {
            'jpg' || 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            _ => null,
          };
    if (value == null) return null;
    final parts = value.split('/');
    return MediaType(parts[0], parts[1]);
  }

  String _extractErrorMessage(
      int statusCode, Map<String, dynamic> decoded, String rawBody) {
    final msg = decoded['message'];
    if (msg is String && msg.trim().isNotEmpty) return msg.trim();
    if (msg is List && msg.isNotEmpty) {
      final joined = msg
          .map((e) => e.toString())
          .where((s) => s.trim().isNotEmpty)
          .join(', ');
      if (joined.isNotEmpty) return joined;
    }
    final error = decoded['error'];
    if (error is String && error.trim().isNotEmpty) return error.trim();
    if (statusCode == 413) return 'Image file is too large to upload';
    if (statusCode == 401) return 'Session expired, please log in again';
    if (statusCode == 403) {
      return 'You do not have permission to perform this action';
    }
    if (statusCode == 404) return 'Conversation not found';
    if (statusCode == 502 || statusCode == 503 || statusCode == 504) {
      return 'Service is temporarily unavailable, please try again';
    }
    if (rawBody.isNotEmpty &&
        rawBody.length < 200 &&
        !rawBody.contains('<html') &&
        !rawBody.contains('<!DOCTYPE')) {
      return rawBody.trim();
    }
    return 'Request failed ($statusCode)';
  }

  Future<Map<String, dynamic>> _request(String method, String path,
      {Map<String, String>? query,
      Map<String, dynamic>? body,
      bool authenticated = true,
      bool handleSessionExpiry = true}) async {
    if (!await _connectivity.isOnline) {
      throw ApiException(0, 'OFFLINE', 'No network connection');
    }
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
    try {
      response = await http.Response.fromStream(await _http.send(request));
    } catch (_) {
      SafeLogger.networkFailure(code: 'NETWORK_ERROR');
      throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');
    }
    Map<String, dynamic> decoded = <String, dynamic>{};
    if (response.body.isNotEmpty) {
      try {
        final parsed = jsonDecode(response.body);
        if (parsed is Map<String, dynamic>) decoded = parsed;
      } catch (_) {
        // Non-JSON response
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = ApiException(
          response.statusCode,
          decoded['code'] as String?,
          _extractErrorMessage(response.statusCode, decoded, response.body));
      SafeLogger.networkFailure(statusCode: error.statusCode, code: error.code);
      if (authenticated && handleSessionExpiry && error.sessionExpired) {
        await _onSessionExpired?.call();
      }
      throw error;
    }
    return decoded;
  }
}
