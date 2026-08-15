import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/localization/localization.dart';

class ImageBubble extends StatelessWidget {
  const ImageBubble({
    super.key,
    required this.media,
    required this.bytes,
    this.onOpen,
  });

  final ChatMedia? media;
  final Uint8List? bytes;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final Widget content;
    if (media == null) {
      content = _ImageState(
        icon: Icons.image_outlined,
        label: appLocalizations(context).imageProcessing,
      );
    } else if (media!.processingStatus != 'READY') {
      content = _ImageState(
        icon: media!.processingStatus == 'PENDING'
            ? Icons.hourglass_empty
            : Icons.broken_image_outlined,
        label: media!.processingStatus == 'PENDING'
            ? appLocalizations(context).imageProcessing
            : appLocalizations(context).imageUnavailable,
      );
    } else if (bytes == null) {
      content = _ImageState(
        icon: Icons.image_outlined,
        label: appLocalizations(context).loadingImage,
        loading: true,
      );
    } else {
      content = GestureDetector(
        onTap: onOpen,
        child: Semantics(
          button: onOpen != null,
          label: appLocalizations(context).openImage,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.memory(bytes!, fit: BoxFit.contain),
          ),
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(width: 240, height: 240, child: content),
      ),
    );
  }
}

class _ImageState extends StatelessWidget {
  const _ImageState({
    required this.icon,
    required this.label,
    this.loading = false,
  });

  final IconData icon;
  final String label;
  final bool loading;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.textSecondary, size: 30),
            const SizedBox(height: 8),
            if (loading)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
          ],
        ),
      );
}
