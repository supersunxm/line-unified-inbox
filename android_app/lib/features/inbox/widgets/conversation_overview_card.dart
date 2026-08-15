import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
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
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.sm,
        AppSpacing.xl,
        AppSpacing.sm,
      ),
      child: Card(
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    appLocalizations(context).todayAtAGlance,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: _Metric(
                      label: appLocalizations(context).total,
                      value: conversations.length,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Expanded(
                    child: _Metric(
                      label: appLocalizations(context).needReply,
                      value: needReply,
                      color: AppColors.warning,
                    ),
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
            ],
          ),
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(
      {required this.label, required this.value, required this.color});

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$value',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      );
}
