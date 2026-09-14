import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../pdf_attachment.dart';

class PdfBubble extends StatelessWidget {
  const PdfBubble({
    super.key,
    required this.filename,
    this.fileSize,
    this.media,
    this.onOpen,
    this.onRetry,
    this.isSending = false,
  });

  final String filename;
  final int? fileSize;
  final ChatMedia? media;
  final Future<void> Function()? onOpen;
  final VoidCallback? onRetry;
  final bool isSending;

  @override
  Widget build(BuildContext context) {
    final status = media?.processingStatus;
    final displaySize = fileSize ?? media?.fileSize;
    final ready = status == 'READY' && onOpen != null;
    final pending = !isSending && status == 'PENDING';
    final failed = !isSending &&
        status != null &&
        status != 'READY' &&
        status != 'PENDING';
    return InkWell(
      onTap: ready ? () => onOpen!() : null,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        constraints: const BoxConstraints(minWidth: 220, maxWidth: 300),
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.picture_as_pdf_outlined,
                color: AppColors.error, size: 34),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    filename,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    isSending
                        ? appLocalizations(context).sending
                        : pending
                            ? appLocalizations(context).sending
                            : failed
                                ? appLocalizations(context).pdfUnavailable
                                : '${appLocalizations(context).pdfFile}${formatPdfFileSize(displaySize).isEmpty ? '' : ' · ${formatPdfFileSize(displaySize)}'}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: failed
                              ? AppColors.error
                              : AppColors.textSecondary,
                        ),
                  ),
                  if (failed && onRetry != null)
                    TextButton(
                      onPressed: onRetry,
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 28),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(appLocalizations(context).retry),
                    ),
                ],
              ),
            ),
            if (ready)
              const Padding(
                padding: EdgeInsets.only(left: AppSpacing.xs),
                child: Icon(Icons.open_in_new, size: 20),
              ),
          ],
        ),
      ),
    );
  }
}
