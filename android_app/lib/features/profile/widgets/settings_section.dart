import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';

class SettingsSection extends StatelessWidget {
  const SettingsSection({super.key});

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Settings', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          const Card(
            child: ListTile(
              leading: Icon(Icons.settings_outlined),
              title: Text('App preferences'),
              subtitle: Text('Managed by your organization'),
            ),
          ),
        ],
      );
}
