import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import 'conversation_repository.dart';

class InboxPage extends StatefulWidget {
  const InboxPage({super.key, required this.repository, required this.onOpen, required this.onProfile});
  final ConversationRepository repository;
  final void Function(String id) onOpen;
  final VoidCallback onProfile;
  @override State<InboxPage> createState() => _InboxPageState();
}

class _InboxPageState extends State<InboxPage> {
  Future<List<ConversationSummary>>? _future;
  @override void initState() { super.initState(); _reload(); }
  void _reload() => setState(() => _future = widget.repository.inbox());
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Inbox'), actions: [IconButton(onPressed: widget.onProfile, icon: const Icon(Icons.person))]), body: RefreshIndicator(onRefresh: () async => _reload(), child: FutureBuilder<List<ConversationSummary>>(future: _future, builder: (context, snapshot) {
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) { final message = snapshot.error is ApiException ? (snapshot.error as ApiException).message : 'Unable to load conversations'; return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Column(children: [Text(message), FilledButton(onPressed: _reload, child: const Text('Retry'))]))]); }
    final items = snapshot.data ?? [];
    if (items.isEmpty) return ListView(children: const [SizedBox(height: 180), Center(child: Text('No conversations yet'))]);
    return ListView.separated(itemCount: items.length, separatorBuilder: (_, __) => const Divider(height: 1), itemBuilder: (context, index) { final item = items[index]; return ListTile(onTap: () => widget.onOpen(item.id), title: Row(children: [Expanded(child: Text(item.customerName)), if (item.unreadCount > 0) Badge(label: Text('${item.unreadCount}'))]), subtitle: Text('${item.storeName} • ${item.preview ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis), trailing: Text(item.bmReplyStatus.replaceAll('_', ' '), style: Theme.of(context).textTheme.labelSmall)); });
  }));
}
