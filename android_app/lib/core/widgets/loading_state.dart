import 'package:flutter/material.dart';
import '../theme/app_spacing.dart';

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: AppSpacing.screen,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              if (message != null) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(message!, textAlign: TextAlign.center),
              ],
            ],
          ),
        ),
      );
}
