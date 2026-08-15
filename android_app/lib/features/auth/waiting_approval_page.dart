import 'package:flutter/material.dart';
import '../../core/localization/localization.dart';

class WaitingApprovalPage extends StatelessWidget {
  const WaitingApprovalPage(
      {super.key, required this.onRefresh, required this.onLogout});
  final VoidCallback onRefresh;
  final VoidCallback onLogout;
  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.hourglass_top, size: 64),
              const SizedBox(height: 16),
              Text(appLocalizations(context).waitingForApproval,
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(appLocalizations(context).waitingApprovalMessage,
                  textAlign: TextAlign.center),
              const SizedBox(height: 24),
              FilledButton(
                  onPressed: onRefresh,
                  child: Text(appLocalizations(context).checkAgain)),
              TextButton(
                  onPressed: onLogout,
                  child: Text(appLocalizations(context).signOut)),
            ]),
          ),
        ),
      );
}
