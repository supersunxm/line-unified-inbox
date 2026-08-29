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
    final isFailed = footerText?.toLowerCase().contains('fail') ?? false;
    final isSending = footerText?.toLowerCase().contains('sending') ?? false;
    final bubbleColor =
        outbound ? AppColors.primaryContainer : AppColors.surface;
    final borderColor =
        outbound ? AppColors.primaryContainer : AppColors.border;
    return Align(
      alignment: outbound ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: bubbleColor,
            border: Border.all(color: borderColor),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
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
              const SizedBox(height: AppSpacing.xs),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _time(timestamp),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                  if (footerText != null && footerText.isNotEmpty) ...[
                    const SizedBox(width: AppSpacing.sm),
                    if (onRetry == null) ...[
                      Icon(
                        isFailed
                            ? Icons.error_outline
                            : isSending
                                ? Icons.schedule_outlined
                                : Icons.done_all,
                        size: 14,
                        color: isFailed
                            ? AppColors.error
                            : AppColors.textSecondary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        footerText,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: isFailed
                                  ? AppColors.error
                                  : AppColors.textSecondary,
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
