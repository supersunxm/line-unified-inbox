import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// A small, low-noise status treatment for dense inbox and chat surfaces.
class CompactStatusChip extends StatelessWidget {
  const CompactStatusChip({
    super.key,
    required this.label,
    this.color = AppColors.textPrimary,
    this.backgroundColor = AppColors.surfaceMuted,
    this.icon,
    this.selected = false,
  });

  final String label;
  final Color color;
  final Color backgroundColor;
  final IconData? icon;
  final bool selected;

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 30),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.textPrimary : backgroundColor,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.textPrimary : backgroundColor,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 15, color: selected ? Colors.white : color),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: selected ? Colors.white : color,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      );
}
