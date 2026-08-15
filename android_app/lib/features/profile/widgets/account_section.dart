import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/status_badge.dart';

class AccountSection extends StatelessWidget {
  const AccountSection({super.key, required this.user});

  final CurrentUser user;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Account', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Card(
            child: ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('Platform role'),
              trailing: StatusBadge(status: user.role),
            ),
          ),
        ],
      );
}
