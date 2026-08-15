import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/theme/app_spacing.dart';

class SettingsSection extends StatelessWidget {
  const SettingsSection({super.key, this.onPersonalInformation});

  final VoidCallback? onPersonalInformation;

  @override
  Widget build(BuildContext context) {
    final languageController = AppLanguageScope.maybeOf(context);
    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(appLocalizations(context).settings,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title:
                      Text(appLocalizations(context).personalInformation),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: onPersonalInformation,
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.language),
                  title: Text(appLocalizations(context).language),
                  subtitle: Text(languageController?.language.nativeName ??
                      AppLanguage.english.nativeName),
                  onTap: languageController == null
                      ? null
                      : () => _showLanguagePicker(context),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.notifications_none),
                  title: Text(appLocalizations(context).notifications),
                  subtitle: Text(appLocalizations(context).comingSoon),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.palette_outlined),
                  title: Text(appLocalizations(context).appearance),
                  subtitle: Text(appLocalizations(context).comingSoon),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.security_outlined),
                  title: Text(appLocalizations(context).accountSecurity),
                  subtitle:
                      Text(appLocalizations(context).managedByOrganization),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text(appLocalizations(context).about),
                  subtitle: Text(appLocalizations(context).appName),
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
