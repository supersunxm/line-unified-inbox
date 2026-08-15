import 'package:flutter/material.dart';

import '../../core/models/models.dart';
import '../../core/localization/localization.dart';
import '../auth/admin_approval_page.dart';
import '../auth/auth_repository.dart';
import '../chat/chat_page.dart';
import '../inbox/conversation_repository.dart';
import '../inbox/inbox_page.dart';
import '../profile/profile_page.dart';
import '../profile/personal_information_page.dart';
import '../summary/summary_page.dart';
import '../summary/summary_repository.dart';

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
  });

  final CurrentUser user;
  final AuthRepository auth;
  final ConversationRepository conversations;
  final Stream<Map<String, dynamic>>? events;
  final SummaryRepository summary;
  final VoidCallback onLogout;
  final Future<void> Function(String conversationId) onConversationOpened;

  @override
  AuthenticatedShellState createState() => AuthenticatedShellState();
}

class AuthenticatedShellState extends State<AuthenticatedShell> {
  int _selectedIndex = 0;

  Future<void> openConversation(String conversationId) async {
    if (!mounted) return;
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

  void _openProfile() {
    if (mounted) setState(() => _selectedIndex = 2);
  }

  void _openPersonalInformation() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PersonalInformationPage(user: widget.user),
    ));
  }

  void _openAdminApprovals() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AdminApprovalPage(auth: widget.auth),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: IndexedStack(
          index: _selectedIndex,
          children: [
            InboxPage(
              repository: widget.conversations,
              events: widget.events,
              onOpen: openConversation,
              onProfile: _openProfile,
            ),
            SummaryPage(repository: widget.summary),
            ProfilePage(
              user: widget.user,
              onLogout: widget.onLogout,
              onApprovals:
                  widget.user.role == 'ADMIN' ? _openAdminApprovals : null,
              onPersonalInformation: _openPersonalInformation,
            ),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedIndex,
          onDestinationSelected: (index) =>
              setState(() => _selectedIndex = index),
          destinations: [
            NavigationDestination(
              icon: Icon(Icons.inbox_outlined),
              selectedIcon: Icon(Icons.inbox),
              label: appLocalizations(context).inbox,
            ),
            NavigationDestination(
              icon: Icon(Icons.bar_chart_outlined),
              selectedIcon: Icon(Icons.bar_chart),
              label: appLocalizations(context).summary,
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: appLocalizations(context).profile,
            ),
          ],
        ),
      );
}
