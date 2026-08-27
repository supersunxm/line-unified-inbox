import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../l10n/app_localizations.dart';

const maxConversationNotificationMessages = 8;
const maxNotificationTextLength = 160;

String normalizeNotificationText(
  Object? value, {
  String fallback = '',
  int maxLength = maxNotificationTextLength,
}) {
  final source = value is String ? value : fallback;
  final compact = source.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (compact.isEmpty) {
    return fallback.replaceAll(RegExp(r'\s+'), ' ').trim();
  }
  if (compact.length <= maxLength) return compact;
  const suffix = '...';
  return '${compact.substring(0, maxLength - suffix.length)}$suffix';
}

String notificationTitle({
  String? customerName,
  String? storeName,
  String fallbackCustomer = 'Customer',
}) {
  final customer = normalizeNotificationText(
    customerName,
    fallback: fallbackCustomer,
    maxLength: 80,
  );
  final store = normalizeNotificationText(storeName, maxLength: 80);
  return store.isEmpty ? customer : '$customer • $store';
}

class ConversationNotificationMessage {
  const ConversationNotificationMessage({
    required this.messageId,
    required this.preview,
    required this.sentAt,
  });

  final String messageId;
  final String preview;
  final DateTime sentAt;

  Map<String, String> toJson() => {
        'messageId': messageId,
        'preview': preview,
        'sentAt': sentAt.toUtc().toIso8601String(),
      };

  static ConversationNotificationMessage? fromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final messageId = value['messageId'];
    final preview = value['preview'];
    final sentAt = value['sentAt'];
    if (messageId is! String ||
        messageId.isEmpty ||
        preview is! String ||
        sentAt is! String) {
      return null;
    }
    final parsed = DateTime.tryParse(sentAt);
    if (parsed == null) return null;
    return ConversationNotificationMessage(
      messageId: messageId,
      preview: preview,
      sentAt: parsed.toUtc(),
    );
  }
}

class ConversationNotificationHistory {
  const ConversationNotificationHistory({
    required this.conversationId,
    required this.customerName,
    required this.messages,
  });

  final String conversationId;
  final String customerName;
  final List<ConversationNotificationMessage> messages;

  Map<String, dynamic> toJson() => {
        'conversationId': conversationId,
        'customerName': customerName,
        'messages': messages.map((message) => message.toJson()).toList(),
      };

  static ConversationNotificationHistory? fromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final conversationId = value['conversationId'];
    final customerName = value['customerName'];
    final rawMessages = value['messages'];
    if (conversationId is! String ||
        conversationId.isEmpty ||
        customerName is! String ||
        rawMessages is! List) {
      return null;
    }
    final messages = rawMessages
        .map(ConversationNotificationMessage.fromJson)
        .whereType<ConversationNotificationMessage>()
        .toList();
    return ConversationNotificationHistory(
      conversationId: conversationId,
      customerName: customerName,
      messages: messages,
    );
  }
}

abstract class ConversationNotificationHistoryStore {
  Future<bool> contains(
      {required String conversationId, required String messageId});

  Future<ConversationNotificationHistory> append({
    required String conversationId,
    required String customerName,
    required ConversationNotificationMessage message,
  });

  Future<void> clearConversation(String conversationId);
  Future<void> clearAll();
}

class SharedPreferencesConversationNotificationHistoryStore
    implements ConversationNotificationHistoryStore {
  SharedPreferencesConversationNotificationHistoryStore(
      {SharedPreferencesAsync? preferences})
      : _preferences = preferences ?? SharedPreferencesAsync();

  static const _key = 'conversation_notification_history_v1';
  final SharedPreferencesAsync _preferences;

  @override
  Future<bool> contains(
      {required String conversationId, required String messageId}) async {
    final history = (await _read())[conversationId];
    return history?.messages.any((item) => item.messageId == messageId) ??
        false;
  }

  @override
  Future<ConversationNotificationHistory> append({
    required String conversationId,
    required String customerName,
    required ConversationNotificationMessage message,
  }) async {
    final values = await _read();
    final existing = values[conversationId];
    final messages = [...?existing?.messages]
      ..removeWhere((item) => item.messageId == message.messageId)
      ..add(message);
    messages.sort((a, b) => a.sentAt.compareTo(b.sentAt));
    final history = ConversationNotificationHistory(
      conversationId: conversationId,
      customerName: customerName.trim().isEmpty
          ? (existing?.customerName ?? 'Customer')
          : customerName.trim(),
      messages: messages.length <= maxConversationNotificationMessages
          ? messages
          : messages
              .sublist(messages.length - maxConversationNotificationMessages),
    );
    values[conversationId] = history;
    await _write(values);
    return history;
  }

  @override
  Future<void> clearConversation(String conversationId) async {
    final values = await _read();
    if (values.remove(conversationId) != null) await _write(values);
  }

  @override
  Future<void> clearAll() => _preferences.remove(_key);

  Future<Map<String, ConversationNotificationHistory>> _read() async {
    final raw = await _preferences.getString(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return {};
      final histories = <String, ConversationNotificationHistory>{};
      decoded.forEach((key, value) {
        final history = ConversationNotificationHistory.fromJson(value);
        if (history != null) histories[key] = history;
      });
      return histories;
    } catch (_) {
      return {};
    }
  }

  Future<void> _write(Map<String, ConversationNotificationHistory> values) =>
      _preferences.setString(
        _key,
        jsonEncode(values.map((key, value) => MapEntry(key, value.toJson()))),
      );
}

class MemoryConversationNotificationHistoryStore
    implements ConversationNotificationHistoryStore {
  final Map<String, ConversationNotificationHistory> _values = {};

  @override
  Future<bool> contains(
          {required String conversationId, required String messageId}) async =>
      _values[conversationId]
          ?.messages
          .any((item) => item.messageId == messageId) ??
      false;

  @override
  Future<ConversationNotificationHistory> append({
    required String conversationId,
    required String customerName,
    required ConversationNotificationMessage message,
  }) async {
    final existing = _values[conversationId];
    final messages = [...?existing?.messages]
      ..removeWhere((item) => item.messageId == message.messageId)
      ..add(message);
    messages.sort((a, b) => a.sentAt.compareTo(b.sentAt));
    final result = ConversationNotificationHistory(
      conversationId: conversationId,
      customerName: customerName.trim().isEmpty
          ? (existing?.customerName ?? 'Customer')
          : customerName.trim(),
      messages: messages.length <= maxConversationNotificationMessages
          ? messages
          : messages
              .sublist(messages.length - maxConversationNotificationMessages),
    );
    _values[conversationId] = result;
    return result;
  }

  @override
  Future<void> clearConversation(String conversationId) async {
    _values.remove(conversationId);
  }

  @override
  Future<void> clearAll() async {
    _values.clear();
  }

  ConversationNotificationHistory? read(String conversationId) =>
      _values[conversationId];
}

String notificationPreview({required String messageType, String? preview}) {
  switch (messageType.toUpperCase()) {
    case 'IMAGE':
      return '📷 Image sent';
    case 'VIDEO':
      return '🎥 Video sent';
    case 'STICKER':
      return 'Sticker sent';
    case 'FILE':
      return 'File sent';
    case 'AUDIO':
      return 'Audio sent';
    case 'LOCATION':
      return 'Location sent';
    case 'UNSUPPORTED':
      return 'Customer message unavailable';
  }
  return normalizeNotificationText(
    preview,
    fallback: 'Customer message unavailable',
  );
}

String localizedNotificationPreview({
  required AppLocalizations localizations,
  required String messageType,
  String? preview,
}) {
  if (messageType.toUpperCase() == 'IMAGE') {
    return '📷 ${localizations.sentAnImage}';
  }
  if (messageType.toUpperCase() == 'VIDEO') {
    return '🎥 ${localizations.sentAVideo}';
  }
  if (messageType.toUpperCase() == 'STICKER') {
    return localizations.sentASticker;
  }
  if (messageType.toUpperCase() == 'FILE') {
    return localizations.sentAFile;
  }
  if (messageType.toUpperCase() == 'AUDIO') {
    return localizations.sentAudio;
  }
  if (messageType.toUpperCase() == 'LOCATION') {
    return localizations.sentLocation;
  }
  if (messageType.toUpperCase() == 'UNSUPPORTED') {
    return localizations.unsupportedCustomerMessage;
  }
  return normalizeNotificationText(
    preview,
    fallback: localizations.unsupportedCustomerMessage,
  );
}
