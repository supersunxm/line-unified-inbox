import 'package:flutter/material.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import 'conversation_preview.dart';

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
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
          child: hqLayout
              ? _buildHqLayout(context)
              : _buildStoreLayout(context),
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
                StoreBadge(name: conversation.storeName, compact: true),
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
