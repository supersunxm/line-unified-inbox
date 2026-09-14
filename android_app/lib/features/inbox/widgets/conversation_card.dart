import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import 'conversation_preview.dart';

/// Dense, divider-led conversation row. Secondary business metadata stays
/// visible, but the customer and latest message carry the hierarchy.
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
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        elevation: 0,
        shape: const RoundedRectangleBorder(),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
            child: Stack(
              children: [
                hqLayout ? _buildHqLayout(context) : _buildStoreLayout(context),
                if (conversation.unreadCount > 0)
                  Positioned(
                    right: 0,
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

  Widget _buildHqLayout(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  conversation.storeName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              if (conversation.sentAt != null) _time(context),
            ],
          ),
          const SizedBox(height: 4),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: conversation.customerName,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const TextSpan(text: ' : '),
                TextSpan(
                    text: localizedConversationPreview(
                        context, conversation.preview)),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 12.5,
                ),
          ),
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
              const SizedBox(width: 8),
              Expanded(
                child: _OwnerSummary(
                  owner: conversation.owner,
                  ownerTracked: conversation.ownerTracked,
                ),
              ),
              _SalesStatus(summary: conversation.customerSalesSummary),
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
            radius: 22,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        conversation.customerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                      ),
                    ),
                    if (conversation.sentAt != null) ...[
                      const SizedBox(width: 6),
                      _time(context),
                    ],
                  ],
                ),
                if (showStoreContext)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      conversation.storeName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                const SizedBox(height: 2),
                ConversationPreview(
                  preview: conversation.preview,
                  showTimestamp: false,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: _OwnerSummary(
                        owner: conversation.owner,
                        ownerTracked: conversation.ownerTracked,
                      ),
                    ),
                    _SalesSummary(summary: conversation.customerSalesSummary),
                    const SizedBox(width: 6),
                    StatusBadge(
                      status: conversation.bmReplyStatus,
                      compact: true,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      );

  Widget _time(BuildContext context) => Text(
        formatConversationTimestamp(conversation.sentAt!.toLocal()),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
      );
}

class _OwnerSummary extends StatelessWidget {
  const _OwnerSummary({required this.owner, this.ownerTracked = true});

  final ConversationOwner? owner;
  final bool ownerTracked;

  @override
  Widget build(BuildContext context) {
    if (owner == null && !ownerTracked) return const SizedBox.shrink();
    return Row(
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
    );
  }
}

class _SalesStatus extends StatelessWidget {
  const _SalesStatus({required this.summary});

  final CustomerSalesSummary? summary;

  @override
  Widget build(BuildContext context) {
    final label = _statusLabel(context, summary?.status);
    if (label == null) return const SizedBox.shrink();
    return _Pill(text: label, color: AppColors.primary);
  }
}

class _SalesSummary extends StatelessWidget {
  const _SalesSummary({required this.summary});

  final CustomerSalesSummary? summary;

  @override
  Widget build(BuildContext context) {
    if (summary == null || summary!.isEmpty) return const SizedBox.shrink();
    final label = _statusLabel(context, summary!.status);
    final first = summary!.products.isEmpty ? null : summary!.products.first;
    final product = first == null
        ? null
        : '📱 ${first.modelName}${first.quantity > 1 ? ' ×${first.quantity}' : ''}${summary!.products.length > 1 ? ' +${summary!.products.length - 1}' : ''}';
    return Flexible(
      child: Text(
        product ?? label ?? '',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.primaryContainer,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 10.5,
              ),
        ),
      );
}

String? _statusLabel(BuildContext context, String? status) => switch (status) {
      'ONLINE' => '🌐 ${appLocalizations(context).statusOnline}',
      'INTERESTED' => '🎯 ${appLocalizations(context).statusInterested}',
      'PURCHASED' => '🛍️ ${appLocalizations(context).statusPurchased}',
      'FILM' => '🛡️ ${appLocalizations(context).statusFilm}',
      _ => null,
    };
