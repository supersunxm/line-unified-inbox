import 'package:flutter/material.dart';

import '../../core/models/models.dart';
import '../auth/admin_approval_page.dart';
import '../auth/auth_repository.dart';
import '../chat/chat_page.dart';
import '../inbox/conversation_repository.dart';
import '../inbox/inbox_page.dart';
import '../profile/profile_page.dart';

class AuthenticatedShell extends StatefulWidget {
  const AuthenticatedShell({
    super.key,
    required this.user,
    required this.auth,
    required this.conversations,
    required this.events,
    required this.onLogout,
    required this.onConversationOpened,
  });

  final CurrentUser user;
  final AuthRepository auth;
  final ConversationRepository conversations;
  final Stream<Map<String, dynamic>>? events;
  final VoidCallback onLogout;
  final Future<void> Function(String conversationId) onConversationOpened;

  @override
  AuthenticatedShellState createState() => AuthenticatedShellState();
}

class AuthenticatedShellState extends State<AuthenticatedShell> {
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
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProfilePage(
          user: widget.user,
          onLogout: widget.onLogout,
          onApprovals: widget.user.role == 'ADMIN' ? _openAdminApprovals : null,
        ),
      ),
    );
  }

  void _openAdminApprovals() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AdminApprovalPage(auth: widget.auth),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => InboxPage(
        repository: widget.conversations,
        events: widget.events,
        onOpen: openConversation,
        onProfile: _openProfile,
      );
}
