import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/theme/app_spacing.dart';

import '../../../core/services/app_update_service.dart';

class SettingsSection extends StatelessWidget {
  const SettingsSection({super.key, this.onPersonalInformation, this.updateService});

  final VoidCallback? onPersonalInformation;
  final AppUpdateService? updateService;

  @override
  Widget build(BuildContext context) {
    final languageController = AppLanguageScope.maybeOf(context);
    final l10n = appLocalizations(context);
    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.settings,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title:
                      Text(l10n.personalInformation),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: onPersonalInformation,
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
                  subtitle: Text(l10n.comingSoon),
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
                  subtitle:
                      Text(l10n.managedByOrganization),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: Text(l10n.about),
                  subtitle: const Text('OPPO LINE OA Chat · v1.0.5+6'),
                  trailing: Text(
                    l10n.checkForUpdates,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  onTap: updateService == null
                      ? null
                      : () => updateService!.checkForUpdates(context, isManual: true),
                ),
              ],
            ),
          ),
        ],
      );
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
