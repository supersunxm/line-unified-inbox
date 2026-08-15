import 'package:flutter/material.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_widgets.dart';
import 'conversation_preview.dart';

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
      color: unread ? AppColors.primaryContainer.withValues(alpha: 0.42) : null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              UserAvatar(displayName: conversation.customerName, radius: 24),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            conversation.customerName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                        if (unread) ...[
                          const SizedBox(width: AppSpacing.sm),
                          UnreadBadge(count: conversation.unreadCount),
                        ],
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    StoreBadge(name: conversation.storeName, compact: true),
                    const SizedBox(height: AppSpacing.md),
                    ConversationPreview(
                      preview: conversation.preview,
                      sentAt: conversation.sentAt,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        StatusBadge(
                          status: conversation.bmReplyStatus,
                          compact: true,
                        ),
                        const Spacer(),
                        const Icon(Icons.chevron_right,
                            color: AppColors.textSecondary),
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
