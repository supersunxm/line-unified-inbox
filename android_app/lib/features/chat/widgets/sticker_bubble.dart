import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';

class StickerBubble extends StatelessWidget {
  const StickerBubble({super.key, this.sticker});

  final StickerPresentation? sticker;

  @override
  Widget build(BuildContext context) {
    final detail = sticker?.firstUsefulText;
    return Semantics(
      label: appLocalizations(context).sentASticker,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 180),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  key: const ValueKey('line-sticker-indicator'),
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: const Color(0xFF06C755),
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Flexible(
                  child: Text(
                    appLocalizations(context).sentASticker,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
              ],
            ),
            if (detail != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                detail,
                key: const ValueKey('line-sticker-text'),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
