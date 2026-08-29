import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/localization/localization.dart';
import '../../../core/widgets/app_widgets.dart';

class ConversationHeader extends StatelessWidget
    implements PreferredSizeWidget {
  static const double _height = 128;

  const ConversationHeader({
    super.key,
    required this.customerName,
    this.customerPictureUrl,
    this.storeName,
    this.storeCode,
    this.bmReplyStatus,
    this.exactStatus = false,
    this.onBack,
    this.onProfile,
    this.onAction,
  });

  final String customerName;
  final String? customerPictureUrl;
  final String? storeName;
  final String? storeCode;
  final String? bmReplyStatus;
  final bool exactStatus;
  final VoidCallback? onBack;
  final VoidCallback? onProfile;
  final VoidCallback? onAction;

  @override
  Size get preferredSize => const Size.fromHeight(_height);

  @override
  Widget build(BuildContext context) {
    final hasStatus = bmReplyStatus?.trim().isNotEmpty ?? false;
    final hasStore = storeName?.trim().isNotEmpty ?? false;
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
      title: hasStore
          ? Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.storefront_outlined,
                        size: 16, color: AppColors.primary),
                    const SizedBox(width: AppSpacing.xs),
                    Flexible(
                      child: Text(
                        storeName!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      appLocalizations(context).storeContext,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
                if (storeCode?.trim().isNotEmpty ?? false)
                  Text(
                    appLocalizations(context).storeCode(storeCode!),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    UserAvatar(
                        displayName: customerName,
                        imageUrl: customerPictureUrl,
                        radius: 16),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customerName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                          ),
                          if (hasStatus)
                            StatusBadge(
                              status: bmReplyStatus!,
                              label: localizedConversationStatusLabel(
                                  context, bmReplyStatus!,
                                  exact: exactStatus),
                              compact: true,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            )
          : Row(
              children: [
                UserAvatar(
                    displayName: customerName,
                    imageUrl: customerPictureUrl,
                    radius: 22),
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
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
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
        if (onAction != null)
          IconButton(
            onPressed: onAction,
            tooltip: appLocalizations(context).moreActions,
            icon: const Icon(Icons.more_horiz),
          ),
      ],
    );
  }
}
