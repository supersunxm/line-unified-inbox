import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/localization/localization.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../inbox/conversation_repository.dart';

class CustomerProfileSheet extends StatelessWidget {
  const CustomerProfileSheet({super.key, required this.detail});

  final ConversationDetail detail;

  @override
  Widget build(BuildContext context) {
    final latestActivity = _latestActivity;
    final unreadCount = detail.unreadCount ?? 0;

    return SafeArea(
      child: SingleChildScrollView(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                UserAvatar(
                    displayName: detail.customerName,
                    imageUrl: detail.customerPictureUrl,
                    radius: 30),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        detail.customerName,
                        style: Theme.of(context).textTheme.titleLarge,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(appLocalizations(context).customerProfile),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(appLocalizations(context).storeContext,
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Card(
              child: ListTile(
                leading: const Icon(Icons.storefront_outlined),
                title: Text(detail.storeName.isEmpty
                    ? appLocalizations(context).storeUnavailable
                    : detail.storeName),
                subtitle: detail.storeCode?.trim().isNotEmpty == true
                    ? Text(
                        appLocalizations(context).storeCode(detail.storeCode!))
                    : null,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(appLocalizations(context).conversationContext,
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Card(
              child: Padding(
                padding: AppSpacing.card,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(appLocalizations(context).replyStatus),
                        const Spacer(),
                        StatusBadge(status: detail.bmReplyStatus ?? 'UNKNOWN'),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _ContextRow(
                      icon: Icons.mark_chat_unread_outlined,
                      label: appLocalizations(context).unreadMessages,
                      value: '$unreadCount',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ContextRow(
                      icon: Icons.forum_outlined,
                      label: appLocalizations(context).messagesInView,
                      value: '${detail.messages.length}',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ContextRow(
                      icon: Icons.schedule_outlined,
                      label: appLocalizations(context).latestActivity,
                      value: latestActivity == null
                          ? appLocalizations(context).noMessagesYet
                          : _formatActivity(context, latestActivity),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  DateTime? get _latestActivity {
    if (detail.messages.isEmpty) return null;
    return detail.messages
        .map((message) => message.sentAt)
        .reduce((left, right) => left.isAfter(right) ? left : right);
  }

  String _formatActivity(BuildContext context, DateTime value) {
    final local = value.toLocal();
    final date = MaterialLocalizations.of(context).formatMediumDate(local);
    final time = MaterialLocalizations.of(context).formatTimeOfDay(
      TimeOfDay.fromDateTime(local),
    );
    return '$date · $time';
  }
}

class _ContextRow extends StatelessWidget {
  const _ContextRow(
      {required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(label)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      );
}
