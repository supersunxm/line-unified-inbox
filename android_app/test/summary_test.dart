import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/summary/summary_page.dart';
import 'package:line_oa_chat_hub/features/summary/summary_repository.dart';

String _previousMonth(String month) {
  final parts = month.split('-').map(int.parse).toList();
  final previous = DateTime.utc(parts[0], parts[1] - 1);
  return '${previous.year.toString().padLeft(4, '0')}-${previous.month.toString().padLeft(2, '0')}';
}

class FakeSummaryRepository extends SummaryRepository {
  FakeSummaryRepository(
      {this.available = false,
      this.empty = false,
      this.failFirst = false,
      this.loading = false})
      : super(ApiClient(TokenStore()));
  final bool available;
  final bool empty;
  final bool failFirst;
  final bool loading;
  final calls = <String>[];
  var _failed = false;
  Completer<MonthlySummary>? completer;

  @override
  Future<MonthlySummary> monthly(String month) async {
    calls.add(month);
    if (loading) {
      completer ??= Completer<MonthlySummary>();
      return completer!.future;
    }
    if (failFirst && !_failed) {
      _failed = true;
      throw StateError('offline');
    }
    return _summary(month);
  }

  MonthlySummary _summary(String month) => MonthlySummary.fromJson({
        'period': {
          'month': month,
          'timezone': 'Asia/Bangkok',
          'isCurrentMonth': true,
          'throughDate': '2026-08-15',
          'comparisonBasis': 'same_day_range'
        },
        'volume': {
          'incomingMessages': empty ? 0 : 12,
          'incomingConversations': empty ? 0 : 4,
          'bmReplies': 8
        },
        'response': {
          'cyclesStarted': 12,
          'cyclesAnswered': available ? 10 : 3,
          'unanswered': available ? 2 : 9,
          'responseRate': available ? 0.83 : null,
          'averageSeconds': available ? 7200 : null,
          'medianSeconds': available ? 5400 : null,
          'buckets': {
            'under4h': 8,
            'from4To12h': 2,
            'from12To24h': 0,
            'over24h': 0
          },
          'sampleSize': available ? 10 : 3,
          'available': available
        },
        'operational': {'needReply': 3, 'completed': 7},
        'comparison': {
          'available': available,
          'reason': available ? null : 'insufficient_previous_period_data',
          'responseChanges': available
              ? {
                  'responseRate': 0.1,
                  'medianSeconds': -900,
                  'averageSeconds': -1200,
                  'bucketPercentagePoints': {'under4h': 0.1}
                }
              : null,
        },
        'tags': {
          'mode': 'CURRENT_TAG_SNAPSHOT',
          'coverage': {
            'eligibleConversations': empty ? 0 : 4,
            'taggedConversations': empty ? 0 : 3,
            'coverageRate': empty ? 0 : 0.75,
            'quality': empty ? 'LOW' : 'MODERATE'
          },
          'sources': {
            'storeOnly': 1,
            'onlineOnly': 1,
            'storeAndOnline': 1,
            'untagged': 1
          },
          'installment': {'count': 1, 'eligibleRate': 0.25, 'taggedRate': 0.33},
          'topProducts': [
            {'productId': 'p1', 'productName': 'OPPO Find X', 'count': 2}
          ],
          'topVariants': [
            {
              'productName': 'OPPO Find X',
              'ram': '12',
              'rom': '256',
              'color': 'Black',
              'count': 1
            }
          ]
        },
        'dataQuality': {
          'qaExcluded': true,
          'ambiguousOutboundExcluded': 1,
          'responseMetricsAvailable': available,
          'tagAnalyticsMode': 'CURRENT_TAG_SNAPSHOT',
          'tagCoverage': {
            'eligibleConversations': empty ? 0 : 4,
            'taggedConversations': empty ? 0 : 3,
            'coverageRate': empty ? 0 : 0.75,
            'quality': empty ? 'LOW' : 'MODERATE'
          }
        },
      });
}

Widget app(FakeSummaryRepository repository) =>
    MaterialApp(home: SummaryPage(repository: repository));

void main() {
  testWidgets('summary tab loads incoming, Need Reply, and Completed metrics',
      (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository()));
    await tester.pumpAndSettle();
    expect(find.text('Incoming Messages'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('Need Reply'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
  });

  testWidgets('summary shows loading state while request is pending',
      (tester) async {
    final repository = FakeSummaryRepository(loading: true);
    await tester.pumpWidget(app(repository));
    expect(find.text('Loading monthly summary…'), findsOneWidget);
  });

  testWidgets('summary shows retryable error state', (tester) async {
    final repository = FakeSummaryRepository(failFirst: true);
    await tester.pumpWidget(app(repository));
    await tester.pumpAndSettle();
    expect(
        find.text('Unable to load summary. Please try again.'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Monthly activity'), findsOneWidget);
  });

  testWidgets('summary with no activity has an explicit empty state',
      (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository(empty: true)));
    await tester.pumpAndSettle();
    expect(find.text('No activity'), findsOneWidget);
    expect(find.text('There is no customer activity for this month.'),
        findsOneWidget);
  });

  testWidgets('unavailable response data never renders fake KPI values',
      (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository()));
    await tester.pumpAndSettle();
    expect(find.text('Collecting response data'), findsOneWidget);
    expect(find.text('Verified responses 3 / 10 required'), findsOneWidget);
    expect(find.text('Response rate'), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Previous-period comparison unavailable'),
      300,
      scrollable: find.byType(Scrollable),
    );
    expect(find.text('Previous-period comparison unavailable'), findsOneWidget);
  });

  testWidgets('available response data renders response rate and buckets',
      (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository(available: true)));
    await tester.pumpAndSettle();
    expect(find.text('Response rate'), findsOneWidget);
    expect(find.text('83%'), findsOneWidget);
    expect(find.text('80% · 8 responses'), findsOneWidget);
  });

  testWidgets('summary renders snapshot coverage and manual insights',
      (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository(available: true)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Customer insights'),
      300,
      scrollable: find.byType(Scrollable),
    );
    expect(find.text('Customer insights'), findsOneWidget);
    expect(find.text('Customer Tag Coverage'), findsOneWidget);
    expect(find.text('Installment Customer Analytics'), findsOneWidget);
    expect(find.text('Installment Customers'), findsOneWidget);
    expect(
      find.text(
          '25% of eligible conversations have installment customer tags.'),
      findsOneWidget,
    );
    expect(find.textContaining('3 / 4'), findsOneWidget);
    expect(find.text('OPPO Find X'), findsOneWidget);
    expect(find.text('Store only'), findsOneWidget);
  });

  testWidgets(
      'month selector loads the previous month and disables future navigation',
      (tester) async {
    final repository = FakeSummaryRepository();
    await tester.pumpWidget(app(repository));
    await tester.pumpAndSettle();
    expect(repository.calls.length, 1);
    final initialMonth = repository.calls.single;
    expect(find.byTooltip('Next month'), findsOneWidget);
    await tester.tap(find.byTooltip('Previous month'));
    await tester.pumpAndSettle();
    expect(repository.calls.length, 2);
    final expectedPrevious = _previousMonth(initialMonth);
    expect(repository.calls.last, expectedPrevious);
  });

  testWidgets('summary displays Bangkok month label', (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository()));
    await tester.pumpAndSettle();
    final now = DateTime.now().toUtc().add(const Duration(hours: 7));
    const monthNames = [
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
    expect(
        find.text('${monthNames[now.month - 1]} ${now.year}'), findsOneWidget);
  });

  testWidgets('summary data quality explains QA exclusion', (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository()));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('QA conversations are excluded from business analytics.'),
      300,
      scrollable: find.byType(Scrollable),
    );
    expect(find.text('QA conversations are excluded from business analytics.'),
        findsOneWidget);
  });

  testWidgets('comparison card stays neutral when comparison is unavailable',
      (tester) async {
    await tester.pumpWidget(app(FakeSummaryRepository()));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Previous-period comparison unavailable'),
      300,
      scrollable: find.byType(Scrollable),
    );
    expect(find.text('Previous-period comparison unavailable'), findsOneWidget);
    expect(find.textContaining('vs previous period'), findsNothing);
  });
}
