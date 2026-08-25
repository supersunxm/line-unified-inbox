import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/localization/localization.dart';

class InboxHeader extends StatelessWidget {
  const InboxHeader({
    super.key,
    required this.conversationCount,
    required this.onProfile,
    this.isHq = false,
    this.scopeName,
    this.unreadCount = 0,
  });

  final int conversationCount;
  final VoidCallback onProfile;
  final bool isHq;
  final String? scopeName;
  final int unreadCount;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    appLocalizations(context).inbox,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                        ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    isHq
                        ? 'HQ · ${scopeName ?? appLocalizations(context).allStores}'
                        : appLocalizations(context)
                            .conversationsCount(conversationCount),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                  ),
                  if (isHq)
                    Text(
                      '$unreadCount ${appLocalizations(context).unread}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                ],
              ),
            ),
            IconButton(
              onPressed: onProfile,
              tooltip: appLocalizations(context).profileTooltip,
              icon: const Icon(Icons.person_outline, size: 20),
              constraints: const BoxConstraints(minWidth: 38, minHeight: 38),
              padding: EdgeInsets.zero,
              style: IconButton.styleFrom(
                foregroundColor: AppColors.textPrimary,
                backgroundColor: AppColors.surface,
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      );
}
