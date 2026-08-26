import 'dart:async';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/localization/localization.dart';
import '../../../core/theme/app_spacing.dart';

import '../../../core/services/app_update_service.dart';
import '../../notifications/notification_service.dart';

class SettingsSection extends StatefulWidget {
  const SettingsSection(
      {super.key,
      this.onPersonalInformation,
      this.updateService,
      this.packageInfo,
      this.notificationService});

  final VoidCallback? onPersonalInformation;
  final AppUpdateService? updateService;
  final PackageInfo? packageInfo;
  final NotificationService? notificationService;

  @override
  State<SettingsSection> createState() => _SettingsSectionState();
}

class _SettingsSectionState extends State<SettingsSection> {
  PackageInfo? _packageInfo;
  NotificationPermissionStatus? _notificationStatus;

  @override
  void initState() {
    super.initState();
    _packageInfo = widget.packageInfo;
    if (_packageInfo == null) {
      unawaited(_loadPackageInfo());
    }
    if (widget.notificationService != null) {
      unawaited(_loadNotificationStatus());
    }
  }

  Future<void> _loadPackageInfo() async {
    try {
      final value = await PackageInfo.fromPlatform();
      if (mounted) setState(() => _packageInfo = value);
    } catch (_) {
      // Keep the About row usable on platforms where package metadata is unavailable.
    }
  }

  @override
  Widget build(BuildContext context) {
    final languageController = AppLanguageScope.maybeOf(context);
    final l10n = appLocalizations(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.settings, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: Text(l10n.personalInformation),
                trailing: const Icon(Icons.chevron_right),
                onTap: widget.onPersonalInformation,
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.language),
                title: Text(l10n.language),
                subtitle: Text(languageController?.language.nativeName ??
                    AppLanguage.english.nativeName),
                onTap: languageController == null
                    ? null
                    : () => _showLanguagePicker(context),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.notifications_none),
                title: Text(l10n.notifications),
                subtitle: Text(_notificationSubtitle(l10n)),
                trailing: const Icon(Icons.chevron_right),
                onTap: widget.notificationService == null
                    ? null
                    : () => _manageNotifications(context),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.palette_outlined),
                title: Text(l10n.appearance),
                subtitle: Text(l10n.comingSoon),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.security_outlined),
                title: Text(l10n.accountSecurity),
                subtitle: Text(l10n.managedByOrganization),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.info_outline),
                title: Text(l10n.about),
                subtitle: Text(_packageInfo == null
                    ? 'OPPO LINE OA Chat'
                    : 'OPPO LINE OA Chat · v${_packageInfo!.version}+${_packageInfo!.buildNumber}'),
                trailing: Text(
                  l10n.checkForUpdates,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                onTap: widget.updateService == null
                    ? null
                    : () => widget.updateService!
                        .checkForUpdates(context, isManual: true),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _notificationSubtitle(AppLocalizations l10n) {
    switch (_notificationStatus) {
      case NotificationPermissionStatus.authorized:
        return l10n.notificationsEnabled;
      case NotificationPermissionStatus.denied:
        return l10n.notificationsDisabled;
      case NotificationPermissionStatus.notDetermined:
        return l10n.enableNotifications;
      case NotificationPermissionStatus.unavailable:
      case null:
        return l10n.enableNotifications;
    }
  }

  Future<void> _loadNotificationStatus() async {
    final service = widget.notificationService;
    if (service == null) return;
    final status = await service.notificationPermissionStatus();
    if (mounted) setState(() => _notificationStatus = status);
  }

  Future<void> _manageNotifications(BuildContext context) async {
    final service = widget.notificationService;
    if (service == null) return;
    var status = await service.notificationPermissionStatus();
    if (status == NotificationPermissionStatus.denied) {
      await service.openNotificationSettings();
    } else {
      status = await service.requestNotificationPermission();
      if (status == NotificationPermissionStatus.denied) {
        await service.openNotificationSettings();
      }
    }
    if (mounted) setState(() => _notificationStatus = status);
  }

  Future<void> _showLanguagePicker(BuildContext context) async {
    final controller = AppLanguageScope.maybeOf(context);
    if (controller == null) return;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(appLocalizations(dialogContext).languageTitle),
        content: RadioGroup<AppLanguage>(
          groupValue: controller.language,
          onChanged: (value) {
            if (value != null) {
              controller.setLanguage(value);
              Navigator.of(dialogContext).pop();
            }
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final language in AppLanguage.values)
                RadioListTile<AppLanguage>(
                  value: language,
                  title: Text(language.nativeName),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
