import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/localization/localization.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/models/models.dart';

class ConversationHeader extends StatelessWidget
    implements PreferredSizeWidget {
  static const double _height = 152;

  const ConversationHeader({
    super.key,
    required this.customerName,
    this.customerPictureUrl,
    this.storeName,
    this.storeCode,
    this.showStoreContext = true,
    this.bmReplyStatus,
    this.owner,
    this.ownerTracked = true,
    this.exactStatus = false,
    this.onBack,
    this.onProfile,
    this.onAction,
    this.onOwnerTap,
  });

  final String customerName;
  final String? customerPictureUrl;
  final String? storeName;
  final String? storeCode;
  final bool showStoreContext;
  final String? bmReplyStatus;
  final ConversationOwner? owner;
  final bool ownerTracked;
  final bool exactStatus;
  final VoidCallback? onBack;
  final VoidCallback? onProfile;
  final VoidCallback? onAction;
  final VoidCallback? onOwnerTap;

  @override
  Size get preferredSize => const Size.fromHeight(_height);

  @override
  Widget build(BuildContext context) {
    final hasStatus = bmReplyStatus?.trim().isNotEmpty ?? false;
    final visibleStoreName = showStoreContext ? storeName : null;
    final visibleStoreCode = showStoreContext ? storeCode : null;
    final hasStore = visibleStoreName?.trim().isNotEmpty ?? false;
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
                        visibleStoreName!,
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
                if (visibleStoreCode?.trim().isNotEmpty ?? false)
                  Text(
                    appLocalizations(context).storeCode(visibleStoreCode!),
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
                if (owner != null || onOwnerTap != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _OwnerRow(
                      owner: owner,
                      ownerTracked: ownerTracked,
                      onTap: onOwnerTap),
                ],
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
                      if (owner != null || onOwnerTap != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        _OwnerRow(
                            owner: owner,
                            ownerTracked: ownerTracked,
                            onTap: onOwnerTap),
                      ],
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

class _OwnerRow extends StatelessWidget {
  const _OwnerRow(
      {required this.owner,
      required this.onTap,
      this.ownerTracked = true});

  final ConversationOwner? owner;
  final VoidCallback? onTap;
  final bool ownerTracked;

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    if (owner == null && !ownerTracked) {
      final edit = Tooltip(
        message: l10n.conversationOwner,
        child: const Icon(Icons.edit_outlined,
            size: 14, color: AppColors.textSecondary),
      );
      return onTap == null
          ? edit
          : InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1),
                child: edit,
              ),
            );
    }
    final label = owner?.displayName ?? l10n.unassignedOwner;
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.person_outline,
            size: 14,
            color: owner == null ? AppColors.textSecondary : AppColors.primary),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            '${l10n.conversationOwner}: $label',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
        if (onTap != null) ...[
          const SizedBox(width: 3),
          const Icon(Icons.edit_outlined,
              size: 12, color: AppColors.textSecondary),
        ],
      ],
    );
    return onTap == null
        ? child
        : InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1),
              child: child,
            ),
          );
  }
}
