import '../../core/models/models.dart';
import '../../core/network/api_client.dart';

class ConversationDetail {
  ConversationDetail({required this.id, required this.customerName, required this.messages});
  final String id;
  final String customerName;
  final List<ChatMessage> messages;
  factory ConversationDetail.fromJson(Map<String, dynamic> json) => ConversationDetail(id: json['id'] as String, customerName: (json['customer'] as Map<String, dynamic>)['displayName'] as String, messages: ((json['messages'] as List<dynamic>?) ?? []).map((item) => ChatMessage.fromJson(item as Map<String, dynamic>)).toList());
}

class ConversationRepository {
  ConversationRepository(this._api);
  final ApiClient _api;
  Future<List<ConversationSummary>> inbox() async {
    final result = await _api.get('/mobile/conversations', query: {'page': '1', 'pageSize': '30'});
    return (result['items'] as List<dynamic>).map((item) => ConversationSummary.fromJson(item as Map<String, dynamic>)).toList();
  }
  Future<ConversationDetail> detail(String id) async => ConversationDetail.fromJson(await _api.get('/mobile/conversations/$id'));
  Future<void> reply(String id, String text, String idempotencyKey) async { await _api.post('/mobile/conversations/$id/messages', body: {'text': text, 'idempotencyKey': idempotencyKey}); }
  Future<void> markOpened(String notificationId) async { await _api.patch('/mobile/notifications/$notificationId/opened'); }
}
