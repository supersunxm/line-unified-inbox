import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/status_badge.dart';

class ConversationOverviewCard extends StatelessWidget {
  const ConversationOverviewCard({
    super.key,
    required this.conversations,
  });

  final List<ConversationSummary> conversations;

  @override
  Widget build(BuildContext context) {
    final completed = conversations
        .where((item) => isCompletedStatus(item.bmReplyStatus))
        .length;
    final needReply = conversations.length - completed;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: _Metric(
                label: appLocalizations(context).total,
                value: conversations.length,
                color: AppColors.textPrimary,
              ),
            ),
            Container(
              width: 1,
              height: 32,
              color: AppColors.border,
            ),
            Expanded(
              child: _Metric(
                label: appLocalizations(context).needReply,
                value: needReply,
                color: AppColors.warning,
              ),
            ),
            Container(
              width: 1,
              height: 32,
              color: AppColors.border,
            ),
            Expanded(
              child: _Metric(
                label: appLocalizations(context).completed,
                value: completed,
                color: AppColors.success,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            '$value',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  height: 1.1,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                  fontSize: 11,
                ),
          ),
        ],
      );
}
