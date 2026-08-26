import 'dart:async';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/network/connectivity_service.dart';
import 'package:line_oa_chat_hub/core/services/app_update_service.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';

class _OnlineConnectivity extends ConnectivityService {
  @override
  Future<bool> get isOnline async => true;
}

List<int> _apkPayload() => List<int>.generate(4096, (index) => index % 251);

AppUpdateInfo _downloadableInfo(List<int> payload) => AppUpdateInfo(
      latestVersion: '1.0.18',
      buildNumber: 19,
      minimumSupportedVersion: '1.0.3',
      minimumSupportedBuildNumber: 4,
      forceUpdate: false,
      apkUrl: 'https://lineoppo.click/downloads/update.apk',
      sha256: sha256.convert(payload).toString(),
    );

Future<Directory> _testCacheDirectory(String name) async {
  final directory = Directory('test/.update-cache-$name');
  if (directory.existsSync()) directory.deleteSync(recursive: true);
  directory.createSync(recursive: true);
  return directory;
}

ApiClient _trackingApi() => ApiClient(
      TokenStore(),
      connectivity: _OnlineConnectivity(),
      httpClient: MockClient((_) async => http.Response('{}', 200)),
    );

class _StartOnlyUpdateService extends AppUpdateService {
  _StartOnlyUpdateService() : super(ApiClient(TokenStore()));

  var started = false;

  @override
  Future<UpdateFlowResult> downloadAndInstallApk(
    AppUpdateInfo info, {
    UpdateProgressCallback? onProgress,
  }) async {
    started = true;
    onProgress?.call(const UpdateProgress(
      UpdateProgressStatus.downloading,
      fraction: 0.25,
    ));
    return UpdateFlowResult.installed;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  group('AppUpdateInfo', () {
    test('parses JSON correctly', () {
      final json = {
        'latestVersion': '1.0.5',
        'buildNumber': 6,
        'minimumSupportedVersion': '1.0.3',
        'minimumSupportedBuildNumber': 4,
        'forceUpdate': false,
        'apkUrl':
            'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
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

      expect(
          info.isUpdateAvailable(5), true); // Older build 5 -> update available
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

      expect(normalUpdate.isForceUpdateRequired(5),
          false); // build 5 >= 4 -> optional
      expect(normalUpdate.isForceUpdateRequired(3),
          true); // build 3 < 4 -> force update

      const forcedUpdate = AppUpdateInfo(
        latestVersion: '1.0.5',
        buildNumber: 6,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: true,
        apkUrl: 'https://example.com/app.apk',
      );

      expect(forcedUpdate.isForceUpdateRequired(5),
          true); // forceUpdate flag true -> forced
    });
  });

  group('AppUpdateService UI Flow', () {
    testWidgets('shows optional update dialog when newer version is available',
        (tester) async {
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
        apkUrl:
            'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
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

    testWidgets(
        'shows non-dismissible force update dialog when below minimum version',
        (tester) async {
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
        apkUrl:
            'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
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
      expect(find.text('Later'),
          findsNothing); // No "Later" button for forced update
      expect(find.text('Update Now'), findsOneWidget);
    });

    testWidgets('shows already up to date SnackBar on manual check',
        (tester) async {
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
        apkUrl:
            'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
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
      expect(find.textContaining('You are using the latest version'),
          findsOneWidget);
    });

    testWidgets(
        'installed v1.0.16 (build 17) detects v1.0.17 (build 18) and shows the production APK',
        (tester) async {
      final updateService = AppUpdateService(ApiClient(TokenStore()));

      final v105PackageInfo = PackageInfo(
        appName: 'OPPO LINE OA Chat',
        packageName: 'com.oppo.lineoahub',
        version: '1.0.16',
        buildNumber: '17',
      );

      const v106UpdateInfo = AppUpdateInfo(
        latestVersion: '1.0.17',
        buildNumber: 18,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl:
            'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.17-production.apk',
        apkSize: '58.0 MB',
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
      expect(find.textContaining('1.0.17+18'), findsOneWidget);
      expect(find.text('Product selection UX improvement'), findsOneWidget);
      expect(find.text('Explicit select confirmation'), findsOneWidget);
      expect(find.text('Improved CRM tagging accuracy'), findsOneWidget);
      expect(find.text('Update Now'), findsOneWidget);
      expect(find.text('Later'), findsOneWidget);
    });

    testWidgets('installed v1.0.17 build 18 reports up to date',
        (tester) async {
      final updateService = AppUpdateService(ApiClient(TokenStore()));
      final current = PackageInfo(
          appName: 'OPPO LINE OA Chat',
          packageName: 'click.lineoppo.chat',
          version: '1.0.17',
          buildNumber: '18');
      const latest = AppUpdateInfo(
          latestVersion: '1.0.17',
          buildNumber: 18,
          minimumSupportedVersion: '1.0.3',
          minimumSupportedBuildNumber: 4,
          forceUpdate: false,
          apkUrl:
              'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.17-production.apk');
      await tester.pumpWidget(MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
              builder: (context) => Scaffold(
                  body: ElevatedButton(
                      onPressed: () => updateService.checkForUpdates(context,
                          isManual: true,
                          overridePackageInfo: current,
                          overrideUpdateInfo: latest),
                      child: const Text('Check current'))))));
      await tester.tap(find.text('Check current'));
      await tester.pumpAndSettle();
      expect(find.textContaining('You are using the latest version'),
          findsOneWidget);
      expect(find.textContaining('1.0.17+18'), findsOneWidget);
      expect(find.text('New Version Available'), findsNothing);
    });

    testWidgets(
        'update metadata network failure is recoverable and preserves session',
        (tester) async {
      final tokens = TokenStore();
      await tokens.saveCredentials(const MobileCredentials(
          accessToken: 'access', refreshToken: 'refresh'));
      final updateService = AppUpdateService(ApiClient(tokens,
          connectivity: _OnlineConnectivity(),
          httpClient: MockClient(
              (_) async => throw http.ClientException('temporary outage'))));
      final current = PackageInfo(
          appName: 'OPPO LINE OA Chat',
          packageName: 'click.lineoppo.chat',
          version: '1.0.16',
          buildNumber: '17');
      await tester.pumpWidget(MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
              builder: (context) => Scaffold(
                  body: ElevatedButton(
                      onPressed: () => updateService.checkForUpdates(context,
                          isManual: true, overridePackageInfo: current),
                      child: const Text('Check network'))))));
      await tester.tap(find.text('Check network'));
      await tester.pumpAndSettle();
      expect(
          find.textContaining('Unable to check for updates'), findsOneWidget);
      expect((await tokens.readCredentials())?.refreshToken, 'refresh');
      expect(find.text('New Version Available'), findsNothing);
    });

    testWidgets('tapping Update Now starts the APK download immediately',
        (tester) async {
      final service = _StartOnlyUpdateService();
      const info = AppUpdateInfo(
        latestVersion: '1.0.18',
        buildNumber: 19,
        minimumSupportedVersion: '1.0.3',
        minimumSupportedBuildNumber: 4,
        forceUpdate: false,
        apkUrl: 'https://lineoppo.click/downloads/update.apk',
      );
      await tester.pumpWidget(MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () => service.checkForUpdates(
                context,
                overridePackageInfo: PackageInfo(
                  appName: 'OPPO LINE OA Chat',
                  packageName: 'click.lineoppo.chat',
                  version: '1.0.17',
                  buildNumber: '18',
                ),
                overrideUpdateInfo: info,
              ),
              child: const Text('Check'),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('Check'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Update Now'));
      await tester.pump();
      expect(service.started, true);
      expect(find.textContaining('Downloading APK'), findsOneWidget);
    });

    test('successful checksum verification reaches the installer', () async {
      final payload = _apkPayload();
      final temporaryDirectory = await _testCacheDirectory('update-success');
      addTearDown(() => temporaryDirectory.delete(recursive: true));
      String? installedPath;
      final service = AppUpdateService(
        _trackingApi(),
        downloadClient:
            MockClient((_) async => http.Response.bytes(payload, 200)),
        cacheDirectoryProvider: () => Future.value(temporaryDirectory),
        installer: (path) async {
          installedPath = path;
          return ApkInstallResult.launched;
        },
      );
      final statuses = <UpdateProgressStatus>[];
      final result = await service.downloadAndInstallApk(
        _downloadableInfo(payload),
        onProgress: (progress) => statuses.add(progress.status),
      );
      expect(result, UpdateFlowResult.installed);
      expect(File(installedPath!).existsSync(), true);
      expect(
          statuses,
          containsAll(<UpdateProgressStatus>[
            UpdateProgressStatus.preparing,
            UpdateProgressStatus.downloading,
            UpdateProgressStatus.verifying,
            UpdateProgressStatus.readyToInstall,
            UpdateProgressStatus.installing,
          ]));
    });

    test('checksum mismatch blocks installation and removes the temporary APK',
        () async {
      final payload = _apkPayload();
      final temporaryDirectory = await _testCacheDirectory('update-checksum');
      addTearDown(() => temporaryDirectory.delete(recursive: true));
      var installerCalled = false;
      final service = AppUpdateService(
        _trackingApi(),
        downloadClient:
            MockClient((_) async => http.Response.bytes(payload, 200)),
        cacheDirectoryProvider: () => Future.value(temporaryDirectory),
        installer: (_) async {
          installerCalled = true;
          return ApkInstallResult.launched;
        },
      );
      final statuses = <UpdateProgressStatus>[];
      final result = await service.downloadAndInstallApk(
        _downloadableInfo(<int>[1, 2, 3]),
        onProgress: (progress) => statuses.add(progress.status),
      );
      expect(result, UpdateFlowResult.checksumFailed);
      expect(installerCalled, false);
      expect(statuses, contains(UpdateProgressStatus.checksumFailed));
      expect(temporaryDirectory.listSync(), isEmpty);
    });

    test('download/network failure shows an error state and does not install',
        () async {
      final temporaryDirectory = await _testCacheDirectory('update-network');
      addTearDown(() => temporaryDirectory.delete(recursive: true));
      var installerCalled = false;
      final service = AppUpdateService(
        _trackingApi(),
        downloadClient:
            MockClient((_) async => throw const SocketException('offline')),
        cacheDirectoryProvider: () => Future.value(temporaryDirectory),
        installer: (_) async {
          installerCalled = true;
          return ApkInstallResult.launched;
        },
      );
      final statuses = <UpdateProgressStatus>[];
      final result = await service.downloadAndInstallApk(
        _downloadableInfo(_apkPayload()),
        onProgress: (progress) => statuses.add(progress.status),
      );
      expect(result, UpdateFlowResult.downloadFailed);
      expect(installerCalled, false);
      expect(statuses, contains(UpdateProgressStatus.downloadFailed));
    });

    test(
        'permission-required installer opens settings and retry reuses verified APK',
        () async {
      final payload = _apkPayload();
      final temporaryDirectory = await _testCacheDirectory('update-permission');
      addTearDown(() => temporaryDirectory.delete(recursive: true));
      var requestCount = 0;
      var attempts = 0;
      final service = AppUpdateService(
        _trackingApi(),
        downloadClient: MockClient((_) async {
          requestCount++;
          return http.Response.bytes(payload, 200);
        }),
        cacheDirectoryProvider: () => Future.value(temporaryDirectory),
        installer: (_) async {
          attempts++;
          return attempts == 1
              ? ApkInstallResult.permissionRequired
              : ApkInstallResult.launched;
        },
      );
      final info = _downloadableInfo(payload);
      final first = await service.downloadAndInstallApk(info);
      final second = await service.downloadAndInstallApk(info);
      expect(first, UpdateFlowResult.permissionRequired);
      expect(second, UpdateFlowResult.installed);
      expect(requestCount, 1);
      expect(attempts, 2);
    });

    test('repeated taps share one in-flight download', () async {
      final payload = _apkPayload();
      final gate = Completer<void>();
      final temporaryDirectory =
          await _testCacheDirectory('update-single-flight');
      addTearDown(() => temporaryDirectory.delete(recursive: true));
      var requestCount = 0;
      final service = AppUpdateService(
        _trackingApi(),
        downloadClient: MockClient((_) async {
          requestCount++;
          await gate.future;
          return http.Response.bytes(payload, 200);
        }),
        cacheDirectoryProvider: () => Future.value(temporaryDirectory),
        installer: (_) async => ApkInstallResult.launched,
      );
      final info = _downloadableInfo(payload);
      final first = service.downloadAndInstallApk(info);
      final second = service.downloadAndInstallApk(info);
      await Future<void>.delayed(Duration.zero);
      expect(requestCount, 1);
      gate.complete();
      expect(await first, UpdateFlowResult.installed);
      expect(await second, UpdateFlowResult.installed);
    });

    test('stale temporary APKs are removed before a new download', () async {
      final payload = _apkPayload();
      final temporaryDirectory = await _testCacheDirectory('update-stale');
      addTearDown(() => temporaryDirectory.delete(recursive: true));
      final stale =
          File('${temporaryDirectory.path}/line_oa_update_18_old.apk');
      stale.writeAsBytesSync(<int>[1, 2, 3]);
      final service = AppUpdateService(
        _trackingApi(),
        downloadClient:
            MockClient((_) async => http.Response.bytes(payload, 200)),
        cacheDirectoryProvider: () => Future.value(temporaryDirectory),
        installer: (_) async => ApkInstallResult.launched,
      );
      expect(await service.downloadAndInstallApk(_downloadableInfo(payload)),
          UpdateFlowResult.installed);
      expect(stale.existsSync(), false);
    });

    test('Android installer bridge launches the package installer', () async {
      const channel = MethodChannel('click.lineoppo.chat/apk_installer');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async => 'launched');
      addTearDown(() => TestDefaultBinaryMessengerBinding
          .instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null));
      expect(await const AndroidApkInstaller().call('/cache/update.apk'),
          ApkInstallResult.launched);
    });

    test(
        'Android installer bridge reports missing install permission for retry',
        () async {
      const channel = MethodChannel('click.lineoppo.chat/apk_installer');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
              channel, (call) async => 'permission_required');
      addTearDown(() => TestDefaultBinaryMessengerBinding
          .instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null));
      expect(await const AndroidApkInstaller().call('/cache/update.apk'),
          ApkInstallResult.permissionRequired);
    });
  });
}
