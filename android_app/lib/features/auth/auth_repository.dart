import '../../core/models/models.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_store.dart';

class AuthRepository {
  AuthRepository(this._api, this._tokens);
  final ApiClient _api;
  final TokenStore _tokens;

  Future<OtpChallenge> sendOtp(String phone) async {
    final result = await _api.post('/auth/mobile/send-otp',
        body: {'phone': phone}, authenticated: false);
    return OtpChallenge(result['challengeId'] as String,
        DateTime.parse(result['expiresAt'] as String));
  }

  Future<void> verifyOtp(String challengeId, String otp) async {
    final result = await _api.post('/auth/mobile/verify-otp',
        body: {'challengeId': challengeId, 'otp': otp}, authenticated: false);
    await _saveCredentials(result);
  }

  Future<void> login(String identifier, String password) async {
    final result = await _api.post('/auth/mobile/login',
        body: {'email': identifier.trim(), 'password': password},
        authenticated: false);
    await _saveCredentials(result);
  }

  Future<void> _saveCredentials(Map<String, dynamic> result) =>
      _tokens.saveCredentials(MobileCredentials(
        accessToken: result['accessToken'] as String,
        refreshToken: result['refreshToken'] as String?,
        accessExpiresAt:
            DateTime.tryParse(result['expiresAt'] as String? ?? ''),
        refreshExpiresAt:
            DateTime.tryParse(result['refreshExpiresAt'] as String? ?? ''),
      ));

  Future<void> changePassword(
      String currentPassword, String newPassword) async {
    await _api.post('/auth/change-password',
        body: {'currentPassword': currentPassword, 'newPassword': newPassword},
        handleSessionExpiry: false);
  }

  Future<List<Store>> stores() async {
    final result = await _api.get('/registration/stores', authenticated: false);
    final items = (result['stores'] as List<dynamic>?) ?? <dynamic>[];
    return items
        .map((item) => Store.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> register(
      {required String name,
      required String employeeId,
      required String email,
      required String storeId,
      required String role,
      required String password}) async {
    await _api.post('/registration/request',
        body: {
          'name': name,
          'employeeId': employeeId.trim(),
          'email': email.trim(),
          'storeId': storeId,
          'role': role,
          'password': password
        },
        authenticated: false);
  }

  Future<void> registerHq(
      {required String name,
      required String employeeId,
      required String email,
      required String password}) async {
    await _api.post('/registration/hq-request',
        body: {
          'name': name,
          'employeeId': employeeId.trim(),
          'email': email.trim(),
          'password': password
        },
        authenticated: false);
  }

  Future<List<PendingRegistration>> pendingRegistrations() async {
    final result = await _api.get('/admin/registrations/pending');
    final items = (result['registrations'] as List<dynamic>?) ?? <dynamic>[];
    return items
        .map((item) =>
            PendingRegistration.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<PendingHqRegistration>> pendingHqRegistrations() async {
    final result = await _api.get('/admin/registrations/hq-pending');
    final items = (result['registrations'] as List<dynamic>?) ?? <dynamic>[];
    return items
        .map((item) =>
            PendingHqRegistration.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<ApprovedHqAccount>> approvedHqRegistrations() async {
    final result = await _api.get('/admin/registrations/hq-approved');
    final items = (result['accounts'] as List<dynamic>?) ?? <dynamic>[];
    return items
        .map((item) => ApprovedHqAccount.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> approveRegistration(String id) =>
      _api.patch('/admin/registrations/$id/approve').then((_) {});
  Future<void> rejectRegistration(String id) =>
      _api.patch('/admin/registrations/$id/reject').then((_) {});
  Future<void> approveHqRegistration(String userId) =>
      _api.patch('/admin/registrations/hq-users/$userId/approve').then((_) {});
  Future<void> rejectHqRegistration(String userId) =>
      _api.patch('/admin/registrations/hq-users/$userId/reject').then((_) {});
  Future<void> deactivateHqAccount(String userId) => _api
      .patch('/admin/registrations/hq-users/$userId/deactivate')
      .then((_) {});
  Future<void> reactivateHqAccount(String userId) => _api
      .patch('/admin/registrations/hq-users/$userId/reactivate')
      .then((_) {});

  Future<CurrentUser> me() async =>
      CurrentUser.fromJson(await _api.get('/auth/me'));
  Future<void> logout() async {
    final credentials = await _tokens.readCredentials();
    try {
      await _api.post('/auth/mobile/logout',
          body: {
            if (credentials?.refreshToken != null)
              'refreshToken': credentials!.refreshToken,
          },
          handleSessionExpiry: false);
    } finally {
      await _tokens.clear();
    }
  }

  Future<bool> hasToken() async => (await _tokens.read()) != null;
}

class OtpChallenge {
  OtpChallenge(this.id, this.expiresAt);
  final String id;
  final DateTime expiresAt;
}

class PendingHqRegistration {
  PendingHqRegistration({
    required this.id,
    required this.displayName,
    required this.employeeId,
    required this.email,
    required this.createdAt,
  });

  factory PendingHqRegistration.fromJson(Map<String, dynamic> json) =>
      PendingHqRegistration(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        employeeId: json['employeeId'] as String?,
        email: json['email'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String displayName;
  final String? employeeId;
  final String email;
  final DateTime createdAt;
}

class ApprovedHqAccount {
  ApprovedHqAccount({
    required this.id,
    required this.displayName,
    required this.employeeId,
    required this.email,
    required this.status,
    required this.isActive,
    required this.createdAt,
    this.lastLoginAt,
  });

  factory ApprovedHqAccount.fromJson(Map<String, dynamic> json) =>
      ApprovedHqAccount(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        employeeId: json['employeeId'] as String?,
        email: json['email'] as String,
        status: json['status'] as String,
        isActive: json['isActive'] as bool? ?? false,
        createdAt: DateTime.parse(json['createdAt'] as String),
        lastLoginAt: json['lastLoginAt'] is String
            ? DateTime.tryParse(json['lastLoginAt'] as String)
            : null,
      );

  final String id;
  final String displayName;
  final String? employeeId;
  final String email;
  final String status;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? lastLoginAt;
}
