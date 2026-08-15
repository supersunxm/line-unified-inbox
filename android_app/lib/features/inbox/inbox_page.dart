import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import '../../core/widgets/app_widgets.dart';
import 'conversation_repository.dart';
import 'widgets/conversation_card.dart';
import 'widgets/conversation_overview_card.dart';
import 'widgets/inbox_filter_bar.dart';
import 'widgets/inbox_header.dart';
import 'widgets/inbox_search_field.dart';

class InboxPage extends StatefulWidget {
  const InboxPage(
      {super.key,
      required this.repository,
      required this.onOpen,
      required this.onProfile,
      this.events});
  final ConversationRepository repository;
  final Future<void> Function(String id) onOpen;
  final VoidCallback onProfile;
  final Stream<Map<String, dynamic>>? events;
  @override
  State<InboxPage> createState() => _InboxPageState();
}

class _InboxPageState extends State<InboxPage> {
  final _scroll = ScrollController();
  final _searchController = TextEditingController();
  final List<ConversationSummary> _items = [];
  String _searchQuery = '';
  InboxFilter _selectedFilter = InboxFilter.all;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _error;
  StreamSubscription<Map<String, dynamic>>? _eventsSubscription;
  final Set<String> _handledRealtimeMessageIds = {};
  final Map<String, int> _reconcileGenerations = {};
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _eventsSubscription = widget.events?.listen(_handleRealtimeEvent);
    _load(reset: true);
  }

  @override
  void dispose() {
    _eventsSubscription?.cancel();
    _searchController.dispose();
    _scroll.dispose();
    super.dispose();
  }

  List<ConversationSummary> get _renderItems {
    final query = _searchQuery.trim().toLowerCase();
    return _items.where((item) {
      final matchesQuery = query.isEmpty ||
          item.customerName.toLowerCase().contains(query) ||
          item.storeName.toLowerCase().contains(query) ||
          (item.preview?.toLowerCase().contains(query) ?? false);
      final matchesFilter = switch (_selectedFilter) {
        InboxFilter.all => true,
        InboxFilter.notReplied => isNeedReplyStatus(item.bmReplyStatus),
        InboxFilter.replied => isCompletedStatus(item.bmReplyStatus),
      };
      return matchesQuery && matchesFilter;
    }).toList(growable: false);
  }

  void _updateSearch(String value) {
    if (value == _searchQuery) return;
    setState(() => _searchQuery = value);
  }

  void _clearSearch() {
    if (_searchQuery.isEmpty) return;
    _searchController.clear();
    setState(() => _searchQuery = '');
  }

  void _onScroll() {
    if (_scroll.position.extentAfter < 240 && !_loadingMore && _hasMore) {
      _load();
    }
  }

  void _handleRealtimeEvent(Map<String, dynamic> event) {
    if (!mounted || event['type'] == 'connected') return;
    final conversationId = event['conversationId'];
    if (conversationId is! String || conversationId.isEmpty) return;

    if (event['type'] == 'message.media.updated') return;
    if (event['type'] == 'message.created') {
      final message = event['message'];
      final messageId = message is Map ? message['id'] : null;
      if (messageId is String &&
          messageId.isNotEmpty &&
          !_handledRealtimeMessageIds.contains(messageId) &&
          _patchMessageCreated(conversationId, event)) {
        _handledRealtimeMessageIds.add(messageId);
        _reconcileUnread(conversationId);
      }
      return;
    }
    if (event['type'] == 'conversation.updated') {
      _patchConversationUpdated(conversationId, event);
    }
  }

  bool _patchMessageCreated(String conversationId, Map<String, dynamic> event) {
    final index = _items.indexWhere((item) => item.id == conversationId);
    final message = event['message'];
    if (index < 0 || message is! Map) return false;
    final current = _items[index];
    final conversation = event['conversation'];
    final latest = conversation is Map
        ? conversation['latestMessageAt']
        : message['sentAt'];
    final sentAt = latest is String ? DateTime.tryParse(latest) : null;
    final bmReplyStatus =
        conversation is Map ? conversation['bmReplyStatus'] : null;
    final updated = current.copyWith(
        preview: conversationMessagePreview(
            text: message['text'] is String ? message['text'] as String : null,
            direction: message['direction'] is String
                ? message['direction'] as String
                : null,
            messageType: message['messageType'] is String
                ? message['messageType'] as String
                : null),
        sentAt: sentAt,
        bmReplyStatus:
            bmReplyStatus is String ? bmReplyStatus : current.bmReplyStatus);
    if (_sameSummary(current, updated) && index == 0) return true;
    final items = [..._items]..removeAt(index);
    items.insert(0, updated);
    setState(() => _items
      ..clear()
      ..addAll(items));
    return true;
  }

  void _patchConversationUpdated(
      String conversationId, Map<String, dynamic> event) {
    final index = _items.indexWhere((item) => item.id == conversationId);
    final conversation = event['conversation'];
    if (index < 0 || conversation is! Map) return;
    final current = _items[index];
    final latest = conversation['latestMessageAt'];
    final updated = current.copyWith(
        sentAt: latest is String ? DateTime.tryParse(latest) : null,
        bmReplyStatus: conversation['bmReplyStatus'] is String
            ? conversation['bmReplyStatus'] as String
            : current.bmReplyStatus);
    if (_sameSummary(current, updated)) return;
    setState(() => _items[index] = updated);
  }

  bool _sameSummary(ConversationSummary left, ConversationSummary right) =>
      left.id == right.id &&
      left.customerName == right.customerName &&
      left.storeName == right.storeName &&
      left.unreadCount == right.unreadCount &&
      left.bmReplyStatus == right.bmReplyStatus &&
      left.preview == right.preview &&
      left.sentAt == right.sentAt;

  int _nextGeneration(String conversationId) {
    final generation = ++_generation;
    _reconcileGenerations[conversationId] = generation;
    return generation;
  }

  Future<void> _reconcileUnread(String conversationId) async {
    final generation = _nextGeneration(conversationId);
    try {
      final detail = await widget.repository.detail(conversationId, limit: 1);
      if (!mounted || _reconcileGenerations[conversationId] != generation) {
        return;
      }
      final index = _items.indexWhere((item) => item.id == conversationId);
      if (index < 0) return;
      final current = _items[index];
      final latestMessage = detail.messages.isEmpty
          ? null
          : detail.messages.reduce((left, right) =>
              left.sentAt.isAfter(right.sentAt) ? left : right);
      final updated = current.copyWith(
          unreadCount: detail.unreadCount,
          bmReplyStatus: detail.bmReplyStatus,
          preview: latestMessage == null
              ? current.preview
              : conversationMessagePreview(
                  text: latestMessage.text,
                  direction: latestMessage.direction,
                  messageType: latestMessage.messageType),
          sentAt: latestMessage?.sentAt ?? current.sentAt);
      if (!_sameSummary(current, updated)) {
        setState(() => _items[index] = updated);
      }
    } catch (_) {
      // The event patch remains visible; the next explicit refresh reconciles it.
    }
  }

  Future<void> _load({bool reset = false}) async {
    if (_loadingMore || (!reset && !_hasMore)) return;
    setState(() {
      if (reset) {
        _loading = true;
        _error = null;
      } else {
        _loadingMore = true;
      }
    });
    try {
      final page = await widget.repository
          .inbox(page: reset ? 1 : ((_items.length ~/ 30) + 1));
      if (!mounted) return;
      setState(() {
        if (reset) {
          _items.clear();
        }
        _items.addAll(page.items);
        _hasMore = _items.length < page.total;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to load conversations');
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _open(ConversationSummary item) async {
    _nextGeneration(item.id);
    await widget.onOpen(item.id);
    if (mounted) {
      try {
        final detail = await widget.repository.detail(item.id, limit: 1);
        if (!mounted) return;
        final index = _items.indexWhere((candidate) => candidate.id == item.id);
        if (index >= 0) {
          final current = _items[index];
          final latestMessage = detail.messages.isEmpty
              ? null
              : detail.messages.reduce((left, right) =>
                  left.sentAt.isAfter(right.sentAt) ? left : right);
          final updated = current.copyWith(
              unreadCount: detail.unreadCount,
              bmReplyStatus: detail.bmReplyStatus,
              preview: latestMessage == null
                  ? current.preview
                  : conversationMessagePreview(
                      text: latestMessage.text,
                      direction: latestMessage.direction,
                      messageType: latestMessage.messageType),
              sentAt: latestMessage?.sentAt ?? current.sentAt);
          if (!_sameSummary(current, updated)) {
            setState(() => _items[index] = updated);
          }
        }
      } catch (_) {
        if (!mounted) return;
        final index = _items.indexWhere((candidate) => candidate.id == item.id);
        if (index >= 0) {
          // Keep the existing read-state patch if reconciliation is unavailable.
          setState(
              () => _items[index] = _items[index].copyWith(unreadCount: 0));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          top: true,
          child: Column(
            children: [
              InboxHeader(
                conversationCount: _items.length,
                onProfile: widget.onProfile,
              ),
              ConversationOverviewCard(conversations: _items),
              InboxSearchField(
                controller: _searchController,
                query: _searchQuery,
                onChanged: _updateSearch,
                onClear: _clearSearch,
              ),
              InboxFilterBar(
                selected: _selectedFilter,
                onChanged: (filter) => setState(() => _selectedFilter = filter),
              ),
              Expanded(child: _buildConversationContent(context)),
            ],
          ),
        ),
      );

  Widget _buildConversationContent(BuildContext context) {
    if (_loading) return const LoadingState();
    if (_error != null && _items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: 320,
              child: ErrorState(
                message: _error!,
                onRetry: () => _load(reset: true),
              ),
            ),
          ],
        ),
      );
    }
    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(
              height: 320,
              child: EmptyState(title: 'No conversations yet'),
            ),
          ],
        ),
      );
    }
    final renderItems = _renderItems;
    if (renderItems.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: ListView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(
              height: 320,
              child: EmptyState(title: 'No matching conversations'),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: renderItems.length + (_loadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          if (index == renderItems.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final item = renderItems[index];
          return ConversationCard(
            conversation: item,
            onTap: () => _open(item),
          );
        },
      ),
    );
  }
}
