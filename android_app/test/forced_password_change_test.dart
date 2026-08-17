import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/auth/auth_repository.dart';
import 'package:line_oa_chat_hub/features/auth/change_password_page.dart';

class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository() : super(ApiClient(TokenStore()), TokenStore());

  @override
  Future<void> changePassword(
      String currentPassword, String newPassword) async {}
}

void main() {
  test('CurrentUser reads the forced password change flag', () {
    final user = CurrentUser.fromJson({
      'id': 'user-1',
      'displayName': 'Test BM',
      'role': 'VIEWER',
      'mustChangePassword': true,
      'memberships': <dynamic>[],
      'stores': <dynamic>[],
      'permissions': <String, dynamic>{},
    });

    expect(user.mustChangePassword, isTrue);
    expect(
      CurrentUser.fromJson({
        'id': 'legacy',
        'displayName': 'Legacy',
        'role': 'VIEWER',
        'memberships': <dynamic>[],
        'stores': <dynamic>[],
        'permissions': <String, dynamic>{},
      }).mustChangePassword,
      isFalse,
    );
  });

  testWidgets('change password page exposes the localized forced-change form',
      (tester) async {
    var changed = false;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('th'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: ChangePasswordPage(
          auth: _FakeAuthRepository(),
          onChanged: () async => changed = true,
          onLogout: () {},
        ),
      ),
    );

    expect(find.text('เปลี่ยนรหัสผ่าน'), findsOneWidget);
    expect(find.text('รหัสผ่านปัจจุบัน'), findsOneWidget);
    expect(find.text('รหัสผ่านใหม่'), findsOneWidget);
    expect(find.text('ยืนยันรหัสผ่านใหม่'), findsOneWidget);
    expect(find.text('บันทึกรหัสผ่าน'), findsOneWidget);
    expect(find.textContaining('ความยาวอย่างน้อย 12 ตัวอักษร'), findsOneWidget);

    await tester.enterText(find.byType(TextField).at(0), 'temporary-password');
    await tester.enterText(find.byType(TextField).at(1), 'NewPassword123!');
    await tester.enterText(find.byType(TextField).at(2), 'NewPassword123!');
    await tester.tap(find.text('บันทึกรหัสผ่าน'));
    await tester.pumpAndSettle();

    expect(changed, isTrue);
  });
}
