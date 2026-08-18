import '../../core/models/models.dart';

String formatWaitingDuration(int waitingSeconds) {
  final seconds = waitingSeconds < 0 ? 0 : waitingSeconds;
  if (seconds < 60 * 60) {
    final minutes = (seconds / 60).ceil().clamp(1, 59);
    return '${minutes}m';
  }
  final hours = seconds ~/ (60 * 60);
  if (hours < 24) return '${hours}h';
  final days = hours ~/ 24;
  final remainingHours = hours % 24;
  return remainingHours == 0 ? '${days}d' : '${days}d ${remainingHours}h';
}

int comparePrioritySummaries(
    ConversationSummary left, ConversationSummary right) {
  final levelComparison =
      right.priority.severityRank.compareTo(left.priority.severityRank);
  if (levelComparison != 0) return levelComparison;

  final leftWaiting = left.priority.waitingSince;
  final rightWaiting = right.priority.waitingSince;
  if (leftWaiting == null && rightWaiting == null) {
    return right.priority.waitingSeconds
        .compareTo(left.priority.waitingSeconds);
  }
  if (leftWaiting == null) return 1;
  if (rightWaiting == null) return -1;
  final waitingComparison = leftWaiting.compareTo(rightWaiting);
  return waitingComparison != 0
      ? waitingComparison
      : left.id.compareTo(right.id);
}
