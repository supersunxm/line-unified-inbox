import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';

class PriorityBadge extends StatelessWidget {
  const PriorityBadge({super.key, required this.priority});

  final ConversationPriority priority;

  @override
  Widget build(BuildContext context) {
    if (!priority.isActionable) return const SizedBox.shrink();
    final colors = _colors(priority.level);
    final localizations = appLocalizations(context);
    final label = switch (priority.level) {
      'URGENT' => localizations.urgent,
      'HIGH' => localizations.attention,
      _ => localizations.normal,
    };
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.foreground.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 8, color: colors.foreground),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: colors.foreground,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }

  _PriorityColors _colors(String level) => switch (level) {
        'URGENT' => const _PriorityColors(
            foreground: AppColors.error, background: Color(0xFFFFEBEE)),
        'HIGH' => const _PriorityColors(
            foreground: AppColors.warning, background: Color(0xFFFFF4E5)),
        _ => const _PriorityColors(
            foreground: AppColors.success, background: Color(0xFFEAF7EE)),
      };
}

class _PriorityColors {
  const _PriorityColors({required this.foreground, required this.background});

  final Color foreground;
  final Color background;
}
