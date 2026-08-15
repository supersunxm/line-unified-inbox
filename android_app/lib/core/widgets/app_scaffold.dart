import 'package:flutter/material.dart';
import 'app_top_bar.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.body,
    this.title,
    this.leading,
    this.actions,
    this.appBar,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.drawer,
    this.backgroundColor,
  });

  final Widget body;
  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final Widget? drawer;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: appBar ??
            (title == null
                ? null
                : AppTopBar(
                    title: title!,
                    leading: leading,
                    actions: actions,
                  )),
        body: body,
        backgroundColor: backgroundColor,
        bottomNavigationBar: bottomNavigationBar,
        floatingActionButton: floatingActionButton,
        drawer: drawer,
      );
}
