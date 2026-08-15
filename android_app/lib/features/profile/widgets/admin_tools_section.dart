import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/localization/localization.dart';

class AdminToolsSection extends StatelessWidget {
  const AdminToolsSection({super.key, this.onApprovals});

  final VoidCallback? onApprovals;

  @override
  Widget build(BuildContext context) {
    if (onApprovals == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(appLocalizations(context).adminTools,
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton.icon(
          onPressed: onApprovals,
          icon: const Icon(Icons.verified_user),
          label: Text(appLocalizations(context).adminApprovals),
        ),
      ],
    );
  }
}
