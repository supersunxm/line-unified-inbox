import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../../core/widgets/status_badge.dart';

class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.user});

  final CurrentUser user;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          UserAvatar(displayName: user.displayName, radius: 34),
          const SizedBox(height: AppSpacing.md),
          Text(
            user.displayName,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            localizedRoleLabel(
                context,
                user.memberships.isEmpty
                    ? user.role
                    : user.memberships.first.role),
            textAlign: TextAlign.center,
          ),
          if (user.position != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(user.position!, textAlign: TextAlign.center),
          ],
          if (user.memberships.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              user.memberships.first.store.name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      );
}
