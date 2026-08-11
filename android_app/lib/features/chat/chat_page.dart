import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import 'dart:math';
import '../inbox/conversation_repository.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key, required this.conversationId, required this.repository});
  final String conversationId;
  final ConversationRepository repository;
  @override State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _text = TextEditingController();
  Future<ConversationDetail>? _future;
  bool _sending = false;
  String? _error;
  @override void initState() { super.initState(); _load(); }
  void _load() => setState(() => _future = widget.repository.detail(widget.conversationId));
  Future<void> _send() async {
    final text = _text.text.trim(); if (text.isEmpty) return;
    setState(() { _sending = true; _error = null; });
    try { await widget.repository.reply(widget.conversationId, text, '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}'); _text.clear(); _load(); }
    on ApiException catch (error) { setState(() => _error = error.message); }
    catch (_) { setState(() => _error = 'Message could not be sent'); }
    finally { if (mounted) setState(() => _sending = false); }
  }
  @override void dispose() { _text.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Conversation')), body: Column(children: [Expanded(child: FutureBuilder<ConversationDetail>(future: _future, builder: (context, snapshot) {
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return Center(child: FilledButton(onPressed: _load, child: const Text('Retry')));
    final detail = snapshot.data!;
    return ListView.builder(padding: const EdgeInsets.all(12), itemCount: detail.messages.length, itemBuilder: (context, index) { final message = detail.messages[index]; final outbound = message.direction == 'OUTBOUND'; return Align(alignment: outbound ? Alignment.centerRight : Alignment.centerLeft, child: Container(margin: const EdgeInsets.symmetric(vertical: 4), padding: const EdgeInsets.all(12), constraints: const BoxConstraints(maxWidth: 300), decoration: BoxDecoration(color: outbound ? Colors.green.shade100 : Colors.grey.shade200, borderRadius: BorderRadius.circular(14)), child: Text(message.messageType == 'IMAGE' ? 'Image received' : message.text))); });
  })), if (_error != null) Padding(padding: const EdgeInsets.all(8), child: Text(_error!, style: const TextStyle(color: Colors.red))), SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [Expanded(child: TextField(controller: _text, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'Reply to customer', border: OutlineInputBorder()))), const SizedBox(width: 8), IconButton(onPressed: _sending ? null : _send, icon: _sending ? const CircularProgressIndicator() : const Icon(Icons.send))])))]));
}
