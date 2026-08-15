import '../../core/models/models.dart';
import '../../core/network/api_client.dart';
import 'dart:typed_data';

const _unset = Object();

class ConversationDetail {
  static const _detailUnset = Object();

  ConversationDetail(
      {required this.id,
      required this.customerName,
      required this.storeName,
      this.storeCode,
      required this.messages,
      this.nextCursor,
      this.unreadCount,
      this.bmReplyStatus,
      this.tags});
  final String id;
  final String customerName;
  final String storeName;
  final String? storeCode;
  final List<ChatMessage> messages;
  final String? nextCursor;
  final int? unreadCount;
  final String? bmReplyStatus;
  final ConversationTags? tags;
  ConversationDetail copyWith(
          {List<ChatMessage>? messages,
          Object? nextCursor = _detailUnset,
          Object? unreadCount = _detailUnset,
          Object? bmReplyStatus = _detailUnset,
          Object? tags = _detailUnset}) =>
      ConversationDetail(
          id: id,
          customerName: customerName,
          storeName: storeName,
          storeCode: storeCode,
          messages: messages ?? this.messages,
          nextCursor: identical(nextCursor, _detailUnset)
              ? this.nextCursor
              : nextCursor as String?,
          unreadCount: identical(unreadCount, _detailUnset)
              ? this.unreadCount
              : unreadCount as int?,
          bmReplyStatus: identical(bmReplyStatus, _detailUnset)
              ? this.bmReplyStatus
              : bmReplyStatus as String?,
          tags: identical(tags, _detailUnset) ? this.tags : tags as ConversationTags?);
  factory ConversationDetail.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>?;
    final store = json['store'] as Map<String, dynamic>?;
    return ConversationDetail(
        id: json['id'] as String,
        customerName:
            (customer?['displayName'] as String?)?.trim().isNotEmpty == true
                ? customer!['displayName'] as String
                : 'Customer',
        storeName: (store?['name'] as String?)?.trim() ?? '',
        storeCode: store?['code'] as String?,
        messages: ((json['messages'] as List<dynamic>?) ?? [])
            .map((item) => ChatMessage.fromJson(item as Map<String, dynamic>))
            .toList(),
        nextCursor: json['nextCursor'] as String?,
        unreadCount: json['unreadCount'] is num
            ? (json['unreadCount'] as num).toInt()
            : null,
        bmReplyStatus: json['bmReplyStatus'] as String?,
        tags: ConversationTags.fromJson(json['tags'] as Map<String, dynamic>?));
  }
}

class InboxPageResult {
  InboxPageResult(
      {required this.items, required this.page, required this.total});
  final List<ConversationSummary> items;
  final int page;
  final int total;
  bool get hasMore => items.isNotEmpty && page * 30 < total;
}

class ConversationRepository {
  ConversationRepository(this._api);
  final ApiClient _api;
  Future<InboxPageResult> inbox({int page = 1}) async {
    final result = await _api.get('/mobile/conversations',
        query: {'page': '$page', 'pageSize': '30'});
    return InboxPageResult(
        items: (result['items'] as List<dynamic>)
            .map((item) =>
                ConversationSummary.fromJson(item as Map<String, dynamic>))
            .toList(),
        page: result['page'] as int,
        total: result['total'] as int);
  }

  Future<ConversationDetail> detail(String id,
          {int limit = 50, String? before}) async =>
      ConversationDetail.fromJson(await _api.get('/mobile/conversations/$id',
          query: {'limit': '$limit', if (before != null) 'before': before}));
  Future<void> markRead(String id) async {
    await _api.patch('/mobile/conversations/$id/read');
  }

  Future<List<ProductSelectorItem>> fetchProducts({String? search, String? category}) async {
    final result = await _api.get('/mobile/products', query: {
      if (search?.trim().isNotEmpty == true) 'search': search!.trim(),
      if (category?.trim().isNotEmpty == true) 'category': category!.trim(),
    });
    return (result['items'] as List<dynamic>? ?? [])
        .map((item) => ProductSelectorItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ConversationDetail> updateConversationTags(
      String id, {
      Object? sourceChannel = _unset,
      Object? productId = _unset,
  }) async {
    final body = <String, dynamic>{};
    if (!identical(sourceChannel, _unset)) body['sourceChannel'] = sourceChannel;
    if (!identical(productId, _unset)) body['productId'] = productId;
    return ConversationDetail.fromJson(
        await _api.patch('/mobile/conversations/$id/tags', body: body));
  }

  Future<ChatMessage?> reply(
      String id, String text, String idempotencyKey) async {
    final result = await _api.post('/mobile/conversations/$id/messages',
        body: {'text': text, 'idempotencyKey': idempotencyKey});
    final rawMessage = result['message'];
    return rawMessage is Map
        ? ChatMessage.fromJson(Map<String, dynamic>.from(rawMessage))
        : null;
  }

  Future<Uint8List> media(String url) => _api.getBytes(url);
  Future<ChatMessage?> sendImage(
          String id, Uint8List bytes, String filename, String idempotencyKey,
          {String? mimeType}) =>
      _sendImage('/mobile/conversations/$id/images',
          field: 'image',
          filename: filename,
          mimeType: mimeType,
          bytes: bytes,
          idempotencyKey: idempotencyKey);

  Future<ChatMessage?> _sendImage(String path,
      {required String field,
      required String filename,
      String? mimeType,
      required Uint8List bytes,
      required String idempotencyKey}) async {
    final result = await _api.postMultipart(path,
        field: field,
        filename: filename,
        mimeType: mimeType,
        bytes: bytes,
        idempotencyKey: idempotencyKey);
    final rawMessage = result['message'];
    return rawMessage is Map
        ? ChatMessage.fromJson(Map<String, dynamic>.from(rawMessage))
        : null;
  }

  Future<void> markOpened(String notificationId) async {
    await _api.patch('/mobile/notifications/$notificationId/opened');
  }
}
