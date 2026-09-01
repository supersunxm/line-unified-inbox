import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/services/media_save_service.dart';
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

  Future<void> _openFullscreen() async {
    final controller = _controller;
    final file = _file;
    if (controller == null || file == null || !controller.value.isInitialized) {
      return;
    }
    final wasPlaying = controller.value.isPlaying;
    final initialPosition = controller.value.position;
    await controller.pause();
    if (!mounted) return;
    final position = await Navigator.of(context).push<Duration>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _FullscreenVideoPage(
          file: file,
          messageId: widget.messageId,
          mimeType: widget.media?.mimeType,
          initialPosition: initialPosition,
        ),
      ),
    );
    if (!mounted) return;
    if (position != null) {
      await controller.seekTo(position);
    }
    if (wasPlaying) {
      await controller.play();
    }
    if (mounted) setState(() {});
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
        Positioned.fill(
          bottom: 44,
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onTap: _openFullscreen,
          ),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: ColoredBox(
            color: const Color(0x99000000),
            child: Row(
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
                IconButton(
                  onPressed: _openFullscreen,
                  tooltip: _fullscreenLabel(context),
                  color: Colors.white,
                  icon: const Icon(Icons.fullscreen_rounded),
                ),
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

class _FullscreenVideoPage extends StatefulWidget {
  const _FullscreenVideoPage({
    required this.file,
    required this.messageId,
    required this.mimeType,
    required this.initialPosition,
  });

  final File file;
  final String messageId;
  final String? mimeType;
  final Duration initialPosition;

  @override
  State<_FullscreenVideoPage> createState() => _FullscreenVideoPageState();
}

class _FullscreenVideoPageState extends State<_FullscreenVideoPage> {
  late final VideoPlayerController _controller;
  late final Future<void> _initialized;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.file(widget.file);
    _initialized = _controller.initialize().then((_) async {
      if (widget.initialPosition > Duration.zero) {
        await _controller.seekTo(widget.initialPosition);
      }
      await _controller.play();
      if (mounted) setState(() {});
    });
    _controller.addListener(_controllerChanged);
  }

  void _controllerChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller.removeListener(_controllerChanged);
    _controller.dispose();
    super.dispose();
  }

  Future<void> _saveVideo() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final bytes = await widget.file.readAsBytes();
      await const MediaSaveService().saveVideo(
        bytes,
        fileName: _fileName(widget.messageId, widget.mimeType),
        mimeType: _normalizedMimeType(widget.mimeType),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_videoSavedLabel(context))),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_videoSaveFailedLabel(context))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _close() async {
    await _controller.pause();
    if (!mounted) return;
    Navigator.of(context).pop(_controller.value.position);
  }

  Future<void> _togglePlayback() async {
    if (_controller.value.isPlaying) {
      await _controller.pause();
    } else {
      await _controller.play();
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        body: FutureBuilder<void>(
          future: _initialized,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(
                child: CircularProgressIndicator(color: Colors.white),
              );
            }
            if (snapshot.hasError || !_controller.value.isInitialized) {
              return Center(
                child: Text(
                  appLocalizations(context).videoUnavailable,
                  style: const TextStyle(color: Colors.white),
                ),
              );
            }
            final value = _controller.value;
            return Stack(
              fit: StackFit.expand,
              children: [
                Center(
                  child: AspectRatio(
                    aspectRatio: value.aspectRatio > 0 ? value.aspectRatio : 16 / 9,
                    child: VideoPlayer(_controller),
                  ),
                ),
                Positioned.fill(
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: _togglePlayback,
                  ),
                ),
                SafeArea(
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: _close,
                            tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                            color: Colors.white,
                            icon: const Icon(Icons.close_rounded),
                          ),
                          const Spacer(),
                          IconButton(
                            onPressed: _saving ? null : _saveVideo,
                            tooltip: appLocalizations(context).save,
                            color: Colors.white,
                            icon: _saving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.download_rounded),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (!value.isPlaying)
                  Center(
                    child: IgnorePointer(
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: const BoxDecoration(
                          color: Color(0x99000000),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 48,
                        ),
                      ),
                    ),
                  ),
                SafeArea(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Container(
                      color: const Color(0x99000000),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: _togglePlayback,
                            color: Colors.white,
                            icon: Icon(
                              value.isPlaying ? Icons.pause : Icons.play_arrow,
                            ),
                          ),
                          Expanded(
                            child: VideoProgressIndicator(
                              _controller,
                              allowScrubbing: true,
                              colors: const VideoProgressColors(
                                playedColor: Colors.white,
                                bufferedColor: Colors.white54,
                                backgroundColor: Colors.white24,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      );

  static String _normalizedMimeType(String? mimeType) =>
      switch (mimeType?.toLowerCase()) {
        'video/quicktime' => 'video/quicktime',
        'video/3gpp' => 'video/3gpp',
        'video/webm' => 'video/webm',
        _ => 'video/mp4',
      };

  static String _fileName(String messageId, String? mimeType) {
    final safeId = messageId.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final extension = switch (mimeType?.toLowerCase()) {
      'video/quicktime' => 'mov',
      'video/3gpp' => '3gp',
      'video/webm' => 'webm',
      _ => 'mp4',
    };
    return 'oppo-line-video-$safeId.$extension';
  }
}

String _fullscreenLabel(BuildContext context) =>
    switch (Localizations.localeOf(context).languageCode) {
      'th' => 'เต็มหน้าจอ',
      'zh' => '全屏播放',
      _ => 'Full screen',
    };

String _videoSavedLabel(BuildContext context) =>
    switch (Localizations.localeOf(context).languageCode) {
      'th' => 'บันทึกวิดีโอลงเครื่องแล้ว',
      'zh' => '视频已保存到设备',
      _ => 'Video saved to device',
    };

String _videoSaveFailedLabel(BuildContext context) =>
    switch (Localizations.localeOf(context).languageCode) {
      'th' => 'ไม่สามารถบันทึกวิดีโอได้',
      'zh' => '无法保存视频',
      _ => 'Unable to save video',
    };

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
