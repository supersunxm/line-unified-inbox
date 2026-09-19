import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import 'message_link_text.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.text,
    required this.outbound,
    required this.timestamp,
    this.message,
    this.footer,
    this.onRetry,
    this.content,
  });

  final String text;
  final bool outbound;
  final DateTime timestamp;
  final ChatMessage? message;
  final String? footer;
  final VoidCallback? onRetry;
  final Widget? content;

  @override
  Widget build(BuildContext context) {
    // An outbound message is attributed only from its persisted sender
    // payload. Do not substitute the currently logged-in user (or a generic
    // store label) when the backend has no sender identity.
    final senderLabel = outbound
        ? message?.sender?.displayName
        : appLocalizations(context).customer;
    final footerText = footer?.trim();
    final isFailed = message?.deliveryStatus == 'FAILED' ||
        (footerText?.toLowerCase().contains('fail') ?? false) ||
        (footerText?.contains('ไม่สำเร็จ') ?? false) ||
        (footerText?.contains('ล้มเหลว') ?? false);
    final isSending = footerText?.toLowerCase().contains('sending') ?? false;
    final isDeliveryCheck = footerText == '✓' || footerText == '✓✓';
    final bubbleColor =
        outbound ? AppColors.primaryContainer : AppColors.surface;
    final borderColor =
        outbound ? AppColors.primaryContainer : AppColors.border;
    return Align(
      alignment: outbound ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 7),
          decoration: BoxDecoration(
            color: bubbleColor,
            border: outbound ? null : Border.all(color: borderColor),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(outbound ? 18 : 5),
              bottomRight: Radius.circular(outbound ? 5 : 18),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (senderLabel != null) ...[
                Text(
                  senderLabel,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: outbound
                            ? AppColors.onPrimaryContainer
                            : AppColors.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
              ],
              DefaultTextStyle(
                style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                      color: AppColors.textPrimary,
                    ),
                child: content ?? MessageLinkText(text: text),
              ),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: AppSpacing.xs,
                runSpacing: 2,
                children: [
                  Text(
                    _time(timestamp),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                  if (footerText != null && footerText.isNotEmpty) ...[
                    const SizedBox(width: AppSpacing.sm),
                    if (isFailed) ...[
                      const Icon(
                        Icons.error_outline,
                        size: 14,
                        color: AppColors.error,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        footerText == '✓' || footerText == '✓✓'
                            ? 'ส่งไม่สำเร็จ'
                            : footerText,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.error,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      if (onRetry != null) ...[
                        const SizedBox(width: AppSpacing.xs),
                        InkWell(
                          onTap: onRetry,
                          borderRadius: BorderRadius.circular(4),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 2,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.refresh,
                                  size: 13,
                                  color: AppColors.primary,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  appLocalizations(context).retry,
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelSmall
                                      ?.copyWith(
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ] else if (onRetry == null) ...[
                      if (!isDeliveryCheck) ...[
                        Icon(
                          isSending
                              ? Icons.schedule_outlined
                              : Icons.done_all,
                          size: 14,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                      ],
                      Text(
                        footerText,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: isDeliveryCheck
                                  ? FontWeight.w700
                                  : null,
                            ),
                      ),
                    ] else
                      TextButton(
                        onPressed: onRetry,
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(0, 32),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(footerText),
                      ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _time(DateTime value) =>
      '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}
