import 'package:flutter/material.dart';
import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import 'conversation_preview.dart';
import 'priority_badge.dart';
import '../priority.dart';

class ConversationCard extends StatelessWidget {
  const ConversationCard({
    super.key,
    required this.conversation,
    required this.onTap,
    this.hqLayout = false,
  });

  final ConversationSummary conversation;
  final VoidCallback onTap;
  final bool hqLayout;

  @override
  Widget build(BuildContext context) {
    final unread = conversation.unreadCount > 0;
    return Card(
      margin: EdgeInsets.zero,
      color: unread ? AppColors.primaryContainer.withValues(alpha: 0.35) : null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
          child: hqLayout
              ? _buildHqLayout(context, unread)
              : _buildStoreLayout(context, unread),
        ),
      ),
    );
  }

  Widget _buildHqLayout(BuildContext context, bool unread) => Column(
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
              if (unread) ...[
                const SizedBox(width: 6),
                UnreadBadge(count: conversation.unreadCount),
              ],
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
              if (conversation.priority.isActionable) ...[
                const SizedBox(width: 6),
                PriorityBadge(priority: conversation.priority),
              ],
              const Spacer(),
              const Icon(Icons.chevron_right,
                  size: 16, color: AppColors.textSecondary),
            ],
          ),
        ],
      );

  Widget _buildStoreLayout(BuildContext context, bool unread) => Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          UserAvatar(
            displayName: conversation.customerName,
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
                    if (unread) ...[
                      const SizedBox(width: 6),
                      UnreadBadge(count: conversation.unreadCount),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                StoreBadge(name: conversation.storeName, compact: true),
                const SizedBox(height: 2),
                ConversationPreview(
                    preview: conversation.preview, sentAt: conversation.sentAt),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 4,
                        runSpacing: 2,
                        children: [
                          StatusBadge(
                              status: conversation.bmReplyStatus,
                              compact: true),
                          if (conversation.priority.isActionable) ...[
                            PriorityBadge(priority: conversation.priority),
                            Text(
                              appLocalizations(context).waitingFor(
                                  formatWaitingDuration(
                                      conversation.priority.waitingSeconds)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 10.5,
                                  ),
                            ),
                          ],
                        ],
                      ),
                    ),
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
