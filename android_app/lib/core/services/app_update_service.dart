import 'dart:async';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../localization/localization.dart';
import '../logging/safe_logger.dart';
import '../network/api_client.dart';
import '../theme/app_spacing.dart';

class AppUpdateInfo {
  const AppUpdateInfo({
    required this.latestVersion,
    required this.buildNumber,
    required this.minimumSupportedVersion,
    required this.minimumSupportedBuildNumber,
    required this.forceUpdate,
    required this.apkUrl,
    this.apkSize,
    this.sha256,
    this.releaseNotes = const [],
  });

  final String latestVersion;
  final int buildNumber;
  final String minimumSupportedVersion;
  final int minimumSupportedBuildNumber;
  final bool forceUpdate;
  final String apkUrl;
  final String? apkSize;
  final String? sha256;
  final List<String> releaseNotes;

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) => AppUpdateInfo(
        latestVersion: json['latestVersion'] as String? ?? '1.0.5',
        buildNumber: json['buildNumber'] as int? ?? 6,
        minimumSupportedVersion: json['minimumSupportedVersion'] as String? ?? '1.0.3',
        minimumSupportedBuildNumber: json['minimumSupportedBuildNumber'] as int? ?? 4,
        forceUpdate: json['forceUpdate'] as bool? ?? false,
        apkUrl: json['apkUrl'] as String? ?? 'https://lineoppo.click/download',
        apkSize: json['apkSize'] as String?,
        sha256: json['sha256'] as String?,
        releaseNotes: (json['releaseNotes'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      );

  bool isUpdateAvailable(int currentBuildNumber) => currentBuildNumber < buildNumber;

  bool isForceUpdateRequired(int currentBuildNumber) => forceUpdate || currentBuildNumber < minimumSupportedBuildNumber;
}

class AppUpdateService {
  AppUpdateService(this._api);

  final ApiClient _api;
  bool _dialogShowing = false;

  Future<AppUpdateInfo?> fetchLatestVersion() async {
    try {
      final json = await _api.get('/app/version/android', authenticated: false);
      return AppUpdateInfo.fromJson(json);
    } catch (e) {
      SafeLogger.updateCheckFailed(e.runtimeType.toString());
      return null;
    }
  }

  Future<void> checkForUpdates(
    BuildContext context, {
    bool isManual = false,
    PackageInfo? overridePackageInfo,
    AppUpdateInfo? overrideUpdateInfo,
  }) async {
    if (_dialogShowing) return;

    try {
      final packageInfo = overridePackageInfo ?? await PackageInfo.fromPlatform();
      final currentBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 0;
      final currentVersion = packageInfo.version;

      final info = overrideUpdateInfo ?? await fetchLatestVersion();

      if (info == null) {
        if (isManual && context.mounted) {
          final l10n = appLocalizations(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.unableToCheckUpdates),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }

      final hasUpdate = info.isUpdateAvailable(currentBuildNumber);

      if (!hasUpdate) {
        if (isManual && context.mounted) {
          final l10n = appLocalizations(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${l10n.alreadyLatestVersion} (v$currentVersion+$currentBuildNumber)',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              backgroundColor: Colors.green.shade700,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }

      if (!context.mounted) return;

      final isForced = info.isForceUpdateRequired(currentBuildNumber);
      _dialogShowing = true;

      await showDialog<void>(
        context: context,
        barrierDismissible: !isForced,
        builder: (dialogCtx) => PopScope(
          canPop: !isForced,
          child: _AppUpdateDialog(
            info: info,
            isForced: isForced,
            currentVersion: currentVersion,
            currentBuildNumber: currentBuildNumber,
            onUpdateNow: () => _downloadAndInstallApk(info),
          ),
        ),
      );
    } finally {
      _dialogShowing = false;
    }
  }

  Future<void> _downloadAndInstallApk(AppUpdateInfo info) async {
    final uri = Uri.parse(info.apkUrl);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      unawaited(_api.post('/app/version/track-download?platform=android&buildNumber=${info.buildNumber}', authenticated: false));
    } catch (e) {
      SafeLogger.updateDownloadFailed(e.runtimeType.toString());
    }
  }
}

class _AppUpdateDialog extends StatelessWidget {
  const _AppUpdateDialog({
    required this.info,
    required this.isForced,
    required this.currentVersion,
    required this.currentBuildNumber,
    required this.onUpdateNow,
  });

  final AppUpdateInfo info;
  final bool isForced;
  final String currentVersion;
  final int currentBuildNumber;
  final VoidCallback onUpdateNow;

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    final theme = Theme.of(context);

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Icon(
            isForced ? Icons.warning_amber_rounded : Icons.rocket_launch_outlined,
            color: isForced ? Colors.orange : Colors.green,
            size: 26,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              isForced ? l10n.updateRequired : l10n.newVersionAvailable,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // App Name & Version Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.green.withAlpha(25),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.system_update_alt, size: 16, color: Colors.green),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${l10n.latestVersion}: ${info.latestVersion}+${info.buildNumber}${info.apkSize != null ? ' (${info.apkSize})' : ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.green,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${l10n.currentVersion}: $currentVersion+$currentBuildNumber',
              style: TextStyle(fontSize: 11, color: theme.hintColor),
            ),
            const SizedBox(height: AppSpacing.md),

            // What's new section
            if (info.releaseNotes.isNotEmpty) ...[
              Text(
                l10n.whatsNew,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              ...info.releaseNotes.map((note) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('✓ ', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12)),
                        Expanded(
                          child: Text(
                            note,
                            style: const TextStyle(fontSize: 12, height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  )),
              const SizedBox(height: AppSpacing.sm),
            ],

            if (isForced)
              Text(
                'This version contains critical updates required to continue using the application.',
                style: TextStyle(fontSize: 11, color: Colors.orange.shade800, fontStyle: FontStyle.italic),
              ),
          ],
        ),
      ),
      actions: [
        if (!isForced)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l10n.later),
          ),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.green.shade700,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          ),
          onPressed: () {
            if (!isForced) {
              Navigator.of(context).pop();
            }
            onUpdateNow();
          },
          icon: const Icon(Icons.download, size: 16),
          label: Text(l10n.updateNow, style: const TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}
