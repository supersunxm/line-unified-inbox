import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/localization/localization.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'summary_repository.dart';

class SummaryFollowerCard extends StatelessWidget {
  const SummaryFollowerCard({super.key, required this.data});

  final SummaryFollowerSnapshot data;

  @override
  Widget build(BuildContext context) {
    final copy = _FollowerCopy.forLocale(appLocalizations(context).localeName);
    final locale = appLocalizations(context).localeName;
    final count = NumberFormat.decimalPattern(locale);
    final percent = NumberFormat.percentPattern(locale)
      ..maximumFractionDigits = 1;

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.group_outlined, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(copy.title,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            if (!data.available || data.totalFollowers == null) ...[
              Text(copy.unavailable,
                  style: Theme.of(context).textTheme.bodyMedium),
              if (data.accountsExpected > 0) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  copy.coverage(data.accountsWithData, data.accountsExpected),
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ] else ...[
              Text(
                count.format(data.totalFollowers),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: AppSpacing.xs),
              if (data.monthlyGrowth != null)
                Row(
                  children: [
                    Icon(
                      data.monthlyGrowth! >= 0
                          ? Icons.trending_up
                          : Icons.trending_down,
                      size: 18,
                      color: data.monthlyGrowth! >= 0
                          ? AppColors.success
                          : AppColors.warning,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        copy.monthlyChange(
                          '${data.monthlyGrowth! >= 0 ? '+' : ''}${count.format(data.monthlyGrowth)}',
                          data.growthRate == null
                              ? null
                              : percent.format(data.growthRate),
                        ),
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                )
              else
                Text(
                  copy.growthUnavailable,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textSecondary),
                ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                [
                  if (data.asOfDate != null) copy.asOf(data.asOfDate!),
                  copy.coverage(data.accountsWithData, data.accountsExpected),
                ].join(' · '),
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColors.textSecondary),
              ),
              if (data.accountsCompared < data.accountsWithData) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  copy.comparisonCoverage(
                      data.accountsCompared, data.accountsWithData),
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _FollowerCopy {
  const _FollowerCopy({
    required this.title,
    required this.unavailable,
    required this.growthUnavailable,
    required this.monthlyChange,
    required this.asOf,
    required this.coverage,
    required this.comparisonCoverage,
  });

  final String title;
  final String unavailable;
  final String growthUnavailable;
  final String Function(String value, String? percent) monthlyChange;
  final String Function(String date) asOf;
  final String Function(int ready, int total) coverage;
  final String Function(int compared, int ready) comparisonCoverage;

  static _FollowerCopy forLocale(String locale) {
    if (locale.startsWith('th')) {
      return _FollowerCopy(
        title: 'ผู้ติดตาม LINE OA',
        unavailable: 'ยังไม่มีข้อมูลผู้ติดตามสำหรับช่วงเวลานี้',
        growthUnavailable: 'ยังไม่มีข้อมูลฐานเพียงพอสำหรับคำนวณการเปลี่ยนแปลง',
        monthlyChange: (value, rate) =>
            'การเปลี่ยนแปลงในเดือน $value${rate == null ? '' : ' ($rate)'}',
        asOf: (date) => 'ข้อมูล ณ $date',
        coverage: (ready, total) => 'ข้อมูล $ready/$total บัญชี',
        comparisonCoverage: (compared, ready) =>
            'คำนวณการเปลี่ยนแปลงได้ $compared/$ready บัญชีที่มีข้อมูล',
      );
    }
    if (locale.startsWith('zh')) {
      return _FollowerCopy(
        title: 'LINE OA 好友数',
        unavailable: '此期间暂无好友数据',
        growthUnavailable: '基准数据不足，暂无法计算变化',
        monthlyChange: (value, rate) =>
            '本月变化 $value${rate == null ? '' : ' ($rate)'}',
        asOf: (date) => '数据截至 $date',
        coverage: (ready, total) => '$ready/$total 个账号有数据',
        comparisonCoverage: (compared, ready) =>
            '$compared/$ready 个有数据账号可计算变化',
      );
    }
    return _FollowerCopy(
      title: 'LINE OA Followers',
      unavailable: 'Follower data is not available for this period yet.',
      growthUnavailable: 'Not enough baseline data to calculate monthly change.',
      monthlyChange: (value, rate) =>
          'Monthly change $value${rate == null ? '' : ' ($rate)'}',
      asOf: (date) => 'Data as of $date',
      coverage: (ready, total) => 'Data for $ready/$total accounts',
      comparisonCoverage: (compared, ready) =>
          'Monthly change available for $compared/$ready accounts with data',
    );
  }
}
