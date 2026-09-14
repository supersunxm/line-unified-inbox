import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/theme/app_colors.dart';

/// LINE-like composer surface. The plus action sheet is deliberately limited
/// to callbacks supplied by the conversation feature, so it cannot advertise
/// unsupported business modules.
class ChatComposer extends StatelessWidget {
  const ChatComposer({
    super.key,
    required this.controller,
    this.onAttach,
    this.onAttachCamera,
    this.onAttachGallery,
    this.onAttachVideo,
    this.onOpenSalesInfo,
    this.onOpenConversationInfo,
    this.onOpenStatus,
    this.onSend,
    this.enabled = true,
    this.isAttaching = false,
    this.isSending = false,
  });

  final TextEditingController controller;
  final VoidCallback? onAttach;
  final VoidCallback? onAttachCamera;
  final VoidCallback? onAttachGallery;
  final VoidCallback? onAttachVideo;
  final VoidCallback? onOpenSalesInfo;
  final VoidCallback? onOpenConversationInfo;
  final VoidCallback? onOpenStatus;
  final VoidCallback? onSend;
  final bool enabled;
  final bool isAttaching;
  final bool isSending;

  @override
  Widget build(BuildContext context) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 6),
          child: _composerRow(context),
        ),
      );

  Future<void> _showAttachmentMenu(BuildContext context) async {
    final l10n = appLocalizations(context);
    final action = await showModalBottomSheet<_ComposerAction>(
      context: context,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (sheetContext) {
        final actions = <_ComposerActionData>[
          if (enabled && onAttachCamera != null)
            _ComposerActionData(
              _ComposerAction.camera,
              Icons.camera_alt_outlined,
              l10n.takePhoto,
            ),
          if (enabled && onAttachGallery != null)
            _ComposerActionData(
              _ComposerAction.gallery,
              Icons.photo_library_outlined,
              l10n.chooseFromGallery,
            ),
          if (enabled &&
              onAttach != null &&
              onAttachCamera == null &&
              onAttachGallery == null)
            _ComposerActionData(
              _ComposerAction.image,
              Icons.image_outlined,
              l10n.attachImage,
            ),
          if (enabled && onAttachVideo != null)
            _ComposerActionData(
              _ComposerAction.video,
              Icons.videocam_outlined,
              _videoLabel(sheetContext),
            ),
          if (onOpenSalesInfo != null)
            _ComposerActionData(
              _ComposerAction.salesInfo,
              Icons.sell_outlined,
              l10n.customerSalesInformation,
            ),
          if (onOpenConversationInfo != null)
            _ComposerActionData(
              _ComposerAction.info,
              Icons.info_outline_rounded,
              l10n.customerProfile,
            ),
          if (onOpenStatus != null)
            _ComposerActionData(
              _ComposerAction.status,
              Icons.mark_chat_unread_outlined,
              l10n.replyStatus,
            ),
        ];
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Wrap(
              spacing: 10,
              runSpacing: 12,
              children: [
                for (final item in actions)
                  _ActionTile(
                    data: item,
                    onTap: () => Navigator.of(sheetContext).pop(item.action),
                  ),
              ],
            ),
          ),
        );
      },
    );

    if (!context.mounted || action == null) return;
    switch (action) {
      case _ComposerAction.image:
        onAttach?.call();
        return;
      case _ComposerAction.camera:
        onAttachCamera?.call();
        return;
      case _ComposerAction.gallery:
        onAttachGallery?.call();
        return;
      case _ComposerAction.video:
        onAttachVideo?.call();
        return;
      case _ComposerAction.salesInfo:
        onOpenSalesInfo?.call();
        return;
      case _ComposerAction.info:
        onOpenConversationInfo?.call();
        return;
      case _ComposerAction.status:
        onOpenStatus?.call();
        return;
    }
  }

  String _videoLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'วิดีโอ',
        'zh' => '视频',
        _ => 'Video',
      };

  String _attachmentLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'เพิ่มไฟล์แนบ',
        'zh' => '添加附件',
        _ => 'Add attachment',
      };

  Widget _composerRow(BuildContext context) {
    final hasSheetActions = onAttach != null ||
        onAttachCamera != null ||
        onAttachGallery != null ||
        onAttachVideo != null ||
        onOpenSalesInfo != null ||
        onOpenConversationInfo != null ||
        onOpenStatus != null;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        _ComposerIconButton(
          tooltip: _attachmentLabel(context),
          icon: Icons.add_rounded,
          onPressed:
              hasSheetActions ? () => _showAttachmentMenu(context) : null,
          filled: true,
        ),
        _ComposerIconButton(
          tooltip: appLocalizations(context).takePhoto,
          icon: Icons.camera_alt_outlined,
          onPressed: enabled && !isAttaching ? onAttachCamera : null,
        ),
        _ComposerIconButton(
          tooltip: appLocalizations(context).chooseFromGallery,
          icon: Icons.photo_outlined,
          onPressed: enabled && !isAttaching ? onAttachGallery : null,
        ),
        const SizedBox(width: 2),
        Expanded(
          child: TextField(
            controller: controller,
            enabled: enabled,
            minLines: 1,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: appLocalizations(context).replyToCustomer,
              hintStyle: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: const BorderSide(color: AppColors.primary),
              ),
              filled: true,
              fillColor: AppColors.surfaceMuted,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            ),
          ),
        ),
        const SizedBox(width: 4),
        _ComposerIconButton(
          tooltip: appLocalizations(context).sendReply,
          icon: Icons.arrow_upward_rounded,
          onPressed: enabled && !isSending ? onSend : null,
          filled: true,
          loading: isSending,
        ),
      ],
    );
  }
}

class _ComposerIconButton extends StatelessWidget {
  const _ComposerIconButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.filled = false,
    this.loading = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool filled;
  final bool loading;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 38,
        height: 42,
        child: IconButton(
          tooltip: tooltip,
          onPressed: onPressed,
          padding: EdgeInsets.zero,
          icon: loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Icon(icon, size: 21),
          style: IconButton.styleFrom(
            foregroundColor: filled ? Colors.white : AppColors.textPrimary,
            backgroundColor: filled ? AppColors.primary : Colors.transparent,
            disabledForegroundColor: AppColors.textSecondary.withAlpha(100),
            shape: const CircleBorder(),
          ),
        ),
      );
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.data, required this.onTap});

  final _ComposerActionData data;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 78,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Column(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    color: AppColors.surfaceMuted,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(data.icon, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 5),
                Text(
                  data.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
          ),
        ),
      );
}

enum _ComposerAction { image, camera, gallery, video, salesInfo, info, status }

class _ComposerActionData {
  const _ComposerActionData(this.action, this.icon, this.label);

  final _ComposerAction action;
  final IconData icon;
  final String label;
}
