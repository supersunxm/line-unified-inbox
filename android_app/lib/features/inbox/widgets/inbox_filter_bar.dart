import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/localization/localization.dart';

enum InboxFilter { all, notReplied, replied }

class InboxFilterBar extends StatelessWidget {
  const InboxFilterBar({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  final InboxFilter selected;
  final ValueChanged<InboxFilter> onChanged;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
        child: Row(
          children: InboxFilter.values.map((filter) {
            final isSelected = filter == selected;
            return Padding(
              padding: const EdgeInsets.only(right: AppSpacing.sm),
              child: FilterChip(
                selected: isSelected,
                label: Text(_label(context, filter)),
                avatar: Icon(_icon(filter), size: 16),
                selectedColor: AppColors.primaryContainer,
                checkmarkColor: AppColors.primary,
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.border,
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
        InboxFilter.notReplied => appLocalizations(context).needReply,
        InboxFilter.replied => appLocalizations(context).completed,
      };

  IconData _icon(InboxFilter filter) => switch (filter) {
        InboxFilter.all => Icons.inbox_outlined,
        InboxFilter.notReplied => Icons.reply_outlined,
        InboxFilter.replied => Icons.check_circle_outline,
      };
}
