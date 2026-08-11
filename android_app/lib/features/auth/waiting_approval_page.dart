import 'package:flutter/material.dart';

class WaitingApprovalPage extends StatelessWidget {
  const WaitingApprovalPage({super.key, required this.onRefresh, required this.onLogout});
  final VoidCallback onRefresh;
  final VoidCallback onLogout;
  @override Widget build(BuildContext context) => Scaffold(body: Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.hourglass_top, size: 64), const SizedBox(height: 16), Text('Waiting for approval', style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 8), const Text('Your store manager or HQ must approve your account before you can access conversations.', textAlign: TextAlign.center), const SizedBox(height: 24), FilledButton(onPressed: onRefresh, child: const Text('Check again')), TextButton(onPressed: onLogout, child: const Text('Sign out'))]))));
}
