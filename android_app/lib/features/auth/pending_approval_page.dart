import 'package:flutter/material.dart';
import '../../core/localization/localization.dart';

class PendingApprovalPage extends StatelessWidget {
  const PendingApprovalPage({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.hourglass_top, size: 64),
                const SizedBox(height: 16),
                Text(appLocalizations(context).pendingApproval,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 12),
                Text(appLocalizations(context).pendingApprovalMessage,
                    textAlign: TextAlign.center),
                const SizedBox(height: 16),
                Semantics(
                  label: 'LINE contact QR code',
                  image: true,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 240),
                    child: AspectRatio(
                      aspectRatio: 1,
                      child: Image.asset(
                        'assets/images/line_contact_qr.jpg',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                    onPressed: onBack,
                    child: Text(appLocalizations(context).backToLogin)),
              ]),
            ),
          ),
        ),
      );
}
