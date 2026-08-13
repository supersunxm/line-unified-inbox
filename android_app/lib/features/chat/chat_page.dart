import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import '../inbox/conversation_repository.dart';

enum ReplyState { sending, failed }
class PendingReply { PendingReply(this.text, this.key, this.state); final String text; final String key; ReplyState state; }

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
  final Map<String, Uint8List> _mediaBytes = {};
  final Set<String> _mediaLoading = {};
  Future<ConversationDetail>? _future;
  String? _error;
  bool _didInitialScroll = false;

  @override void initState() { super.initState(); _load(); }
  @override void dispose() { _text.dispose(); _scroll.dispose(); super.dispose(); }
  void _load() { setState(() { _future = widget.repository.detail(widget.conversationId); _didInitialScroll = false; }); }
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
    final detail = snapshot.data!;
    if (!_didInitialScroll) { _didInitialScroll = true; _scrollToBottom(immediate: true); }
    return Scaffold(appBar: AppBar(title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(detail.customerName, overflow: TextOverflow.ellipsis), if (detail.storeName.isNotEmpty) Text(detail.storeName, style: Theme.of(context).textTheme.labelSmall, overflow: TextOverflow.ellipsis)])), body: Column(children: [Expanded(child: ListView.builder(controller: _scroll, padding: const EdgeInsets.all(12), itemCount: detail.messages.length + _pending.length, itemBuilder: (context, index) { if (index < detail.messages.length) return _messageRow(detail.messages, index); final pending = _pending[index - detail.messages.length]; return _bubble(pending.text, true, timestamp: DateTime.now(), footer: pending.state == ReplyState.sending ? 'Sending…' : 'Failed · Retry', onRetry: pending.state == ReplyState.failed ? () => _sendText(pending.text, existing: pending) : null); })), if (_error != null) Padding(padding: const EdgeInsets.all(8), child: Text(_error!, style: const TextStyle(color: Colors.red))), SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [Expanded(child: TextField(controller: _text, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'Reply to customer', border: OutlineInputBorder()))), const SizedBox(width: 8), IconButton(onPressed: _send, icon: const Icon(Icons.send))])))]));
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
  String _time(DateTime value) => '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
  String _dayLabel(DateTime date) { final now = DateTime.now(); if (_sameDay(date, now)) return 'Today'; final yesterday = now.subtract(const Duration(days: 1)); if (_sameDay(date, yesterday)) return 'Yesterday'; const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return '${date.day} ${months[date.month - 1]} ${date.year}'; }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.bytes});
  final Uint8List bytes;
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: Colors.black, appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white), body: Center(child: InteractiveViewer(child: Image.memory(bytes, fit: BoxFit.contain))));
}
