import 'package:flutter/material.dart';

import '../../core/widgets/app_widgets.dart';

class SummaryPage extends StatelessWidget {
  const SummaryPage({super.key});

  @override
  Widget build(BuildContext context) => AppScaffold(
        title: 'Summary',
        body: const EmptyState(
          icon: Icons.bar_chart_outlined,
          title: 'Monthly performance insights',
          message: 'Summary analytics will be available in a future release.',
        ),
      );
}
