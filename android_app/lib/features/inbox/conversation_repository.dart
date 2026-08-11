import '../../core/models/models.dart';
import '../../core/network/api_client.dart';

class ConversationDetail {
  ConversationDetail({required this.id, required this.customerName, required this.messages, this.nextCursor});
  final String id;
  final String customerName;
  final List<ChatMessage> messages;
  final String? nextCursor;
  factory ConversationDetail.fromJson(Map<String, dynamic> json) => ConversationDetail(id: json['id'] as String, customerName: (json['customer'] as Map<String, dynamic>)['displayName'] as String, messages: ((json['messages'] as List<dynamic>?) ?? []).map((item) => ChatMessage.fromJson(item as Map<String, dynamic>)).toList(), nextCursor: json['nextCursor'] as String?);
}

class InboxPageResult {
  InboxPageResult({required this.items, required this.page, required this.total});
  final List<ConversationSummary> items;
  final int page;
  final int total;
  bool get hasMore => items.isNotEmpty && page * 30 < total;
}

class ConversationRepository {
  ConversationRepository(this._api);
  final ApiClient _api;
  Future<InboxPageResult> inbox({int page = 1}) async {
    final result = await _api.get('/mobile/conversations', query: {'page': '$page', 'pageSize': '30'});
    return InboxPageResult(items: (result['items'] as List<dynamic>).map((item) => ConversationSummary.fromJson(item as Map<String, dynamic>)).toList(), page: result['page'] as int, total: result['total'] as int);
  }
  Future<ConversationDetail> detail(String id) async => ConversationDetail.fromJson(await _api.get('/mobile/conversations/$id'));
  Future<void> reply(String id, String text, String idempotencyKey) async { await _api.post('/mobile/conversations/$id/messages', body: {'text': text, 'idempotencyKey': idempotencyKey}); }
  Future<void> markOpened(String notificationId) async { await _api.patch('/mobile/notifications/$notificationId/opened'); }
}
