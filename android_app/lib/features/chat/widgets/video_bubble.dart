import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';

class VideoBubble extends StatefulWidget {
  const VideoBubble({
    super.key,
    required this.messageId,
    required this.media,
    required this.onLoad,
  });

  final String messageId;
  final ChatMedia? media;
  final Future<Uint8List> Function()? onLoad;

  @override
  State<VideoBubble> createState() => _VideoBubbleState();
}

class _VideoBubbleState extends State<VideoBubble> {
  VideoPlayerController? _controller;
  File? _file;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    final controller = _controller;
    if (controller != null) {
      controller.removeListener(_controllerChanged);
      unawaited(controller.dispose());
    }
    final file = _file;
    if (file != null) unawaited(file.delete().catchError((_) => file));
    super.dispose();
  }

  void _controllerChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _togglePlayback() async {
    final controller = _controller;
    if (controller != null) {
      if (controller.value.isPlaying) {
        await controller.pause();
      } else {
        await controller.play();
      }
      if (mounted) setState(() {});
      return;
    }
    final media = widget.media;
    final loader = widget.onLoad;
    if (_loading || media == null || !media.ready || loader == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });
    VideoPlayerController? nextController;
    File? file;
    try {
      final bytes = await loader();
      if (bytes.isEmpty) throw StateError('Video response was empty');
      final extension = _extensionFor(media.mimeType);
      final safeId =
          widget.messageId.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
      file = File('${Directory.systemTemp.path}/line-video-$safeId.$extension');
      await file.writeAsBytes(bytes, flush: true);
      nextController = VideoPlayerController.file(file);
      await nextController.initialize();
      nextController.addListener(_controllerChanged);
      if (!mounted) {
        nextController.removeListener(_controllerChanged);
        await nextController.dispose();
        try {
          await file.delete();
        } catch (_) {}
        nextController = null;
        file = null;
        return;
      }
      setState(() {
        _file = file;
        _controller = nextController;
        _loading = false;
      });
    } catch (_) {
      if (nextController != null) {
        nextController.removeListener(_controllerChanged);
        await nextController.dispose();
      }
      final failedFile = file;
      if (failedFile != null) {
        try {
          await failedFile.delete();
        } catch (_) {}
      }
      if (mounted) {
        setState(() {
          _loading = false;
          _error = appLocalizations(context).videoUnavailable;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = widget.media;
    final content = media == null
        ? _VideoState(
            icon: Icons.videocam_outlined,
            label: appLocalizations(context).videoProcessing,
          )
        : media.processingStatus != 'READY'
            ? _VideoState(
                icon: media.processingStatus == 'PENDING'
                    ? Icons.hourglass_empty
                    : Icons.broken_image_outlined,
                label: media.processingStatus == 'PENDING'
                    ? appLocalizations(context).videoProcessing
                    : appLocalizations(context).videoUnavailable,
              )
            : !media.ready
                ? _VideoState(
                    icon: Icons.broken_image_outlined,
                    label: appLocalizations(context).videoUnavailable,
                  )
                : _error != null
                    ? _VideoState(
                        icon: Icons.error_outline,
                        label: _error!,
                      )
                    : _playerContent(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(width: 240, height: 180, child: content),
      ),
    );
  }

  Widget _playerContent(BuildContext context) {
    final controller = _controller;
    if (controller == null) {
      if (widget.onLoad == null) {
        return _VideoState(
          icon: Icons.broken_image_outlined,
          label: appLocalizations(context).videoUnavailable,
        );
      }
      return Center(
        child: _loading
            ? Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(strokeWidth: 2),
                  const SizedBox(height: 8),
                  Text(
                    appLocalizations(context).loadingVideo,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                ],
              )
            : Semantics(
                button: true,
                label: appLocalizations(context).playVideo,
                child: IconButton(
                  onPressed: _togglePlayback,
                  tooltip: appLocalizations(context).playVideo,
                  iconSize: 54,
                  icon: const Icon(Icons.play_circle_fill),
                ),
              ),
      );
    }

    final value = controller.value;
    if (value.hasError) {
      return _VideoState(
        icon: Icons.error_outline,
        label: appLocalizations(context).videoUnavailable,
      );
    }
    if (!value.isInitialized) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(
          color: Colors.black,
          child: FittedBox(
            fit: BoxFit.contain,
            child: SizedBox(
              width: value.size.width,
              height: value.size.height,
              child: VideoPlayer(controller),
            ),
          ),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: ColoredBox(
            color: const Color(0x99000000),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: _togglePlayback,
                  tooltip: value.isPlaying
                      ? appLocalizations(context).pauseVideo
                      : appLocalizations(context).playVideo,
                  color: Colors.white,
                  icon: Icon(value.isPlaying ? Icons.pause : Icons.play_arrow),
                ),
                Expanded(
                  child: VideoProgressIndicator(
                    controller,
                    allowScrubbing: true,
                    colors: const VideoProgressColors(
                      playedColor: Colors.white,
                      bufferedColor: Colors.white54,
                      backgroundColor: Colors.white24,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _extensionFor(String? mimeType) => switch (mimeType?.toLowerCase()) {
        'video/quicktime' => 'mov',
        'video/3gpp' => '3gp',
        'video/webm' => 'webm',
        _ => 'mp4',
      };
}

class _VideoState extends StatelessWidget {
  const _VideoState({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: AppColors.textSecondary, size: 30),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ],
          ),
        ),
      );
}
