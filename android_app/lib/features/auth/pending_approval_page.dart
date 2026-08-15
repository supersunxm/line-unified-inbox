import 'package:flutter/material.dart';

class PendingApprovalPage extends StatelessWidget {
  const PendingApprovalPage({super.key, required this.onBack});
  final VoidCallback onBack;
  @override Widget build(BuildContext context) => Scaffold(body: Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.hourglass_top, size: 64), const SizedBox(height: 16), Text('Pending approval', style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 8), const Text('Your account has been submitted and is waiting for administrator approval.', textAlign: TextAlign.center), const SizedBox(height: 24), FilledButton(onPressed: onBack, child: const Text('Back to login'))]))));
}
