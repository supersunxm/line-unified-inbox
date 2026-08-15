import 'package:flutter/widgets.dart';

class AppSpacing {
  const AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  static const screen = EdgeInsets.all(xl);
  static const card = EdgeInsets.all(lg);
  static const compact = EdgeInsets.symmetric(horizontal: md, vertical: sm);
}
