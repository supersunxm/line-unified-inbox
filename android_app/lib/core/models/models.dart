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
      this.employeeId,
      required this.email,
      required this.storeName,
      required this.role,
      required this.createdAt});
  final String id;
  final String name;
  final String? employeeId;
  final String email;
  final String storeName;
  final String role;
  final DateTime createdAt;
  factory PendingRegistration.fromJson(Map<String, dynamic> json) =>
      PendingRegistration(
          id: json['id'] as String,
          name: json['name'] as String,
          employeeId: json['employeeId'] as String?,
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
      this.email,
      this.employeeId,
      this.phone,
      this.position,
      this.mustChangePassword = false});
  final String id;
  final String? email;
  final String displayName;
  final String role;
  final List<StoreMembership> memberships;
  final List<Store> stores;
  final Map<String, dynamic> permissions;
  final String? employeeId;
  final String? phone;
  final String? position;
  final bool mustChangePassword;
  factory CurrentUser.fromJson(Map<String, dynamic> json) {
    final profile =
        (json['profile'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    return CurrentUser(
        id: json['id'] as String,
        email: json['email'] as String?,
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
        employeeId:
            profile['employeeId'] as String? ?? json['employeeId'] as String?,
        phone: profile['phone'] as String?,
        position: profile['position'] as String?,
        mustChangePassword: json['mustChangePassword'] as bool? ?? false);
  }
}

class ConversationSummary {
  static const _summaryUnset = Object();

  ConversationSummary(
      {required this.id,
      required this.customerName,
      required this.storeName,
      required this.unreadCount,
      required this.bmReplyStatus,
      this.customerPictureUrl,
      this.customerSalesSummary,
      this.preview,
      this.sentAt,
      this.priority = const ConversationPriority.none()});
  final String id;
  final String customerName;
  final String storeName;
  final int unreadCount;
  final String bmReplyStatus;
  final String? customerPictureUrl;
  final CustomerSalesSummary? customerSalesSummary;
  final String? preview;
  final DateTime? sentAt;
  final ConversationPriority priority;

  ConversationSummary copyWith({
    String? id,
    String? customerName,
    String? storeName,
    int? unreadCount,
    String? bmReplyStatus,
    Object? customerPictureUrl = _summaryUnset,
    Object? customerSalesSummary = _summaryUnset,
    String? preview,
    DateTime? sentAt,
    ConversationPriority? priority,
  }) =>
      ConversationSummary(
          id: id ?? this.id,
          customerName: customerName ?? this.customerName,
          storeName: storeName ?? this.storeName,
          unreadCount: unreadCount ?? this.unreadCount,
          bmReplyStatus: bmReplyStatus ?? this.bmReplyStatus,
          customerPictureUrl: identical(customerPictureUrl, _summaryUnset)
              ? this.customerPictureUrl
              : customerPictureUrl as String?,
          customerSalesSummary: identical(customerSalesSummary, _summaryUnset)
              ? this.customerSalesSummary
              : customerSalesSummary as CustomerSalesSummary?,
          preview: preview ?? this.preview,
          sentAt: sentAt ?? this.sentAt,
          priority: priority ?? this.priority);

  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    final message = json['lastMessage'] as Map<String, dynamic>?;
    return ConversationSummary(
        id: json['id'] as String,
        customerName:
            (json['customer'] as Map<String, dynamic>)['displayName'] as String,
        storeName: (json['store'] as Map<String, dynamic>)['name'] as String,
        unreadCount: json['unreadCount'] as int? ?? 0,
        bmReplyStatus: json['bmReplyStatus'] as String,
        customerPictureUrl:
            (json['customer'] as Map<String, dynamic>)['pictureUrl'] as String?,
        customerSalesSummary: CustomerSalesSummary.fromJson(
            json['customerSalesSummary'] as Map<String, dynamic>?),
        preview: message == null
            ? null
            : conversationMessagePreview(
                text: message['preview'] as String?,
                direction: message['direction'] as String?,
                messageType: message['messageType'] as String?,
              ),
        sentAt: message?['sentAt'] == null
            ? null
            : DateTime.parse(message!['sentAt'] as String),
        priority: ConversationPriority.fromJson(json['priority']));
  }
}

class CustomerSalesSummaryProduct {
  const CustomerSalesSummaryProduct(
      {required this.modelName, this.quantity = 1});

  final String modelName;
  final int quantity;

  factory CustomerSalesSummaryProduct.fromJson(Map<String, dynamic> json) =>
      CustomerSalesSummaryProduct(
        modelName: (json['modelName'] as String?)?.trim().isNotEmpty == true
            ? (json['modelName'] as String).trim()
            : 'Product',
        quantity: json['quantity'] is num
            ? (json['quantity'] as num).toInt().clamp(1, 999).toInt()
            : 1,
      );

  @override
  bool operator ==(Object other) =>
      other is CustomerSalesSummaryProduct &&
      other.modelName == modelName &&
      other.quantity == quantity;

  @override
  int get hashCode => Object.hash(modelName, quantity);
}

class CustomerSalesSummary {
  const CustomerSalesSummary(
      {this.status, this.interestLevel, this.products = const []});

  final String? status;
  final String? interestLevel;
  final List<CustomerSalesSummaryProduct> products;

  bool get isEmpty =>
      (status == null || status!.trim().isEmpty) && products.isEmpty;

  bool get isOnline => status == 'ONLINE';
  bool get isInterested => status == 'INTERESTED';
  bool get isPurchased => status == 'PURCHASED';

  static CustomerSalesSummary? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final rawProducts = json['products'];
    final products = rawProducts is List
        ? rawProducts
            .whereType<Map>()
            .map((item) => CustomerSalesSummaryProduct.fromJson(
                Map<String, dynamic>.from(item)))
            .toList(growable: false)
        : const <CustomerSalesSummaryProduct>[];
    final status = json['status'] as String?;
    final interestLevel = json['interestLevel'] as String?;
    final summary = CustomerSalesSummary(
      status: status,
      interestLevel: interestLevel,
      products: products,
    );
    return summary.isEmpty ? null : summary;
  }

  static CustomerSalesSummary? fromData({
    required String? status,
    String? interestLevel,
    Iterable<CustomerSalesSummaryProduct> products = const [],
  }) {
    final summary = CustomerSalesSummary(
      status: status,
      interestLevel: interestLevel,
      products: products.toList(growable: false),
    );
    return summary.isEmpty ? null : summary;
  }

  @override
  bool operator ==(Object other) =>
      other is CustomerSalesSummary &&
      other.status == status &&
      other.interestLevel == interestLevel &&
      _listEquals(other.products, products);

  @override
  int get hashCode =>
      Object.hash(status, interestLevel, Object.hashAll(products));

  static bool _listEquals(List<CustomerSalesSummaryProduct> left,
      List<CustomerSalesSummaryProduct> right) {
    if (left.length != right.length) return false;
    for (var index = 0; index < left.length; index++) {
      if (left[index] != right[index]) return false;
    }
    return true;
  }
}

class ConversationPriority {
  const ConversationPriority({
    required this.level,
    required this.waitingSeconds,
    required this.waitingSince,
    required this.reasons,
  });

  const ConversationPriority.none()
      : level = 'NONE',
        waitingSeconds = 0,
        waitingSince = null,
        reasons = const [];

  final String level;
  final int waitingSeconds;
  final DateTime? waitingSince;
  final List<String> reasons;

  bool get isActionable => level != 'NONE';

  int get severityRank => switch (level) {
        'URGENT' => 3,
        'HIGH' => 2,
        'NORMAL' => 1,
        _ => 0,
      };

  factory ConversationPriority.fromJson(Object? value) {
    if (value is! Map) return const ConversationPriority.none();
    final rawLevel = value['level'];
    final level = rawLevel is String ? rawLevel.toUpperCase() : 'NONE';
    final normalizedLevel = switch (level) {
      'URGENT' || 'HIGH' || 'NORMAL' || 'NONE' => level,
      _ => 'NONE',
    };
    final rawWaitingSeconds = value['waitingSeconds'];
    final waitingSeconds = rawWaitingSeconds is num
        ? rawWaitingSeconds.toInt().clamp(0, 2147483647).toInt()
        : 0;
    final rawWaitingSince = value['waitingSince'];
    return ConversationPriority(
      level: normalizedLevel,
      waitingSeconds: waitingSeconds,
      waitingSince:
          rawWaitingSince is String ? DateTime.tryParse(rawWaitingSince) : null,
      reasons: (value['reasons'] is List)
          ? (value['reasons'] as List)
              .whereType<String>()
              .toList(growable: false)
          : const [],
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ConversationPriority &&
      other.level == level &&
      other.waitingSeconds == waitingSeconds &&
      other.waitingSince == waitingSince &&
      _listEquals(other.reasons, reasons);

  @override
  int get hashCode => Object.hash(level, waitingSeconds, waitingSince, reasons);

  static bool _listEquals(List<String> left, List<String> right) {
    if (left.length != right.length) return false;
    for (var index = 0; index < left.length; index++) {
      if (left[index] != right[index]) return false;
    }
    return true;
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

  bool get isEmpty =>
      sourceChannels.isEmpty && !isInstallment && product == null;

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
      : normalizedType == 'VIDEO'
          ? 'Sent a video'
          : normalizedType == 'STICKER'
              ? 'Sent a LINE sticker'
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
      this.sticker,
      this.media,
      this.idempotencyKey});
  final String id;
  final String text;
  final String direction;
  final String messageType;
  final DateTime sentAt;
  final MessageSender? sender;
  final StickerPresentation? sticker;
  final ChatMedia? media;
  final String? idempotencyKey;
  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
      id: json['id'] as String,
      text: (json['text'] ?? json['originalText']) as String,
      direction: json['direction'] as String,
      messageType: json['messageType'] as String,
      sentAt: DateTime.parse(json['sentAt'] as String),
      sender: MessageSender.fromJson(json['sender'] as Map<String, dynamic>?),
      sticker: StickerPresentation.fromJson(
          json['sticker'] as Map<String, dynamic>?),
      media: ChatMedia.fromJson(json['media'] as Map<String, dynamic>?),
      idempotencyKey: json['idempotencyKey'] is String
          ? json['idempotencyKey'] as String
          : json['externalMessageId'] is String &&
                  (json['externalMessageId'] as String).startsWith('outbound:')
              ? (json['externalMessageId'] as String).substring(9)
              : null);
}

class StickerPresentation {
  const StickerPresentation({this.text, this.keywords = const []});

  final String? text;
  final List<String> keywords;

  String? get firstUsefulText {
    final normalizedText = text?.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (normalizedText?.isNotEmpty == true) return normalizedText;
    for (final keyword in keywords) {
      final normalized = keyword.replaceAll(RegExp(r'\s+'), ' ').trim();
      if (normalized.isNotEmpty) return normalized;
    }
    return null;
  }

  static StickerPresentation? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    return StickerPresentation(
      text: json['text'] is String ? json['text'] as String : null,
      keywords: json['keywords'] is List
          ? (json['keywords'] as List)
              .whereType<String>()
              .toList(growable: false)
          : const [],
    );
  }
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
  bool get isImage => mimeType?.toLowerCase().startsWith('image/') ?? false;
  bool get isVideo => mimeType?.toLowerCase().startsWith('video/') ?? false;
  bool get ready =>
      processingStatus == 'READY' && url != null && (isImage || isVideo);
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

class MonthlySummary {
  MonthlySummary({
    required this.period,
    required this.volume,
    required this.response,
    required this.operational,
    required this.comparison,
    required this.tags,
    required this.dataQuality,
  });

  final SummaryPeriod period;
  final SummaryVolume volume;
  final SummaryResponse response;
  final SummaryOperational operational;
  final SummaryComparison comparison;
  final SummaryTagAnalytics tags;
  final SummaryDataQuality dataQuality;

  factory MonthlySummary.fromJson(Map<String, dynamic> json) => MonthlySummary(
        period: SummaryPeriod.fromJson(
            json['period'] as Map<String, dynamic>? ?? {}),
        volume: SummaryVolume.fromJson(
            json['volume'] as Map<String, dynamic>? ?? {}),
        response: SummaryResponse.fromJson(
            json['response'] as Map<String, dynamic>? ?? {}),
        operational: SummaryOperational.fromJson(
            json['operational'] as Map<String, dynamic>? ?? {}),
        comparison: SummaryComparison.fromJson(
            json['comparison'] as Map<String, dynamic>? ?? {}),
        tags: SummaryTagAnalytics.fromJson(
            json['tags'] as Map<String, dynamic>? ?? {}),
        dataQuality: SummaryDataQuality.fromJson(
            json['dataQuality'] as Map<String, dynamic>? ?? {}),
      );
}

class SummaryPeriod {
  SummaryPeriod(
      {required this.month,
      required this.timezone,
      required this.isCurrentMonth,
      required this.throughDate,
      required this.comparisonBasis});
  final String month;
  final String timezone;
  final bool isCurrentMonth;
  final String throughDate;
  final String comparisonBasis;

  factory SummaryPeriod.fromJson(Map<String, dynamic> json) => SummaryPeriod(
        month: json['month'] as String? ?? '',
        timezone: json['timezone'] as String? ?? 'Asia/Bangkok',
        isCurrentMonth: json['isCurrentMonth'] == true,
        throughDate: json['throughDate'] as String? ?? '',
        comparisonBasis: json['comparisonBasis'] as String? ?? 'full_month',
      );
}

class SummaryVolume {
  SummaryVolume(
      {required this.incomingMessages,
      required this.incomingConversations,
      required this.bmReplies});
  final int incomingMessages;
  final int incomingConversations;
  final int bmReplies;

  factory SummaryVolume.fromJson(Map<String, dynamic> json) => SummaryVolume(
        incomingMessages: _intValue(json['incomingMessages']),
        incomingConversations: _intValue(json['incomingConversations']),
        bmReplies: _intValue(json['bmReplies']),
      );
}

class SummaryResponse {
  SummaryResponse(
      {required this.cyclesStarted,
      required this.cyclesAnswered,
      required this.unanswered,
      required this.responseRate,
      required this.averageSeconds,
      required this.medianSeconds,
      required this.buckets,
      required this.sampleSize,
      required this.available});
  final int cyclesStarted;
  final int cyclesAnswered;
  final int unanswered;
  final double? responseRate;
  final double? averageSeconds;
  final double? medianSeconds;
  final SummaryBuckets buckets;
  final int sampleSize;
  final bool available;

  factory SummaryResponse.fromJson(Map<String, dynamic> json) =>
      SummaryResponse(
        cyclesStarted: _intValue(json['cyclesStarted']),
        cyclesAnswered: _intValue(json['cyclesAnswered']),
        unanswered: _intValue(json['unanswered']),
        responseRate: _doubleValue(json['responseRate']),
        averageSeconds: _doubleValue(json['averageSeconds']),
        medianSeconds: _doubleValue(json['medianSeconds']),
        buckets: SummaryBuckets.fromJson(
            json['buckets'] as Map<String, dynamic>? ?? {}),
        sampleSize: _intValue(json['sampleSize']),
        available: json['available'] == true,
      );
}

class SummaryBuckets {
  SummaryBuckets(
      {required this.under4h,
      required this.from4To12h,
      required this.from12To24h,
      required this.over24h});
  final int under4h;
  final int from4To12h;
  final int from12To24h;
  final int over24h;

  factory SummaryBuckets.fromJson(Map<String, dynamic> json) => SummaryBuckets(
        under4h: _intValue(json['under4h']),
        from4To12h: _intValue(json['from4To12h']),
        from12To24h: _intValue(json['from12To24h']),
        over24h: _intValue(json['over24h']),
      );
}

class SummaryOperational {
  SummaryOperational({required this.needReply, required this.completed});
  final int needReply;
  final int completed;

  factory SummaryOperational.fromJson(Map<String, dynamic> json) =>
      SummaryOperational(
        needReply: _intValue(json['needReply']),
        completed: _intValue(json['completed']),
      );
}

class SummaryComparison {
  SummaryComparison(
      {required this.available,
      this.reason,
      this.volume,
      this.response,
      this.changes = const {},
      this.responseChanges});
  final bool available;
  final String? reason;
  final SummaryVolume? volume;
  final SummaryResponse? response;
  final Map<String, double?> changes;
  final SummaryResponseChanges? responseChanges;

  factory SummaryComparison.fromJson(Map<String, dynamic> json) =>
      SummaryComparison(
        available: json['available'] == true,
        reason: json['reason'] as String?,
        volume: json['volume'] is Map<String, dynamic>
            ? SummaryVolume.fromJson(json['volume'] as Map<String, dynamic>)
            : null,
        response: json['response'] is Map<String, dynamic>
            ? SummaryResponse.fromJson(json['response'] as Map<String, dynamic>)
            : null,
        changes: (json['changes'] as Map<String, dynamic>?)
                ?.map((key, value) => MapEntry(key, _doubleValue(value))) ??
            const {},
        responseChanges: json['responseChanges'] is Map<String, dynamic>
            ? SummaryResponseChanges.fromJson(
                json['responseChanges'] as Map<String, dynamic>)
            : null,
      );
}

class SummaryResponseChanges {
  SummaryResponseChanges(
      {this.responseRate,
      this.medianSeconds,
      this.averageSeconds,
      this.bucketPercentagePoints});
  final double? responseRate;
  final double? medianSeconds;
  final double? averageSeconds;
  final Map<String, double?>? bucketPercentagePoints;

  factory SummaryResponseChanges.fromJson(Map<String, dynamic> json) =>
      SummaryResponseChanges(
        responseRate: _doubleValue(json['responseRate']),
        medianSeconds: _doubleValue(json['medianSeconds']),
        averageSeconds: _doubleValue(json['averageSeconds']),
        bucketPercentagePoints:
            (json['bucketPercentagePoints'] as Map<String, dynamic>?)
                ?.map((key, value) => MapEntry(key, _doubleValue(value))),
      );
}

class SummaryTagAnalytics {
  SummaryTagAnalytics(
      {required this.mode,
      required this.coverage,
      required this.sources,
      required this.installment,
      required this.topProducts,
      required this.topVariants});
  final String mode;
  final SummaryTagCoverage coverage;
  final SummaryTagSources sources;
  final SummaryInstallment installment;
  final List<SummaryProduct> topProducts;
  final List<SummaryVariant> topVariants;

  factory SummaryTagAnalytics.fromJson(Map<String, dynamic> json) =>
      SummaryTagAnalytics(
        mode: json['mode'] as String? ?? 'CURRENT_TAG_SNAPSHOT',
        coverage: SummaryTagCoverage.fromJson(
            json['coverage'] as Map<String, dynamic>? ?? {}),
        sources: SummaryTagSources.fromJson(
            json['sources'] as Map<String, dynamic>? ?? {}),
        installment: SummaryInstallment.fromJson(
            json['installment'] as Map<String, dynamic>? ?? {}),
        topProducts: ((json['topProducts'] as List<dynamic>?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(SummaryProduct.fromJson)
            .toList(),
        topVariants: ((json['topVariants'] as List<dynamic>?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(SummaryVariant.fromJson)
            .toList(),
      );
}

class SummaryTagCoverage {
  SummaryTagCoverage(
      {required this.eligibleConversations,
      required this.taggedConversations,
      required this.coverageRate,
      required this.quality});
  final int eligibleConversations;
  final int taggedConversations;
  final double coverageRate;
  final String quality;

  factory SummaryTagCoverage.fromJson(Map<String, dynamic> json) =>
      SummaryTagCoverage(
        eligibleConversations: _intValue(json['eligibleConversations']),
        taggedConversations: _intValue(json['taggedConversations']),
        coverageRate: _doubleValue(json['coverageRate']) ?? 0,
        quality: json['quality'] as String? ?? 'LOW',
      );
}

class SummaryTagSources {
  SummaryTagSources(
      {required this.storeOnly,
      required this.onlineOnly,
      required this.storeAndOnline,
      required this.untagged});
  final int storeOnly;
  final int onlineOnly;
  final int storeAndOnline;
  final int untagged;

  factory SummaryTagSources.fromJson(Map<String, dynamic> json) =>
      SummaryTagSources(
        storeOnly: _intValue(json['storeOnly']),
        onlineOnly: _intValue(json['onlineOnly']),
        storeAndOnline: _intValue(json['storeAndOnline']),
        untagged: _intValue(json['untagged']),
      );
}

class SummaryInstallment {
  SummaryInstallment(
      {required this.count,
      required this.eligibleRate,
      required this.taggedRate});
  final int count;
  final double eligibleRate;
  final double taggedRate;

  factory SummaryInstallment.fromJson(Map<String, dynamic> json) =>
      SummaryInstallment(
        count: _intValue(json['count']),
        eligibleRate: _doubleValue(json['eligibleRate']) ?? 0,
        taggedRate: _doubleValue(json['taggedRate']) ?? 0,
      );
}

class SummaryProduct {
  SummaryProduct(
      {required this.productId,
      required this.productName,
      required this.count});
  final String productId;
  final String productName;
  final int count;

  factory SummaryProduct.fromJson(Map<String, dynamic> json) => SummaryProduct(
        productId: json['productId'] as String? ?? '',
        productName: json['productName'] as String? ?? '',
        count: _intValue(json['count']),
      );
}

class SummaryVariant {
  SummaryVariant(
      {required this.productName,
      this.ram,
      this.rom,
      this.color,
      required this.count});
  final String productName;
  final String? ram;
  final String? rom;
  final String? color;
  final int count;

  factory SummaryVariant.fromJson(Map<String, dynamic> json) => SummaryVariant(
        productName: json['productName'] as String? ?? '',
        ram: json['ram'] as String?,
        rom: json['rom'] as String?,
        color: json['color'] as String?,
        count: _intValue(json['count']),
      );
}

class SummaryDataQuality {
  SummaryDataQuality(
      {required this.qaExcluded,
      required this.ambiguousOutboundExcluded,
      required this.responseMetricsAvailable,
      this.tagAnalyticsMode,
      this.tagCoverage});
  final bool qaExcluded;
  final int ambiguousOutboundExcluded;
  final bool responseMetricsAvailable;
  final String? tagAnalyticsMode;
  final SummaryTagCoverage? tagCoverage;

  factory SummaryDataQuality.fromJson(Map<String, dynamic> json) =>
      SummaryDataQuality(
        qaExcluded: json['qaExcluded'] == true,
        ambiguousOutboundExcluded: _intValue(json['ambiguousOutboundExcluded']),
        responseMetricsAvailable: json['responseMetricsAvailable'] == true,
        tagAnalyticsMode: json['tagAnalyticsMode'] as String?,
        tagCoverage: json['tagCoverage'] is Map<String, dynamic>
            ? SummaryTagCoverage.fromJson(
                json['tagCoverage'] as Map<String, dynamic>)
            : null,
      );
}

int _intValue(Object? value) => value is num ? value.toInt() : 0;
double? _doubleValue(Object? value) => value is num ? value.toDouble() : null;
