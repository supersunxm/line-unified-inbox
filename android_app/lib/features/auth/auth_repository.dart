import '../../core/models/models.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_store.dart';

class AuthRepository {
  AuthRepository(this._api, this._tokens);
  final ApiClient _api;
  final TokenStore _tokens;

  Future<OtpChallenge> sendOtp(String phone) async {
    final result = await _api.post('/auth/mobile/send-otp', body: {'phone': phone}, authenticated: false);
    return OtpChallenge(result['challengeId'] as String, DateTime.parse(result['expiresAt'] as String));
  }

  Future<void> verifyOtp(String challengeId, String otp) async {
    final result = await _api.post('/auth/mobile/verify-otp', body: {'challengeId': challengeId, 'otp': otp}, authenticated: false);
    await _tokens.save(result['accessToken'] as String);
  }

  Future<CurrentUser> me() async => CurrentUser.fromJson(await _api.get('/auth/me'));
  Future<void> logout() async { try { await _api.post('/auth/mobile/logout'); } finally { await _tokens.clear(); } }
  Future<bool> hasToken() async => (await _tokens.read()) != null;
}

class OtpChallenge {
  OtpChallenge(this.id, this.expiresAt);
  final String id;
  final DateTime expiresAt;
}
