import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/status_badge.dart';
import 'inbox_filter_bar.dart';

/// Compact status/filter rail shown below the inbox search field.
class ConversationOverviewCard extends StatelessWidget {
  const ConversationOverviewCard({
    super.key,
    required this.conversations,
    this.monthlyTotal,
    this.monthlyNeedReply,
    this.monthlyCompleted,
    this.totalCount,
    this.selected = InboxFilter.all,
    this.onChanged,
    this.onSearch,
  });

  final List<ConversationSummary> conversations;
  final int? monthlyTotal;
  final int? monthlyNeedReply;
  final int? monthlyCompleted;
  final int? totalCount;
  final InboxFilter selected;
  final ValueChanged<InboxFilter>? onChanged;
  final VoidCallback? onSearch;

  @override
  Widget build(BuildContext context) {
    final needReply = monthlyNeedReply ??
        conversations
            .where((item) => isNeedReplyStatus(item.bmReplyStatus))
            .length;
    final completed = monthlyCompleted ??
        conversations
            .where((item) => isCompletedStatus(item.bmReplyStatus))
            .length;
    final metrics = [
      (
        InboxFilter.all,
        appLocalizations(context).all,
        totalCount ?? monthlyTotal ?? conversations.length,
        AppColors.textPrimary
      ),
      (
        InboxFilter.notReplied,
        appLocalizations(context).needReply,
        needReply,
        AppColors.warning
      ),
      (
        InboxFilter.replied,
        appLocalizations(context).completed,
        completed,
        AppColors.success
      ),
    ];

    return SizedBox(
      height: 45,
      child: Row(
        children: [
          Expanded(
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 2, 8, 4),
              itemCount: metrics.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (context, index) {
                final metric = metrics[index];
                final isSelected = selected == metric.$1;
                return FilterChip(
                  selected: isSelected,
                  onSelected: onChanged == null
                      ? null
                      : (value) {
                          if (value) onChanged!(metric.$1);
                        },
                  showCheckmark: false,
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(metric.$2),
                      const SizedBox(width: 5),
                      Text('${metric.$3}'),
                    ],
                  ),
                  labelStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: isSelected ? Colors.white : metric.$4,
                        fontWeight: FontWeight.w700,
                      ),
                  backgroundColor: AppColors.surface,
                  selectedColor: AppColors.textPrimary,
                  side: BorderSide(
                    color:
                        isSelected ? AppColors.textPrimary : AppColors.border,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                );
              },
            ),
          ),
          if (onSearch != null)
            Padding(
              padding: const EdgeInsets.only(right: 10, bottom: 2),
              child: IconButton(
                key: const Key('inbox-search-button'),
                onPressed: onSearch,
                tooltip: appLocalizations(context).searchConversations,
                icon: const Icon(Icons.tune_rounded, size: 20),
                style: IconButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  backgroundColor: AppColors.surfaceMuted,
                  minimumSize: const Size(38, 38),
                  padding: EdgeInsets.zero,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
