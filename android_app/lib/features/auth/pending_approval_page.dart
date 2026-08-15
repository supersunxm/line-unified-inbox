import 'package:flutter/material.dart';
import '../../core/localization/localization.dart';

class PendingApprovalPage extends StatelessWidget {
  const PendingApprovalPage({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.hourglass_top, size: 64),
              const SizedBox(height: 16),
              Text(appLocalizations(context).pendingApproval,
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(appLocalizations(context).pendingApprovalMessage,
                  textAlign: TextAlign.center),
              const SizedBox(height: 24),
              FilledButton(
                  onPressed: onBack,
                  child: Text(appLocalizations(context).backToLogin)),
            ]),
          ),
        ),
      );
}
