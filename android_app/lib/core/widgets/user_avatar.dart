import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.displayName,
    this.imageUrl,
    this.radius = 22,
  });

  final String displayName;
  final String? imageUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final trimmed = displayName.trim();
    final initial =
        trimmed.isEmpty ? '?' : trimmed.characters.first.toUpperCase();
    final uri = Uri.tryParse(imageUrl?.trim() ?? '');
    final hasValidImage = uri != null &&
        (uri.scheme == 'https' || uri.scheme == 'http') &&
        uri.host.isNotEmpty;
    if (!hasValidImage) return _InitialAvatar(initial: initial, radius: radius);
    return ClipOval(
      child: Image.network(
        uri.toString(),
        width: radius * 2,
        height: radius * 2,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) =>
            _InitialAvatar(initial: initial, radius: radius),
        loadingBuilder: (context, child, progress) => progress == null
            ? child
            : _InitialAvatar(initial: initial, radius: radius),
      ),
    );
  }
}

class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.initial, required this.radius});

  final String initial;
  final double radius;

  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: radius,
        backgroundColor: AppColors.primaryContainer,
        foregroundColor: AppColors.onPrimaryContainer,
        child: Text(
          initial,
          style: Theme.of(context).textTheme.titleMedium,
        ),
      );
}
