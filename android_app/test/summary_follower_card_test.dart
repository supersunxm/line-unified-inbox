import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/features/summary/summary_follower_card.dart';
import 'package:line_oa_chat_hub/features/summary/summary_repository.dart';

void main() {
  test('follower snapshot parses backend numeric fields safely', () {
    final value = SummaryFollowerSnapshot.fromJson({
      'available': true,
      'totalFollowers': 12345,
      'monthlyGrowth': 345,
      'growthRate': 0.02875,
      'asOfDate': '2026-09-15',
      'baselineDate': '2026-08-31',
      'accountsExpected': 2,
      'accountsWithData': 2,
      'accountsCompared': 1,
      'coverageRate': 1,
    });

    expect(value.available, isTrue);
    expect(value.totalFollowers, 12345);
    expect(value.monthlyGrowth, 345);
    expect(value.growthRate, closeTo(0.02875, 0.000001));
    expect(value.accountsCompared, 1);
  });

  testWidgets('follower card shows real total, monthly change, date and coverage',
      (tester) async {
    const value = SummaryFollowerSnapshot(
      available: true,
      totalFollowers: 12345,
      monthlyGrowth: 345,
      growthRate: 0.028,
      asOfDate: '2026-09-15',
      baselineDate: '2026-08-31',
      accountsExpected: 2,
      accountsWithData: 2,
      accountsCompared: 2,
      coverageRate: 1,
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SummaryFollowerCard(data: value)),
      ),
    );

    expect(find.text('LINE OA Followers'), findsOneWidget);
    expect(find.text('12,345'), findsOneWidget);
    expect(find.textContaining('Monthly change +345'), findsOneWidget);
    expect(find.textContaining('Data as of 2026-09-15'), findsOneWidget);
    expect(find.textContaining('Data for 2/2 accounts'), findsOneWidget);
  });

  testWidgets('follower card reports unavailable snapshot coverage explicitly',
      (tester) async {
    const value = SummaryFollowerSnapshot(
      available: false,
      reason: 'no_follower_snapshots',
      totalFollowers: null,
      monthlyGrowth: null,
      growthRate: null,
      asOfDate: null,
      baselineDate: null,
      accountsExpected: 1,
      accountsWithData: 0,
      accountsCompared: 0,
      coverageRate: 0,
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SummaryFollowerCard(data: value)),
      ),
    );

    expect(find.text('Follower data is not available for this period yet.'),
        findsOneWidget);
    expect(find.text('Data for 0/1 accounts'), findsOneWidget);
  });
}
