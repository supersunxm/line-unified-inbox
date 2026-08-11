import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient(this._tokens, {http.Client? httpClient}) : _http = httpClient ?? http.Client();
  final TokenStore _tokens;
  final http.Client _http;

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query, bool authenticated = true}) => _request('GET', path, query: query, authenticated: authenticated);
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body, bool authenticated = true}) => _request('POST', path, body: body, authenticated: authenticated);
  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body, bool authenticated = true}) => _request('PATCH', path, body: body, authenticated: authenticated);

  Future<Map<String, dynamic>> _request(String method, String path, {Map<String, String>? query, Map<String, dynamic>? body, bool authenticated = true}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (authenticated) {
      final token = await _tokens.read();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    final request = http.Request(method, AppConfig.uri(path, query))
      ..headers.addAll(headers)
      ..body = body == null ? '' : jsonEncode(body);
    final streamed = await _http.send(request);
    final response = await http.Response.fromStream(streamed);
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode, decoded['code'] as String?, decoded['message']?.toString() ?? 'Request failed');
    }
    return decoded;
  }
}
