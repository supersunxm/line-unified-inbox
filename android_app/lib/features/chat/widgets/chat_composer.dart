import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/localization/localization.dart';

class ChatComposer extends StatelessWidget {
  const ChatComposer({
    super.key,
    required this.controller,
    this.onAttach,
    this.onAttachVideo,
    this.onSend,
    this.enabled = true,
    this.isAttaching = false,
    this.isSending = false,
  });

  final TextEditingController controller;
  final VoidCallback? onAttach;
  final VoidCallback? onAttachVideo;
  final VoidCallback? onSend;
  final bool enabled;
  final bool isAttaching;
  final bool isSending;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.md,
        ),
        child: _composerRow(context),
      ),
    );
  }

  Future<void> _showAttachmentMenu(BuildContext context) async {
    final l10n = appLocalizations(context);
    final action = await showModalBottomSheet<_AttachmentAction>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.image_outlined),
              title: Text(l10n.attachImage),
              onTap: () =>
                  Navigator.of(sheetContext).pop(_AttachmentAction.image),
            ),
            ListTile(
              leading: const Icon(Icons.videocam_outlined),
              title: Text(_videoLabel(sheetContext)),
              subtitle: onAttachVideo == null ? Text(l10n.comingSoon) : null,
              onTap: () =>
                  Navigator.of(sheetContext).pop(_AttachmentAction.video),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
        ),
      ),
    );

    if (!context.mounted || action == null) return;
    switch (action) {
      case _AttachmentAction.image:
        onAttach?.call();
      case _AttachmentAction.video:
        if (onAttachVideo != null) {
          onAttachVideo!.call();
          return;
        }
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(l10n.comingSoon)));
    }
  }

  String _videoLabel(BuildContext context) {
    return switch (Localizations.localeOf(context).languageCode) {
      'th' => 'วิดีโอ',
      'zh' => '视频',
      _ => 'Video',
    };
  }

  Widget _composerRow(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.border),
          boxShadow: const [
            BoxShadow(
              color: Color(0x10000000),
              blurRadius: 12,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            SizedBox(
              width: 44,
              height: 44,
              child: IconButton.filledTonal(
                tooltip: appLocalizations(context).moreActions,
                onPressed: enabled &&
                        !isAttaching &&
                        (onAttach != null || onAttachVideo != null)
                    ? () => _showAttachmentMenu(context)
                    : null,
                icon: isAttaching
                    ? const SizedBox(
                        width: 19,
                        height: 19,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add_rounded),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: TextField(
                controller: controller,
                enabled: enabled,
                minLines: 1,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: appLocalizations(context).replyToCustomer,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: false,
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            SizedBox(
              width: 44,
              height: 44,
              child: IconButton.filled(
                tooltip: appLocalizations(context).sendReply,
                onPressed: enabled && !isSending ? onSend : null,
                icon: isSending
                    ? const SizedBox(
                        width: 19,
                        height: 19,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.arrow_upward_rounded),
              ),
            ),
          ],
        ),
      );
}

enum _AttachmentAction { image, video }
