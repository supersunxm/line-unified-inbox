import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/core/services/app_update_service.dart';
import 'package:line_oa_chat_hub/features/profile/widgets/settings_section.dart';

class _AvailableUpdateService extends AppUpdateService {
  _AvailableUpdateService() : super(ApiClient(TokenStore()));

  var fetchCount = 0;

  @override
  Future<void> checkForUpdates(
    BuildContext context, {
    bool isManual = false,
    PackageInfo? overridePackageInfo,
    AppUpdateInfo? overrideUpdateInfo,
  }) {
    return super.checkForUpdates(
      context,
      isManual: isManual,
      overridePackageInfo: PackageInfo(
        appName: 'OPPO LINE OA Chat',
        packageName: 'click.lineoppo.chat',
        version: '1.1.1',
        buildNumber: '21',
      ),
      overrideUpdateInfo: overrideUpdateInfo,
    );
  }

  @override
  Future<AppUpdateInfo?> fetchLatestVersion() async {
    fetchCount++;
    return const AppUpdateInfo(
      latestVersion: '1.1.2',
      buildNumber: 22,
      minimumSupportedVersion: '1.0.3',
      minimumSupportedBuildNumber: 4,
      forceUpdate: false,
      apkUrl: 'https://lineoppo.click/downloads/update.apk',
    );
  }
}

String _mainSource() => File('lib/main.dart').readAsStringSync();

String _section(String source, String start, String end) {
  final startIndex = source.indexOf(start);
  expect(startIndex, greaterThanOrEqualTo(0),
      reason: 'Expected $start in lib/main.dart');
  final endIndex = source.indexOf(end, startIndex + start.length);
  expect(endIndex, greaterThanOrEqualTo(0),
      reason: 'Expected $end after $start in lib/main.dart');
  return source.substring(startIndex, endIndex);
}

void main() {
  test('app startup does not show an update dialog', () {
    final restore = _section(
      _mainSource(),
      'Future<void> _restore()',
      'Future<void> _openConversation',
    );
    expect(restore, isNot(contains('checkForUpdates')));
  });

  test('login completion does not show an update dialog', () {
    final login = _section(
      _mainSource(),
      'Future<void> _finishLogin()',
      'Future<void> _refreshSession',
    );
    expect(login, isNot(contains('checkForUpdates')));
  });

  test('app resume does not show an update dialog', () {
    final lifecycle = _section(
      _mainSource(),
      'void didChangeAppLifecycleState',
      'Future<void> _restore()',
    );
    expect(lifecycle, isNot(contains('checkForUpdates')));
  });

  test('the app shell contains no automatic update prompt call', () {
    expect(_mainSource(), isNot(contains('checkForUpdates')));
  });

  testWidgets('manual Profile check shows the dialog for a newer build', (
    tester,
  ) async {
    final service = _AvailableUpdateService();
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SettingsSection(
            updateService: service,
            packageInfo: PackageInfo(
              appName: 'OPPO LINE OA Chat',
              packageName: 'click.lineoppo.chat',
              version: '1.1.1',
              buildNumber: '21',
            ),
          ),
        ),
      ),
    );

    // Invoke the About row's actual tap callback. This exercises the same
    // Profile action without making the test depend on viewport dimensions.
    final aboutTile = find.byType(ListTile).last;
    final onTap = tester.widget<ListTile>(aboutTile).onTap;
    expect(onTap, isNotNull);
    onTap!();
    await tester.pumpAndSettle();
    await tester.pumpAndSettle();

    expect(service.fetchCount, 1);
    expect(find.text('New Version Available'), findsOneWidget);
    expect(find.textContaining('1.1.2+22'), findsOneWidget);
  });
}
