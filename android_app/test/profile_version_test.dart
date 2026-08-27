import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/features/profile/widgets/installed_app_version.dart';
import 'package:line_oa_chat_hub/features/profile/widgets/settings_section.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Profile About shows the installed PackageInfo version/build', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SettingsSection(
            packageInfo: PackageInfo(
              appName: 'OPPO LINE OA Chat',
              packageName: 'click.lineoppo.chat',
              version: '9.9.9',
              buildNumber: '999',
            ),
          ),
        ),
      ),
    );

    expect(find.text('OPPO LINE OA Chat · v9.9.9+999'), findsOneWidget);
    expect(find.textContaining('1.0.6+7'), findsNothing);
  });

  test('installed version formatter never uses backend release metadata', () {
    final packageInfo = PackageInfo(
      appName: 'OPPO LINE OA Chat',
      packageName: 'click.lineoppo.chat',
      version: '1.1.1',
      buildNumber: '21',
    );

    expect(
      formatInstalledAppVersion(packageInfo),
      'OPPO LINE OA Chat · v1.1.1+21',
    );
    expect(formatInstalledAppVersion(packageInfo), isNot(contains('1.0.6')));
  });
}
