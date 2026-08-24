import 'package:flutter/material.dart';

import '../../core/models/authorization_extensions.dart';
import '../../core/models/models.dart';

class WorkspaceHomePage extends StatelessWidget {
  const WorkspaceHomePage({super.key, required this.user});

  final CurrentUser user;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('OPPO LINE OA Monitor', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(
            user.workspaceSummary,
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 20),
          if (user.canAccessHqWorkspace)
            _WorkspaceCard(
              icon: Icons.apartment_outlined,
              title: 'HQ workspace',
              description: user.canAccessAllStores
                  ? 'All-store scope is enabled for this account.'
                  : 'HQ access is enabled with a restricted store scope.',
            ),
          if (user.canAccessMainOaWorkspace)
            const _WorkspaceCard(
              icon: Icons.corporate_fare_outlined,
              title: 'Main OA workspace',
              description:
                  'Main OA access is enabled. Main OA conversations stay isolated from Store conversations.',
            ),
          if (!user.canAccessStoreWorkspace)
            const _WorkspaceCard(
              icon: Icons.info_outline,
              title: 'Store inbox hidden',
              description:
                  'This account does not have an active Store workspace, so Store inbox and Store summary tabs are not shown.',
            ),
        ],
      ),
    );
  }
}

class _WorkspaceCard extends StatelessWidget {
  const _WorkspaceCard({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(description),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}
