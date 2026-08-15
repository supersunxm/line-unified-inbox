import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import 'connection_status_indicator.dart';

class InboxHeader extends StatelessWidget {
  const InboxHeader({
    super.key,
    required this.conversationCount,
    required this.onProfile,
  });

  final int conversationCount;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.xl,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Inbox',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '$conversationCount conversations',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                ],
              ),
            ),
            const ConnectionStatusIndicator(),
            const SizedBox(width: AppSpacing.xs),
            IconButton(
              onPressed: onProfile,
              tooltip: 'Profile',
              icon: const Icon(Icons.person_outline),
              style: IconButton.styleFrom(
                foregroundColor: AppColors.textPrimary,
                backgroundColor: AppColors.surface,
                side: const BorderSide(color: AppColors.border),
              ),
            ),
          ],
        ),
      );
}
