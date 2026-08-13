class StoreMembership {
  StoreMembership({required this.id, required this.storeId, required this.role, required this.store});
  final String id;
  final String storeId;
  final String role;
  final Store store;
  factory StoreMembership.fromJson(Map<String, dynamic> json) => StoreMembership(id: json['id'] as String, storeId: json['storeId'] as String, role: json['role'] as String, store: Store.fromJson(json['store'] as Map<String, dynamic>));
}

class Store {
  Store({required this.id, required this.name, this.code});
  final String id;
  final String name;
  final String? code;
  factory Store.fromJson(Map<String, dynamic> json) => Store(id: json['id'] as String, name: json['name'] as String, code: json['code'] as String?);
}

class PendingRegistration {
  PendingRegistration({required this.id, required this.name, required this.email, required this.storeName, required this.role, required this.createdAt});
  final String id;
  final String name;
  final String email;
  final String storeName;
  final String role;
  final DateTime createdAt;
  factory PendingRegistration.fromJson(Map<String, dynamic> json) => PendingRegistration(id: json['id'] as String, name: json['name'] as String, email: json['email'] as String, storeName: (json['store'] as Map<String, dynamic>)['name'] as String, role: json['role'] as String, createdAt: DateTime.parse(json['createdAt'] as String));
}

class CurrentUser {
  CurrentUser({required this.id, required this.displayName, required this.role, required this.memberships, required this.stores, required this.permissions, this.phone, this.position});
  final String id;
  final String displayName;
  final String role;
  final List<StoreMembership> memberships;
  final List<Store> stores;
  final Map<String, dynamic> permissions;
  final String? phone;
  final String? position;
  factory CurrentUser.fromJson(Map<String, dynamic> json) {
    final profile = (json['profile'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    return CurrentUser(id: json['id'] as String, displayName: json['displayName'] as String, role: json['role'] as String, memberships: ((json['memberships'] as List<dynamic>?) ?? []).map((item) => StoreMembership.fromJson(item as Map<String, dynamic>)).toList(), stores: ((json['stores'] as List<dynamic>?) ?? []).map((item) => Store.fromJson(item as Map<String, dynamic>)).toList(), permissions: (json['permissions'] as Map<String, dynamic>?) ?? <String, dynamic>{}, phone: profile['phone'] as String?, position: profile['position'] as String?);
  }
}

class ConversationSummary {
  ConversationSummary({required this.id, required this.customerName, required this.storeName, required this.unreadCount, required this.bmReplyStatus, this.preview, this.sentAt});
  final String id;
  final String customerName;
  final String storeName;
  final int unreadCount;
  final String bmReplyStatus;
  final String? preview;
  final DateTime? sentAt;
  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    final message = json['lastMessage'] as Map<String, dynamic>?;
    return ConversationSummary(id: json['id'] as String, customerName: (json['customer'] as Map<String, dynamic>)['displayName'] as String, storeName: (json['store'] as Map<String, dynamic>)['name'] as String, unreadCount: json['unreadCount'] as int? ?? 0, bmReplyStatus: json['bmReplyStatus'] as String, preview: message?['preview'] as String?, sentAt: message?['sentAt'] == null ? null : DateTime.parse(message!['sentAt'] as String));
  }
}

class ChatMessage {
  ChatMessage({required this.id, required this.text, required this.direction, required this.messageType, required this.sentAt, this.sender, this.media});
  final String id;
  final String text;
  final String direction;
  final String messageType;
  final DateTime sentAt;
  final MessageSender? sender;
  final ChatMedia? media;
  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(id: json['id'] as String, text: json['text'] as String, direction: json['direction'] as String, messageType: json['messageType'] as String, sentAt: DateTime.parse(json['sentAt'] as String), sender: MessageSender.fromJson(json['sender'] as Map<String, dynamic>?), media: ChatMedia.fromJson(json['media'] as Map<String, dynamic>?));
}

class MessageSender {
  MessageSender({this.userId, required this.displayName});
  final String? userId;
  final String displayName;
  static MessageSender? fromJson(Map<String, dynamic>? json) {
    if (json == null || json['displayName'] is! String || (json['displayName'] as String).trim().isEmpty) return null;
    return MessageSender(userId: json['userId'] is String ? json['userId'] as String : null, displayName: (json['displayName'] as String).trim());
  }
}

class ChatMedia {
  ChatMedia({required this.processingStatus, this.mimeType, this.fileSize, this.url});
  final String processingStatus;
  final String? mimeType;
  final int? fileSize;
  final String? url;
  bool get ready => processingStatus == 'READY' && url != null && (mimeType?.startsWith('image/') ?? false);
  static ChatMedia? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final fileSize = json['fileSize'];
    return ChatMedia(processingStatus: json['processingStatus'] is String ? json['processingStatus'] as String : 'FAILED', mimeType: json['mimeType'] is String ? json['mimeType'] as String : null, fileSize: fileSize is num ? fileSize.toInt() : null, url: json['url'] is String ? json['url'] as String : null);
  }
}
