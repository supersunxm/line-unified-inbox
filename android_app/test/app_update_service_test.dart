import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/services/app_update_service.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppUpdateInfo', () {
    test('parses JSON correctly', () {
      final json = {
        'latestVersion': '1.0.5',
        'buildNumber': 6,
        'minimumSupportedVersion': '1.0.3',
        'minimumSupportedBuildNumber': 4,
        'forceUpdate': false,
        'apkUrl': 'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
        'apkSize': '57 MB',
        'sha256': '4068576a...',
        'releaseNotes': ['CRM improvements', 'Update system'],
      };

      final info = AppUpdateInfo.fromJson(json);

      expect(info.latestVersion, '1.0.5');
      expect(info.buildNumber, 6);
      expect(info.minimumSupportedVersion, '1.0.3');
      expect(info.minimumSupportedBuildNumber, 4);
      expect(info.forceUpdate, false);
      expect(info.apkSize, '57 MB');
      expect(info.releaseNotes.length, 2);
    });

    test('determines update availability by build number', () {
      const info = AppUpdateInfo(
        latestVersion: '1.0.5',
        buildNumber: 6,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: 'https://example.com/app.apk',
      );

      expect(info.isUpdateAvailable(5), true); // Older build 5 -> update available
      expect(info.isUpdateAvailable(6), false); // Same build 6 -> up to date
      expect(info.isUpdateAvailable(7), false); // Newer build 7 -> up to date
    });

    test('determines force update requirement', () {
      const normalUpdate = AppUpdateInfo(
        latestVersion: '1.0.5',
        buildNumber: 6,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: 'https://example.com/app.apk',
      );

      expect(normalUpdate.isForceUpdateRequired(5), false); // build 5 >= 4 -> optional
      expect(normalUpdate.isForceUpdateRequired(3), true); // build 3 < 4 -> force update

      const forcedUpdate = AppUpdateInfo(
        latestVersion: '1.0.5',
        buildNumber: 6,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: true,
        apkUrl: 'https://example.com/app.apk',
      );

      expect(forcedUpdate.isForceUpdateRequired(5), true); // forceUpdate flag true -> forced
    });
  });

  group('AppUpdateService UI Flow', () {
    testWidgets('shows optional update dialog when newer version is available', (tester) async {
      final updateService = AppUpdateService(ApiClient(TokenStore()));

      final testPackageInfo = PackageInfo(
        appName: 'OPPO LINE OA Chat',
        packageName: 'com.oppo.lineoahub',
        version: '1.0.4',
        buildNumber: '5',
      );

      const testUpdateInfo = AppUpdateInfo(
        latestVersion: '1.0.5',
        buildNumber: 6,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: 'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
        apkSize: '57.1 MB',
        releaseNotes: ['CRM enhancements', 'In-app update system'],
      );

      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () => updateService.checkForUpdates(
                  ctx,
                  overridePackageInfo: testPackageInfo,
                  overrideUpdateInfo: testUpdateInfo,
                ),
                child: const Text('Check'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Check'));
      await tester.pumpAndSettle();

      // Verify dialog is shown
      expect(find.text('New Version Available'), findsOneWidget);
      expect(find.textContaining('1.0.5+6'), findsOneWidget);
      expect(find.text('CRM enhancements'), findsOneWidget);
      expect(find.text('In-app update system'), findsOneWidget);
      expect(find.text('Later'), findsOneWidget);
      expect(find.text('Update Now'), findsOneWidget);

      // Dismiss dialog
      await tester.tap(find.text('Later'));
      await tester.pumpAndSettle();

      expect(find.text('New Version Available'), findsNothing);
    });

    testWidgets('shows non-dismissible force update dialog when below minimum version', (tester) async {
      final updateService = AppUpdateService(ApiClient(TokenStore()));

      final oldPackageInfo = PackageInfo(
        appName: 'OPPO LINE OA Chat',
        packageName: 'com.oppo.lineoahub',
        version: '1.0.2',
        buildNumber: '3', // Below minimumSupportedBuildNumber 4
      );

      const forcedUpdateInfo = AppUpdateInfo(
        latestVersion: '1.0.5',
        buildNumber: 6,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: 'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
        apkSize: '57.1 MB',
        releaseNotes: ['Critical security and CRM upgrade'],
      );

      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () => updateService.checkForUpdates(
                  ctx,
                  overridePackageInfo: oldPackageInfo,
                  overrideUpdateInfo: forcedUpdateInfo,
                ),
                child: const Text('Check'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Check'));
      await tester.pumpAndSettle();

      // Verify Forced Update dialog
      expect(find.text('Update Required'), findsOneWidget);
      expect(find.text('Later'), findsNothing); // No "Later" button for forced update
      expect(find.text('Update Now'), findsOneWidget);
    });

    testWidgets('shows already up to date SnackBar on manual check', (tester) async {
      final updateService = AppUpdateService(ApiClient(TokenStore()));

      final currentPackageInfo = PackageInfo(
        appName: 'OPPO LINE OA Chat',
        packageName: 'com.oppo.lineoahub',
        version: '1.0.5',
        buildNumber: '6',
      );

      const latestUpdateInfo = AppUpdateInfo(
        latestVersion: '1.0.5',
        buildNumber: 6,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: 'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
      );

      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () => updateService.checkForUpdates(
                  ctx,
                  isManual: true,
                  overridePackageInfo: currentPackageInfo,
                  overrideUpdateInfo: latestUpdateInfo,
                ),
                child: const Text('Check'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Check'));
      await tester.pumpAndSettle();

      // Verify no dialog, but SnackBar shows up
      expect(find.text('New Version Available'), findsNothing);
      expect(find.textContaining('You are using the latest version'), findsOneWidget);
    });

    testWidgets('installed v1.0.5 (build 6) detects v1.0.6 (build 7) and triggers update dialog', (tester) async {
      final updateService = AppUpdateService(ApiClient(TokenStore()));

      final v105PackageInfo = PackageInfo(
        appName: 'OPPO LINE OA Chat',
        packageName: 'com.oppo.lineoahub',
        version: '1.0.5',
        buildNumber: '6',
      );

      const v106UpdateInfo = AppUpdateInfo(
        latestVersion: '1.0.6',
        buildNumber: 7,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: 'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.6-production.apk',
        apkSize: '56.9 MB',
        releaseNotes: [
          'Product selection UX improvement',
          'Explicit select confirmation',
          'Improved CRM tagging accuracy',
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () => updateService.checkForUpdates(
                  ctx,
                  overridePackageInfo: v105PackageInfo,
                  overrideUpdateInfo: v106UpdateInfo,
                ),
                child: const Text('Check'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Check'));
      await tester.pumpAndSettle();

      // Verify New Version Available dialog with v1.0.6+7 details
      expect(find.text('New Version Available'), findsOneWidget);
      expect(find.textContaining('1.0.6+7'), findsOneWidget);
      expect(find.text('Product selection UX improvement'), findsOneWidget);
      expect(find.text('Explicit select confirmation'), findsOneWidget);
      expect(find.text('Improved CRM tagging accuracy'), findsOneWidget);
      expect(find.text('Update Now'), findsOneWidget);
      expect(find.text('Later'), findsOneWidget);
    });
  });
}
