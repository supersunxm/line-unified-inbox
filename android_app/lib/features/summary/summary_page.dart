import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/models/models.dart';
import '../../core/localization/localization.dart';
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
        title: appLocalizations(context).summary,
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
      return LoadingState(
          message: appLocalizations(context).loadingMonthlySummary);
    }
    if (_error != null) {
      return ErrorState(
          message: appLocalizations(context).unableToLoadSummary,
          onRetry: _load);
    }
    final summary = _summary;
    if (summary == null) {
      return ErrorState(
          message: appLocalizations(context).summaryUnavailable,
          onRetry: _load);
    }
    if (summary.volume.incomingMessages == 0 &&
        summary.volume.incomingConversations == 0) {
      return EmptyState(
          icon: Icons.bar_chart_outlined,
          title: appLocalizations(context).noActivity,
          message: appLocalizations(context).noActivityThisMonth);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: AppSpacing.screen,
        children: [
          Text(appLocalizations(context).monthlyActivity,
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          _MetricGrid(summary: summary),
          const SizedBox(height: AppSpacing.xl),
          _ResponseCard(
              response: summary.response, comparison: summary.comparison),
          const SizedBox(height: AppSpacing.lg),
          _ComparisonCard(comparison: summary.comparison),
          const SizedBox(height: AppSpacing.lg),
          _TagAnalyticsCard(tags: summary.tags),
          const SizedBox(height: AppSpacing.lg),
          Text(appLocalizations(context).dataQuality,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Text(
            summary.dataQuality.qaExcluded
                ? appLocalizations(context).qaExcluded
                : appLocalizations(context).analyticsQualityUnknown,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textSecondary),
          ),
          if (summary.dataQuality.tagAnalyticsMode != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${appLocalizations(context).tagCoverage}: ${summary.dataQuality.tagAnalyticsMode == 'CURRENT_TAG_SNAPSHOT' ? appLocalizations(context).currentTagSnapshot : summary.dataQuality.tagAnalyticsMode}',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.textSecondary),
            ),
          ],
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
                tooltip: appLocalizations(context).previousMonth,
                onPressed: onPrevious,
                icon: const Icon(Icons.chevron_left)),
            Expanded(
                child: Text(_monthLabel(context, month),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium)),
            IconButton(
                tooltip: appLocalizations(context).nextMonth,
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
                  label: appLocalizations(context).incomingMessages,
                  value: _formatCount(context, summary.volume.incomingMessages),
                  icon: Icons.markunread_outlined),
              _MetricCard(
                  width: width,
                  label: appLocalizations(context).customerConversations,
                  value: _formatCount(
                      context, summary.volume.incomingConversations),
                  icon: Icons.forum_outlined),
              _MetricCard(
                  width: width,
                  label: appLocalizations(context).needReply,
                  value: _formatCount(context, summary.operational.needReply),
                  icon: Icons.priority_high,
                  color: AppColors.warning),
              _MetricCard(
                  width: width,
                  label: appLocalizations(context).completed,
                  value: _formatCount(context, summary.operational.completed),
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
  const _ResponseCard({required this.response, required this.comparison});
  final SummaryResponse response;
  final SummaryComparison comparison;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: AppSpacing.card,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(appLocalizations(context).responsePerformance,
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.md),
            if (!response.available) ...[
              const Icon(Icons.hourglass_bottom, color: AppColors.info),
              const SizedBox(height: AppSpacing.sm),
              Text(appLocalizations(context).collectingResponseData,
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(appLocalizations(context).responseDataAfterReplies),
              const SizedBox(height: AppSpacing.md),
              LinearProgressIndicator(
                  value: (response.sampleSize / _minimumResponseSample)
                      .clamp(0, 1)),
              const SizedBox(height: AppSpacing.sm),
              Text(
                  appLocalizations(context).verifiedResponses(
                      response.sampleSize, _minimumResponseSample),
                  style: Theme.of(context).textTheme.bodySmall),
            ] else ...[
              _ResponseMetricRow(
                  label: appLocalizations(context).responseRate,
                  value:
                      '${((response.responseRate ?? 0) * 100).toStringAsFixed(0)}%'),
              _ResponseMetricRow(
                  label: appLocalizations(context).medianResponseTime,
                  value: _formatDuration(context, response.medianSeconds)),
              _ResponseMetricRow(
                  label: appLocalizations(context).averageResponseTime,
                  value: _formatDuration(context, response.averageSeconds)),
              if (comparison.responseChanges?.medianSeconds != null)
                _ResponseDelta(
                    seconds: comparison.responseChanges!.medianSeconds!),
              const Divider(height: AppSpacing.xl),
              _BucketRow(
                  label: appLocalizations(context).underFourHours,
                  count: response.buckets.under4h,
                  total: response.sampleSize),
              _BucketRow(
                  label: appLocalizations(context).fourToTwelveHours,
                  count: response.buckets.from4To12h,
                  total: response.sampleSize),
              _BucketRow(
                  label: appLocalizations(context).twelveToTwentyFourHours,
                  count: response.buckets.from12To24h,
                  total: response.sampleSize),
              _BucketRow(
                  label: appLocalizations(context).overTwentyFourHours,
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

class _ResponseDelta extends StatelessWidget {
  const _ResponseDelta({required this.seconds});
  final double seconds;

  @override
  Widget build(BuildContext context) {
    final faster = seconds < 0;
    final value = _formatDuration(context, seconds.abs());
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs),
      child: Text(
        '${faster ? '↓' : '↑'} $value ${faster ? appLocalizations(context).faster : appLocalizations(context).slower}',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: faster ? AppColors.success : AppColors.warning,
            ),
      ),
    );
  }
}

class _BucketRow extends StatelessWidget {
  const _BucketRow(
      {required this.label, required this.count, required this.total});
  final String label;
  final int count;
  final int total;
  @override
  Widget build(BuildContext context) {
    final percentage = total == 0 ? 0.0 : count / total;
    return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(children: [
          Expanded(child: Text(label)),
          Text(
              '${_formatPercent(context, percentage)} · ${_formatCount(context, count)} ${appLocalizations(context).responses}')
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
                child: Text(appLocalizations(context).previousPeriodUnavailable,
                    style: Theme.of(context).textTheme.bodyMedium)),
          ]),
        ),
      );
    }
    final incomingChange = comparison.changes['incomingMessages'];
    final changeLabel = incomingChange == null
        ? appLocalizations(context).comparedPreviousPeriod
        : '${incomingChange >= 0 ? '↑' : '↓'} ${_formatPercent(context, incomingChange.abs())} ${appLocalizations(context).incomingMessages.toLowerCase()}';
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

class _TagAnalyticsCard extends StatelessWidget {
  const _TagAnalyticsCard({required this.tags});
  final SummaryTagAnalytics tags;

  @override
  Widget build(BuildContext context) {
    final coverage = tags.coverage;
    final quality = switch (coverage.quality) {
      'STRONG' => appLocalizations(context).coverageStrong,
      'MODERATE' => appLocalizations(context).coverageModerate,
      'PARTIAL' => appLocalizations(context).coveragePartial,
      _ => appLocalizations(context).coverageLow,
    };
    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(appLocalizations(context).customerInsights,
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.md),
            Text(appLocalizations(context).tagCoverage,
                style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: AppSpacing.xs),
            Text(
                '${_formatCount(context, coverage.taggedConversations)} / ${_formatCount(context, coverage.eligibleConversations)} · ${_formatPercent(context, coverage.coverageRate)}'),
            const SizedBox(height: AppSpacing.xs),
            LinearProgressIndicator(value: coverage.coverageRate.clamp(0, 1)),
            const SizedBox(height: AppSpacing.xs),
            Text('${appLocalizations(context).coverageQuality}: $quality',
                style: Theme.of(context).textTheme.bodySmall),
            if (coverage.quality == 'LOW' || coverage.quality == 'PARTIAL')
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text(appLocalizations(context).tagCoverageWarning,
                    style: Theme.of(context).textTheme.bodySmall),
              ),
            const Divider(height: AppSpacing.xl),
            Text(appLocalizations(context).customerSource,
                style: Theme.of(context).textTheme.titleSmall),
            _InsightRow(
                label: appLocalizations(context).sourceStoreOnly,
                value: tags.sources.storeOnly),
            _InsightRow(
                label: appLocalizations(context).sourceOnlineOnly,
                value: tags.sources.onlineOnly),
            _InsightRow(
                label: appLocalizations(context).sourceStoreAndOnline,
                value: tags.sources.storeAndOnline),
            _InsightRow(
                label: appLocalizations(context).sourceUntagged,
                value: tags.sources.untagged),
            const Divider(height: AppSpacing.xl),
            Text(appLocalizations(context).installmentInterest,
                style: Theme.of(context).textTheme.titleSmall),
            _InsightRow(
                label: appLocalizations(context).taggedInstallment,
                value: tags.installment.count),
            Text(
                '${_formatPercent(context, tags.installment.eligibleRate)} ${appLocalizations(context).eligibleRate}',
                style: Theme.of(context).textTheme.bodySmall),
            Text(
                '${_formatPercent(context, tags.installment.taggedRate)} ${appLocalizations(context).taggedRate}',
                style: Theme.of(context).textTheme.bodySmall),
            if (tags.topProducts.isNotEmpty) ...[
              const Divider(height: AppSpacing.xl),
              Text(appLocalizations(context).topProducts,
                  style: Theme.of(context).textTheme.titleSmall),
              for (final product in tags.topProducts)
                _InsightRow(label: product.productName, value: product.count),
            ],
            if (tags.topVariants.isNotEmpty) ...[
              const Divider(height: AppSpacing.xl),
              Text(appLocalizations(context).topConfigurations,
                  style: Theme.of(context).textTheme.titleSmall),
              for (final variant in tags.topVariants)
                _InsightRow(
                    label: _variantLabel(variant), value: variant.count),
            ],
            if (coverage.eligibleConversations == 0 && tags.topProducts.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Text(appLocalizations(context).noTaggedData),
              ),
          ],
        ),
      ),
    );
  }
}

class _InsightRow extends StatelessWidget {
  const _InsightRow({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(children: [
          Expanded(child: Text(label)),
          Text(_formatCount(context, value),
              style: Theme.of(context).textTheme.titleSmall),
        ]),
      );
}

String _variantLabel(SummaryVariant variant) => [
      variant.productName,
      if (variant.ram?.isNotEmpty == true) '${variant.ram}GB',
      if (variant.rom?.isNotEmpty == true) '${variant.rom}GB',
      if (variant.color?.isNotEmpty == true) variant.color!,
    ].join(' / ');

String _formatCount(BuildContext context, int value) =>
    NumberFormat.decimalPattern(appLocalizations(context).localeName)
        .format(value);

String _formatPercent(BuildContext context, double value) {
  final formatter = NumberFormat.percentPattern(
      appLocalizations(context).localeName)
    ..maximumFractionDigits = 1
    ..minimumFractionDigits =
        value == 0 || (value * 100).truncateToDouble() == value * 100 ? 0 : 1;
  return formatter.format(value);
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

String _monthLabel(BuildContext context, String month) {
  final parts = month.split('-').map(int.parse).toList();
  final localizations = appLocalizations(context);
  final names = [
    localizations.january,
    localizations.february,
    localizations.march,
    localizations.april,
    localizations.may,
    localizations.june,
    localizations.july,
    localizations.august,
    localizations.september,
    localizations.october,
    localizations.november,
    localizations.december,
  ];
  if (localizations.localeName.startsWith('zh')) {
    return '${parts[0]}年${parts[1]}月';
  }
  return '${names[parts[1] - 1]} ${parts[0]}';
}

String _formatDuration(BuildContext context, double? seconds) {
  if (seconds == null) return '—';
  final totalMinutes = (seconds / 60).round();
  final localizations = appLocalizations(context);
  if (totalMinutes < 60) {
    return localizations.minutes(totalMinutes);
  }
  final hours = totalMinutes ~/ 60;
  final minutes = totalMinutes % 60;
  return localizations.hoursMinutes(hours, minutes);
}
