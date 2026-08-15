import 'package:flutter/widgets.dart';

import 'app_language.dart';

class AppLanguageScope extends InheritedNotifier<AppLanguageController> {
  const AppLanguageScope({
    super.key,
    required AppLanguageController controller,
    required super.child,
  }) : super(notifier: controller);

  static AppLanguageController of(BuildContext context) {
    return maybeOf(context) ?? AppLanguageController();
  }

  static AppLanguageController? maybeOf(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<AppLanguageScope>();
    return scope?.notifier;
  }
}
