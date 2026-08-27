import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';
import '../../core/logging/safe_logger.dart';
import '../../core/storage/token_store.dart';

class RealtimeService {
  static const _connectionTimeout = Duration(seconds: 20);

  RealtimeService(this._tokens);
  final TokenStore _tokens;
  final _events = StreamController<Map<String, dynamic>>.broadcast();
  http.Client? _client;
  bool _running = false;
  int _retry = 0;
  Stream<Map<String, dynamic>> get events => _events.stream;

  Future<void> connect() async {
    if (_running) return;
    _running = true;
    while (_running) {
      try {
        final token = await _tokens.read().timeout(_connectionTimeout);
        if (token == null) {
          await Future<void>.delayed(const Duration(seconds: 2));
          continue;
        }
        final client = http.Client();
        _client = client;
        final request = http.Request('GET', AppConfig.uri('/realtime/events'))
          ..headers['Authorization'] = 'Bearer $token'
          ..headers['Accept'] = 'text/event-stream';
        final response = await client.send(request).timeout(_connectionTimeout);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw StateError('Realtime connection failed');
        }
        _retry = 0;
        String? eventType;
        await for (final line in response.stream
            .transform(utf8.decoder)
            .transform(const LineSplitter())) {
          if (line.startsWith('event:')) eventType = line.substring(6).trim();
          if (line.startsWith('data:')) {
            final data = jsonDecode(line.substring(5).trim());
            if (data is Map<String, dynamic>) {
              if (eventType != null) data['type'] = eventType;
              _events.add(data);
            }
            eventType = null;
          }
        }
        client.close();
      } catch (_) {
        SafeLogger.startupStage('realtime', 'connection_failed');
        _client?.close();
        if (!_running) break;
        final delay = Duration(seconds: 1 << (_retry.clamp(0, 5)));
        _retry += 1;
        await Future<void>.delayed(delay);
      }
    }
  }

  void disconnect() {
    _running = false;
    _client?.close();
    _client = null;
  }

  Future<void> dispose() async {
    disconnect();
    await _events.close();
  }
}
