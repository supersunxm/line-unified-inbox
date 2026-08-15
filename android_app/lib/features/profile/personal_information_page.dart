import 'package:flutter/material.dart';

import '../../core/models/models.dart';
import '../../core/theme/app_spacing.dart';

class PersonalInformationPage extends StatelessWidget {
  const PersonalInformationPage({super.key, required this.user});

  final CurrentUser user;

  String _value(String? value) => value == null || value.trim().isEmpty ? 'Not set' : value;

  @override
  Widget build(BuildContext context) {
    final membership = user.memberships.isEmpty ? null : user.memberships.first;
    return Scaffold(
      appBar: AppBar(title: const Text('Personal Information')),
      body: ListView(
        padding: AppSpacing.screen,
        children: [
          _InfoCard(label: 'Name', value: _value(user.displayName)),
          _InfoCard(label: 'Employee ID', value: _value(user.employeeId)),
          _InfoCard(label: 'Email', value: _value(user.email)),
          _InfoCard(label: 'Role', value: _value(membership?.role ?? user.role).replaceAll('_', ' ')),
          _InfoCard(label: 'Assigned Store', value: _value(membership?.store.name)),
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
