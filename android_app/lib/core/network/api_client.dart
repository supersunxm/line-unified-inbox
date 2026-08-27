import 'dart:async';
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

enum _SessionRecoveryOutcome { recovered, temporaryFailure, terminalFailure }

class ApiClient {
  static const defaultRequestTimeout = Duration(seconds: 20);

  ApiClient(this._tokens,
      {http.Client? httpClient,
      ConnectivityService? connectivity,
      SessionExpiredHandler? onSessionExpired,
      Duration? requestTimeout})
      : _http = httpClient ?? http.Client(),
        _connectivity = connectivity ?? ConnectivityService(),
        _onSessionExpired = onSessionExpired,
        _requestTimeout = requestTimeout ?? defaultRequestTimeout;
  final TokenStore _tokens;
  final http.Client _http;
  final ConnectivityService _connectivity;
  final SessionExpiredHandler? _onSessionExpired;
  final Duration _requestTimeout;
  Future<_SessionRecoveryOutcome>? _refreshInFlight;

  Future<_SessionRecoveryOutcome> _recoverSession(
      String? failedAccessToken) async {
    MobileCredentials? current;
    try {
      current = await _tokens.readCredentials().timeout(_requestTimeout);
    } on TimeoutException {
      SafeLogger.sessionRefresh('temporary_failure', code: 'STORAGE_TIMEOUT');
      return _SessionRecoveryOutcome.temporaryFailure;
    } catch (_) {
      SafeLogger.sessionRefresh('temporary_failure', code: 'STORAGE_ERROR');
      return _SessionRecoveryOutcome.temporaryFailure;
    }
    if (current == null) return _SessionRecoveryOutcome.terminalFailure;
    if (failedAccessToken != null && current.accessToken != failedAccessToken) {
      return _SessionRecoveryOutcome.recovered;
    }
    if (current.refreshToken == null) {
      SafeLogger.forcedLogout('legacy_session_expired');
      await _onSessionExpired?.call();
      return _SessionRecoveryOutcome.terminalFailure;
    }
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final operation = _performRefresh(current);
    _refreshInFlight = operation;
    try {
      return await operation;
    } finally {
      if (identical(_refreshInFlight, operation)) _refreshInFlight = null;
    }
  }

  Future<_SessionRecoveryOutcome> _performRefresh(
      MobileCredentials credentials) async {
    SafeLogger.sessionRefresh('attempt');
    late http.Response response;
    try {
      response = await _http
          .post(AppConfig.uri('/auth/mobile/refresh'),
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: jsonEncode({'refreshToken': credentials.refreshToken}))
          .timeout(
            _requestTimeout,
          );
    } on TimeoutException {
      SafeLogger.sessionRefresh('temporary_failure', code: 'NETWORK_TIMEOUT');
      return _SessionRecoveryOutcome.temporaryFailure;
    } catch (_) {
      SafeLogger.sessionRefresh('temporary_failure', code: 'NETWORK_ERROR');
      return _SessionRecoveryOutcome.temporaryFailure;
    }
    Map<String, dynamic> decoded = <String, dynamic>{};
    try {
      final value = jsonDecode(response.body);
      if (value is Map<String, dynamic>) decoded = value;
    } catch (_) {}
    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        await _tokens
            .saveCredentials(MobileCredentials(
              accessToken: decoded['accessToken'] as String,
              refreshToken: decoded['refreshToken'] as String,
              accessExpiresAt:
                  DateTime.tryParse(decoded['expiresAt'] as String? ?? ''),
              refreshExpiresAt: DateTime.tryParse(
                  decoded['refreshExpiresAt'] as String? ?? ''),
            ))
            .timeout(_requestTimeout);
      } on TimeoutException {
        SafeLogger.sessionRefresh('temporary_failure', code: 'STORAGE_TIMEOUT');
        return _SessionRecoveryOutcome.temporaryFailure;
      } catch (_) {
        SafeLogger.sessionRefresh('temporary_failure', code: 'STORAGE_ERROR');
        return _SessionRecoveryOutcome.temporaryFailure;
      }
      SafeLogger.sessionRefresh('success');
      return _SessionRecoveryOutcome.recovered;
    }
    final code = decoded['code'] as String?;
    if (response.statusCode == 401 || code == 'SESSION_EXPIRED') {
      SafeLogger.sessionRefresh('terminal_failure',
          statusCode: response.statusCode, code: code);
      SafeLogger.forcedLogout('refresh_rejected');
      await _onSessionExpired?.call();
      return _SessionRecoveryOutcome.terminalFailure;
    } else {
      SafeLogger.sessionRefresh('temporary_failure',
          statusCode: response.statusCode, code: code);
    }
    return _SessionRecoveryOutcome.temporaryFailure;
  }

  Future<String?> _readAccessToken() async {
    try {
      return await _tokens.read().timeout(_requestTimeout);
    } on TimeoutException {
      SafeLogger.startupStage('secure_storage', 'timeout');
      throw ApiException(0, 'SECURE_STORAGE_TIMEOUT',
          'Secure storage is temporarily unavailable');
    } catch (_) {
      SafeLogger.startupStage('secure_storage', 'failed');
      throw ApiException(0, 'SECURE_STORAGE_ERROR',
          'Secure storage is temporarily unavailable');
    }
  }

  Future<http.Response> _sendAndRead(http.BaseRequest request) async {
    final stream = await _http.send(request).timeout(_requestTimeout);
    return http.Response.fromStream(stream).timeout(_requestTimeout);
  }

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

  Future<Uint8List> getBytes(String path,
      {bool authenticated = true, bool retry = true}) async {
    if (!await _isOnline()) {
      throw ApiException(0, 'OFFLINE', 'No network connection');
    }
    final headers = <String, String>{'Accept': '*/*'};
    if (authenticated) {
      final token = await _readAccessToken();
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
      response = await _sendAndRead(request);
    } on TimeoutException {
      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');
      throw ApiException(0, 'NETWORK_TIMEOUT', 'The service timed out');
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
      if (authenticated && error.sessionExpired && retry) {
        final recovery = await _recoverSession(
            headers['Authorization']?.replaceFirst('Bearer ', ''));
        if (recovery == _SessionRecoveryOutcome.temporaryFailure) {
          throw ApiException(
              0, 'SESSION_RECOVERY_TEMPORARY', 'Session recovery unavailable');
        }
        if (recovery == _SessionRecoveryOutcome.recovered) {
          return getBytes(path, authenticated: authenticated, retry: false);
        }
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
      bool authenticated = true,
      bool retry = true}) async {
    if (!await _isOnline()) {
      throw ApiException(0, 'OFFLINE', 'No network connection');
    }
    final request = http.MultipartRequest('POST', AppConfig.uri(path));
    if (authenticated) {
      final token = await _readAccessToken();
      if (token != null) request.headers['Authorization'] = 'Bearer $token';
    }
    request.fields['idempotencyKey'] = idempotencyKey;
    request.files.add(http.MultipartFile.fromBytes(field, bytes,
        filename: filename, contentType: _imageMediaType(mimeType, filename)));
    late http.Response response;
    try {
      response = await _sendAndRead(request);
    } on TimeoutException {
      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');
      throw ApiException(0, 'NETWORK_TIMEOUT', 'The service timed out');
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
      if (authenticated && error.sessionExpired && retry) {
        final recovery = await _recoverSession(
            request.headers['Authorization']?.replaceFirst('Bearer ', ''));
        if (recovery == _SessionRecoveryOutcome.temporaryFailure) {
          throw ApiException(
              0, 'SESSION_RECOVERY_TEMPORARY', 'Session recovery unavailable');
        }
        if (recovery == _SessionRecoveryOutcome.recovered) {
          return postMultipart(path,
              field: field,
              filename: filename,
              mimeType: mimeType,
              bytes: bytes,
              idempotencyKey: idempotencyKey,
              authenticated: authenticated,
              retry: false);
        }
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
      bool handleSessionExpiry = true,
      bool retry = true}) async {
    if (!await _isOnline()) {
      throw ApiException(0, 'OFFLINE', 'No network connection');
    }
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (authenticated) {
      final token = await _readAccessToken();
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
      response = await _sendAndRead(request);
    } on TimeoutException {
      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');
      throw ApiException(0, 'NETWORK_TIMEOUT', 'The service timed out');
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
      if (authenticated &&
          handleSessionExpiry &&
          error.sessionExpired &&
          retry) {
        final recovery = await _recoverSession(
            headers['Authorization']?.replaceFirst('Bearer ', ''));
        if (recovery == _SessionRecoveryOutcome.temporaryFailure) {
          throw ApiException(
              0, 'SESSION_RECOVERY_TEMPORARY', 'Session recovery unavailable');
        }
        if (recovery == _SessionRecoveryOutcome.recovered) {
          return _request(method, path,
              query: query,
              body: body,
              authenticated: authenticated,
              handleSessionExpiry: handleSessionExpiry,
              retry: false);
        }
      }
      throw error;
    }
    return decoded;
  }

  Future<bool> _isOnline() async {
    try {
      return await _connectivity.isOnline.timeout(_requestTimeout);
    } on TimeoutException {
      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');
      return false;
    } catch (_) {
      SafeLogger.networkFailure(code: 'NETWORK_ERROR');
      return false;
    }
  }
}
