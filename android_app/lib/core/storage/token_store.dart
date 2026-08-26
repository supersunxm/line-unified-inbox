import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class MobileCredentials {
  const MobileCredentials(
      {required this.accessToken,
      this.refreshToken,
      this.accessExpiresAt,
      this.refreshExpiresAt});
  final String accessToken;
  final String? refreshToken;
  final DateTime? accessExpiresAt;
  final DateTime? refreshExpiresAt;

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        if (refreshToken != null) 'refreshToken': refreshToken,
        if (accessExpiresAt != null)
          'accessExpiresAt': accessExpiresAt!.toIso8601String(),
        if (refreshExpiresAt != null)
          'refreshExpiresAt': refreshExpiresAt!.toIso8601String(),
      };

  factory MobileCredentials.fromJson(Map<String, dynamic> json) =>
      MobileCredentials(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String?,
        accessExpiresAt:
            DateTime.tryParse(json['accessExpiresAt'] as String? ?? ''),
        refreshExpiresAt:
            DateTime.tryParse(json['refreshExpiresAt'] as String? ?? ''),
      );
}

class TokenStore {
  TokenStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'mobile_access_token';
  static const _credentialsKey = 'mobile_credentials_v2';
  final FlutterSecureStorage _storage;

  Future<MobileCredentials?> readCredentials() async {
    final encoded = await _storage.read(key: _credentialsKey);
    if (encoded != null) {
      try {
        return MobileCredentials.fromJson(
            jsonDecode(encoded) as Map<String, dynamic>);
      } catch (_) {
        return null;
      }
    }
    final legacy = await _storage.read(key: _key);
    return legacy == null ? null : MobileCredentials(accessToken: legacy);
  }

  Future<String?> read() async => (await readCredentials())?.accessToken;
  Future<void> save(String token) =>
      saveCredentials(MobileCredentials(accessToken: token));
  Future<void> saveCredentials(MobileCredentials credentials) async {
    // One secure-storage value is the atomic unit: readers can never observe a
    // new access token paired with an old rotating refresh token.
    await _storage.write(
        key: _credentialsKey, value: jsonEncode(credentials.toJson()));
    await _storage.delete(key: _key);
  }

  Future<void> clear() async {
    await _storage.delete(key: _credentialsKey);
    await _storage.delete(key: _key);
  }
}
