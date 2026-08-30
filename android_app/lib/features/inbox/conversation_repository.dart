import '../../core/models/models.dart';
import '../../core/network/api_client.dart';
import 'dart:typed_data';

const _unset = Object();

class CustomerSalesProductItem {
  const CustomerSalesProductItem({
    required this.id,
    required this.productModelId,
    this.productVariantId,
    required this.modelName,
    this.seriesName,
    this.category,
    this.ram,
    this.rom,
    this.color,
    this.quantity = 1,
    required this.status,
  });

  final String id;
  final String productModelId;
  final String? productVariantId;
  final String modelName;
  final String? seriesName;
  final String? category;
  final String? ram;
  final String? rom;
  final String? color;
  final int quantity;
  final String status;

  String get variantLabel {
    final parts = <String>[];
    if (ram != null && ram!.isNotEmpty) parts.add('${ram}GB RAM');
    if (rom != null && rom!.isNotEmpty) parts.add('${rom}GB ROM');
    if (color != null && color!.isNotEmpty) parts.add(color!);
    return parts.join(' · ');
  }

  static CustomerSalesProductItem fromJson(Map<String, dynamic> json) {
    final model = json['model'] as Map<String, dynamic>? ?? {};
    final variant = json['variant'] as Map<String, dynamic>?;
    return CustomerSalesProductItem(
      id: json['id'] as String? ?? '',
      productModelId:
          json['productModelId'] as String? ?? model['id'] as String? ?? '',
      productVariantId:
          json['productVariantId'] as String? ?? variant?['id'] as String?,
      modelName:
          model['name'] as String? ?? json['modelName'] as String? ?? 'Product',
      seriesName: model['seriesName'] as String?,
      category: model['category'] as String?,
      ram: json['ram'] as String? ?? variant?['ram'] as String?,
      rom: json['rom'] as String? ?? variant?['rom'] as String?,
      color: json['color'] as String? ?? variant?['color'] as String?,
      quantity: json['quantity'] is num ? (json['quantity'] as num).toInt() : 1,
      status: json['status'] as String? ?? 'INTERESTED',
    );
  }

  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id,
        'productModelId': productModelId,
        if (productVariantId != null) 'productVariantId': productVariantId,
        if (ram != null) 'ram': ram,
        if (rom != null) 'rom': rom,
        if (color != null) 'color': color,
        'quantity': quantity,
        'status': status,
      };
}

class CustomerSalesInformation {
  const CustomerSalesInformation({
    this.status,
    this.interestLevel,
    required this.purchaseChannel,
    this.paymentMethod,
    required this.products,
    this.recordedBy,
    this.recordedAt,
  });

  final String? status;
  final String? interestLevel;
  final List<String> purchaseChannel;
  final String? paymentMethod;
  final List<CustomerSalesProductItem> products;
  final String? recordedBy;
  final DateTime? recordedAt;

  bool get isEmpty => status == null && products.isEmpty;
  bool get isOnline => status == 'ONLINE';
  bool get isInterested => status == 'INTERESTED';
  bool get isPurchased => status == 'PURCHASED';

  static CustomerSalesInformation? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final rawProducts = json['products'];
    return CustomerSalesInformation(
      status: json['status'] as String?,
      interestLevel: json['interestLevel'] as String?,
      purchaseChannel: (json['purchaseChannel'] as List<dynamic>? ?? [])
          .whereType<String>()
          .toList(growable: false),
      paymentMethod: json['paymentMethod'] as String?,
      products: rawProducts is List
          ? rawProducts
              .whereType<Map>()
              .map((item) => CustomerSalesProductItem.fromJson(
                  Map<String, dynamic>.from(item)))
              .toList(growable: false)
          : const [],
      recordedBy: json['recordedBy'] as String?,
      recordedAt: json['recordedAt'] is String
          ? DateTime.tryParse(json['recordedAt'] as String)
          : null,
    );
  }
}

class PurchaseInformation {
  const PurchaseInformation({
    required this.recordState,
    required this.purchaseChannel,
    required this.paymentMethod,
    required this.products,
    this.recordedBy,
    this.recordedAt,
  });

  final String recordState;
  final List<String> purchaseChannel;
  final String? paymentMethod;
  final List<Map<String, dynamic>> products;
  final String? recordedBy;
  final DateTime? recordedAt;

  static PurchaseInformation? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final rawProducts = json['products'];
    return PurchaseInformation(
      recordState: json['recordState'] as String? ?? 'NONE',
      purchaseChannel: (json['purchaseChannel'] as List<dynamic>? ?? [])
          .whereType<String>()
          .toList(growable: false),
      paymentMethod: json['paymentMethod'] as String?,
      products: rawProducts is List
          ? rawProducts
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false)
          : const [],
      recordedBy: json['recordedBy'] as String?,
      recordedAt: json['recordedAt'] is String
          ? DateTime.tryParse(json['recordedAt'] as String)
          : null,
    );
  }
}

class AiInsight {
  const AiInsight({
    required this.mentionedProducts,
    required this.topics,
    required this.classification,
  });

  final List<Map<String, dynamic>> mentionedProducts;
  final List<Map<String, dynamic>> topics;
  final Map<String, dynamic> classification;

  static AiInsight? fromJson(Map<String, dynamic>? json) => json == null
      ? null
      : AiInsight(
          mentionedProducts: (json['mentionedProducts'] is List)
              ? (json['mentionedProducts'] as List)
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList(growable: false)
              : const [],
          topics: (json['topics'] is List)
              ? (json['topics'] as List)
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList(growable: false)
              : const [],
          classification: json['classification'] is Map
              ? Map<String, dynamic>.from(json['classification'] as Map)
              : const {},
        );
}

class OperationalState {
  const OperationalState(
      {required this.replyStatus, required this.priority, this.unread});

  final String replyStatus;
  final String priority;
  final int? unread;

  static OperationalState? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final priority = json['priority'];
    return OperationalState(
      replyStatus: json['replyStatus'] as String? ?? 'NOT_REPLIED',
      priority:
          priority is Map ? priority['level'] as String? ?? 'NONE' : 'NONE',
      unread: json['unread'] is num ? (json['unread'] as num).toInt() : null,
    );
  }
}

class ConversationDetail {
  static const _detailUnset = Object();

  ConversationDetail(
      {required this.id,
      required this.customerName,
      required this.storeName,
      this.customerPictureUrl,
      this.storeCode,
      required this.messages,
      this.nextCursor,
      this.unreadCount,
      this.bmReplyStatus,
      this.tags,
      this.customerSalesInformation,
      this.purchaseInformation,
      this.aiInsight,
      this.operationalState,
      this.owner,
      this.ownerTracked = true});
  final String id;
  final String customerName;
  final String storeName;
  final String? customerPictureUrl;
  final String? storeCode;
  final List<ChatMessage> messages;
  final String? nextCursor;
  final int? unreadCount;
  final String? bmReplyStatus;
  final ConversationTags? tags;
  final CustomerSalesInformation? customerSalesInformation;
  final PurchaseInformation? purchaseInformation;
  final AiInsight? aiInsight;
  final OperationalState? operationalState;
  final ConversationOwner? owner;
  final bool ownerTracked;
  ConversationDetail copyWith(
          {List<ChatMessage>? messages,
          Object? nextCursor = _detailUnset,
          Object? unreadCount = _detailUnset,
          Object? bmReplyStatus = _detailUnset,
          Object? tags = _detailUnset,
          Object? customerSalesInformation = _detailUnset,
          Object? purchaseInformation = _detailUnset,
          Object? aiInsight = _detailUnset,
          Object? operationalState = _detailUnset,
          Object? owner = _detailUnset,
          bool? ownerTracked}) =>
      ConversationDetail(
          id: id,
          customerName: customerName,
          storeName: storeName,
          customerPictureUrl: customerPictureUrl,
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
          tags: identical(tags, _detailUnset)
              ? this.tags
              : tags as ConversationTags?,
          customerSalesInformation:
              identical(customerSalesInformation, _detailUnset)
                  ? this.customerSalesInformation
                  : customerSalesInformation as CustomerSalesInformation?,
          purchaseInformation: identical(purchaseInformation, _detailUnset)
              ? this.purchaseInformation
              : purchaseInformation as PurchaseInformation?,
          aiInsight: identical(aiInsight, _detailUnset)
              ? this.aiInsight
              : aiInsight as AiInsight?,
          operationalState: identical(operationalState, _detailUnset)
              ? this.operationalState
              : operationalState as OperationalState?,
          owner: identical(owner, _detailUnset)
              ? this.owner
              : owner as ConversationOwner?,
          ownerTracked: ownerTracked ?? this.ownerTracked);
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
        customerPictureUrl: customer?['pictureUrl'] as String?,
        storeCode: store?['code'] as String?,
        messages: ((json['messages'] as List<dynamic>?) ?? [])
            .map((item) => ChatMessage.fromJson(item as Map<String, dynamic>))
            .toList(),
        nextCursor: json['nextCursor'] as String?,
        unreadCount: json['unreadCount'] is num
            ? (json['unreadCount'] as num).toInt()
            : null,
        bmReplyStatus: json['bmReplyStatus'] as String?,
        tags: ConversationTags.fromJson(json['tags'] as Map<String, dynamic>?),
        customerSalesInformation: CustomerSalesInformation.fromJson(
            json['customerSalesInformation'] as Map<String, dynamic>?),
        purchaseInformation: PurchaseInformation.fromJson(
            json['purchaseInformation'] as Map<String, dynamic>?),
        aiInsight:
            AiInsight.fromJson(json['aiInsight'] as Map<String, dynamic>?),
        operationalState: OperationalState.fromJson(
            json['operationalState'] as Map<String, dynamic>?),
        owner: json['owner'] is Map
            ? ConversationOwner.fromJson(
                Map<String, dynamic>.from(json['owner'] as Map))
            : null,
        ownerTracked: json['ownerTracked'] as bool? ?? true);
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
  Future<InboxPageResult> inbox({
    int page = 1,
    String? storeId,
    String? bmReplyStatus,
    String? replyStatusGroup,
    String? search,
  }) async {
    final result = await _api.get('/mobile/conversations', query: {
      'page': '$page',
      'pageSize': '30',
      if (storeId?.trim().isNotEmpty == true) 'storeId': storeId!.trim(),
      if (bmReplyStatus?.trim().isNotEmpty == true)
        'bmReplyStatus': bmReplyStatus!.trim(),
      if (replyStatusGroup?.trim().isNotEmpty == true)
        'replyStatusGroup': replyStatusGroup!.trim(),
      if (search?.trim().isNotEmpty == true) 'search': search!.trim(),
    });
    return InboxPageResult(
        items: (result['items'] as List<dynamic>)
            .map((item) =>
                ConversationSummary.fromJson(item as Map<String, dynamic>))
            .toList(),
        page: result['page'] as int,
        total: result['total'] as int);
  }

  /// Returns the same store scope exposed by Web `/chats`.
  Future<List<Store>> storeOptions() async {
    final result = await _api.get('/conversations/store-priority-summary');
    return (result['stores'] as List<dynamic>? ?? [])
        .map((item) => Store.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Returns the authenticated user's unread notification total.
  ///
  /// The mobile notifications endpoint applies the same backend authorization
  /// scope used by the conversation APIs, so HQ receives one all-store total
  /// without maintaining a second inbox counter on the client.
  Future<int> unreadTotal() async {
    final result = await _api.get('/mobile/notifications/unread-count');
    final count = result['unreadCount'];
    return count is num ? count.toInt() : 0;
  }

  Future<ConversationDetail> detail(String id,
          {int limit = 50, String? before}) async =>
      ConversationDetail.fromJson(await _api.get('/mobile/conversations/$id',
          query: {'limit': '$limit', if (before != null) 'before': before}));
  Future<void> markRead(String id) async {
    await _api.patch('/mobile/conversations/$id/read');
  }

  Future<ConversationDetail> updateBmReplyStatus(
      String id, String status) async {
    final result = await _api.patch('/mobile/conversations/$id/bm-reply-status',
        body: {'status': status});
    final conversation = result['conversation'];
    if (conversation is Map) {
      return ConversationDetail.fromJson(
          Map<String, dynamic>.from(conversation));
    }
    return detail(id);
  }

  Future<List<ConversationOwner>> eligibleOwners(String id) async {
    final result = await _api.get('/mobile/conversations/$id/owners');
    return (result['items'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .map((item) =>
            ConversationOwner.fromJson(Map<String, dynamic>.from(item)))
        .where((owner) => owner.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<ConversationDetail> updateOwner(String id, String? userId) async {
    final result = await _api.patch('/mobile/conversations/$id/owner',
        body: <String, dynamic>{'userId': userId});
    return ConversationDetail.fromJson(result);
  }

  Future<List<ProductSelectorItem>> fetchProducts(
      {String? search, String? category}) async {
    final result = await _api.get('/mobile/products', query: {
      if (search?.trim().isNotEmpty == true) 'search': search!.trim(),
      if (category?.trim().isNotEmpty == true) 'category': category!.trim(),
      'limit': '50',
    });
    return (result['items'] as List<dynamic>? ?? [])
        .map((item) =>
            ProductSelectorItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<ProductVariantSelectorItem>> fetchProductVariants(
      String productId) async {
    final result = await _api.get('/mobile/products/$productId/variants');
    return (result['items'] as List<dynamic>? ?? [])
        .map((item) =>
            ProductVariantSelectorItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ConversationDetail> updateConversationTags(
    String id, {
    Object? sourceChannels = _unset,
    Object? isInstallment = _unset,
    Object? productId = _unset,
    Object? variantId = _unset,
  }) async {
    final body = <String, dynamic>{};
    if (!identical(sourceChannels, _unset)) {
      body['sourceChannels'] = sourceChannels;
    }
    if (!identical(isInstallment, _unset)) {
      body['isInstallment'] = isInstallment;
    }
    if (!identical(productId, _unset)) body['productId'] = productId;
    if (!identical(variantId, _unset)) body['variantId'] = variantId;
    return ConversationDetail.fromJson(
        await _api.patch('/mobile/conversations/$id/tags', body: body));
  }

  Future<ConversationDetail> updateCustomerSalesInfo(
    String id, {
    Object? status = _unset,
    Object? interestLevel = _unset,
    Object? purchaseChannel = _unset,
    Object? paymentMethod = _unset,
    Object? products = _unset,
  }) async {
    final body = <String, dynamic>{};
    if (!identical(status, _unset)) body['status'] = status;
    if (!identical(interestLevel, _unset)) {
      body['interestLevel'] = interestLevel;
    }
    if (!identical(purchaseChannel, _unset)) {
      body['purchaseChannel'] = purchaseChannel;
    }
    if (!identical(paymentMethod, _unset)) {
      body['paymentMethod'] = paymentMethod;
    }
    if (!identical(products, _unset)) {
      if (products is List<CustomerSalesProductItem>) {
        body['products'] = products.map((p) => p.toJson()).toList();
      } else {
        body['products'] = products;
      }
    }
    return ConversationDetail.fromJson(await _api
        .patch('/mobile/conversations/$id/customer-sales-info', body: body));
  }

  Future<ConversationDetail> updatePurchaseInformation(
    String id, {
    Object? purchaseChannel = _unset,
    Object? paymentMethod = _unset,
    Object? productModelId = _unset,
    Object? productVariantId = _unset,
  }) async {
    final body = <String, dynamic>{};
    if (!identical(purchaseChannel, _unset)) {
      body['purchaseChannel'] = purchaseChannel;
    }
    if (!identical(paymentMethod, _unset)) {
      body['paymentMethod'] = paymentMethod;
    }
    if (!identical(productModelId, _unset)) {
      body['productModelId'] = productModelId;
    }
    if (!identical(productVariantId, _unset)) {
      body['productVariantId'] = productVariantId;
    }
    return ConversationDetail.fromJson(await _api
        .patch('/mobile/conversations/$id/purchase-information', body: body));
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
