import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/localization/localization.dart';

enum InboxFilter { all, notReplied, notifiedBm, replied, unread, priority }

class InboxFilterBar extends StatelessWidget {
  const InboxFilterBar({
    super.key,
    required this.selected,
    required this.onChanged,
    this.hqMode = false,
  });

  final InboxFilter selected;
  final ValueChanged<InboxFilter> onChanged;
  final bool hqMode;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        child: Row(
          children: (hqMode
                  ? const [
                      InboxFilter.all,
                      InboxFilter.notReplied,
                      InboxFilter.notifiedBm,
                      InboxFilter.replied,
                      InboxFilter.unread,
                    ]
                  : InboxFilter.values
                      .where((filter) => filter != InboxFilter.unread)
                      .toList())
              .map((filter) {
            final isSelected = filter == selected;
            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: FilterChip(
                selected: isSelected,
                label: Text(_label(context, filter)),
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? AppColors.primary : AppColors.textPrimary,
                ),
                avatar: Icon(
                  _icon(filter),
                  size: 14,
                  color:
                      isSelected ? AppColors.primary : AppColors.textSecondary,
                ),
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
                materialTapTargetSize: MaterialTapTargetSize.padded,
                selectedColor: AppColors.primaryContainer,
                checkmarkColor: AppColors.primary,
                showCheckmark: false,
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.border,
                  width: isSelected ? 1.2 : 1.0,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                onSelected: (value) {
                  if (!value) return;
                  onChanged(filter);
                },
              ),
            );
          }).toList(),
        ),
      );

  String _label(BuildContext context, InboxFilter filter) => switch (filter) {
        InboxFilter.all => appLocalizations(context).all,
        InboxFilter.notReplied => hqMode
            ? appLocalizations(context).notReplied
            : appLocalizations(context).needReply,
        InboxFilter.notifiedBm => appLocalizations(context).notifiedBm,
        InboxFilter.replied => hqMode
            ? appLocalizations(context).replied
            : appLocalizations(context).completed,
        InboxFilter.unread => appLocalizations(context).unread,
        InboxFilter.priority => appLocalizations(context).priority,
      };

  IconData _icon(InboxFilter filter) => switch (filter) {
        InboxFilter.all => Icons.inbox_outlined,
        InboxFilter.notReplied => Icons.reply_outlined,
        InboxFilter.notifiedBm => Icons.notifications_active_outlined,
        InboxFilter.replied => Icons.check_circle_outline,
        InboxFilter.unread => Icons.mark_email_unread_outlined,
        InboxFilter.priority => Icons.priority_high,
      };
}
