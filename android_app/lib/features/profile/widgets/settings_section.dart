import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';

class SettingsSection extends StatelessWidget {
  const SettingsSection({super.key, this.onPersonalInformation});

  final VoidCallback? onPersonalInformation;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Settings', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Personal Information'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: onPersonalInformation,
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.language),
                  title: Text('Language'),
                  subtitle: Text('Coming soon'),
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.notifications_none),
                  title: Text('Notifications'),
                  subtitle: Text('Coming soon'),
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.palette_outlined),
                  title: Text('Appearance'),
                  subtitle: Text('Coming soon'),
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.security_outlined),
                  title: Text('Account & Security'),
                  subtitle: Text('Managed by your organization'),
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text('About'),
                  subtitle: Text('LINE OA Chat Hub'),
                ),
              ],
            ),
          ),
        ],
      );
}
