import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.displayName, this.radius = 22});

  final String displayName;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final trimmed = displayName.trim();
    final initial =
        trimmed.isEmpty ? '?' : trimmed.characters.first.toUpperCase();
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primaryContainer,
      foregroundColor: AppColors.onPrimaryContainer,
      child: Text(
        initial,
        style: Theme.of(context).textTheme.titleMedium,
      ),
    );
  }
}
