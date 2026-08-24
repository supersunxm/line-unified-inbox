import 'package:flutter/material.dart';

import '../../core/localization/localization.dart';
import '../../core/models/authorization_extensions.dart';
import '../../core/models/models.dart';
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
    this.updateService,
  });

  final CurrentUser user;
  final AuthRepository auth;
  final ConversationRepository conversations;
  final Stream<Map<String, dynamic>>? events;
  final SummaryRepository summary;
  final VoidCallback onLogout;
  final Future<void> Function(String conversationId) onConversationOpened;
  final AppUpdateService? updateService;

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

  Future<void> openConversation(String conversationId) async {
    if (!mounted || !widget.user.canAccessStoreWorkspace) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatPage(
          conversationId: conversationId,
          repository: widget.conversations,
          events: widget.events,
          onConversationOpened: widget.onConversationOpened,
        ),
      ),
    );
  }

  List<_ShellDestination> _destinations(BuildContext context) {
    final destinations = <_ShellDestination>[];

    if (widget.user.canAccessHqWorkspace ||
        widget.user.canAccessMainOaWorkspace) {
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

    if (widget.user.canAccessStoreWorkspace) {
      destinations.add(
        _ShellDestination(
          keyName: 'inbox',
          child: InboxPage(
            repository: widget.conversations,
            events: widget.events,
            onOpen: openConversation,
            onProfile: _openProfile,
          ),
          destination: NavigationDestination(
            icon: const Icon(Icons.inbox_outlined),
            selectedIcon: const Icon(Icons.inbox),
            label: appLocalizations(context).inbox,
          ),
        ),
      );
      destinations.add(
        _ShellDestination(
          keyName: 'summary',
          child: SummaryPage(repository: widget.summary),
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
          user: widget.user,
          onLogout: widget.onLogout,
          onApprovals:
              widget.user.canManageAccounts ? _openAdminApprovals : null,
          onPersonalInformation: _openPersonalInformation,
          updateService: widget.updateService,
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
    if (!widget.user.canManageAccounts) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AdminApprovalPage(auth: widget.auth),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final destinations = _destinations(context);
    final selectedIndex = _selectedIndex < destinations.length
        ? _selectedIndex
        : destinations.length - 1;

    return Scaffold(
      body: IndexedStack(
        index: selectedIndex,
        children: destinations.map((item) => item.child).toList(growable: false),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) => setState(() => _selectedIndex = index),
        destinations: destinations
            .map((item) => item.destination)
            .toList(growable: false),
      ),
    );
  }
}
