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
  });

  final ConversationSummary conversation;
  final VoidCallback onTap;

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
          child: Row(
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
                    // Row 1: Customer Name + Unread Badge
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.customerName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
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

                    // Row 2: Store Name
                    StoreBadge(name: conversation.storeName, compact: true),
                    const SizedBox(height: 2),

                    // Row 3: Preview Message + SentAt
                    ConversationPreview(
                      preview: conversation.preview,
                      sentAt: conversation.sentAt,
                    ),
                    const SizedBox(height: 3),

                    // Row 4: Status Badges + Priority + Chevron
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
                                compact: true,
                              ),
                              if (conversation.priority.isActionable) ...[
                                PriorityBadge(priority: conversation.priority),
                                Text(
                                  appLocalizations(context).waitingFor(
                                    formatWaitingDuration(
                                        conversation.priority.waitingSeconds),
                                  ),
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
                        const Icon(
                          Icons.chevron_right,
                          size: 16,
                          color: AppColors.textSecondary,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
