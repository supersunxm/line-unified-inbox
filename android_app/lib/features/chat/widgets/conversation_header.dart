import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';

/// Compact one-row conversation header. Store and owner context are kept as
/// quiet secondary text so the message timeline starts higher on screen.
class ConversationHeader extends StatelessWidget
    implements PreferredSizeWidget {
  static const double _height = 72;

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
    final visibleStoreName = showStoreContext ? storeName : null;
    final hasStore = visibleStoreName?.trim().isNotEmpty ?? false;
    final hasOwner = owner != null || (ownerTracked && onOwnerTap != null);

    return AppBar(
      toolbarHeight: _height,
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: const Border(
        bottom: BorderSide(color: AppColors.border),
      ),
      leading: onBack == null
          ? null
          : IconButton(
              onPressed: onBack,
              tooltip: appLocalizations(context).back,
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            ),
      titleSpacing: 0,
      title: Row(
        children: [
          UserAvatar(
            displayName: customerName,
            imageUrl: customerPictureUrl,
            radius: 19,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        customerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                    if (bmReplyStatus?.trim().isNotEmpty == true) ...[
                      const SizedBox(width: 6),
                      StatusBadge(
                        status: bmReplyStatus!,
                        label: localizedConversationStatusLabel(
                          context,
                          bmReplyStatus!,
                          exact: exactStatus,
                        ),
                        compact: true,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (hasStore) ...[
                      Flexible(
                        child: Text(
                          visibleStoreName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        appLocalizations(context).storeContext,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                    ] else if (hasOwner)
                      Flexible(
                        child: _OwnerRow(
                          owner: owner,
                          ownerTracked: ownerTracked,
                          onTap: onOwnerTap,
                        ),
                      )
                    else
                      Text(
                        appLocalizations(context).conversationContext,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                  ],
                ),
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
            icon: const Icon(Icons.info_outline_rounded, size: 21),
          ),
        if (onAction != null)
          IconButton(
            onPressed: onAction,
            tooltip: appLocalizations(context).moreActions,
            icon: const Icon(Icons.more_horiz_rounded, size: 23),
          ),
      ],
    );
  }
}

class _OwnerRow extends StatelessWidget {
  const _OwnerRow({
    required this.owner,
    required this.onTap,
    this.ownerTracked = true,
  });

  final ConversationOwner? owner;
  final VoidCallback? onTap;
  final bool ownerTracked;

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    if (owner == null && !ownerTracked) {
      final edit = Icon(
        Icons.edit_outlined,
        size: 14,
        color: AppColors.textSecondary,
        semanticLabel: l10n.conversationOwner,
      );
      return onTap == null ? edit : InkWell(onTap: onTap, child: edit);
    }
    final label = owner?.displayName ?? l10n.unassignedOwner;
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.person_outline,
          size: 14,
          color: owner == null ? AppColors.textSecondary : AppColors.primary,
        ),
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
    return onTap == null ? child : InkWell(onTap: onTap, child: child);
  }
}
