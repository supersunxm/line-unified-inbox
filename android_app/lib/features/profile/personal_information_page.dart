import 'package:flutter/material.dart';

import '../../core/models/models.dart';
import '../../core/localization/localization.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/status_badge.dart';

class PersonalInformationPage extends StatelessWidget {
  const PersonalInformationPage({super.key, required this.user});

  final CurrentUser user;

  String _value(BuildContext context, String? value) =>
      value == null || value.trim().isEmpty
          ? appLocalizations(context).notSet
          : value;

  @override
  Widget build(BuildContext context) {
    final membership = user.memberships.isEmpty ? null : user.memberships.first;
    return Scaffold(
      appBar: AppBar(
          title: Text(appLocalizations(context).personalInformation)),
      body: ListView(
        padding: AppSpacing.screen,
        children: [
          _InfoCard(
              label: appLocalizations(context).name,
              value: _value(context, user.displayName)),
          _InfoCard(
              label: appLocalizations(context).employeeId,
              value: _value(context, user.employeeId)),
          _InfoCard(
              label: appLocalizations(context).email,
              value: _value(context, user.email)),
          _InfoCard(
              label: appLocalizations(context).role,
              value: localizedRoleLabel(
                  context, _value(context, membership?.role ?? user.role))),
          _InfoCard(
              label: appLocalizations(context).assignedStores,
              value: _value(context, membership?.store.name)),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(value, style: Theme.of(context).textTheme.bodyLarge),
            ],
          ),
        ),
      );
}
