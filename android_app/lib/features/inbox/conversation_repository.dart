import '../../core/models/models.dart';
import '../../core/network/api_client.dart';
import 'dart:typed_data';

class ConversationDetail {
  ConversationDetail({required this.id, required this.customerName, required this.storeName, this.storeCode, required this.messages, this.nextCursor});
  final String id;
  final String customerName;
  final String storeName;
  final String? storeCode;
  final List<ChatMessage> messages;
  final String? nextCursor;
  factory ConversationDetail.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>?;
    final store = json['store'] as Map<String, dynamic>?;
    return ConversationDetail(id: json['id'] as String, customerName: (customer?['displayName'] as String?)?.trim().isNotEmpty == true ? customer!['displayName'] as String : 'Customer', storeName: (store?['name'] as String?)?.trim() ?? '', storeCode: store?['code'] as String?, messages: ((json['messages'] as List<dynamic>?) ?? []).map((item) => ChatMessage.fromJson(item as Map<String, dynamic>)).toList(), nextCursor: json['nextCursor'] as String?);
  }
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
  Future<Uint8List> media(String url) => _api.getBytes(url);
  Future<void> markOpened(String notificationId) async { await _api.patch('/mobile/notifications/$notificationId/opened'); }
}
