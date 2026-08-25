import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/localization/localization.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import '../../core/logging/safe_logger.dart';
import '../../core/widgets/status_badge.dart';
import '../inbox/conversation_repository.dart';
import 'widgets/conversation_header.dart';
import 'widgets/chat_composer.dart';
import 'widgets/customer_profile_sheet.dart';
import 'widgets/conversation_tags_sheet.dart';
import 'widgets/message_timeline.dart';

enum ReplyState { sending, failed }

class PendingReply {
  PendingReply(this.text, this.key, this.state);
  final String text;
  final String key;
  ReplyState state;
}

class PendingImage {
  PendingImage(this.bytes, this.filename, this.key);
  final Uint8List bytes;
  final String filename;
  final String key;
  ReplyState state = ReplyState.sending;
}

Future<ConversationDetail?> resolveConversationTagsDetailAfterDismiss(
    ConversationDetail? sheetResult,
    Future<ConversationDetail> Function() reload) async {
  if (sheetResult != null) return sheetResult;
  try {
    return await reload();
  } catch (_) {
    return null;
  }
}

class ChatPage extends StatefulWidget {
  const ChatPage(
      {super.key,
      required this.conversationId,
      required this.repository,
      this.canReply = true,
      this.events,
      this.onConversationOpened});
  final String conversationId;
  final ConversationRepository repository;
  final bool canReply;
  final Stream<Map<String, dynamic>>? events;
  final Future<void> Function(String conversationId)? onConversationOpened;
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  final List<PendingReply> _pending = [];
  final List<PendingImage> _pendingImages = [];
  final Map<String, Uint8List> _mediaBytes = {};
  final Set<String> _mediaLoading = {};
  Future<ConversationDetail>? _future;
  ConversationDetail? _detail;
  bool _loadingOlder = false;
  String? _error;
  bool _didInitialScroll = false;
  bool _initialScrollScheduled = false;
  int _initialScrollPasses = 0;
  bool _paginationEnabled = false;
  bool _programmaticScroll = false;
  int _scrollGeneration = 0;
  bool _openedNotified = false;
  StreamSubscription<Map<String, dynamic>>? _eventsSubscription;

  @override
  void initState() {
    super.initState();
    _eventsSubscription = widget.events?.listen(_handleRealtimeEvent);
    _load();
  }

  @override
  void dispose() {
    _eventsSubscription?.cancel();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _load() {
    final request = widget.repository.detail(widget.conversationId);
    setState(() {
      _detail = null;
      _future = request;
      _didInitialScroll = false;
      _initialScrollScheduled = false;
      _initialScrollPasses = 0;
      _paginationEnabled = false;
      _programmaticScroll = false;
      _scrollGeneration += 1;
    });
    request.then((_) async {
      if (!_openedNotified && mounted) {
        _openedNotified = true;
        try {
          await widget.repository.markRead(widget.conversationId);
          if (mounted && _detail != null) {
            _detail = _detail!.copyWith(unreadCount: 0);
          }
        } catch (error) {
          SafeLogger.conversationMarkReadFailed(error.runtimeType.toString());
        }
        try {
          await widget.onConversationOpened?.call(widget.conversationId);
        } catch (error) {
          SafeLogger.conversationNotificationCleanupFailed(
              error.runtimeType.toString());
        }
      }
    }).catchError((_) {});
  }

  void _showCustomerProfile() {
    final detail = _detail;
    if (detail == null) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => CustomerProfileSheet(detail: detail),
    );
  }

  Future<void> _showConversationTags() async {
    final detail = _detail;
    if (detail == null || !mounted) return;
    final sheetResult = await ConversationTagsSheet.show(
      context: context,
      conversationId: detail.id,
      repository: widget.repository,
      initialTags: detail.tags ?? const ConversationTags(),
      initialSalesInfo: detail.customerSalesInformation,
      initialPurchaseInfo: detail.purchaseInformation,
    );

    final updated = await resolveConversationTagsDetailAfterDismiss(
      sheetResult,
      () => widget.repository.detail(widget.conversationId),
    );
    if (!mounted || updated == null || _detail == null) return;

    final wasInterested =
        _detail?.customerSalesInformation?.isInterested == true;
    final isNowPurchased =
        updated.customerSalesInformation?.isPurchased == true;
    final isConversion = wasInterested && isNowPurchased;

    setState(() => _detail = _detail!.copyWith(
          tags: updated.tags,
          customerSalesInformation: updated.customerSalesInformation,
          purchaseInformation: updated.purchaseInformation,
          operationalState: updated.operationalState,
          unreadCount: updated.unreadCount,
          bmReplyStatus: updated.bmReplyStatus,
        ));

    // A null sheet result means the route was dismissed with Android Back,
    // drag, or barrier tap. The authoritative refresh above is intentionally
    // silent; only an explicit save/close result should show a success notice.
    if (sheetResult == null) return;

    final l10n = appLocalizations(context);
    final message = isConversion
        ? '✓ ${l10n.convertedToPurchasedNotice}'
        : '✓ ${l10n.customerInfoSaved}';

    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isNowPurchased ? Icons.shopping_bag : Icons.check_circle,
              color: Colors.white,
              size: 18,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        backgroundColor:
            isNowPurchased ? Colors.green.shade700 : Colors.blue.shade700,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _handleRealtimeEvent(Map<String, dynamic> event) {
    if (!mounted || event['conversationId'] != widget.conversationId) return;
    if (event['type'] == 'message.created') {
      _appendRealtimeMessage(event['message']);
    } else if (event['type'] == 'message.media.updated') {
      _updateRealtimeMedia(event['message'], event['messageId']);
    }
  }

  void _updateRealtimeMedia(Object? rawMessage, Object? eventMessageId) {
    final detail = _detail;
    if (detail == null || rawMessage is! Map) return;
    final messageJson = Map<String, dynamic>.from(rawMessage);
    final id = messageJson['id'] ?? eventMessageId;
    final mediaJson = messageJson['media'];
    if (id is! String || mediaJson is! Map) return;
    final index = detail.messages.indexWhere((item) => item.id == id);
    if (index < 0) return;

    final current = detail.messages[index];
    final updatedMedia = ChatMedia(
        processingStatus: mediaJson['processingStatus'] is String
            ? mediaJson['processingStatus'] as String
            : current.media?.processingStatus ?? 'FAILED',
        mimeType: mediaJson['mimeType'] is String
            ? mediaJson['mimeType'] as String
            : current.media?.mimeType ??
                (current.messageType == 'IMAGE' ? 'image/*' : null),
        fileSize: mediaJson['fileSize'] is num
            ? (mediaJson['fileSize'] as num).toInt()
            : current.media?.fileSize,
        url: mediaJson['url'] is String
            ? mediaJson['url'] as String
            : current.media?.url ?? '/messages/$id/media');
    if (_sameMedia(current.media, updatedMedia)) return;
    final messages = [...detail.messages];
    messages[index] = ChatMessage(
        id: current.id,
        text: current.text,
        direction: current.direction,
        messageType: current.messageType,
        sentAt: current.sentAt,
        sender: current.sender,
        media: updatedMedia,
        idempotencyKey: current.idempotencyKey);
    setState(() => _detail = detail.copyWith(messages: messages));
  }

  bool _sameMedia(ChatMedia? current, ChatMedia updated) =>
      current?.processingStatus == updated.processingStatus &&
      current?.mimeType == updated.mimeType &&
      current?.fileSize == updated.fileSize &&
      current?.url == updated.url;

  void _mergeSentMessage(ChatMessage? message, String idempotencyKey) {
    final detail = _detail;
    if (detail == null) return;
    final messages = [...detail.messages];
    if (message != null && !messages.any((item) => item.id == message.id)) {
      messages.add(message);
      messages.sort((left, right) {
        final timestamp = left.sentAt.compareTo(right.sentAt);
        return timestamp == 0 ? left.id.compareTo(right.id) : timestamp;
      });
    }
    setState(() {
      _pending.removeWhere((item) => item.key == idempotencyKey);
      _pendingImages.removeWhere((item) => item.key == idempotencyKey);
      _detail = detail.copyWith(messages: messages, bmReplyStatus: 'REPLIED');
    });
  }

  Future<void> _showConversationActions() async {
    final detail = _detail;
    if (detail == null || !widget.canReply || !mounted) return;
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        final l10n = appLocalizations(sheetContext);
        const statuses = ['NOT_REPLIED', 'NOTIFIED_BM', 'REPLIED'];
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.notifications_active_outlined),
                title: Text(l10n.notifiedBm),
                subtitle: Text(l10n.replyStatus),
                onTap: () => Navigator.of(sheetContext).pop('NOTIFIED_BM'),
              ),
              const Divider(height: 1),
              RadioGroup<String>(
                groupValue: detail.bmReplyStatus,
                onChanged: (value) {
                  if (value != null) {
                    Navigator.of(sheetContext).pop(value);
                  }
                },
                child: Column(
                  children: [
                    for (final status in statuses)
                      RadioListTile<String>(
                        value: status,
                        title: Text(localizedConversationStatusLabel(
                            sheetContext, status,
                            exact: true)),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
    if (selected == null || selected == detail.bmReplyStatus || !mounted) {
      return;
    }
    try {
      final updated =
          await widget.repository.updateBmReplyStatus(detail.id, selected);
      if (!mounted) return;
      setState(() => _detail = _detail?.copyWith(
            bmReplyStatus: updated.bmReplyStatus,
            operationalState: updated.operationalState,
            unreadCount: updated.unreadCount,
          ));
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to update reply status');
    }
  }

  void _appendRealtimeMessage(Object? rawMessage) {
    final detail = _detail;
    if (detail == null || rawMessage is! Map) return;

    try {
      final messageJson = Map<String, dynamic>.from(rawMessage);
      final message = ChatMessage.fromJson(messageJson);
      if (detail.messages.any((item) => item.id == message.id)) return;

      if (message.idempotencyKey != null) {
        _pending.removeWhere((item) => item.key == message.idempotencyKey);
        _pendingImages
            .removeWhere((item) => item.key == message.idempotencyKey);
      }

      final messages = [...detail.messages, message]..sort((left, right) {
          final timestamp = left.sentAt.compareTo(right.sentAt);
          return timestamp == 0 ? left.id.compareTo(right.id) : timestamp;
        });
      final nearBottom = !_scroll.hasClients ||
          _scroll.position.maxScrollExtent - _scroll.position.pixels <= 120;
      setState(() {
        _detail = detail.copyWith(messages: messages);
        _error = null;
      });
      if (nearBottom) _scrollToBottom();
    } catch (_) {
      // Ignore malformed or incomplete realtime payloads. The next normal
      // reconciliation can still recover the authoritative conversation.
    }
  }

  Future<void> _loadOlder() async {
    final detail = _detail;
    final cursor = detail?.nextCursor;
    if (!_paginationEnabled ||
        _programmaticScroll ||
        _loadingOlder ||
        detail == null ||
        cursor == null) {
      return;
    }
    final beforeOffset = _scroll.hasClients ? _scroll.position.pixels : 0.0;
    final beforeMaxExtent =
        _scroll.hasClients ? _scroll.position.maxScrollExtent : 0.0;
    setState(() => _loadingOlder = true);
    try {
      final older =
          await widget.repository.detail(widget.conversationId, before: cursor);
      if (!mounted) return;
      final seen = detail.messages.map((message) => message.id).toSet();
      final merged = [
        ...older.messages.where((message) => !seen.contains(message.id)),
        ...detail.messages
      ];
      setState(() {
        _detail =
            detail.copyWith(messages: merged, nextCursor: older.nextCursor);
        _loadingOlder = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_scroll.hasClients) return;
        final delta = _scroll.position.maxScrollExtent - beforeMaxExtent;
        final target =
            (beforeOffset + delta).clamp(0.0, _scroll.position.maxScrollExtent);
        _programmaticScroll = true;
        try {
          _scroll.jumpTo(target);
        } finally {
          _programmaticScroll = false;
        }
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingOlder = false;
          _error = 'Unable to load older messages';
        });
      }
    }
  }

  String _key() {
    final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex =
        bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  Future<void> _sendText(String text, {PendingReply? existing}) async {
    final pending = existing ?? PendingReply(text, _key(), ReplyState.sending);
    setState(() {
      if (existing == null) _pending.add(pending);
      pending.state = ReplyState.sending;
      _error = null;
    });
    _scrollToBottom();
    try {
      final message = await widget.repository
          .reply(widget.conversationId, pending.text, pending.key);
      if (mounted) {
        _mergeSentMessage(message, pending.key);
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          pending.state = ReplyState.failed;
          _error = error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          pending.state = ReplyState.failed;
          _error = 'Message could not be sent';
        });
      }
    }
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty) return;
    _text.clear();
    await _sendText(text);
  }

  Future<void> _pickImage() async {
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
                leading: const Icon(Icons.camera_alt_outlined,
                    color: Color(0xFF0F8A5F)),
                title: Text(l10n.takePhoto,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined,
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
      final picked = await ImagePicker().pickImage(
        source: source,
        maxWidth: 2048,
        maxHeight: 2048,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      final bytes = await picked.readAsBytes();
      if (!mounted) return;
      final confirmSend = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => _ImagePreviewPage(
            bytes: bytes,
            filename: picked.name,
          ),
        ),
      );
      if (confirmSend == true && mounted) {
        await _sendImage(bytes, picked.name, mimeType: picked.mimeType);
      }
    } on PlatformException catch (e) {
      if (mounted) {
        setState(() {
          _error = (e.code == 'camera_access_denied' ||
                  e.code.toLowerCase().contains('permission'))
              ? l10n.cameraPermissionRequired
              : (e.message ?? l10n.imageUnavailable);
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = l10n.imageUnavailable);
    }
  }

  Future<void> _sendImage(Uint8List bytes, String filename,
      {String? mimeType, PendingImage? existing}) async {
    final pending = existing ?? PendingImage(bytes, filename, _key());
    if (existing == null) setState(() => _pendingImages.add(pending));
    setState(() {
      pending.state = ReplyState.sending;
      _error = null;
    });
    _scrollToBottom();
    try {
      final message = await widget.repository.sendImage(
          widget.conversationId, pending.bytes, pending.filename, pending.key,
          mimeType: mimeType);
      if (mounted) {
        _mergeSentMessage(message, pending.key);
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          pending.state = ReplyState.failed;
          _error = error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          pending.state = ReplyState.failed;
          _error = appLocalizations(context).imageUnavailable;
        });
      }
    }
  }

  void _scrollToBottom({bool immediate = false}) {
    final generation = _scrollGeneration;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || generation != _scrollGeneration || !_scroll.hasClients) {
        return;
      }
      if (immediate) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      } else {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
      }
    });
  }

  void _scheduleInitialScroll() {
    if (_didInitialScroll || _initialScrollScheduled) return;
    final generation = _scrollGeneration;
    _initialScrollScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initialScrollScheduled = false;
      if (!mounted || _didInitialScroll) return;
      if (generation != _scrollGeneration) {
        _didInitialScroll = true;
        _paginationEnabled =
            _scroll.hasClients && _scroll.position.hasContentDimensions;
        return;
      }
      if (!_scroll.hasClients || !_scroll.position.hasContentDimensions) {
        _scheduleInitialScroll();
        return;
      }
      if (_initialScrollPasses == 0) {
        _initialScrollPasses = 1;
        _scheduleInitialScroll();
        return;
      }
      _programmaticScroll = true;
      try {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      } finally {
        _programmaticScroll = false;
      }
      _initialScrollPasses += 1;
      if (_initialScrollPasses < 3) {
        _scheduleInitialScroll();
      } else {
        _didInitialScroll = true;
        _paginationEnabled = true;
      }
    });
  }

  Future<void> _loadMedia(ChatMedia media, String id) async {
    if (!media.ready || _mediaBytes.containsKey(id) || !_mediaLoading.add(id)) {
      return;
    }
    try {
      final bytes = await widget.repository.media(media.url!);
      if (mounted) setState(() => _mediaBytes[id] = bytes);
    } catch (_) {
      if (mounted) setState(() {});
    } finally {
      _mediaLoading.remove(id);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      body: FutureBuilder<ConversationDetail>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError || !snapshot.hasData) {
              return Center(
                  child: FilledButton(
                      onPressed: _load,
                      child: Text(appLocalizations(context).retry)));
            }
            final detail = _detail ?? snapshot.data!;
            _detail ??= detail;
            if (!_didInitialScroll) {
              _scheduleInitialScroll();
            }
            return Scaffold(
                appBar: ConversationHeader(
                    customerName: detail.customerName,
                    storeName: detail.storeName,
                    storeCode: detail.storeCode,
                    bmReplyStatus: detail.bmReplyStatus,
                    exactStatus: true,
                    onBack: () => Navigator.of(context).maybePop(),
                    onProfile: _showCustomerProfile,
                    onAction:
                        widget.canReply ? _showConversationActions : null),
                body: Column(children: [
                  ConversationTagsBar(
                      tags: detail.tags,
                      customerSalesInformation: detail.customerSalesInformation,
                      purchaseInformation: detail.purchaseInformation,
                      onPressed:
                          widget.canReply ? _showConversationTags : null),
                  Expanded(
                      child: MessageTimeline(
                          controller: _scroll,
                          messages: detail.messages,
                          pendingMessages: [
                            ..._pending.map((pending) => PendingTimelineMessage(
                                key: pending.key,
                                isImage: false,
                                isSending: pending.state == ReplyState.sending,
                                text: pending.text)),
                            ..._pendingImages.map((pending) =>
                                PendingTimelineMessage(
                                    key: pending.key,
                                    isImage: true,
                                    isSending:
                                        pending.state == ReplyState.sending,
                                    bytes: pending.bytes,
                                    filename: pending.filename))
                          ],
                          loadingOlder: _loadingOlder,
                          mediaBytes: _mediaBytes,
                          onLoadOlder: _loadOlder,
                          onRetryMessage: _retryPending,
                          onOpenImage: (bytes) => Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) => _ImageViewer(bytes: bytes))),
                          onLoadMedia: _loadMedia,
                          onUserScroll: () => _scrollGeneration += 1,
                          isProgrammaticScroll: () => _programmaticScroll)),
                  if (_error != null)
                    Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text(_error!,
                            style: const TextStyle(color: Colors.red))),
                  if (!widget.canReply)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: Row(
                        children: [
                          const Icon(Icons.lock_outline, size: 16),
                          const SizedBox(width: 6),
                          Text(appLocalizations(context).readOnlyConversation,
                              style: Theme.of(context).textTheme.labelMedium),
                        ],
                      ),
                    ),
                  ChatComposer(
                      controller: _text,
                      enabled: widget.canReply,
                      onAttach: widget.canReply ? _pickImage : null,
                      onSend: widget.canReply ? _send : null)
                ]));
          }));

  void _retryPending(String key) {
    for (final pending in _pending) {
      if (pending.key == key) {
        _sendText(pending.text, existing: pending);
        return;
      }
    }
    for (final pending in _pendingImages) {
      if (pending.key == key) {
        _sendImage(pending.bytes, pending.filename, existing: pending);
        return;
      }
    }
  }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.bytes});
  final Uint8List bytes;
  @override
  Widget build(BuildContext context) => Scaffold(
      backgroundColor: Colors.black,
      appBar:
          AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
      body: Center(
          child: InteractiveViewer(
              child: Image.memory(bytes, fit: BoxFit.contain))));
}

class _ImagePreviewPage extends StatelessWidget {
  const _ImagePreviewPage({
    required this.bytes,
    required this.filename,
  });

  final Uint8List bytes;
  final String filename;

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);

    return Scaffold(
      backgroundColor: const Color(0xFF11141A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11141A),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(false),
        ),
        title: Text(
          l10n.sendImageQuestion,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: InteractiveViewer(
                      minScale: 0.8,
                      maxScale: 3.0,
                      child: Image.memory(
                        bytes,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1F2B),
                border: Border(
                  top: BorderSide(
                    color: Colors.white.withValues(alpha: 0.08),
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: const BorderSide(color: Colors.white24),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () => Navigator.of(context).pop(false),
                      child: Text(
                        l10n.cancel,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF0F8A5F),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () => Navigator.of(context).pop(true),
                      icon: const Icon(Icons.send_rounded, size: 18),
                      label: Text(
                        l10n.send,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
