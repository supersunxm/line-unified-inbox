import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.status,
    this.label,
    this.compact = false,
  });

  final String status;
  final String? label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(status);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label ?? conversationStatusLabel(status),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colors.$2,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }

  (Color, Color) _colors(String value) {
    final normalized = value.toUpperCase();
    if (normalized.contains('FAIL') ||
        normalized.contains('REJECT') ||
        normalized.contains('SUSPEND')) {
      return (AppColors.errorContainer, AppColors.error);
    }
    if (normalized.contains('PENDING') ||
        normalized.contains('NOT_REPLIED') ||
        normalized.contains('NOTIFIED_BM') ||
        normalized.contains('PROCESSING')) {
      return (AppColors.warningContainer, AppColors.warning);
    }
    if (normalized.contains('ACTIVE') ||
        normalized.contains('REPLIED') ||
        normalized.contains('SENT') ||
        normalized.contains('READY')) {
      return (AppColors.successContainer, AppColors.success);
    }
    return (AppColors.surfaceMuted, AppColors.textSecondary);
  }
}

bool isNeedReplyStatus(String value) {
  final normalized = value.toUpperCase();
  return normalized == 'NOT_REPLIED' || normalized == 'NOTIFIED_BM';
}

bool isCompletedStatus(String value) => value.toUpperCase() == 'REPLIED';

String conversationStatusLabel(String value) {
  if (isNeedReplyStatus(value)) return 'Need Reply';
  if (isCompletedStatus(value)) return 'Completed';
  return value
      .toLowerCase()
      .split('_')
      .map((part) =>
          part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
