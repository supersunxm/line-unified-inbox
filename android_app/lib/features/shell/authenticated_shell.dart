import 'package:flutter/material.dart';

import '../../core/localization/localization.dart';
import '../../core/models/authorization_extensions.dart';
import '../../core/models/models.dart';
import '../../core/network/store_view_context.dart';
import '../../core/services/app_update_service.dart';
import '../auth/admin_approval_page.dart';
import '../auth/auth_repository.dart';
import '../chat/chat_page.dart';
import '../inbox/conversation_repository.dart';
import '../inbox/inbox_page.dart';
import '../profile/personal_information_page.dart';
import '../profile/profile_page.dart';
import '../summary/summary_page.dart';
import '../summary/summary_repository.dart';
import '../notifications/notification_service.dart';
import 'store_view_repository.dart';
import 'store_view_sheet.dart';
import 'workspace_home_page.dart';

class AuthenticatedShell extends StatefulWidget {
  const AuthenticatedShell({
    super.key,
    required this.user,
    required this.auth,
    required this.conversations,
    required this.events,
    required this.summary,
    required this.onLogout,
    required this.onConversationOpened,
    this.storeView,
    this.storeViewRepository,
    this.updateService,
    this.notifications,
  });

  final CurrentUser user;
  final AuthRepository auth;
  final ConversationRepository conversations;
  final Stream<Map<String, dynamic>>? events;
  final SummaryRepository summary;
  final StoreViewContextController? storeView;
  final StoreViewRepository? storeViewRepository;
  final VoidCallback onLogout;
  final Future<void> Function(String conversationId) onConversationOpened;
  final AppUpdateService? updateService;
  final NotificationService? notifications;

  @override
  AuthenticatedShellState createState() => AuthenticatedShellState();
}

class _ShellDestination {
  const _ShellDestination({
    required this.keyName,
    required this.child,
    required this.destination,
  });

  final String keyName;
  final Widget child;
  final NavigationDestination destination;
}

class AuthenticatedShellState extends State<AuthenticatedShell> {
  int _selectedIndex = 0;
  late final StoreViewContextController _fallbackStoreView;

  StoreViewContextController get _storeView =>
      widget.storeView ?? _fallbackStoreView;

  bool get _isStoreView => _storeView.isActive;

  String get _contextKey => _storeView.storeId ?? 'hq';

  @override
  void initState() {
    super.initState();
    _fallbackStoreView = StoreViewContextController();
  }

  @override
  void dispose() {
    _fallbackStoreView.dispose();
    super.dispose();
  }

  Future<void> openConversation(String conversationId) async {
    if (!mounted ||
        (!widget.user.canAccessStoreWorkspace &&
            !widget.user.canAccessAllStores)) {
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatPage(
          conversationId: conversationId,
          repository: widget.conversations,
          events: widget.events,
          canReply: widget.user.canReply,
          showStoreContext:
              _isStoreView ? false : widget.user.shouldShowConversationStoreContext,
          onConversationOpened: widget.onConversationOpened,
        ),
      ),
    );
  }

  List<_ShellDestination> _destinations(BuildContext context) {
    final destinations = <_ShellDestination>[];
    final hasInboxAccess =
        widget.user.canAccessStoreWorkspace || widget.user.canAccessAllStores;

    // HQ's primary mobile task is the all-store inbox. When HQ enters a store
    // view, render the same store-oriented destinations and presentation that
    // a store user sees while retaining the authenticated HQ identity.
    if (!_isStoreView && widget.user.canAccessHqWorkspace && hasInboxAccess) {
      destinations.add(_inboxDestination(context));
    }

    if (!_isStoreView &&
        (widget.user.canAccessHqWorkspace ||
            widget.user.canAccessMainOaWorkspace)) {
      destinations.add(
        _ShellDestination(
          keyName: 'workspace',
          child: WorkspaceHomePage(user: widget.user),
          destination: const NavigationDestination(
            icon: Icon(Icons.home_work_outlined),
            selectedIcon: Icon(Icons.home_work),
            label: 'Workspace',
          ),
        ),
      );
    }

    if (hasInboxAccess &&
        (_isStoreView ||
            !(widget.user.canAccessHqWorkspace && hasInboxAccess))) {
      destinations.add(_inboxDestination(context));
    }
    if (hasInboxAccess) {
      destinations.add(
        _ShellDestination(
          keyName: 'summary',
          child: SummaryPage(
            key: ValueKey('summary:$_contextKey'),
            repository: widget.summary,
          ),
          destination: NavigationDestination(
            icon: const Icon(Icons.bar_chart_outlined),
            selectedIcon: const Icon(Icons.bar_chart),
            label: appLocalizations(context).summary,
          ),
        ),
      );
    }

    destinations.add(
      _ShellDestination(
        keyName: 'profile',
        child: ProfilePage(
          key: ValueKey('profile:$_contextKey'),
          user: widget.user,
          auth: widget.auth,
          onLogout: widget.onLogout,
          onApprovals: !_isStoreView && widget.user.canManageAccounts
              ? _openAdminApprovals
              : null,
          onPersonalInformation: _openPersonalInformation,
          updateService: widget.updateService,
          notificationService: widget.notifications,
        ),
        destination: NavigationDestination(
          icon: const Icon(Icons.person_outline),
          selectedIcon: const Icon(Icons.person),
          label: appLocalizations(context).profile,
        ),
      ),
    );

    return destinations;
  }

  _ShellDestination _inboxDestination(BuildContext context) =>
      _ShellDestination(
        keyName: 'inbox',
        child: InboxPage(
          key: ValueKey('inbox:$_contextKey'),
          repository: widget.conversations,
          events: widget.events,
          isHq: !_isStoreView && widget.user.canAccessHqWorkspace,
          showStoreFilter: !_isStoreView && widget.user.canAccessAllStores,
          showStoreContext:
              _isStoreView ? false : widget.user.shouldShowConversationStoreContext,
          onOpen: openConversation,
          onProfile: _openProfile,
        ),
        destination: NavigationDestination(
          icon: const Icon(Icons.inbox_outlined),
          selectedIcon: const Icon(Icons.inbox),
          label: appLocalizations(context).inbox,
        ),
      );

  void _openProfile() {
    if (!mounted) return;
    final destinations = _destinations(context);
    final index = destinations.indexWhere((item) => item.keyName == 'profile');
    if (index >= 0) setState(() => _selectedIndex = index);
  }

  void _openPersonalInformation() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PersonalInformationPage(user: widget.user),
      ),
    );
  }

  void _openAdminApprovals() {
    if (_isStoreView || !widget.user.canManageAccounts) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AdminApprovalPage(auth: widget.auth),
      ),
    );
  }

  Future<void> _openStoreViewPicker() async {
    final repository = widget.storeViewRepository;
    if (!widget.user.canActAsStore || repository == null) return;
    final selected = await showStoreViewPicker(
      context,
      repository: repository,
      selectedStore: _storeView.store,
    );
    if (!mounted || selected == null) return;
    _storeView.enter(selected);
    setState(() => _selectedIndex = 0);
  }

  void _exitStoreView() {
    if (!_isStoreView) return;
    _storeView.exit();
    setState(() => _selectedIndex = 0);
  }

  Widget _storeViewBanner(BuildContext context) {
    final theme = Theme.of(context);
    final store = _storeView.store;
    return Material(
      color: theme.colorScheme.surfaceContainerHighest,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
          child: Row(
            children: [
              Icon(
                store == null ? Icons.corporate_fare_outlined : Icons.storefront,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      store == null
                          ? 'HQ Mode'
                          : 'กำลังใช้งานในมุมมองสาขา',
                      style: theme.textTheme.labelSmall,
                    ),
                    if (store != null)
                      Text(
                        store.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                  ],
                ),
              ),
              if (store == null)
                TextButton.icon(
                  onPressed: _openStoreViewPicker,
                  icon: const Icon(Icons.storefront_outlined, size: 18),
                  label: const Text('เข้าสู่มุมมองสาขา'),
                )
              else ...[
                TextButton.icon(
                  onPressed: _openStoreViewPicker,
                  icon: const Icon(Icons.swap_horiz, size: 18),
                  label: const Text('เปลี่ยน'),
                ),
                IconButton(
                  tooltip: 'กลับ HQ',
                  onPressed: _exitStoreView,
                  icon: const Icon(Icons.close),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _storeView,
        builder: (context, _) {
          final destinations = _destinations(context);
          final selectedIndex = _selectedIndex < destinations.length
              ? _selectedIndex
              : destinations.length - 1;
          final showStoreViewBanner =
              widget.user.canActAsStore && widget.storeViewRepository != null;

          return Scaffold(
            body: Column(
              children: [
                if (showStoreViewBanner) _storeViewBanner(context),
                Expanded(
                  child: MediaQuery.removePadding(
                    context: context,
                    removeTop: showStoreViewBanner,
                    child: IndexedStack(
                      index: selectedIndex,
                      children: destinations
                          .map((item) => item.child)
                          .toList(growable: false),
                    ),
                  ),
                ),
              ],
            ),
            bottomNavigationBar: NavigationBar(
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              selectedIndex: selectedIndex,
              onDestinationSelected: (index) =>
                  setState(() => _selectedIndex = index),
              destinations: destinations
                  .map((item) => item.destination)
                  .toList(growable: false),
            ),
          );
        },
      );
}
