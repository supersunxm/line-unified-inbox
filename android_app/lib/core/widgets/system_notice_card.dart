import 'package:flutter/material.dart';

import '../localization/localization.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Presents operational/sync failures without leaking raw technical copy into
/// the visual flow of the conversation.
class SystemNoticeCard extends StatelessWidget {
  const SystemNoticeCard({
    super.key,
    required this.message,
    this.technicalDetail,
    this.onRetry,
    this.onDetails,
  });

  final String message;
  final String? technicalDetail;
  final VoidCallback? onRetry;
  final VoidCallback? onDetails;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.xs,
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.warningContainer.withAlpha(210),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFF1D79A)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 1),
                  child: Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.warning,
                    size: 19,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    message,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF714D00),
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                        ),
                  ),
                ),
              ],
            ),
            if (technicalDetail?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 3),
              Padding(
                padding: const EdgeInsets.only(left: 27),
                child: Text(
                  technicalDetail!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF8A6B2B),
                        fontWeight: FontWeight.w500,
                      ),
                ),
              ),
            ],
            if (onRetry != null || onDetails != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  if (onRetry != null)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onRetry,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(36),
                          foregroundColor: AppColors.textPrimary,
                          backgroundColor: Colors.white.withAlpha(170),
                          side: const BorderSide(color: Color(0xFFE7C978)),
                          padding: EdgeInsets.zero,
                        ),
                        child: Text(appLocalizations(context).retry),
                      ),
                    ),
                  if (onRetry != null && onDetails != null)
                    const SizedBox(width: AppSpacing.sm),
                  if (onDetails != null)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onDetails,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(36),
                          foregroundColor: AppColors.textPrimary,
                          backgroundColor: Colors.white.withAlpha(170),
                          side: const BorderSide(color: Color(0xFFE7C978)),
                          padding: EdgeInsets.zero,
                        ),
                        child: Text(_detailsLabel(context)),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      );

  String _detailsLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'ดูรายละเอียด',
        'zh' => '查看详情',
        _ => 'View details',
      };
}
