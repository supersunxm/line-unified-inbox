import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/localization/localization.dart';
import '../../../core/widgets/app_widgets.dart';

class ConversationHeader extends StatelessWidget
    implements PreferredSizeWidget {
  static const double _height = 96;

  const ConversationHeader({
    super.key,
    required this.customerName,
    this.bmReplyStatus,
    this.onBack,
    this.onProfile,
    this.onAction,
  });

  final String customerName;
  final String? bmReplyStatus;
  final VoidCallback? onBack;
  final VoidCallback? onProfile;
  final VoidCallback? onAction;

  @override
  Size get preferredSize => const Size.fromHeight(_height);

  @override
  Widget build(BuildContext context) {
    final hasStatus = bmReplyStatus?.trim().isNotEmpty ?? false;
    return AppBar(
      toolbarHeight: _height,
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: const Border(
        bottom: BorderSide(color: AppColors.border),
      ),
      leading: onBack == null
          ? null
          : IconButton(
              onPressed: onBack,
              tooltip: appLocalizations(context).back,
              icon: const Icon(Icons.arrow_back),
            ),
      titleSpacing: AppSpacing.sm,
      title: Row(
        children: [
          UserAvatar(displayName: customerName, radius: 22),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                if (hasStatus)
                  StatusBadge(status: bmReplyStatus!, compact: true),
              ],
            ),
          ),
        ],
      ),
      actions: [
        if (onProfile != null)
          IconButton(
            onPressed: onProfile,
            tooltip: appLocalizations(context).customerProfile,
            icon: const Icon(Icons.person_outline),
          ),
        IconButton(
          onPressed: onAction,
          tooltip: appLocalizations(context).moreActions,
          icon: const Icon(Icons.more_horiz),
        ),
      ],
    );
  }
}
