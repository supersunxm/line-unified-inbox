import '../../core/models/models.dart';
import '../inbox/conversation_repository.dart';

// Keep polling long enough to cover a worker replacement, the 90-second
// durable-send lease, and bounded Manager-history verification backoff. The
// delay is capped so a mounted chat converges without hammering the API.
const queuedDeliveryPollDelays = <Duration>[
  Duration(seconds: 1),
  Duration(seconds: 2),
  Duration(seconds: 3),
  Duration(seconds: 5),
  Duration(seconds: 8),
  Duration(seconds: 13),
  Duration(seconds: 21),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
  Duration(seconds: 30),
];

const queuedDeliveryPollHorizon = Duration(minutes: 5, seconds: 53);

bool canApplyQueuedDeliveryPollResult({
  required bool mounted,
  required int pollGeneration,
  required int currentGeneration,
}) =>
    mounted && pollGeneration == currentGeneration;

class QueuedDeliveryReconciliation {
  const QueuedDeliveryReconciliation({
    required this.detail,
    required this.stopPolling,
  });

  final ConversationDetail detail;
  final bool stopPolling;
}

QueuedDeliveryReconciliation reconcileQueuedDelivery({
  required ConversationDetail current,
  required ConversationDetail latest,
  required String messageId,
  required DateTime targetSentAt,
}) {
  final refreshed =
      latest.messages.where((message) => message.id == messageId).firstOrNull;

  if (refreshed == null) {
    if (!_canonicalWindowCoversTarget(latest.messages, targetSentAt)) {
      return QueuedDeliveryReconciliation(
        detail: current,
        stopPolling: false,
      );
    }

    final withoutTarget =
        current.messages.where((message) => message.id != messageId);
    return QueuedDeliveryReconciliation(
      detail: current.copyWith(
        messages: _mergeMessages(withoutTarget, latest.messages),
        bmReplyStatus: latest.bmReplyStatus ?? current.bmReplyStatus,
        owner: latest.owner,
        ownerTracked: latest.ownerTracked,
      ),
      stopPolling: true,
    );
  }

  final withoutTarget =
      current.messages.where((message) => message.id != messageId);
  return QueuedDeliveryReconciliation(
    detail: current.copyWith(
      messages: _mergeMessages(withoutTarget, latest.messages),
      bmReplyStatus: latest.bmReplyStatus ?? current.bmReplyStatus,
      owner: latest.owner,
      ownerTracked: latest.ownerTracked,
    ),
    stopPolling: refreshed.deliveryStatus != 'PENDING',
  );
}

bool _canonicalWindowCoversTarget(
    List<ChatMessage> messages, DateTime targetSentAt) {
  if (messages.isEmpty) return false;

  final windowStart = messages
      .map((message) => message.sentAt)
      .reduce((left, right) => left.isBefore(right) ? left : right);
  final windowEnd = messages
      .map((message) => message.sentAt)
      .reduce((left, right) => left.isAfter(right) ? left : right);
  return !targetSentAt.isBefore(windowStart) &&
      !targetSentAt.isAfter(windowEnd);
}

List<ChatMessage> _mergeMessages(
    Iterable<ChatMessage> current, Iterable<ChatMessage> canonical) {
  final byId = <String, ChatMessage>{};
  for (final message in current) {
    byId[message.id] = message;
  }
  for (final message in canonical) {
    byId[message.id] = message;
  }

  final merged = byId.values.toList()
    ..sort((left, right) {
      final timestamp = left.sentAt.compareTo(right.sentAt);
      return timestamp == 0 ? left.id.compareTo(right.id) : timestamp;
    });
  return merged;
}
