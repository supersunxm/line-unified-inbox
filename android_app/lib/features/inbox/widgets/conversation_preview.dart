import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/localization/localization.dart';

class ConversationPreview extends StatelessWidget {
  const ConversationPreview({
    super.key,
    this.preview,
    this.sentAt,
  });

  final String? preview;
  final DateTime? sentAt;

  @override
  Widget build(BuildContext context) {
    final localizations = appLocalizations(context);
    var displayPreview = preview?.trim();
    if (displayPreview == 'Sent an image') {
      displayPreview = localizations.sentAnImage;
    } else if (displayPreview?.startsWith('You:') == true) {
      displayPreview = '${localizations.you}:${displayPreview!.substring(4)}';
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text(
            displayPreview?.isNotEmpty == true
                ? displayPreview!
                : localizations.noMessagesYet,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 12.5,
                ),
          ),
        ),
        if (sentAt != null) ...[
          const SizedBox(width: 8),
          Text(
            _formatTimestamp(sentAt!.toLocal()),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
          ),
        ],
      ],
    );
  }

  String _formatTimestamp(DateTime value) {
    final now = DateTime.now();
    final sameDay = value.year == now.year &&
        value.month == now.month &&
        value.day == now.day;
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    if (sameDay) return '$hour:$minute';
    return '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}';
  }
}
