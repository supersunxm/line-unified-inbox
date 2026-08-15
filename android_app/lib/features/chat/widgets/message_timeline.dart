import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import 'image_bubble.dart';
import 'message_bubble.dart';

class PendingTimelineMessage {
  const PendingTimelineMessage({
    required this.key,
    required this.isImage,
    required this.isSending,
    this.text,
    this.bytes,
    this.filename,
  });

  final String key;
  final bool isImage;
  final bool isSending;
  final String? text;
  final Uint8List? bytes;
  final String? filename;
}

class MessageTimeline extends StatelessWidget {
  const MessageTimeline({
    super.key,
    required this.controller,
    required this.messages,
    required this.pendingMessages,
    required this.loadingOlder,
    required this.mediaBytes,
    this.onLoadOlder,
    this.onRetryMessage,
    this.onOpenImage,
    this.onLoadMedia,
    this.onUserScroll,
    this.isProgrammaticScroll,
  });

  final ScrollController controller;
  final List<ChatMessage> messages;
  final List<PendingTimelineMessage> pendingMessages;
  final bool loadingOlder;
  final Map<String, Uint8List> mediaBytes;
  final VoidCallback? onLoadOlder;
  final ValueChanged<String>? onRetryMessage;
  final ValueChanged<Uint8List>? onOpenImage;
  final void Function(ChatMedia media, String messageId)? onLoadMedia;
  final VoidCallback? onUserScroll;
  final bool Function()? isProgrammaticScroll;

  bool get _programmatic => isProgrammaticScroll?.call() ?? false;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          if (loadingOlder) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: Listener(
              onPointerDown: (_) {
                if (!_programmatic) onUserScroll?.call();
              },
              child: NotificationListener<ScrollNotification>(
                onNotification: (notification) {
                  if (!_programmatic &&
                      notification is UserScrollNotification &&
                      notification.direction != ScrollDirection.idle) {
                    onUserScroll?.call();
                  }
                  if (!_programmatic && notification.metrics.pixels < 100) {
                    onLoadOlder?.call();
                  }
                  return false;
                },
                child: ListView.builder(
                  controller: controller,
                  padding: const EdgeInsets.all(12),
                  itemCount: messages.length + pendingMessages.length,
                  itemBuilder: (context, index) {
                    if (index < messages.length) {
                      return _messageRow(context, messages[index], index);
                    }
                    return _pendingRow(
                        context, pendingMessages[index - messages.length]);
                  },
                ),
              ),
            ),
          ),
        ],
      );

  Widget _messageRow(BuildContext context, ChatMessage message, int index) {
    final previous = index == 0 ? null : messages[index - 1];
    final separator = previous == null ||
        !_sameDay(previous.sentAt.toLocal(), message.sentAt.toLocal());
    return Column(
      children: [
        if (separator)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              _dayLabel(message.sentAt.toLocal()),
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ),
        _messageBubble(message),
      ],
    );
  }

  Widget _messageBubble(ChatMessage message) {
    final outbound = message.direction == 'OUTBOUND';
    final media = message.media;
    final image = message.messageType == 'IMAGE';
    if (image && media != null && media.ready) {
      onLoadMedia?.call(media, message.id);
    }
    final bytes = mediaBytes[message.id];
    return MessageBubble(
      text: message.text,
      outbound: outbound,
      timestamp: message.sentAt.toLocal(),
      message: message,
      footer: outbound ? 'Sent' : null,
      content: image
          ? ImageBubble(
              media: media,
              bytes: bytes,
              onOpen: bytes == null || onOpenImage == null
                  ? null
                  : () => onOpenImage!(bytes),
            )
          : null,
    );
  }

  Widget _pendingRow(BuildContext context, PendingTimelineMessage pending) {
    if (pending.isImage) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          constraints: const BoxConstraints(maxWidth: 300),
          decoration: BoxDecoration(
            color: AppColors.primaryContainer,
            border: Border.all(color: AppColors.primaryContainer),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(18),
              topRight: Radius.circular(18),
              bottomLeft: Radius.circular(18),
              bottomRight: Radius.circular(5),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Image.memory(
                pending.bytes!,
                width: 240,
                height: 240,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                pending.isSending ? 'Sending…' : 'Failed · Retry',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: pending.isSending
                          ? AppColors.textSecondary
                          : AppColors.error,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              if (!pending.isSending)
                TextButton(
                  onPressed: onRetryMessage == null
                      ? null
                      : () => onRetryMessage!(pending.key),
                  child: const Text('Retry'),
                ),
            ],
          ),
        ),
      );
    }

    return MessageBubble(
      text: pending.text ?? '',
      outbound: true,
      timestamp: DateTime.now(),
      footer: pending.isSending ? 'Sending…' : 'Failed · Retry',
      onRetry: pending.isSending || onRetryMessage == null
          ? null
          : () => onRetryMessage!(pending.key),
    );
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  String _dayLabel(DateTime date) {
    final now = DateTime.now();
    if (_sameDay(date, now)) return 'Today';
    final yesterday = now.subtract(const Duration(days: 1));
    if (_sameDay(date, yesterday)) return 'Yesterday';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }
}
