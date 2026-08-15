import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/user_avatar.dart';

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
          if (user.position != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(user.position!, textAlign: TextAlign.center),
          ],
        ],
      );
}
