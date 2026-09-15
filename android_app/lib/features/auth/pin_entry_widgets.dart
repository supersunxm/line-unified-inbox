import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

class PinDots extends StatelessWidget {
  const PinDots(
      {super.key,
      required this.enteredLength,
      this.hasError = false,
      this.semanticLabel});

  final int enteredLength;
  final bool hasError;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final color = hasError ? AppColors.error : AppColors.textPrimary;
    return Semantics(
      label: semanticLabel ?? '$enteredLength of 6 PIN digits entered',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var index = 0; index < 6; index += 1)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 7),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: index < enteredLength ? color : Colors.transparent,
                  border: Border.all(
                      color: index < enteredLength ? color : AppColors.border,
                      width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class PinKeypad extends StatelessWidget {
  const PinKeypad({
    super.key,
    required this.onDigit,
    required this.onDelete,
    this.enabled = true,
    this.deleteSemanticLabel = 'Delete last PIN digit',
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onDelete;
  final bool enabled;
  final String deleteSemanticLabel;

  @override
  Widget build(BuildContext context) => GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: AppSpacing.md,
        crossAxisSpacing: AppSpacing.md,
        childAspectRatio: 1.8,
        children: [
          for (var digit = 1; digit <= 9; digit += 1)
            _PinKey(
              label: '$digit',
              enabled: enabled,
              onPressed: () => onDigit('$digit'),
            ),
          const SizedBox.shrink(),
          _PinKey(
            label: '0',
            enabled: enabled,
            onPressed: () => onDigit('0'),
          ),
          _PinKey(
            label: '⌫',
            semanticLabel: deleteSemanticLabel,
            enabled: enabled,
            onPressed: onDelete,
          ),
        ],
      );
}

class _PinKey extends StatelessWidget {
  const _PinKey({
    required this.label,
    required this.enabled,
    required this.onPressed,
    this.semanticLabel,
  });

  final String label;
  final bool enabled;
  final VoidCallback onPressed;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: semanticLabel ?? label,
        child: FilledButton.tonal(
          onPressed: enabled ? onPressed : null,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.surface,
            foregroundColor: AppColors.textPrimary,
            disabledBackgroundColor: AppColors.surfaceMuted,
            disabledForegroundColor: AppColors.textSecondary,
            textStyle:
                const TextStyle(fontSize: 28, fontWeight: FontWeight.w600),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: AppColors.border),
            ),
          ),
          child: Text(label),
        ),
      );
}

class PinEntryScaffold extends StatelessWidget {
  const PinEntryScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.enteredLength,
    required this.onDigit,
    required this.onDelete,
    this.employeeId,
    this.footer,
    this.hasError = false,
    this.loading = false,
    this.enabled = true,
    this.employeeLabel = 'Employee ID',
    this.deleteSemanticLabel = 'Delete last PIN digit',
    this.dotsSemanticLabel,
  });

  final String title;
  final String subtitle;
  final int enteredLength;
  final ValueChanged<String> onDigit;
  final VoidCallback onDelete;
  final String? employeeId;
  final Widget? footer;
  final bool hasError;
  final bool loading;
  final bool enabled;
  final String employeeLabel;
  final String deleteSemanticLabel;
  final String? dotsSemanticLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: AppSpacing.screen,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - AppSpacing.xl * 2),
              child: Column(
                children: [
                  if (employeeId != null) ...[
                    Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                            child: Icon(Icons.person_outline)),
                        title: Text(employeeLabel,
                            style: theme.textTheme.labelLarge),
                        subtitle: Text(employeeId!,
                            style: theme.textTheme.titleMedium),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                  ],
                  Text(title,
                      style: theme.textTheme.headlineSmall,
                      textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.sm),
                  Text(subtitle,
                      style: theme.textTheme.bodyLarge
                          ?.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.xl),
                  PinDots(
                      enteredLength: enteredLength,
                      hasError: hasError,
                      semanticLabel: dotsSemanticLabel),
                  const SizedBox(height: AppSpacing.xxl),
                  if (loading)
                    const Padding(
                        padding: EdgeInsets.only(bottom: AppSpacing.lg),
                        child: CircularProgressIndicator()),
                  PinKeypad(
                      onDigit: onDigit,
                      onDelete: onDelete,
                      enabled: enabled && !loading,
                      deleteSemanticLabel: deleteSemanticLabel),
                  if (footer != null) ...[
                    const SizedBox(height: AppSpacing.xl),
                    footer!
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PinRecoveryScaffold extends StatelessWidget {
  const PinRecoveryScaffold({
    super.key,
    required this.employeeId,
    required this.employeeLabel,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onUsePassword,
  });

  final String employeeId;
  final String employeeLabel;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onUsePassword;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: AppSpacing.screen,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight - AppSpacing.xl * 2,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Card(
                    child: ListTile(
                      leading: const CircleAvatar(
                        child: Icon(Icons.person_outline),
                      ),
                      title: Text(employeeLabel,
                          style: theme.textTheme.labelLarge),
                      subtitle:
                          Text(employeeId, style: theme.textTheme.titleMedium),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                  Icon(
                    Icons.lock_reset_outlined,
                    size: 56,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(title,
                      style: theme.textTheme.headlineSmall,
                      textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.sm),
                  Text(subtitle,
                      style: theme.textTheme.bodyLarge
                          ?.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.xl),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: onUsePassword,
                      icon: const Icon(Icons.key_outlined),
                      label: Text(actionLabel),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
