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

  Future<void> login(String identifier, String password) async {
    final result = await _api.post('/auth/mobile/login', body: {'email': identifier.trim(), 'password': password}, authenticated: false);
    await _tokens.save(result['accessToken'] as String);
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _api.post('/auth/change-password', body: {'currentPassword': currentPassword, 'newPassword': newPassword}, handleSessionExpiry: false);
  }

  Future<List<Store>> stores() async {
    final result = await _api.get('/registration/stores', authenticated: false);
    final items = (result['stores'] as List<dynamic>?) ?? <dynamic>[];
    return items.map((item) => Store.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> register({required String name, required String employeeId, required String email, required String storeId, required String role, required String password}) async {
    await _api.post('/registration/request', body: {'name': name, 'employeeId': employeeId.trim(), 'email': email.trim(), 'storeId': storeId, 'role': role, 'password': password}, authenticated: false);
  }

  Future<void> registerHq({required String name, required String employeeId, required String email, required String password}) async {
    await _api.post('/registration/hq-request', body: {'name': name, 'employeeId': employeeId.trim(), 'email': email.trim(), 'password': password}, authenticated: false);
  }

  Future<List<PendingRegistration>> pendingRegistrations() async {
    final result = await _api.get('/admin/registrations/pending');
    final items = (result['registrations'] as List<dynamic>?) ?? <dynamic>[];
    return items.map((item) => PendingRegistration.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> approveRegistration(String id) => _api.patch('/admin/registrations/$id/approve').then((_) {});
  Future<void> rejectRegistration(String id) => _api.patch('/admin/registrations/$id/reject').then((_) {});

  Future<CurrentUser> me() async => CurrentUser.fromJson(await _api.get('/auth/me'));
  Future<void> logout() async { try { await _api.post('/auth/mobile/logout'); } finally { await _tokens.clear(); } }
  Future<bool> hasToken() async => (await _tokens.read()) != null;
}

class OtpChallenge {
  OtpChallenge(this.id, this.expiresAt);
  final String id;
  final DateTime expiresAt;
}
