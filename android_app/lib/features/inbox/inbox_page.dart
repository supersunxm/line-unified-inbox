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
  final _scroll = ScrollController();
  final List<ConversationSummary> _items = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _error;

  @override void initState() { super.initState(); _scroll.addListener(_onScroll); _load(reset: true); }
  @override void dispose() { _scroll.dispose(); super.dispose(); }
  void _onScroll() { if (_scroll.position.extentAfter < 240 && !_loadingMore && _hasMore) _load(); }
  Future<void> _load({bool reset = false}) async {
    if (_loadingMore || (!reset && !_hasMore)) return;
    setState(() { if (reset) { _loading = true; _error = null; } else { _loadingMore = true; } });
    try {
      final page = await widget.repository.inbox(page: reset ? 1 : ((_items.length ~/ 30) + 1));
      if (!mounted) return;
      setState(() { if (reset) _items.clear(); _items.addAll(page.items); _hasMore = _items.length < page.total; });
    } on ApiException catch (error) { if (mounted) setState(() => _error = error.message); }
    catch (_) { if (mounted) setState(() => _error = 'Unable to load conversations'); }
    finally { if (mounted) setState(() { _loading = false; _loadingMore = false; }); }
  }

  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Inbox'), actions: [IconButton(onPressed: widget.onProfile, icon: const Icon(Icons.person))]), body: RefreshIndicator(onRefresh: () => _load(reset: true), child: _loading ? const Center(child: CircularProgressIndicator()) : _error != null && _items.isEmpty ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Column(children: [Text(_error!), FilledButton(onPressed: () => _load(reset: true), child: const Text('Retry'))]))]) : _items.isEmpty ? ListView(children: const [SizedBox(height: 180), Center(child: Text('No conversations yet'))]) : ListView.separated(controller: _scroll, itemCount: _items.length + (_loadingMore ? 1 : 0), separatorBuilder: (_, __) => const Divider(height: 1), itemBuilder: (context, index) {
    if (index == _items.length) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
    final item = _items[index];
    return ListTile(onTap: () => widget.onOpen(item.id), title: Row(children: [Expanded(child: Text(item.customerName)), if (item.unreadCount > 0) Badge(label: Text('${item.unreadCount}'))]), subtitle: Text('${item.storeName} • ${item.preview ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis), trailing: Text(item.bmReplyStatus.replaceAll('_', ' '), style: Theme.of(context).textTheme.labelSmall));
  }));
}
