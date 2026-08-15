import 'package:flutter/material.dart';

import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/app_widgets.dart';
import 'summary_repository.dart';

const _minimumResponseSample = 10;

class SummaryPage extends StatefulWidget {
  const SummaryPage({super.key, required this.repository});

  final SummaryRepository repository;

  @override
  State<SummaryPage> createState() => _SummaryPageState();
}

class _SummaryPageState extends State<SummaryPage> {
  late String _month = _currentMonth();
  MonthlySummary? _summary;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final summary = await widget.repository.monthly(_month);
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  void _moveMonth(int delta) {
    final parts = _month.split('-').map(int.parse).toList();
    final next = DateTime.utc(parts[0], parts[1] - 1 + delta);
    final nextMonth =
        '${next.year.toString().padLeft(4, '0')}-${next.month.toString().padLeft(2, '0')}';
    if (delta > 0 && _compareMonths(nextMonth, _currentMonth()) > 0) {
      return;
    }
    setState(() => _month = nextMonth);
    _load();
  }

  @override
  Widget build(BuildContext context) => AppScaffold(
        title: 'Summary',
        body: Column(
          children: [
            _MonthSelector(
                month: _month,
                canGoNext: _compareMonths(_month, _currentMonth()) < 0,
                onPrevious: () => _moveMonth(-1),
                onNext: () => _moveMonth(1)),
            Expanded(child: _content(context)),
          ],
        ),
      );

  Widget _content(BuildContext context) {
    if (_loading) {
      return const LoadingState(message: 'Loading monthly summary…');
    }
    if (_error != null) {
      return ErrorState(
          message: 'Unable to load summary. Please try again.', onRetry: _load);
    }
    final summary = _summary;
    if (summary == null) {
      return ErrorState(
          message: 'Summary data is unavailable.', onRetry: _load);
    }
    if (summary.volume.incomingMessages == 0 &&
        summary.volume.incomingConversations == 0) {
      return const EmptyState(
          icon: Icons.bar_chart_outlined,
          title: 'No activity',
          message: 'There is no customer activity for this month.');
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: AppSpacing.screen,
        children: [
          Text('Monthly activity',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          _MetricGrid(summary: summary),
          const SizedBox(height: AppSpacing.xl),
          _ResponseCard(response: summary.response),
          const SizedBox(height: AppSpacing.lg),
          _ComparisonCard(comparison: summary.comparison),
          const SizedBox(height: AppSpacing.lg),
          Text('Data quality', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Text(
            summary.dataQuality.qaExcluded
                ? 'QA conversations are excluded from business analytics.'
                : 'Analytics quality could not be confirmed.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _MonthSelector extends StatelessWidget {
  const _MonthSelector(
      {required this.month,
      required this.canGoNext,
      required this.onPrevious,
      required this.onNext});
  final String month;
  final bool canGoNext;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
        child: Row(
          children: [
            IconButton(
                tooltip: 'Previous month',
                onPressed: onPrevious,
                icon: const Icon(Icons.chevron_left)),
            Expanded(
                child: Text(_monthLabel(month),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium)),
            IconButton(
                tooltip: 'Next month',
                onPressed: canGoNext ? onNext : null,
                icon: const Icon(Icons.chevron_right)),
          ],
        ),
      );
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.summary});
  final MonthlySummary summary;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final width = (constraints.maxWidth - AppSpacing.md) / 2;
          return Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: [
              _MetricCard(
                  width: width,
                  label: 'Incoming Messages',
                  value: summary.volume.incomingMessages.toString(),
                  icon: Icons.markunread_outlined),
              _MetricCard(
                  width: width,
                  label: 'Customer Conversations',
                  value: summary.volume.incomingConversations.toString(),
                  icon: Icons.forum_outlined),
              _MetricCard(
                  width: width,
                  label: 'Need Reply',
                  value: summary.operational.needReply.toString(),
                  icon: Icons.priority_high,
                  color: AppColors.warning),
              _MetricCard(
                  width: width,
                  label: 'Completed',
                  value: summary.operational.completed.toString(),
                  icon: Icons.check_circle_outline,
                  color: AppColors.success),
            ],
          );
        },
      );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(
      {required this.width,
      required this.label,
      required this.value,
      required this.icon,
      this.color});
  final double width;
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: width,
        child: Card(
          child: Padding(
            padding: AppSpacing.card,
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: color ?? AppColors.primary),
              const SizedBox(height: AppSpacing.md),
              Text(value, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: AppSpacing.xs),
              Text(label,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textSecondary)),
            ]),
          ),
        ),
      );
}

class _ResponseCard extends StatelessWidget {
  const _ResponseCard({required this.response});
  final SummaryResponse response;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: AppSpacing.card,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Response performance',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.md),
            if (!response.available) ...[
              const Icon(Icons.hourglass_bottom, color: AppColors.info),
              const SizedBox(height: AppSpacing.sm),
              Text('Collecting response data',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              const Text(
                  'Response metrics will appear after enough verified BM replies are recorded.'),
              const SizedBox(height: AppSpacing.md),
              LinearProgressIndicator(
                  value: (response.sampleSize / _minimumResponseSample)
                      .clamp(0, 1)),
              const SizedBox(height: AppSpacing.sm),
              Text(
                  'Verified responses ${response.sampleSize} / $_minimumResponseSample required',
                  style: Theme.of(context).textTheme.bodySmall),
            ] else ...[
              _ResponseMetricRow(
                  label: 'Response rate',
                  value:
                      '${((response.responseRate ?? 0) * 100).toStringAsFixed(0)}%'),
              _ResponseMetricRow(
                  label: 'Median response time',
                  value: _formatDuration(response.medianSeconds)),
              _ResponseMetricRow(
                  label: 'Average response time',
                  value: _formatDuration(response.averageSeconds)),
              const Divider(height: AppSpacing.xl),
              _BucketRow(
                  label: '< 4h',
                  count: response.buckets.under4h,
                  total: response.sampleSize),
              _BucketRow(
                  label: '4–12h',
                  count: response.buckets.from4To12h,
                  total: response.sampleSize),
              _BucketRow(
                  label: '12–24h',
                  count: response.buckets.from12To24h,
                  total: response.sampleSize),
              _BucketRow(
                  label: '≥ 24h',
                  count: response.buckets.over24h,
                  total: response.sampleSize),
            ],
          ]),
        ),
      );
}

class _ResponseMetricRow extends StatelessWidget {
  const _ResponseMetricRow({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label),
        Text(value, style: Theme.of(context).textTheme.titleMedium)
      ]));
}

class _BucketRow extends StatelessWidget {
  const _BucketRow(
      {required this.label, required this.count, required this.total});
  final String label;
  final int count;
  final int total;
  @override
  Widget build(BuildContext context) {
    final percentage = total == 0 ? 0 : count / total * 100;
    return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(children: [
          Expanded(child: Text(label)),
          Text('${percentage.toStringAsFixed(0)}% · $count responses')
        ]));
  }
}

class _ComparisonCard extends StatelessWidget {
  const _ComparisonCard({required this.comparison});
  final SummaryComparison comparison;

  @override
  Widget build(BuildContext context) {
    if (!comparison.available) {
      return Card(
        child: Padding(
          padding: AppSpacing.card,
          child: Row(children: [
            const Icon(Icons.compare_arrows, color: AppColors.textSecondary),
            const SizedBox(width: AppSpacing.md),
            Expanded(
                child: Text('Previous-period comparison unavailable',
                    style: Theme.of(context).textTheme.bodyMedium)),
          ]),
        ),
      );
    }
    final incomingChange = comparison.changes['incomingMessages'];
    final changeLabel = incomingChange == null
        ? 'Compared with the previous period'
        : '${incomingChange >= 0 ? '↑' : '↓'} ${(incomingChange.abs() * 100).toStringAsFixed(1)}% incoming messages vs previous period';
    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Row(children: [
          const Icon(Icons.compare_arrows, color: AppColors.textSecondary),
          const SizedBox(width: AppSpacing.md),
          Expanded(
              child: Text(changeLabel,
                  style: Theme.of(context).textTheme.bodyMedium)),
        ]),
      ),
    );
  }
}

String _currentMonth() {
  final now = DateTime.now().toUtc().add(const Duration(hours: 7));
  return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}';
}

int _compareMonths(String left, String right) {
  final leftParts = left.split('-').map(int.parse).toList();
  final rightParts = right.split('-').map(int.parse).toList();
  return (leftParts[0] - rightParts[0]) * 12 + leftParts[1] - rightParts[1];
}

String _monthLabel(String month) {
  final parts = month.split('-').map(int.parse).toList();
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  return '${names[parts[1] - 1]} ${parts[0]}';
}

String _formatDuration(double? seconds) {
  if (seconds == null) return '—';
  final totalMinutes = (seconds / 60).round();
  if (totalMinutes < 60) return '${totalMinutes}m';
  final hours = totalMinutes ~/ 60;
  final minutes = totalMinutes % 60;
  return minutes == 0 ? '${hours}h' : '${hours}h ${minutes}m';
}
