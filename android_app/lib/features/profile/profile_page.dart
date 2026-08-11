import 'package:flutter/material.dart';
import '../../core/models/models.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key, required this.user, required this.onLogout});
  final CurrentUser user;
  final VoidCallback onLogout;
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Profile')), body: ListView(padding: const EdgeInsets.all(20), children: [CircleAvatar(radius: 34, child: Text(user.displayName.substring(0, 1).toUpperCase())), const SizedBox(height: 16), Center(child: Text(user.displayName, style: Theme.of(context).textTheme.titleLarge)), if (user.position != null) Center(child: Text(user.position!)), const SizedBox(height: 24), const Text('Assigned stores', style: TextStyle(fontWeight: FontWeight.bold)), ...user.memberships.map((membership) => ListTile(contentPadding: EdgeInsets.zero, title: Text(membership.store.name), subtitle: Text(membership.role.replaceAll('_', ' ')))), const SizedBox(height: 24), OutlinedButton.icon(onPressed: onLogout, icon: const Icon(Icons.logout), label: const Text('Sign out'))]));
}
