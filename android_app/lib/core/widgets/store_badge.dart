import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StoreBadge extends StatelessWidget {
  const StoreBadge({
    super.key,
    required this.name,
    this.code,
    this.compact = false,
  });

  final String name;
  final String? code;
  final bool compact;

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 4 : 6,
        ),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.storefront_outlined, size: 16),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                code == null || code!.trim().isEmpty ? name : '$name · $code',
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ),
          ],
        ),
      );
}
