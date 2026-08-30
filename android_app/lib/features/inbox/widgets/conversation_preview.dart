import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/localization/localization.dart';

class ConversationPreview extends StatelessWidget {
  const ConversationPreview({
    super.key,
    this.preview,
    this.sentAt,
    this.showTimestamp = true,
  });

  final String? preview;
  final DateTime? sentAt;
  final bool showTimestamp;

  @override
  Widget build(BuildContext context) {
    final localizations = appLocalizations(context);
    final displayPreview = localizedConversationPreview(context, preview);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text(
            displayPreview.isNotEmpty
                ? displayPreview
                : localizations.noMessagesYet,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 12.5,
                ),
          ),
        ),
        if (showTimestamp && sentAt != null) ...[
          const SizedBox(width: 8),
          Text(
            formatConversationTimestamp(sentAt!.toLocal()),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
          ),
        ],
      ],
    );
  }
}

String localizedConversationPreview(BuildContext context, String? preview) {
  final localizations = appLocalizations(context);
  var displayPreview = preview?.trim() ?? '';
  var outbound = false;
  if (displayPreview.startsWith('You:')) {
    outbound = true;
    displayPreview = displayPreview.substring(4).trimLeft();
  }
  if (displayPreview == 'Sent an image') {
    displayPreview = localizations.sentAnImage;
  } else if (displayPreview == 'Sent a video') {
    displayPreview = localizations.sentAVideo;
  } else if (displayPreview == 'Sent a LINE sticker') {
    displayPreview = localizations.sentASticker;
  }
  if (outbound) displayPreview = '${localizations.you}: $displayPreview';
  return displayPreview;
}

String formatConversationTimestamp(DateTime value) {
  final now = DateTime.now();
  final sameDay = value.year == now.year &&
      value.month == now.month &&
      value.day == now.day;
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  if (sameDay) return '$hour:$minute';
  return '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}';
}
