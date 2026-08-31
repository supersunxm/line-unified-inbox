from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected anchor missing in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1))


# Android API client: keep existing request behavior, but allow long media uploads.
replace_once(
    "android_app/lib/core/network/api_client.dart",
    "  Future<http.Response> _sendAndRead(http.BaseRequest request) async {\n    final stream = await _http.send(request).timeout(_requestTimeout);\n    return http.Response.fromStream(stream).timeout(_requestTimeout);\n  }",
    "  Future<http.Response> _sendAndRead(http.BaseRequest request,\n      {Duration? timeout}) async {\n    final effectiveTimeout = timeout ?? _requestTimeout;\n    final stream = await _http.send(request).timeout(effectiveTimeout);\n    return http.Response.fromStream(stream).timeout(effectiveTimeout);\n  }",
)
replace_once(
    "android_app/lib/core/network/api_client.dart",
    "      required String idempotencyKey,\n      bool authenticated = true,\n      bool retry = true}) async {",
    "      required String idempotencyKey,\n      bool authenticated = true,\n      bool retry = true,\n      Duration? timeout}) async {",
)
replace_once(
    "android_app/lib/core/network/api_client.dart",
    "      response = await _sendAndRead(request);\n    } on TimeoutException {\n      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');\n      throw ApiException(0, 'NETWORK_TIMEOUT', 'The service timed out');\n    } catch (_) {\n      SafeLogger.networkFailure(code: 'NETWORK_ERROR');\n      throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');\n    }\n    Map<String, dynamic> decoded = <String, dynamic>{};",
    "      response = await _sendAndRead(request, timeout: timeout);\n    } on TimeoutException {\n      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');\n      throw ApiException(0, 'NETWORK_TIMEOUT', 'The service timed out');\n    } catch (_) {\n      SafeLogger.networkFailure(code: 'NETWORK_ERROR');\n      throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');\n    }\n    Map<String, dynamic> decoded = <String, dynamic>{};",
)
replace_once(
    "android_app/lib/core/network/api_client.dart",
    "              idempotencyKey: idempotencyKey,\n              authenticated: authenticated,\n              retry: false);",
    "              idempotencyKey: idempotencyKey,\n              authenticated: authenticated,\n              retry: false,\n              timeout: timeout);",
)

# Android repository: video reuses the established multipart/auth/session path.
replace_once(
    "android_app/lib/features/inbox/conversation_repository.dart",
    "  Future<ChatMessage?> sendImage(\n          String id, Uint8List bytes, String filename, String idempotencyKey,\n          {String? mimeType}) =>\n      _sendImage('/mobile/conversations/$id/images',\n          field: 'image',\n          filename: filename,\n          mimeType: mimeType,\n          bytes: bytes,\n          idempotencyKey: idempotencyKey);",
    "  Future<ChatMessage?> sendImage(\n          String id, Uint8List bytes, String filename, String idempotencyKey,\n          {String? mimeType}) =>\n      _sendImage('/mobile/conversations/$id/images',\n          field: 'image',\n          filename: filename,\n          mimeType: mimeType,\n          bytes: bytes,\n          idempotencyKey: idempotencyKey);\n\n  Future<ChatMessage?> sendVideo(\n          String id, Uint8List bytes, String filename, String idempotencyKey,\n          {String? mimeType}) =>\n      _sendImage('/mobile/conversations/$id/videos',\n          field: 'video',\n          filename: filename,\n          mimeType: mimeType ?? 'video/mp4',\n          bytes: bytes,\n          idempotencyKey: idempotencyKey,\n          timeout: const Duration(minutes: 2));",
)
replace_once(
    "android_app/lib/features/inbox/conversation_repository.dart",
    "      String? mimeType,\n      required Uint8List bytes,\n      required String idempotencyKey}) async {",
    "      String? mimeType,\n      required Uint8List bytes,\n      required String idempotencyKey,\n      Duration? timeout}) async {",
)
replace_once(
    "android_app/lib/features/inbox/conversation_repository.dart",
    "        bytes: bytes,\n        idempotencyKey: idempotencyKey);",
    "        bytes: bytes,\n        idempotencyKey: idempotencyKey,\n        timeout: timeout);",
)

# Android chat page: pick/capture, preview and send MP4 video.
replace_once(
    "android_app/lib/features/chat/chat_page.dart",
    "import 'dart:async';\nimport 'dart:math';",
    "import 'dart:async';\nimport 'dart:io';\nimport 'dart:math';",
)
replace_once(
    "android_app/lib/features/chat/chat_page.dart",
    "import 'package:image_picker/image_picker.dart';",
    "import 'package:image_picker/image_picker.dart';\nimport 'package:video_player/video_player.dart';",
)
replace_once(
    "android_app/lib/features/chat/chat_page.dart",
    "  final List<PendingImage> _pendingImages = [];\n  final Map<String, Uint8List> _mediaBytes = {};",
    "  final List<PendingImage> _pendingImages = [];\n  final Map<String, Uint8List> _mediaBytes = {};\n  bool _sendingVideo = false;",
)
video_methods = r'''
  Future<void> _pickVideo() async {
    final l10n = appLocalizations(context);
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.videocam_outlined,
                    color: Color(0xFF0F8A5F)),
                title: Text(_recordVideoLabel(context),
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.video_library_outlined,
                    color: Color(0xFF0F8A5F)),
                title: Text(l10n.chooseFromGallery,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null || !mounted) return;
    try {
      final picked = await ImagePicker().pickVideo(
        source: source,
        maxDuration: const Duration(minutes: 3),
      );
      if (picked == null || !mounted) return;
      final length = await picked.length();
      if (length <= 0) {
        setState(() => _error = l10n.videoUnavailable);
        return;
      }
      if (length > 30 * 1024 * 1024) {
        setState(() => _error = _videoTooLargeLabel(context));
        return;
      }
      final declaredMime = picked.mimeType?.toLowerCase().split(';').first;
      if (declaredMime != null &&
          declaredMime.isNotEmpty &&
          declaredMime != 'video/mp4' &&
          declaredMime != 'application/octet-stream') {
        setState(() => _error = _mp4OnlyLabel(context));
        return;
      }
      final confirmSend = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => _VideoPreviewPage(
            path: picked.path,
            filename: picked.name,
          ),
        ),
      );
      if (confirmSend != true || !mounted) return;
      final bytes = await picked.readAsBytes();
      if (!mounted) return;
      await _sendVideo(bytes, picked.name, mimeType: picked.mimeType);
    } on PlatformException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = (error.code == 'camera_access_denied' ||
                error.code.toLowerCase().contains('permission'))
            ? l10n.cameraPermissionRequired
            : (error.message ?? l10n.videoUnavailable);
      });
    } catch (_) {
      if (mounted) setState(() => _error = l10n.videoUnavailable);
    }
  }

  Future<void> _sendVideo(Uint8List bytes, String filename,
      {String? mimeType}) async {
    if (_sendingVideo) return;
    final idempotencyKey = _key();
    setState(() {
      _sendingVideo = true;
      _error = null;
    });
    try {
      final message = await widget.repository.sendVideo(
        widget.conversationId,
        bytes,
        filename.toLowerCase().endsWith('.mp4') ? filename : '$filename.mp4',
        idempotencyKey,
        mimeType: mimeType,
      );
      if (mounted) _mergeSentMessage(message, idempotencyKey);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = appLocalizations(context).videoUnavailable);
      }
    } finally {
      if (mounted) setState(() => _sendingVideo = false);
    }
  }

  String _recordVideoLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'ถ่ายวิดีโอ',
        'zh' => '拍摄视频',
        _ => 'Record video',
      };

  String _videoTooLargeLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'วิดีโอต้องมีขนาดไม่เกิน 30 MB',
        'zh' => '视频大小不得超过 30 MB',
        _ => 'Video must be 30 MB or smaller',
      };

  String _mp4OnlyLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'รองรับวิดีโอ MP4 เท่านั้น',
        'zh' => '仅支持 MP4 视频',
        _ => 'Only MP4 video is supported',
      };

'''
replace_once(
    "android_app/lib/features/chat/chat_page.dart",
    "  Future<void> _sendImage(Uint8List bytes, String filename,\n      {String? mimeType, PendingImage? existing}) async {",
    video_methods + "  Future<void> _sendImage(Uint8List bytes, String filename,\n      {String? mimeType, PendingImage? existing}) async {",
)
replace_once(
    "android_app/lib/features/chat/chat_page.dart",
    "                      onAttach: widget.canReply ? _pickImage : null,\n                      onSend: widget.canReply ? _send : null)",
    "                      onAttach: widget.canReply ? _pickImage : null,\n                      onAttachVideo: widget.canReply ? _pickVideo : null,\n                      isAttaching: _sendingVideo,\n                      onSend: widget.canReply ? _send : null)",
)
video_preview = r'''
class _VideoPreviewPage extends StatefulWidget {
  const _VideoPreviewPage({required this.path, required this.filename});

  final String path;
  final String filename;

  @override
  State<_VideoPreviewPage> createState() => _VideoPreviewPageState();
}

class _VideoPreviewPageState extends State<_VideoPreviewPage> {
  late final VideoPlayerController _controller;
  late final Future<void> _initialized;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.file(File(widget.path));
    _initialized = _controller.initialize().then((_) {
      _controller.setLooping(true);
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: Text(widget.filename,
              maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
        body: FutureBuilder<void>(
          future: _initialized,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(
                  child: CircularProgressIndicator(color: Colors.white));
            }
            if (snapshot.hasError || !_controller.value.isInitialized) {
              return Center(
                child: Text(appLocalizations(context).videoUnavailable,
                    style: const TextStyle(color: Colors.white)),
              );
            }
            return Center(
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    if (_controller.value.isPlaying) {
                      _controller.pause();
                    } else {
                      _controller.play();
                    }
                  });
                },
                child: AspectRatio(
                  aspectRatio: _controller.value.aspectRatio > 0
                      ? _controller.value.aspectRatio
                      : 16 / 9,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      VideoPlayer(_controller),
                      if (!_controller.value.isPlaying)
                        Container(
                          width: 64,
                          height: 64,
                          decoration: const BoxDecoration(
                            color: Color(0x99000000),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.play_arrow_rounded,
                              color: Colors.white, size: 42),
                        ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: Text(appLocalizations(context).cancel),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => Navigator.of(context).pop(true),
                    icon: const Icon(Icons.send_rounded),
                    label: Text(appLocalizations(context).send),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

'''
replace_once(
    "android_app/lib/features/chat/chat_page.dart",
    "class _ImageViewer extends StatefulWidget {",
    video_preview + "class _ImageViewer extends StatefulWidget {",
)

# Backend: isolated video controller/service, no changes to image/text/auto-reply paths.
service = r'''import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ActivityActionType,
  BmReplyStatus,
  FollowUpStatus,
  MessageDirection,
  MessageType,
  Prisma,
} from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { MediaStorageService } from "../media/media-storage";
import { createMediaPublicUrl } from "../media/media-public-url";
import { ownerTrackingInboundFilter } from "../owner-tracking";
import { PrismaService } from "../prisma.service";
import { RealtimeEventService } from "../realtime/realtime-event.service";

export const MOBILE_VIDEO_MAX_BYTES = 30 * 1024 * 1024;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIDEO_PREVIEW_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAAC0CAIAAABqhmJGAAADJUlEQVR42u3dW24qMRBFUYgYhJn/4Hoa+SVRBP0ol8vOWt83gJB2jrshuvfW2g2Y05e3AAQMCBgQMAgYEDAgYEDAIGBAwICAQcCAgAEBAwIGAQMCBgQMCBgEDAgYEDAIGBAwIGBAwCBgQMCAgAEBg4ABAQMCBgEDAgYEDAgYBAwIGBAwCBgQMCBgQMAgYEDAgIABAYOAAQEDAgYBAwIGBAzs8PAWLGbbtvf/4Pl8epeWcW+teRfWLlbPAmbBdGUsYMp1+zHFiz+OgAlO93R14Q+IgNkbW2BmXR8cAUs3oy4ZC5i+USUUlf+MCHj9epNDGvjU7OebWOr92+szBn5ehYDVq2EcoWeot8jZtdrrwQKr98wU22EBM+XWaVjAHLju9ToR8Kz11rzUdE9LwBzrxGtDwItf+iaPoYthARNc4LZtQ3LSsIAJO6Cm5eQgLWC6VJc/xUZYwATPWkJURljA9B1G2yhgks6faX+g32OE/aYQMKYYAc85vws8l98RAv6/cm4I9Zhit7IEjBM1AsaJV8CYYgTMgQ0cexl5vWEfJgkYU4yAcVUsYEwxAsYUI2BMMW89vAX84vtVFhj1YoGRLhYY9VpgpIsF5mc2Y+/3Xq/Xf1xogTG8WGDUa4GRLhaYM5eRvdMNr9cXtgRsDFd4LsPuCI20sMBz1tXpLNq1Xh8gWWAMLxZ4CYEjnFCv21cCJj62HreaTb2AyZi1tJbMr4CJDC9/eM1vEffWmneh1PwWr8LNZwvMrAdUh2cB8/k4WrOT11dlfgXMrJeU6hUwH9qoNsIufQXMrA2rtyx3oYsqcsHputcCc/U6c9QUq1fAzNqweh2hCQ7pNuIPFdQrYCKL6hdV2hMhYBlH1iVdATOg4YuxhT8gAuZkdTvbu/jjCJiMkg/RrYCZMmPpCpiZalasgIESfBMLBAwIGBAwCBgQMCBgQMAgYEDAgIBBwICAAQEDAgYBAwIGBAwIGAQMCBgQMAgYEDAgYEDAIGBAwICAAQGDgAEBAwIGAQMCBgQMCBgEDAgYEDAIGBAwIGBAwCBgQMCAgAEBg4ABAQMCBgEDAgYSfQO9jEwDpZeTFwAAAABJRU5ErkJggg==",
  "base64",
);

export function isSupportedMp4(buffer: Buffer): boolean {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
  return brand !== "qt  " && !brand.startsWith("3g");
}

@Injectable()
export class MobileVideoService {
  private readonly logger = new Logger(MobileVideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
    private readonly encryption: CredentialEncryptionService,
    private readonly media: MediaStorageService,
    private readonly realtime: RealtimeEventService,
  ) {}

  async send(
    user: AuthUser,
    conversationId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
    idempotencyKey: string,
  ) {
    const canReply = user.authorization?.capabilities.reply ?? user.permissions?.canReply;
    if (canReply === false) throw new ForbiddenException("Reply access is forbidden");
    await this.storeAccess.assertConversationAccess(user, conversationId);

    if (!UUID_V4.test(idempotencyKey)) {
      throw new BadRequestException("idempotencyKey must be a UUID");
    }
    if (!file.buffer.length || file.buffer.length > MOBILE_VIDEO_MAX_BYTES) {
      throw new BadRequestException("Video exceeds the 30 MB limit");
    }
    if (!isSupportedMp4(file.buffer)) {
      throw new BadRequestException("Only MP4 video is supported");
    }
    const declaredMime = (file.mimetype ?? "").split(";", 1)[0].trim().toLowerCase();
    if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== "video/mp4") {
      throw new BadRequestException("Video content does not match the supported MP4 type");
    }

    const dedupeExternalId = `outbound:${idempotencyKey}`;
    const prior = await this.prisma.message.findUnique({
      where: { externalMessageId: dedupeExternalId },
      include: { media: true },
    });
    if (prior) return this.response(prior, true);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        store: true,
        lineOfficialAccount: true,
        owner: { select: { id: true, displayName: true } },
      },
    });
    if (!conversation) throw new NotFoundException("ไม่พบการสนทนา");
    if (!conversation.customer.lineUserId) throw new BadRequestException("ไม่พบ LINE User ID ของลูกค้า");
    const oa = conversation.lineOfficialAccount;
    if (!oa || oa.archivedAt || !oa.isActive || !oa.encryptedChannelAccessToken) {
      throw new BadRequestException("LINE Official Account นี้ไม่ได้เปิดใช้งาน");
    }

    let accessToken: string;
    try {
      accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken);
    } catch {
      throw new ServiceUnavailableException("ไม่สามารถอ่าน Channel Access Token ของร้านนี้ได้");
    }

    const videoKey = `line-media/outbound/${conversation.id}/${idempotencyKey}.mp4`;
    const previewKey = `line-media/outbound/${conversation.id}/${idempotencyKey}-preview.png`;
    const [storedVideo] = await Promise.all([
      this.media.put(videoKey, file.buffer, "video/mp4"),
      this.media.put(previewKey, VIDEO_PREVIEW_PNG, "image/png"),
    ]);
    const originalContentUrl = createMediaPublicUrl(videoKey);
    const previewImageUrl = createMediaPublicUrl(previewKey);

    const delivery = await this.pushVideo({
      accessToken,
      lineUserId: conversation.customer.lineUserId,
      originalContentUrl,
      previewImageUrl,
      retryKey: idempotencyKey,
    });

    const sentAt = new Date();
    const ownerTracked = (await this.prisma.message.count({
      where: { conversationId: conversation.id, ...ownerTrackingInboundFilter() },
    })) > 0;
    let ownerAssigned = false;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            externalMessageId: dedupeExternalId,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.VIDEO,
            originalText: "[Video]",
            sentAt,
            senderUserId: user.id,
            senderDisplayName: user.displayName?.trim() || "Store",
            rawPayload: {
              provider: "LINE",
              deliveryMethod: "PUSH",
              providerMessageId: delivery.externalMessageId,
              requestId: delivery.requestId,
              acceptedRequestId: delivery.acceptedRequestId,
            },
          },
        });
        await tx.messageMedia.create({
          data: {
            messageId: message.id,
            providerMessageId: dedupeExternalId,
            mediaType: MessageType.VIDEO,
            mimeType: "video/mp4",
            objectKey: videoKey,
            provider: storedVideo.provider,
            fileId: storedVideo.fileId,
            fileSize: storedVideo.size,
            processingStatus: "READY",
          },
        });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            latestMessageAt: sentAt,
            bmReplyStatus: BmReplyStatus.REPLIED,
            followUpStatus: FollowUpStatus.COMPLETED,
          },
        });
        if (ownerTracked) {
          const ownerUpdate = await tx.conversation.updateMany({
            where: { id: conversation.id, ownerUserId: null },
            data: { ownerUserId: user.id },
          });
          ownerAssigned = ownerUpdate.count === 1;
        }
        await tx.activityHistory.create({
          data: {
            conversationId: conversation.id,
            actionType: ActivityActionType.STATUS_CHANGED,
            previousStatus: conversation.followUpStatus,
            newStatus: FollowUpStatus.COMPLETED,
            previousBmReplyStatus: conversation.bmReplyStatus,
            newBmReplyStatus: BmReplyStatus.REPLIED,
            createdByName: user.displayName,
            description: `Customer video sent via LINE (PUSH); storeId=${conversation.storeId}; lineOfficialAccountId=${conversation.lineOfficialAccountId}`,
          },
        });
        return message;
      });

      const owner = ownerAssigned
        ? { id: user.id, displayName: user.displayName?.trim() || "Staff" }
        : conversation.owner
          ? { id: conversation.owner.id, displayName: conversation.owner.displayName?.trim() || "Staff" }
          : null;
      this.realtime.publish({
        type: "message.created",
        version: 1,
        conversationId: conversation.id,
        storeId: conversation.storeId,
        message: {
          id: created.id,
          direction: "OUTBOUND",
          messageType: "VIDEO",
          text: created.originalText,
          sentAt: sentAt.toISOString(),
          sender: { userId: user.id, displayName: user.displayName?.trim() || "Staff" },
          media: {
            processingStatus: "READY",
            mimeType: "video/mp4",
            fileSize: storedVideo.size,
            url: `/messages/${created.id}/media`,
          },
        },
        conversation: {
          id: conversation.id,
          latestMessageAt: sentAt.toISOString(),
          bmReplyStatus: BmReplyStatus.REPLIED,
          owner,
          ownerTracked,
        },
      });

      return this.response(
        { ...created, media: { processingStatus: "READY", mimeType: "video/mp4", fileSize: storedVideo.size } },
        delivery.duplicateAccepted,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.message.findUnique({
          where: { externalMessageId: dedupeExternalId },
          include: { media: true },
        });
        if (existing) return this.response(existing, true);
      }
      this.logger.error(`LINE accepted outbound video but persistence failed for conversation ${conversation.id}`);
      throw error;
    }
  }

  private response(
    message: {
      id: string;
      direction: MessageDirection;
      messageType: MessageType;
      originalText: string;
      sentAt: Date;
      externalMessageId?: string | null;
      senderUserId?: string | null;
      senderDisplayName?: string | null;
      media?: { processingStatus: string; mimeType: string | null; fileSize: number | null } | null;
    },
    duplicate: boolean,
  ) {
    return {
      message: {
        id: message.id,
        direction: message.direction,
        messageType: message.messageType,
        text: message.originalText,
        sentAt: message.sentAt.toISOString(),
        sender: message.senderUserId
          ? { userId: message.senderUserId, displayName: message.senderDisplayName?.trim() || "Staff" }
          : null,
        media: message.media
          ? {
              processingStatus: message.media.processingStatus,
              mimeType: message.media.mimeType,
              fileSize: message.media.fileSize,
              url: message.media.processingStatus === "READY" ? `/messages/${message.id}/media` : null,
            }
          : null,
        idempotencyKey: message.externalMessageId?.startsWith("outbound:")
          ? message.externalMessageId.slice("outbound:".length)
          : null,
      },
      bmReplyStatus: BmReplyStatus.REPLIED,
      duplicate,
    };
  }

  private async pushVideo(input: {
    accessToken: string;
    lineUserId: string;
    originalContentUrl: string;
    previewImageUrl: string;
    retryKey: string;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          "X-Line-Retry-Key": input.retryKey,
        },
        body: JSON.stringify({
          to: input.lineUserId,
          messages: [{
            type: "video",
            originalContentUrl: input.originalContentUrl,
            previewImageUrl: input.previewImageUrl,
          }],
        }),
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException("ส่งวิดีโอไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted = response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      let lineMessage = "";
      try {
        const body = await response.json() as { message?: string };
        lineMessage = body.message?.trim() ?? "";
      } catch {
        // Keep provider body out of logs and user response if it is not JSON.
      }
      if (response.status === 401) {
        throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      }
      if (response.status === 429) {
        throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS);
      }
      if (response.status === 400 || response.status === 403) {
        throw new BadGatewayException(`LINE ปฏิเสธการส่งวิดีโอ${lineMessage ? `: ${lineMessage}` : ""}`);
      }
      throw new ServiceUnavailableException("ส่งวิดีโอไม่สำเร็จ กรุณาลองอีกครั้ง");
    }

    let body: { sentMessages?: Array<{ id?: string }> } = {};
    try {
      body = await response.json() as typeof body;
    } catch {
      // A duplicate-accepted response may have no JSON body.
    }
    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      externalMessageId: body.sentMessages?.[0]?.id ?? null,
      duplicateAccepted,
    };
  }
}
'''
(ROOT / "backend/src/mobile/mobile-video.service.ts").write_text(service)

controller = r'''import { BadRequestException, Body, Controller, Param, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthRequest } from "../auth/auth.guard";
import { MOBILE_VIDEO_MAX_BYTES, MobileVideoService } from "./mobile-video.service";

@Controller("mobile/conversations")
export class MobileVideoController {
  constructor(private readonly videos: MobileVideoService) {}

  @Post(":id/videos")
  @UseInterceptors(FileInterceptor("video", { limits: { fileSize: MOBILE_VIDEO_MAX_BYTES } }))
  sendVideo(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number; originalname?: string } | undefined,
    @Body("idempotencyKey") idempotencyKey: string,
  ) {
    if (!file) throw new BadRequestException("Video file is required");
    return this.videos.send(request.user!, id, file, idempotencyKey);
  }
}
'''
(ROOT / "backend/src/mobile/mobile-video.controller.ts").write_text(controller)

spec = r'''import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedMp4, MOBILE_VIDEO_MAX_BYTES } from "./mobile-video.service";

test("mobile video accepts MP4 ftyp containers", () => {
  const buffer = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(32)]);
  assert.equal(isSupportedMp4(buffer), true);
});

test("mobile video rejects QuickTime and non-MP4 containers", () => {
  const quickTime = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypqt  "), Buffer.alloc(32)]);
  assert.equal(isSupportedMp4(quickTime), false);
  assert.equal(isSupportedMp4(Buffer.from("not-an-mp4")), false);
});

test("mobile video upload limit is 30 MB", () => {
  assert.equal(MOBILE_VIDEO_MAX_BYTES, 30 * 1024 * 1024);
});
'''
(ROOT / "backend/src/mobile/mobile-video.service.spec.ts").write_text(spec)

# Register the isolated backend controller/service.
replace_once(
    "backend/src/app.module.ts",
    'import { MobileConversationsService } from "./mobile/mobile-conversations.service";',
    'import { MobileConversationsService } from "./mobile/mobile-conversations.service";\nimport { MobileVideoController } from "./mobile/mobile-video.controller";\nimport { MobileVideoService } from "./mobile/mobile-video.service";',
)
replace_once(
    "backend/src/app.module.ts",
    "CustomersController, MobileConversationsController, MobileNotificationsController",
    "CustomersController, MobileConversationsController, MobileVideoController, MobileNotificationsController",
)
replace_once(
    "backend/src/app.module.ts",
    "MobileConversationsService, MobileNotificationsService",
    "MobileConversationsService, MobileVideoService, MobileNotificationsService",
)

# Remove the temporary patching machinery from the final feature commit.
for helper in [
    ROOT / "scripts/apply-mobile-video-feature.py",
    ROOT / ".github/workflows/apply-mobile-video-feature.yml",
]:
    if helper.exists():
        helper.unlink()
