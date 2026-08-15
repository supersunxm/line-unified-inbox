import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class ConnectionStatusIndicator extends StatelessWidget {
  const ConnectionStatusIndicator({
    super.key,
    this.compact = false,
  });

  final bool compact;

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 5 : 7,
        ),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.support_agent_outlined,
              size: compact ? 14 : 16,
              color: AppColors.textSecondary,
            ),
            if (!compact) ...[
              const SizedBox(width: 6),
              Text(
                'Support queue',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ],
          ],
        ),
      );
}
