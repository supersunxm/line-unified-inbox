import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import '../inbox/conversation_repository.dart';

enum ReplyState { sending, failed }
class PendingReply { PendingReply(this.text, this.key, this.state); final String text; final String key; ReplyState state; }
class PendingImage { PendingImage(this.bytes, this.filename, this.key); final Uint8List bytes; final String filename; final String key; ReplyState state = ReplyState.sending; }

class ChatPage extends StatefulWidget {
  const ChatPage({super.key, required this.conversationId, required this.repository});
  final String conversationId;
  final ConversationRepository repository;
  @override State<ChatPage> createState() => _ChatPageState();
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

  @override void initState() { super.initState(); _load(); }
  @override void dispose() { _text.dispose(); _scroll.dispose(); super.dispose(); }
  void _load() { setState(() { _detail = null; _future = widget.repository.detail(widget.conversationId); _didInitialScroll = false; }); }
  Future<void> _loadOlder() async {
    final detail = _detail; final cursor = detail?.nextCursor;
    if (_loadingOlder || detail == null || cursor == null) return;
    final beforeOffset = _scroll.hasClients ? _scroll.position.pixels : 0.0;
    final beforeMaxExtent = _scroll.hasClients ? _scroll.position.maxScrollExtent : 0.0;
    setState(() => _loadingOlder = true);
    try {
      final older = await widget.repository.detail(widget.conversationId, before: cursor);
      if (!mounted) return;
      final seen = detail.messages.map((message) => message.id).toSet();
      final merged = [...older.messages.where((message) => !seen.contains(message.id)), ...detail.messages];
      setState(() { _detail = detail.copyWith(messages: merged, nextCursor: older.nextCursor); _loadingOlder = false; });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_scroll.hasClients) return;
        final delta = _scroll.position.maxScrollExtent - beforeMaxExtent;
        final target = (beforeOffset + delta).clamp(0.0, _scroll.position.maxScrollExtent);
        _scroll.jumpTo(target);
      });
    } catch (_) { if (mounted) setState(() { _loadingOlder = false; _error = 'Unable to load older messages'; }); }
  }
  String _key() { final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256)); bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80; final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join(); return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}'; }
  Future<void> _sendText(String text, {PendingReply? existing}) async {
    final pending = existing ?? PendingReply(text, _key(), ReplyState.sending);
    setState(() { if (existing == null) _pending.add(pending); pending.state = ReplyState.sending; _error = null; });
    _scrollToBottom();
    try { await widget.repository.reply(widget.conversationId, pending.text, pending.key); if (mounted) { setState(() => _pending.remove(pending)); _load(); } }
    on ApiException catch (error) { if (mounted) setState(() { pending.state = ReplyState.failed; _error = error.message; }); }
    catch (_) { if (mounted) setState(() { pending.state = ReplyState.failed; _error = 'Message could not be sent'; }); }
  }
  Future<void> _send() async { final text = _text.text.trim(); if (text.isEmpty) return; _text.clear(); await _sendText(text); }
  Future<void> _pickImage() async {
    try {
      final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (picked == null || !mounted) return;
      final bytes = await picked.readAsBytes();
      if (!mounted) return;
      final send = await showDialog<bool>(context: context, builder: (_) => AlertDialog(title: const Text('Send image?'), content: Image.memory(bytes, height: 220, fit: BoxFit.contain), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Send'))]));
      if (send == true) await _sendImage(bytes, picked.name, mimeType: picked.mimeType);
    } catch (_) { if (mounted) setState(() => _error = 'Unable to choose this image'); }
  }
  Future<void> _sendImage(Uint8List bytes, String filename, {String? mimeType, PendingImage? existing}) async {
    final pending = existing ?? PendingImage(bytes, filename, _key());
    if (existing == null) setState(() => _pendingImages.add(pending));
    setState(() { pending.state = ReplyState.sending; _error = null; });
    _scrollToBottom();
    try { await widget.repository.sendImage(widget.conversationId, pending.bytes, pending.filename, pending.key, mimeType: mimeType); if (mounted) { setState(() => _pendingImages.remove(pending)); _load(); } }
    on ApiException catch (error) { if (mounted) setState(() { pending.state = ReplyState.failed; _error = error.message; }); }
    catch (_) { if (mounted) setState(() { pending.state = ReplyState.failed; _error = 'Image could not be sent'; }); }
  }
  void _scrollToBottom({bool immediate = false}) { WidgetsBinding.instance.addPostFrameCallback((_) { if (!mounted || !_scroll.hasClients) return; if (immediate) { _scroll.jumpTo(_scroll.position.maxScrollExtent); } else { _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 220), curve: Curves.easeOut); } }); }
  Future<void> _loadMedia(ChatMedia media, String id) async {
    if (!media.ready || _mediaBytes.containsKey(id) || !_mediaLoading.add(id)) return;
    try { final bytes = await widget.repository.media(media.url!); if (mounted) setState(() => _mediaBytes[id] = bytes); }
    catch (_) { if (mounted) setState(() {}); }
    finally { _mediaLoading.remove(id); }
  }
  @override Widget build(BuildContext context) => Scaffold(body: FutureBuilder<ConversationDetail>(future: _future, builder: (context, snapshot) {
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError || !snapshot.hasData) return Center(child: FilledButton(onPressed: _load, child: const Text('Retry')));
    final detail = _detail ?? snapshot.data!;
    _detail ??= detail;
    if (!_didInitialScroll) { _didInitialScroll = true; _scrollToBottom(immediate: true); }
    return Scaffold(appBar: AppBar(title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(detail.customerName, overflow: TextOverflow.ellipsis), if (detail.storeName.isNotEmpty) Text(detail.storeName, style: Theme.of(context).textTheme.labelSmall, overflow: TextOverflow.ellipsis)])), body: Column(children: [if (_loadingOlder) const LinearProgressIndicator(minHeight: 2), Expanded(child: NotificationListener<ScrollNotification>(onNotification: (notification) { if (notification.metrics.pixels < 100) _loadOlder(); return false; }, child: ListView.builder(controller: _scroll, padding: const EdgeInsets.all(12), itemCount: detail.messages.length + _pending.length + _pendingImages.length, itemBuilder: (context, index) { if (index < detail.messages.length) return _messageRow(detail.messages, index); final textIndex = index - detail.messages.length; if (textIndex < _pending.length) { final pending = _pending[textIndex]; return _bubble(pending.text, true, timestamp: DateTime.now(), footer: pending.state == ReplyState.sending ? 'Sending…' : 'Failed · Retry', onRetry: pending.state == ReplyState.failed ? () => _sendText(pending.text, existing: pending) : null); } final pending = _pendingImages[textIndex - _pending.length]; return _pendingImageBubble(pending); }))), if (_error != null) Padding(padding: const EdgeInsets.all(8), child: Text(_error!, style: const TextStyle(color: Colors.red))), SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [SizedBox(width: 48, height: 48, child: IconButton.filledTonal(tooltip: 'Attach image', onPressed: _pickImage, icon: const Icon(Icons.add_photo_alternate))), const SizedBox(width: 8), Expanded(child: TextField(controller: _text, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'Reply to customer', border: OutlineInputBorder()))), const SizedBox(width: 8), SizedBox(width: 48, height: 48, child: IconButton(tooltip: 'Send reply', onPressed: _send, icon: const Icon(Icons.send))) ])))]));
  }));
  Widget _messageRow(List<ChatMessage> messages, int index) { final message = messages[index]; final previous = index == 0 ? null : messages[index - 1]; final separator = previous == null || !_sameDay(previous.sentAt.toLocal(), message.sentAt.toLocal()); return Column(children: [if (separator) Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(_dayLabel(message.sentAt.toLocal()), style: Theme.of(context).textTheme.labelMedium)), _bubble(message.text, message.direction == 'OUTBOUND', message: message, timestamp: message.sentAt.toLocal(), footer: message.direction == 'OUTBOUND' ? 'Sent' : null)]); }
  Widget _bubble(String text, bool outbound, {ChatMessage? message, required DateTime timestamp, String? footer, VoidCallback? onRetry}) {
    final imageMessage = message;
    final media = imageMessage?.media;
    final image = imageMessage != null && imageMessage.messageType == 'IMAGE' && media != null;
    if (image && media.ready) _loadMedia(media, imageMessage.id);
    final bytes = imageMessage == null ? null : _mediaBytes[imageMessage.id];
    final senderLabel = outbound ? (message?.sender?.displayName ?? (message == null ? 'You' : 'Store')) : null;
    return Align(alignment: outbound ? Alignment.centerRight : Alignment.centerLeft, child: Container(margin: const EdgeInsets.symmetric(vertical: 4), padding: const EdgeInsets.all(8), constraints: const BoxConstraints(maxWidth: 300), decoration: BoxDecoration(color: outbound ? Colors.green.shade100 : Colors.grey.shade200, borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [if (image) _imageContent(imageMessage, media, bytes) else Text(text), Row(mainAxisSize: MainAxisSize.min, children: [Text(_time(timestamp), style: Theme.of(context).textTheme.labelSmall), if (footer != null) ...[const SizedBox(width: 6), onRetry == null ? Text(footer, style: Theme.of(context).textTheme.labelSmall) : TextButton(onPressed: onRetry, child: Text(footer))]]), if (senderLabel != null) Text(senderLabel, style: Theme.of(context).textTheme.labelSmall)])));
  }
  Widget _imageContent(ChatMessage message, ChatMedia media, Uint8List? bytes) { if (media.processingStatus != 'READY') return Text(media.processingStatus == 'PENDING' ? 'Image processing…' : 'Image unavailable'); if (bytes == null) return const SizedBox(width: 220, height: 140, child: Center(child: CircularProgressIndicator())); return GestureDetector(onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => _ImageViewer(bytes: bytes))), child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.memory(bytes, width: 240, height: 240, fit: BoxFit.contain))); }
  Widget _pendingImageBubble(PendingImage pending) => Align(alignment: Alignment.centerRight, child: Container(margin: const EdgeInsets.symmetric(vertical: 4), padding: const EdgeInsets.all(8), constraints: const BoxConstraints(maxWidth: 280), decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Image.memory(pending.bytes, width: 240, height: 180, fit: BoxFit.contain), Text(pending.state == ReplyState.sending ? 'Sending…' : 'Failed · Retry', style: Theme.of(context).textTheme.labelSmall), if (pending.state == ReplyState.failed) TextButton(onPressed: () => _sendImage(pending.bytes, pending.filename, existing: pending), child: const Text('Retry'))])));
  String _time(DateTime value) => '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
  String _dayLabel(DateTime date) { final now = DateTime.now(); if (_sameDay(date, now)) return 'Today'; final yesterday = now.subtract(const Duration(days: 1)); if (_sameDay(date, yesterday)) return 'Yesterday'; const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return '${date.day} ${months[date.month - 1]} ${date.year}'; }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.bytes});
  final Uint8List bytes;
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: Colors.black, appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white), body: Center(child: InteractiveViewer(child: Image.memory(bytes, fit: BoxFit.contain))));
}
