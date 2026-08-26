import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/features/profile/widgets/settings_section.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Profile About shows the installed PackageInfo version/build',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
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
    ));

    expect(find.text('OPPO LINE OA Chat · v9.9.9+999'), findsOneWidget);
    expect(find.textContaining('1.0.6+7'), findsNothing);
  });
}
