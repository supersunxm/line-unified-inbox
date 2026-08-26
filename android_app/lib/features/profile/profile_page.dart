import 'package:flutter/material.dart';

import '../../core/models/models.dart';
import '../../core/localization/localization.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/services/app_update_service.dart';
import '../notifications/notification_service.dart';
import 'widgets/account_section.dart';
import 'widgets/admin_tools_section.dart';
import 'widgets/membership_section.dart';
import 'widgets/profile_header.dart';
import 'widgets/settings_section.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({
    super.key,
    required this.user,
    required this.onLogout,
    this.onApprovals,
    this.onPersonalInformation,
    this.updateService,
    this.notificationService,
  });

  final CurrentUser user;
  final VoidCallback onLogout;
  final VoidCallback? onApprovals;
  final VoidCallback? onPersonalInformation;
  final AppUpdateService? updateService;
  final NotificationService? notificationService;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(appLocalizations(context).profile)),
        body: ListView(
          padding: AppSpacing.screen,
          children: [
            ProfileHeader(user: user),
            const SizedBox(height: AppSpacing.xl),
            AccountSection(user: user),
            const SizedBox(height: AppSpacing.xl),
            MembershipSection(memberships: user.memberships),
            const SizedBox(height: AppSpacing.xl),
            SettingsSection(
              onPersonalInformation: onPersonalInformation,
              updateService: updateService,
              notificationService: notificationService,
            ),
            if (onApprovals != null) ...[
              const SizedBox(height: AppSpacing.xl),
              AdminToolsSection(onApprovals: onApprovals),
            ],
            const SizedBox(height: AppSpacing.xl),
            OutlinedButton.icon(
              onPressed: onLogout,
              icon: const Icon(Icons.logout),
              label: Text(appLocalizations(context).signOut),
            ),
          ],
        ),
      );
}
