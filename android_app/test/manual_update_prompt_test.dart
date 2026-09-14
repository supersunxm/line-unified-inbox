import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/core/services/app_update_service.dart';
import 'package:line_oa_chat_hub/features/profile/widgets/settings_section.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

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
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('authenticated startup schedules a post-frame update check', () {
    final restore = _section(
      _mainSource(),
      'Future<void> _restore()',
      'Future<void> _openConversation',
    );
    expect(restore, contains('_scheduleDailyUpdateCheck();'));
  });

  test('login completion schedules a post-frame update check', () {
    final login = _section(
      _mainSource(),
      'Future<void> _finishLogin()',
      'Future<void> _refreshSession',
    );
    expect(login, contains('_scheduleDailyUpdateCheck();'));
  });

  test('app resume can schedule only the daily update check', () {
    final lifecycle = _section(
      _mainSource(),
      'void didChangeAppLifecycleState',
      'Future<void> _restore()',
    );
    expect(lifecycle, contains('_scheduleDailyUpdateCheck();'));
    expect(lifecycle, isNot(contains('isManual: true')));
  });

  test('daily update checks are gated by the authenticated main UI', () {
    final source = _mainSource();
    expect(source, contains('Future<void> _runDailyUpdateCheck'));
    expect(source, contains('_navigator.currentState?.context'));
    expect(source, contains('addPostFrameCallback'));
    expect(source, contains('!_hasMainWorkspace(_user!)'));
    expect(source, contains('_lastAutomaticUpdateCheckDate == today'));
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
