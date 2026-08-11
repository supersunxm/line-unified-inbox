import 'dart:math';
import 'package:flutter/material.dart';
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
  final List<PendingReply> _pending = [];
  Future<ConversationDetail>? _future;
  String? _error;
  @override void initState() { super.initState(); _load(); }
  void _load() => setState(() => _future = widget.repository.detail(widget.conversationId));
  String _key() => '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';
  Future<void> _sendText(String text, {PendingReply? existing}) async {
    final pending = existing ?? PendingReply(text, _key(), ReplyState.sending);
    setState(() { if (existing == null) _pending.add(pending); pending.state = ReplyState.sending; _error = null; });
    try { await widget.repository.reply(widget.conversationId, pending.text, pending.key); if (mounted) { setState(() => _pending.remove(pending)); _load(); } }
    on ApiException catch (error) { if (mounted) setState(() { pending.state = ReplyState.failed; _error = error.message; }); }
    catch (_) { if (mounted) setState(() { pending.state = ReplyState.failed; _error = 'Message could not be sent'; }); }
  }
  Future<void> _send() async { final text = _text.text.trim(); if (text.isEmpty) return; _text.clear(); await _sendText(text); }
  @override void dispose() { _text.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Conversation')), body: Column(children: [Expanded(child: FutureBuilder<ConversationDetail>(future: _future, builder: (context, snapshot) {
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return Center(child: FilledButton(onPressed: _load, child: const Text('Retry')));
    final messages = snapshot.data!.messages;
    return ListView.builder(padding: const EdgeInsets.all(12), itemCount: messages.length + _pending.length, itemBuilder: (context, index) {
      if (index < messages.length) { final message = messages[index]; return _bubble(message.text, message.direction == 'OUTBOUND'); }
      final pending = _pending[index - messages.length];
      return _bubble(pending.text, true, footer: pending.state == ReplyState.sending ? const Text('Sending…') : TextButton(onPressed: () => _sendText(pending.text, existing: pending), child: const Text('Failed — Retry')));
    });
  })), if (_error != null) Padding(padding: const EdgeInsets.all(8), child: Text(_error!, style: const TextStyle(color: Colors.red))), SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [Expanded(child: TextField(controller: _text, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'Reply to customer', border: OutlineInputBorder()))), const SizedBox(width: 8), IconButton(onPressed: _send, icon: const Icon(Icons.send))])))]));
  Widget _bubble(String text, bool outbound, {Widget? footer}) => Align(alignment: outbound ? Alignment.centerRight : Alignment.centerLeft, child: Container(margin: const EdgeInsets.symmetric(vertical: 4), padding: const EdgeInsets.all(12), constraints: const BoxConstraints(maxWidth: 300), decoration: BoxDecoration(color: outbound ? Colors.green.shade100 : Colors.grey.shade200, borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(text), if (footer != null) footer]));
}
