class StoreMembership {
  StoreMembership(
      {required this.id,
      required this.storeId,
      required this.role,
      required this.store});
  final String id;
  final String storeId;
  final String role;
  final Store store;
  factory StoreMembership.fromJson(Map<String, dynamic> json) =>
      StoreMembership(
          id: json['id'] as String,
          storeId: json['storeId'] as String,
          role: json['role'] as String,
          store: Store.fromJson(json['store'] as Map<String, dynamic>));
}

class Store {
  Store({required this.id, required this.name, this.code});
  final String id;
  final String name;
  final String? code;
  factory Store.fromJson(Map<String, dynamic> json) => Store(
      id: json['id'] as String,
      name: json['name'] as String,
      code: json['code'] as String?);
}

class PendingRegistration {
  PendingRegistration(
      {required this.id,
      required this.name,
      required this.email,
      required this.storeName,
      required this.role,
      required this.createdAt});
  final String id;
  final String name;
  final String email;
  final String storeName;
  final String role;
  final DateTime createdAt;
  factory PendingRegistration.fromJson(Map<String, dynamic> json) =>
      PendingRegistration(
          id: json['id'] as String,
          name: json['name'] as String,
          email: json['email'] as String,
          storeName: (json['store'] as Map<String, dynamic>)['name'] as String,
          role: json['role'] as String,
          createdAt: DateTime.parse(json['createdAt'] as String));
}

class CurrentUser {
  CurrentUser(
      {required this.id,
      required this.displayName,
      required this.role,
      required this.memberships,
      required this.stores,
      required this.permissions,
      this.phone,
      this.position});
  final String id;
  final String displayName;
  final String role;
  final List<StoreMembership> memberships;
  final List<Store> stores;
  final Map<String, dynamic> permissions;
  final String? phone;
  final String? position;
  factory CurrentUser.fromJson(Map<String, dynamic> json) {
    final profile =
        (json['profile'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    return CurrentUser(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        role: json['role'] as String,
        memberships: ((json['memberships'] as List<dynamic>?) ?? [])
            .map((item) =>
                StoreMembership.fromJson(item as Map<String, dynamic>))
            .toList(),
        stores: ((json['stores'] as List<dynamic>?) ?? [])
            .map((item) => Store.fromJson(item as Map<String, dynamic>))
            .toList(),
        permissions: (json['permissions'] as Map<String, dynamic>?) ??
            <String, dynamic>{},
        phone: profile['phone'] as String?,
        position: profile['position'] as String?);
  }
}

class ConversationSummary {
  ConversationSummary(
      {required this.id,
      required this.customerName,
      required this.storeName,
      required this.unreadCount,
      required this.bmReplyStatus,
      this.preview,
      this.sentAt});
  final String id;
  final String customerName;
  final String storeName;
  final int unreadCount;
  final String bmReplyStatus;
  final String? preview;
  final DateTime? sentAt;

  ConversationSummary copyWith({
    String? id,
    String? customerName,
    String? storeName,
    int? unreadCount,
    String? bmReplyStatus,
    String? preview,
    DateTime? sentAt,
  }) =>
      ConversationSummary(
          id: id ?? this.id,
          customerName: customerName ?? this.customerName,
          storeName: storeName ?? this.storeName,
          unreadCount: unreadCount ?? this.unreadCount,
          bmReplyStatus: bmReplyStatus ?? this.bmReplyStatus,
          preview: preview ?? this.preview,
          sentAt: sentAt ?? this.sentAt);

  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    final message = json['lastMessage'] as Map<String, dynamic>?;
    return ConversationSummary(
        id: json['id'] as String,
        customerName:
            (json['customer'] as Map<String, dynamic>)['displayName'] as String,
        storeName: (json['store'] as Map<String, dynamic>)['name'] as String,
        unreadCount: json['unreadCount'] as int? ?? 0,
        bmReplyStatus: json['bmReplyStatus'] as String,
        preview: message == null
            ? null
            : conversationMessagePreview(
                text: message['preview'] as String?,
                direction: message['direction'] as String?,
                messageType: message['messageType'] as String?,
              ),
        sentAt: message?['sentAt'] == null
            ? null
            : DateTime.parse(message!['sentAt'] as String));
  }
}

class ConversationProductTag {
  const ConversationProductTag({
    required this.id,
    required this.productName,
    required this.category,
    required this.seriesName,
  });

  final String id;
  final String productName;
  final String category;
  final String seriesName;

  factory ConversationProductTag.fromJson(Map<String, dynamic> json) =>
      ConversationProductTag(
        id: json['id'] as String,
        productName: json['productName'] as String,
        category: json['category'] as String,
        seriesName: json['seriesName'] as String,
      );
}

class ConversationProductVariant {
  const ConversationProductVariant({
    required this.id,
    this.ram,
    this.rom,
    this.color,
  });

  final String id;
  final String? ram;
  final String? rom;
  final String? color;

  factory ConversationProductVariant.fromJson(Map<String, dynamic> json) =>
      ConversationProductVariant(
        id: json['id'] as String,
        ram: json['ram'] as String?,
        rom: json['rom'] as String?,
        color: json['color'] as String?,
      );

  String get label => [
        if (ram?.trim().isNotEmpty == true) '${ram}GB',
        if (rom?.trim().isNotEmpty == true) '${rom}GB',
        if (color?.trim().isNotEmpty == true) color!,
      ].join(' / ');
}

class ConversationTags {
  const ConversationTags({
    this.sourceChannels = const [],
    this.isInstallment = false,
    this.product,
    this.variant,
  });

  final List<String> sourceChannels;
  final bool isInstallment;
  final ConversationProductTag? product;
  final ConversationProductVariant? variant;

  bool get isEmpty => sourceChannels.isEmpty && !isInstallment && product == null;

  factory ConversationTags.fromJson(Map<String, dynamic>? json) {
    final productJson = json?['product'];
    final variantJson = json?['variant'];
    final rawSources = json?['sourceChannels'];
    final sources = rawSources is List
        ? rawSources.whereType<String>().toList(growable: false)
        : switch (json?['sourceChannel']) {
            String source => [source],
            _ => const <String>[],
          };
    return ConversationTags(
      sourceChannels: sources,
      isInstallment: json?['isInstallment'] == true,
      product: productJson is Map<String, dynamic>
          ? ConversationProductTag.fromJson(productJson)
          : null,
      variant: variantJson is Map<String, dynamic>
          ? ConversationProductVariant.fromJson(variantJson)
          : null,
    );
  }
}

class ProductSelectorItem {
  const ProductSelectorItem({
    required this.id,
    required this.productName,
    required this.category,
    required this.seriesName,
  });

  final String id;
  final String productName;
  final String category;
  final String seriesName;

  factory ProductSelectorItem.fromJson(Map<String, dynamic> json) =>
      ProductSelectorItem(
        id: json['id'] as String,
        productName: json['productName'] as String,
        category: json['category'] as String,
        seriesName: json['seriesName'] as String,
      );
}

class ProductVariantSelectorItem extends ConversationProductVariant {
  const ProductVariantSelectorItem({
    required super.id,
    super.ram,
    super.rom,
    super.color,
  });

  factory ProductVariantSelectorItem.fromJson(Map<String, dynamic> json) =>
      ProductVariantSelectorItem(
        id: json['id'] as String,
        ram: json['ram'] as String?,
        rom: json['rom'] as String?,
        color: json['color'] as String?,
      );
}

String? conversationMessagePreview({
  required String? text,
  required String? direction,
  required String? messageType,
}) {
  final normalizedType = messageType?.toUpperCase();
  final normalizedText = text?.trim();
  final content = normalizedType == 'IMAGE'
      ? 'Sent an image'
      : normalizedText?.isNotEmpty == true
          ? normalizedText!
          : null;
  if (content == null) return null;
  return direction?.toUpperCase() == 'OUTBOUND' ? 'You: $content' : content;
}

class ChatMessage {
  ChatMessage(
      {required this.id,
      required this.text,
      required this.direction,
      required this.messageType,
      required this.sentAt,
      this.sender,
      this.media,
      this.idempotencyKey});
  final String id;
  final String text;
  final String direction;
  final String messageType;
  final DateTime sentAt;
  final MessageSender? sender;
  final ChatMedia? media;
  final String? idempotencyKey;
  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
      id: json['id'] as String,
      text: (json['text'] ?? json['originalText']) as String,
      direction: json['direction'] as String,
      messageType: json['messageType'] as String,
      sentAt: DateTime.parse(json['sentAt'] as String),
      sender: MessageSender.fromJson(json['sender'] as Map<String, dynamic>?),
      media: ChatMedia.fromJson(json['media'] as Map<String, dynamic>?),
      idempotencyKey: json['idempotencyKey'] is String
          ? json['idempotencyKey'] as String
          : json['externalMessageId'] is String &&
                  (json['externalMessageId'] as String).startsWith('outbound:')
              ? (json['externalMessageId'] as String).substring(9)
              : null);
}

class MessageSender {
  MessageSender({this.userId, required this.displayName});
  final String? userId;
  final String displayName;
  static MessageSender? fromJson(Map<String, dynamic>? json) {
    if (json == null ||
        json['displayName'] is! String ||
        (json['displayName'] as String).trim().isEmpty) {
      return null;
    }
    return MessageSender(
        userId: json['userId'] is String ? json['userId'] as String : null,
        displayName: (json['displayName'] as String).trim());
  }
}

class ChatMedia {
  ChatMedia(
      {required this.processingStatus, this.mimeType, this.fileSize, this.url});
  final String processingStatus;
  final String? mimeType;
  final int? fileSize;
  final String? url;
  bool get ready =>
      processingStatus == 'READY' &&
      url != null &&
      (mimeType?.startsWith('image/') ?? false);
  static ChatMedia? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final fileSize = json['fileSize'];
    return ChatMedia(
        processingStatus: json['processingStatus'] is String
            ? json['processingStatus'] as String
            : 'FAILED',
        mimeType:
            json['mimeType'] is String ? json['mimeType'] as String : null,
        fileSize: fileSize is num ? fileSize.toInt() : null,
        url: json['url'] is String ? json['url'] as String : null);
  }
}
