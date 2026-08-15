import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/store_badge.dart';

class MembershipSection extends StatelessWidget {
  const MembershipSection({super.key, required this.memberships});

  final List<StoreMembership> memberships;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Assigned stores',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          if (memberships.isEmpty)
            const Text('No store memberships assigned.')
          else
            Card(
              child: Column(
                children: [
                  for (var index = 0; index < memberships.length; index++) ...[
                    if (index > 0) const Divider(height: 1),
                    ListTile(
                      leading: StoreBadge(
                        name: memberships[index].store.name,
                        code: memberships[index].store.code,
                        compact: true,
                      ),
                      title: Text(memberships[index].store.name),
                      subtitle:
                          Text(memberships[index].role.replaceAll('_', ' ')),
                    ),
                  ],
                ],
              ),
            ),
        ],
      );
}
