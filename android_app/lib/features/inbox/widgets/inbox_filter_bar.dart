import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/localization/localization.dart';

enum InboxFilter { all, notReplied, replied }

class InboxFilterBar extends StatelessWidget {
  const InboxFilterBar({
    super.key,
    required this.selected,
    required this.onChanged,
    required this.onSearch,
    this.hqMode = false,
  });

  final InboxFilter selected;
  final ValueChanged<InboxFilter> onChanged;
  final VoidCallback onSearch;
  final bool hqMode;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        child: Row(
          children: [
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: const [
                    InboxFilter.all,
                    InboxFilter.notReplied,
                    InboxFilter.replied,
                  ].map((filter) {
                    final isSelected = filter == selected;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: FilterChip(
                        selected: isSelected,
                        label: Text(_label(context, filter)),
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.textPrimary,
                        ),
                        avatar: Icon(
                          _icon(filter),
                          size: 14,
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.textSecondary,
                        ),
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 0),
                        materialTapTargetSize: MaterialTapTargetSize.padded,
                        selectedColor: AppColors.primaryContainer,
                        checkmarkColor: AppColors.primary,
                        showCheckmark: false,
                        side: BorderSide(
                          color:
                              isSelected ? AppColors.primary : AppColors.border,
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
              ),
            ),
            const SizedBox(width: 4),
            SizedBox(
              width: 42,
              height: 40,
              child: OutlinedButton(
                key: const Key('inbox-search-button'),
                onPressed: onSearch,
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.zero,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Icon(
                  Icons.search,
                  size: 20,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
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
