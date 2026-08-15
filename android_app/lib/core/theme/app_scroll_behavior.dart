import 'package:flutter/material.dart';

/// Application-wide scroll policy.
///
/// Android's default Material overscroll indicator can stretch the entire
/// surface at a boundary. The inbox/chat product uses bounded scrolling
/// instead, so every scrollable inherits clamped physics and no indicator.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) =>
      const ClampingScrollPhysics();

  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) =>
      child;
}
