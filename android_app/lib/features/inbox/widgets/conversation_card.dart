import 'package:flutter/material.dart';
import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import 'conversation_preview.dart';

class ConversationCard extends StatelessWidget {
  const ConversationCard({
    super.key,
    required this.conversation,
    required this.onTap,
    this.hqLayout = false,
    this.showStoreContext = true,
  });

  final ConversationSummary conversation;
  final VoidCallback onTap;
  final bool hqLayout;
  final bool showStoreContext;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
          child: Stack(
            children: [
              hqLayout ? _buildHqLayout(context) : _buildStoreLayout(context),
              if (conversation.unreadCount > 0)
                Positioned(
                  left: 0,
                  top: 0,
                  child: ExcludeSemantics(
                    child: Opacity(
                      opacity: 0,
                      child: UnreadBadge(count: conversation.unreadCount),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHqLayout(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  conversation.storeName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              if (conversation.sentAt != null)
                Text(
                  formatConversationTimestamp(conversation.sentAt!.toLocal()),
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
            ],
          ),
          const SizedBox(height: 5),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: conversation.customerName,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const TextSpan(text: ' : '),
                TextSpan(
                  text: localizedConversationPreview(
                      context, conversation.preview),
                ),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 12.5,
                ),
          ),
          _OwnerSummary(owner: conversation.owner),
          _SalesSummary(summary: conversation.customerSalesSummary),
          const SizedBox(height: 6),
          Row(
            children: [
              StatusBadge(
                status: conversation.bmReplyStatus,
                label: localizedConversationStatusLabel(
                  context,
                  conversation.bmReplyStatus,
                  exact: true,
                ),
                compact: true,
              ),
              const Spacer(),
              const Icon(Icons.chevron_right,
                  size: 16, color: AppColors.textSecondary),
            ],
          ),
        ],
      );

  Widget _buildStoreLayout(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          UserAvatar(
            displayName: conversation.customerName,
            imageUrl: conversation.customerPictureUrl,
            radius: 19,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        conversation.customerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                if (showStoreContext)
                  StoreBadge(name: conversation.storeName, compact: true),
                _OwnerSummary(owner: conversation.owner),
                _SalesSummary(summary: conversation.customerSalesSummary),
                const SizedBox(height: 2),
                ConversationPreview(
                    preview: conversation.preview, sentAt: conversation.sentAt),
                const SizedBox(height: 3),
                Row(
                  children: [
                    StatusBadge(
                        status: conversation.bmReplyStatus, compact: true),
                    const Spacer(),
                    const Icon(Icons.chevron_right,
                        size: 16, color: AppColors.textSecondary),
                  ],
                ),
              ],
            ),
          ),
        ],
      );
}

class _OwnerSummary extends StatelessWidget {
  const _OwnerSummary({required this.owner});

  final ConversationOwner? owner;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        children: [
          const Icon(Icons.person_outline,
              size: 13, color: AppColors.textSecondary),
          const SizedBox(width: 3),
          Flexible(
            child: Text(
              '${appLocalizations(context).conversationOwner}: ${owner?.displayName ?? appLocalizations(context).unassignedOwner}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SalesSummary extends StatelessWidget {
  const _SalesSummary({required this.summary});

  final CustomerSalesSummary? summary;

  @override
  Widget build(BuildContext context) {
    if (summary == null || summary!.isEmpty) return const SizedBox.shrink();
    final status = switch (summary!.status) {
      'ONLINE' => '🌐 ${appLocalizations(context).statusOnline}',
      'INTERESTED' => '🎯 ${appLocalizations(context).statusInterested}',
      'PURCHASED' => '🛍️ ${appLocalizations(context).statusPurchased}',
      _ => null,
    };
    final first = summary!.products.isEmpty ? null : summary!.products.first;
    final productLabel = first == null
        ? null
        : '📱 ${first.modelName}${first.quantity > 1 ? ' ×${first.quantity}' : ''}${summary!.products.length > 1 ? ' +${summary!.products.length - 1}' : ''}';
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Wrap(
        spacing: 4,
        runSpacing: 2,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (status != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: AppColors.primaryContainer.withAlpha(150),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                status,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      fontSize: 10.5,
                    ),
              ),
            ),
          if (productLabel != null)
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 220),
              child: Text(
                productLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
        ],
      ),
    );
  }
}
