import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../inbox/conversation_repository.dart';

/// Conversation detail surface. Secondary operational data lives here so the
/// room can stay focused on the message history.
class ConversationInfoPage extends StatelessWidget {
  const ConversationInfoPage({
    super.key,
    required this.detail,
    this.onOwnerTap,
    this.onSalesTap,
    this.onStatusTap,
  });

  final ConversationDetail detail;
  final VoidCallback? onOwnerTap;
  final VoidCallback? onSalesTap;
  final VoidCallback? onStatusTap;

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    final sales = detail.customerSalesInformation;
    final source = _sourceLabel(context, sales, detail.tags);
    final imageCount = detail.messages
        .where((message) => message.messageType == 'IMAGE')
        .length;
    final videoCount = detail.messages
        .where((message) => message.messageType == 'VIDEO')
        .length;
    final linkCount = detail.messages
        .where((message) => RegExp(r'https?://\S+', caseSensitive: false)
            .hasMatch(message.text))
        .length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(l10n.customerProfile),
        leading: IconButton(
          tooltip: l10n.back,
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          _ProfileHeader(detail: detail),
          const SizedBox(height: 18),
          _ActionRail(
            onOwnerTap: onOwnerTap,
            onSalesTap: onSalesTap,
            onStatusTap: onStatusTap,
          ),
          const SizedBox(height: 22),
          _Section(
            title: l10n.conversationContext,
            children: [
              _InfoRow(
                icon: Icons.storefront_outlined,
                label: l10n.storeContext,
                value: detail.storeName.isEmpty
                    ? l10n.storeUnavailable
                    : detail.storeName,
                subtitle: detail.storeCode?.trim().isNotEmpty == true
                    ? l10n.storeCode(detail.storeCode!)
                    : null,
              ),
              _InfoRow(
                icon: Icons.person_outline,
                label: l10n.conversationOwner,
                value: detail.owner?.displayName ?? l10n.unassignedOwner,
                onTap: onOwnerTap,
              ),
              _InfoRow(
                icon: Icons.language_outlined,
                label: l10n.customerSource,
                value: source ?? '-',
              ),
              _InfoRow(
                icon: Icons.mark_chat_unread_outlined,
                label: l10n.replyStatus,
                value: localizedConversationStatusLabel(
                  context,
                  detail.bmReplyStatus ?? 'UNKNOWN',
                  exact: true,
                ),
                onTap: onStatusTap,
                valueWidget: StatusBadge(
                  status: detail.bmReplyStatus ?? 'UNKNOWN',
                  compact: true,
                ),
              ),
              _InfoRow(
                icon: Icons.sell_outlined,
                label: l10n.customerSalesInformation,
                value: _salesSummary(context, sales),
                onTap: onSalesTap,
              ),
            ],
          ),
          const SizedBox(height: 18),
          _Section(
            title: l10n.customerProfile,
            children: [
              _InfoRow(
                icon: Icons.mark_chat_unread_outlined,
                label: l10n.unreadMessages,
                value: '${detail.unreadCount ?? 0}',
              ),
              _InfoRow(
                icon: Icons.forum_outlined,
                label: l10n.messagesInView,
                value: '${detail.messages.length}',
              ),
              _InfoRow(
                icon: Icons.schedule_outlined,
                label: l10n.latestActivity,
                value: _latestActivity(context),
              ),
            ],
          ),
          if (imageCount + videoCount + linkCount > 0) ...[
            const SizedBox(height: 18),
            _Section(
              title: _mediaLabel(context),
              children: [
                if (imageCount > 0)
                  _InfoRow(
                    icon: Icons.photo_library_outlined,
                    label: _imagesLabel(context),
                    value: '$imageCount',
                  ),
                if (videoCount > 0)
                  _InfoRow(
                    icon: Icons.video_library_outlined,
                    label: _videosLabel(context),
                    value: '$videoCount',
                  ),
                if (linkCount > 0)
                  _InfoRow(
                    icon: Icons.link_outlined,
                    label: _linksLabel(context),
                    value: '$linkCount',
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String? _sourceLabel(BuildContext context, CustomerSalesInformation? sales,
      ConversationTags? tags) {
    final sources = <String>[];
    if (sales?.isOnline == true) {
      sources.add(appLocalizations(context).statusOnline);
    }
    if (sales?.onlineSource?.trim().isNotEmpty == true) {
      sources.add(sales!.onlineSource!.trim());
    }
    if (sources.isEmpty) sources.addAll(tags?.sourceChannels ?? const []);
    return sources.isEmpty ? null : sources.join(' · ');
  }

  String _salesSummary(BuildContext context, CustomerSalesInformation? sales) {
    if (sales == null || sales.isEmpty) {
      return appLocalizations(context).noCustomerSalesInfo;
    }
    final status = switch (sales.status) {
      'ONLINE' => appLocalizations(context).statusOnline,
      'INTERESTED' => appLocalizations(context).statusInterested,
      'PURCHASED' => appLocalizations(context).statusPurchased,
      'FILM' => appLocalizations(context).statusFilm,
      _ => appLocalizations(context).customerSalesInformation,
    };
    final first = sales.products.isEmpty ? null : sales.products.first;
    return first == null ? status : '$status · ${first.modelName}';
  }

  String _latestActivity(BuildContext context) {
    if (detail.messages.isEmpty) return appLocalizations(context).noMessagesYet;
    final latest = detail.messages
        .map((message) => message.sentAt)
        .reduce((left, right) => left.isAfter(right) ? left : right)
        .toLocal();
    final date = MaterialLocalizations.of(context).formatMediumDate(latest);
    final time = MaterialLocalizations.of(context)
        .formatTimeOfDay(TimeOfDay.fromDateTime(latest));
    return '$date · $time';
  }

  String _mediaLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'สื่อ',
        'zh' => '媒体',
        _ => 'Media',
      };

  String _imagesLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'รูปภาพ',
        'zh' => '图片',
        _ => 'Images',
      };

  String _videosLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'วิดีโอ',
        'zh' => '视频',
        _ => 'Videos',
      };

  String _linksLabel(BuildContext context) =>
      switch (Localizations.localeOf(context).languageCode) {
        'th' => 'ลิงก์',
        'zh' => '链接',
        _ => 'Links',
      };
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.detail});

  final ConversationDetail detail;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          UserAvatar(
            displayName: detail.customerName,
            imageUrl: detail.customerPictureUrl,
            radius: 30,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  detail.customerName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  detail.storeName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
              ],
            ),
          ),
        ],
      );
}

class _ActionRail extends StatelessWidget {
  const _ActionRail({this.onOwnerTap, this.onSalesTap, this.onStatusTap});

  final VoidCallback? onOwnerTap;
  final VoidCallback? onSalesTap;
  final VoidCallback? onStatusTap;

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    final actions = [
      if (onOwnerTap != null)
        _ActionData(Icons.person_add_alt_1_outlined, l10n.conversationOwner,
            onOwnerTap!),
      if (onSalesTap != null)
        _ActionData(
            Icons.sell_outlined, l10n.customerSalesInformation, onSalesTap!),
      if (onStatusTap != null)
        _ActionData(Icons.more_horiz_rounded, l10n.moreActions, onStatusTap!),
    ];
    if (actions.isEmpty) return const SizedBox.shrink();
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        for (final action in actions)
          Expanded(
            child: InkWell(
              onTap: action.onTap,
              borderRadius: BorderRadius.circular(14),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        color: AppColors.surface,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(action.icon, size: 21),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      action.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _ActionData {
  const _ActionData(this.icon, this.label, this.onTap);

  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 6),
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(children: children),
          ),
        ],
      );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.subtitle,
    this.onTap,
    this.valueWidget,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icon, size: 20, color: AppColors.textSecondary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: Theme.of(context).textTheme.bodyMedium),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              valueWidget ??
                  Flexible(
                    child: Text(
                      value,
                      textAlign: TextAlign.end,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ),
              if (onTap != null)
                const Padding(
                  padding: EdgeInsets.only(left: 4),
                  child: Icon(Icons.chevron_right_rounded,
                      size: 19, color: AppColors.textSecondary),
                ),
            ],
          ),
        ),
      );
}
