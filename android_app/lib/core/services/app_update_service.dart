import 'dart:async';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../localization/localization.dart';
import '../logging/safe_logger.dart';
import '../config/app_config.dart';
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
        minimumSupportedVersion:
            json['minimumSupportedVersion'] as String? ?? '1.0.3',
        minimumSupportedBuildNumber:
            json['minimumSupportedBuildNumber'] as int? ?? 4,
        forceUpdate: json['forceUpdate'] as bool? ?? false,
        apkUrl: json['apkUrl'] as String? ?? 'https://lineoppo.click/download',
        apkSize: json['apkSize'] as String?,
        sha256: json['sha256'] as String?,
        releaseNotes: (json['releaseNotes'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
      );

  bool isUpdateAvailable(int currentBuildNumber) =>
      currentBuildNumber < buildNumber;

  bool isForceUpdateRequired(int currentBuildNumber) =>
      forceUpdate || currentBuildNumber < minimumSupportedBuildNumber;
}

enum UpdateProgressStatus {
  preparing,
  downloading,
  verifying,
  readyToInstall,
  installing,
  permissionRequired,
  downloadFailed,
  checksumFailed,
  installationFailed,
}

class UpdateProgress {
  const UpdateProgress(this.status, {this.fraction, this.error});

  final UpdateProgressStatus status;
  final double? fraction;
  final String? error;
}

enum UpdateFlowResult {
  installed,
  permissionRequired,
  downloadFailed,
  checksumFailed,
  installationFailed,
}

enum ApkInstallResult { launched, permissionRequired, failed }

typedef ApkInstaller = Future<ApkInstallResult> Function(String path);
typedef CacheDirectoryProvider = Future<Directory> Function();
typedef UpdateProgressCallback = void Function(UpdateProgress progress);

class AndroidApkInstaller {
  const AndroidApkInstaller();

  static const _channel = MethodChannel('click.lineoppo.chat/apk_installer');

  Future<ApkInstallResult> call(String path) async {
    try {
      final result = await _channel.invokeMethod<String>('installApk', {
        'path': path,
      });
      return switch (result) {
        'launched' => ApkInstallResult.launched,
        'permission_required' => ApkInstallResult.permissionRequired,
        _ => ApkInstallResult.failed,
      };
    } on MissingPluginException {
      return ApkInstallResult.failed;
    } on PlatformException {
      return ApkInstallResult.failed;
    }
  }
}

class AppUpdateService {
  AppUpdateService(
    this._api, {
    http.Client? downloadClient,
    ApkInstaller? installer,
    CacheDirectoryProvider? cacheDirectoryProvider,
  })  : _downloadClient = downloadClient ?? http.Client(),
        _installer = installer ?? const AndroidApkInstaller().call,
        _cacheDirectoryProvider =
            cacheDirectoryProvider ?? getApplicationSupportDirectory;

  final ApiClient _api;
  final http.Client _downloadClient;
  final ApkInstaller _installer;
  final CacheDirectoryProvider _cacheDirectoryProvider;
  bool _dialogShowing = false;
  Future<UpdateFlowResult>? _updateInFlight;
  String? _verifiedApkPath;
  int? _verifiedBuildNumber;
  int? _trackedBuildNumber;

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
    // Version checks are deliberately user initiated. The only automatic
    // updater activity left in the app is retrying an install that already
    // reached Android's permission settings from the active update dialog.
    if (!isManual) return;
    if (_dialogShowing) return;

    try {
      final packageInfo =
          overridePackageInfo ?? await PackageInfo.fromPlatform();
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
            onUpdateNow: (onProgress) =>
                downloadAndInstallApk(info, onProgress: onProgress),
          ),
        ),
      );
    } finally {
      _dialogShowing = false;
    }
  }

  Future<UpdateFlowResult> downloadAndInstallApk(
    AppUpdateInfo info, {
    UpdateProgressCallback? onProgress,
  }) async {
    final existing = _updateInFlight;
    if (existing != null) return existing;

    final operation = _runUpdate(info, onProgress: onProgress);
    _updateInFlight = operation;
    try {
      return await operation;
    } finally {
      if (identical(_updateInFlight, operation)) _updateInFlight = null;
    }
  }

  Future<UpdateFlowResult> _runUpdate(
    AppUpdateInfo info, {
    UpdateProgressCallback? onProgress,
  }) async {
    onProgress?.call(const UpdateProgress(UpdateProgressStatus.preparing));
    String? apkPath = _verifiedPathFor(info);
    var downloadedThisRun = false;
    try {
      if (apkPath == null) {
        await _cleanupStaleApks();
        apkPath = await _downloadApk(info, onProgress: onProgress);
        downloadedThisRun = true;
        _verifiedApkPath = apkPath;
        _verifiedBuildNumber = info.buildNumber;
      } else {
        onProgress?.call(
          const UpdateProgress(UpdateProgressStatus.readyToInstall),
        );
      }

      if (downloadedThisRun && _trackedBuildNumber != info.buildNumber) {
        await _trackDownload(info);
        _trackedBuildNumber = info.buildNumber;
      }

      onProgress?.call(const UpdateProgress(UpdateProgressStatus.installing));
      final installResult = await _installer(apkPath);
      switch (installResult) {
        case ApkInstallResult.launched:
          return UpdateFlowResult.installed;
        case ApkInstallResult.permissionRequired:
          onProgress?.call(
            const UpdateProgress(UpdateProgressStatus.permissionRequired),
          );
          return UpdateFlowResult.permissionRequired;
        case ApkInstallResult.failed:
          onProgress?.call(
            const UpdateProgress(UpdateProgressStatus.installationFailed),
          );
          await _discardVerifiedApk(apkPath);
          return UpdateFlowResult.installationFailed;
      }
    } on _ChecksumMismatch catch (error) {
      onProgress?.call(
        UpdateProgress(
          UpdateProgressStatus.checksumFailed,
          error: error.message,
        ),
      );
      await _discardVerifiedApk(apkPath);
      return UpdateFlowResult.checksumFailed;
    } catch (error) {
      SafeLogger.updateDownloadFailed(error.runtimeType.toString());
      onProgress?.call(
        UpdateProgress(
          UpdateProgressStatus.downloadFailed,
          error: error.toString(),
        ),
      );
      await _discardVerifiedApk(apkPath);
      return UpdateFlowResult.downloadFailed;
    }
  }

  String? _verifiedPathFor(AppUpdateInfo info) {
    if (_verifiedApkPath == null) {
      return null;
    }
    if (_verifiedBuildNumber != info.buildNumber) {
      _verifiedApkPath = null;
      _verifiedBuildNumber = null;
      return null;
    }
    if (File(_verifiedApkPath!).existsSync()) {
      return _verifiedApkPath;
    }
    _verifiedApkPath = null;
    _verifiedBuildNumber = null;
    return null;
  }

  Future<String> _downloadApk(
    AppUpdateInfo info, {
    UpdateProgressCallback? onProgress,
  }) async {
    final uri = _resolveApkUri(info.apkUrl);
    final directory = await _cacheDirectoryProvider();
    directory.createSync(recursive: true);
    final file = File(
      '${directory.path}/line_oa_update_${info.buildNumber}_${DateTime.now().microsecondsSinceEpoch}.apk',
    );
    final sink = file.openWrite();
    final digestOutput = _DigestSink();
    final digestInput = sha256.startChunkedConversion(digestOutput);
    var received = 0;
    var sinkClosed = false;
    try {
      onProgress?.call(
        const UpdateProgress(UpdateProgressStatus.downloading, fraction: 0),
      );
      final request = http.Request('GET', uri)
        ..headers['Accept'] = 'application/vnd.android.package-archive';
      final response = await _downloadClient.send(request);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw HttpException(
          'APK download returned HTTP ${response.statusCode}',
        );
      }
      final total = response.contentLength;
      await for (final chunk in response.stream) {
        final bytes = Uint8List.fromList(chunk);
        sink.add(bytes);
        digestInput.add(bytes);
        received += bytes.length;
        onProgress?.call(
          UpdateProgress(
            UpdateProgressStatus.downloading,
            fraction: total == null || total <= 0
                ? null
                : (received / total).clamp(0, 1),
          ),
        );
      }
      await sink.flush();
      await sink.close();
      sinkClosed = true;
      digestInput.close();
      final actual = digestOutput.value.toString().toLowerCase();
      final expected = info.sha256?.trim().toLowerCase();
      onProgress?.call(const UpdateProgress(UpdateProgressStatus.verifying));
      if (expected == null ||
          !RegExp(r'^[a-f0-9]{64}$').hasMatch(expected) ||
          actual != expected) {
        throw _ChecksumMismatch(
          'Downloaded APK checksum does not match release metadata',
        );
      }
      onProgress?.call(
        const UpdateProgress(UpdateProgressStatus.readyToInstall),
      );
      return file.path;
    } catch (_) {
      if (!sinkClosed) await sink.close();
      try {
        if (await file.exists()) await file.delete();
      } catch (error) {
        SafeLogger.updateDownloadFailed(
          'download_cleanup_${error.runtimeType}',
        );
      }
      rethrow;
    }
  }

  Uri _resolveApkUri(String value) {
    final parsed = Uri.parse(value);
    return parsed.hasScheme ? parsed : AppConfig.uri(value);
  }

  Future<void> _trackDownload(AppUpdateInfo info) async {
    try {
      await _api.post(
        '/app/version/track-download?platform=android&buildNumber=${info.buildNumber}',
        authenticated: false,
      );
    } catch (error) {
      SafeLogger.updateDownloadFailed('tracking_${error.runtimeType}');
    }
  }

  Future<void> _cleanupStaleApks() async {
    try {
      final directory = await _cacheDirectoryProvider();
      if (!directory.existsSync()) return;
      for (final entity in directory.listSync()) {
        if (entity is File &&
            entity.path.split('/').last.startsWith('line_oa_update_')) {
          if (entity.path != _verifiedApkPath) entity.deleteSync();
        }
      }
    } catch (error) {
      SafeLogger.updateDownloadFailed('cleanup_${error.runtimeType}');
    }
  }

  Future<void> _discardVerifiedApk(String? path) async {
    if (path == null) return;
    if (_verifiedApkPath == path) {
      _verifiedApkPath = null;
      _verifiedBuildNumber = null;
    }
    try {
      final file = File(path);
      if (file.existsSync()) file.deleteSync();
    } catch (error) {
      SafeLogger.updateDownloadFailed('discard_${error.runtimeType}');
    }
  }
}

class _ChecksumMismatch implements Exception {
  const _ChecksumMismatch(this.message);
  final String message;
}

class _DigestSink implements Sink<Digest> {
  Digest? _digest;

  Digest get value => _digest!;

  @override
  void add(Digest value) => _digest = value;

  @override
  void close() {}
}

class _AppUpdateDialog extends StatefulWidget {
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
  final Future<UpdateFlowResult> Function(UpdateProgressCallback onProgress)
      onUpdateNow;

  @override
  State<_AppUpdateDialog> createState() => _AppUpdateDialogState();
}

class _AppUpdateDialogState extends State<_AppUpdateDialog>
    with WidgetsBindingObserver {
  UpdateProgress? _progress;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _progress?.status == UpdateProgressStatus.permissionRequired &&
        !_busy) {
      // Android opens the app-specific install permission settings when
      // permission is missing. Retry the already-verified APK as soon as the
      // user returns, without downloading it again.
      unawaited(_startUpdate());
    }
  }

  Future<void> _startUpdate() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _progress = const UpdateProgress(UpdateProgressStatus.preparing);
    });
    try {
      await widget.onUpdateNow((progress) {
        if (mounted) setState(() => _progress = progress);
      });
    } catch (error) {
      SafeLogger.updateDownloadFailed('ui_${error.runtimeType}');
      if (mounted) {
        setState(
          () => _progress = const UpdateProgress(
            UpdateProgressStatus.downloadFailed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _statusText(AppLocalizations l10n, UpdateProgress progress) {
    return switch (progress.status) {
      UpdateProgressStatus.preparing => l10n.preparingDownload,
      UpdateProgressStatus.downloading => progress.fraction == null
          ? l10n.downloadingApk
          : l10n.downloadingApkProgress((progress.fraction! * 100).round()),
      UpdateProgressStatus.verifying => l10n.verifyingDownload,
      UpdateProgressStatus.readyToInstall => l10n.readyToInstall,
      UpdateProgressStatus.installing => l10n.installingApk,
      UpdateProgressStatus.permissionRequired => l10n.installPermissionRequired,
      UpdateProgressStatus.downloadFailed => l10n.downloadFailed,
      UpdateProgressStatus.checksumFailed => l10n.checksumFailed,
      UpdateProgressStatus.installationFailed => l10n.installationFailed,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    final theme = Theme.of(context);

    final progress = _progress;
    final hasError = progress?.status == UpdateProgressStatus.downloadFailed ||
        progress?.status == UpdateProgressStatus.checksumFailed ||
        progress?.status == UpdateProgressStatus.installationFailed;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Icon(
            widget.isForced
                ? Icons.warning_amber_rounded
                : Icons.rocket_launch_outlined,
            color: widget.isForced ? Colors.orange : Colors.green,
            size: 26,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              widget.isForced ? l10n.updateRequired : l10n.newVersionAvailable,
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
                  const Icon(
                    Icons.system_update_alt,
                    size: 16,
                    color: Colors.green,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${l10n.latestVersion}: ${widget.info.latestVersion}+${widget.info.buildNumber}${widget.info.apkSize != null ? ' (${widget.info.apkSize})' : ''}',
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
              '${l10n.currentVersion}: ${widget.currentVersion}+${widget.currentBuildNumber}',
              style: TextStyle(fontSize: 11, color: theme.hintColor),
            ),
            const SizedBox(height: AppSpacing.md),

            // What's new section
            if (widget.info.releaseNotes.isNotEmpty) ...[
              Text(
                l10n.whatsNew,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              ...widget.info.releaseNotes.map(
                (note) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '✓ ',
                        style: TextStyle(
                          color: Colors.green,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      Expanded(
                        child: Text(
                          note,
                          style: const TextStyle(fontSize: 12, height: 1.3),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],

            if (progress != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _statusText(l10n, progress),
                style: TextStyle(
                  fontSize: 12,
                  color: hasError
                      ? Colors.red.shade700
                      : theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (progress.status == UpdateProgressStatus.downloading &&
                  progress.fraction != null) ...[
                const SizedBox(height: 8),
                LinearProgressIndicator(value: progress.fraction),
              ],
              if (progress.status == UpdateProgressStatus.permissionRequired)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    l10n.installPermissionInstructions,
                    style: TextStyle(fontSize: 11, color: theme.hintColor),
                  ),
                ),
            ],

            if (widget.isForced)
              Text(
                'This version contains critical updates required to continue using the application.',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.orange.shade800,
                  fontStyle: FontStyle.italic,
                ),
              ),
          ],
        ),
      ),
      actions: [
        if (!widget.isForced)
          TextButton(
            onPressed: _busy ? null : () => Navigator.of(context).pop(),
            child: Text(l10n.later),
          ),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.green.shade700,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          ),
          onPressed: _busy ? null : _startUpdate,
          icon: const Icon(Icons.download, size: 16),
          label: Text(
            hasError ||
                    progress?.status == UpdateProgressStatus.permissionRequired
                ? l10n.retryUpdate
                : l10n.updateNow,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }
}
