import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/auth/auth_repository.dart';
import 'package:line_oa_chat_hub/features/auth/registration_page.dart';
import 'package:line_oa_chat_hub/features/profile/personal_information_page.dart';
import 'package:line_oa_chat_hub/features/profile/profile_page.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';
import 'package:line_oa_chat_hub/features/shell/authenticated_shell.dart';
import 'package:line_oa_chat_hub/features/summary/summary_page.dart';
import 'package:line_oa_chat_hub/features/summary/summary_repository.dart';

CurrentUser user({String? employeeId}) => CurrentUser(
      id: 'user-1',
      email: 'bm@example.com',
      displayName: 'Bee Manager',
      role: 'VIEWER',
      employeeId: employeeId,
      memberships: [
        StoreMembership(
          id: 'membership-1',
          storeId: 'store-1',
          role: 'STAFF',
          store:
              Store(id: 'store-1', name: 'OBS Seacon Bangkae', code: '28243'),
        ),
      ],
      stores: [Store(id: 'store-1', name: 'OBS Seacon Bangkae', code: '28243')],
      permissions: const {},
    );

class FakeAuthRepository extends AuthRepository {
  FakeAuthRepository() : super(ApiClient(TokenStore()), TokenStore());

  @override
  Future<List<Store>> stores() async => [
        Store(id: 'store-1', name: 'OBS Seacon Bangkae', code: '28243'),
      ];
}

class FakeConversationRepository extends ConversationRepository {
  FakeConversationRepository() : super(ApiClient(TokenStore()));

  @override
  Future<InboxPageResult> inbox({int page = 1}) async =>
      InboxPageResult(items: const [], page: page, total: 0);
}

class FakeSummaryRepository extends SummaryRepository {
  FakeSummaryRepository() : super(ApiClient(TokenStore()));

  @override
  Future<MonthlySummary> monthly(String month) async =>
      MonthlySummary.fromJson({
        'period': {
          'month': month,
          'timezone': 'Asia/Bangkok',
          'isCurrentMonth': true,
          'throughDate': '2026-08-15',
          'comparisonBasis': 'same_day_range'
        },
        'volume': {
          'incomingMessages': 4,
          'incomingConversations': 2,
          'bmReplies': 1
        },
        'response': {
          'cyclesStarted': 2,
          'cyclesAnswered': 1,
          'unanswered': 1,
          'responseRate': null,
          'averageSeconds': null,
          'medianSeconds': null,
          'buckets': {
            'under4h': 1,
            'from4To12h': 0,
            'from12To24h': 0,
            'over24h': 0
          },
          'sampleSize': 1,
          'available': false
        },
        'operational': {'needReply': 1, 'completed': 1},
        'comparison': {
          'available': false,
          'reason': 'insufficient_previous_period_data'
        },
        'dataQuality': {
          'qaExcluded': true,
          'ambiguousOutboundExcluded': 0,
          'responseMetricsAvailable': false
        },
      });
}

void main() {
  test('CurrentUser preserves employee ID and legacy null values', () {
    final parsed = CurrentUser.fromJson({
      'id': 'user-1',
      'email': 'bm@example.com',
      'displayName': 'Bee Manager',
      'role': 'VIEWER',
      'profile': <String, dynamic>{'employeeId': 'EMP-1'},
      'memberships': [],
      'stores': [],
      'permissions': <String, dynamic>{},
    });
    expect(parsed.employeeId, 'EMP-1');
    expect(
        CurrentUser.fromJson({
          'id': 'legacy',
          'displayName': 'Legacy',
          'role': 'VIEWER',
          'memberships': [],
          'stores': [],
          'permissions': <String, dynamic>{},
        }).employeeId,
        isNull);
  });

  testWidgets('profile hub opens personal information and handles legacy IDs',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: ProfilePage(
        user: user(),
        onLogout: () {},
        onPersonalInformation: () =>
            Navigator.of(tester.element(find.text('Personal Information')))
                .push(
          MaterialPageRoute(
              builder: (_) => PersonalInformationPage(user: user())),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Bee Manager'), findsOneWidget);
    await tester.tap(find.text('Personal Information'));
    await tester.pumpAndSettle();
    expect(find.text('Employee ID'), findsOneWidget);
    expect(find.text('Not set'), findsOneWidget);
    expect(find.text('OBS Seacon Bangkae'), findsOneWidget);
  });

  testWidgets(
      'summary loads trusted activity and registration shows employee ID',
      (tester) async {
    await tester.pumpWidget(
        MaterialApp(home: SummaryPage(repository: FakeSummaryRepository())));
    await tester.pumpAndSettle();
    expect(find.text('Monthly activity'), findsOneWidget);
    expect(find.text('Collecting response data'), findsOneWidget);
    await tester.pumpWidget(MaterialApp(
      home: RegistrationPage(
        auth: FakeAuthRepository(),
        onSubmitted: () {},
        onBack: () {},
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, 'Employee ID'), findsOneWidget);
  });

  testWidgets('authenticated shell renders Inbox, Summary, and Profile tabs',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: AuthenticatedShell(
        user: user(employeeId: 'EMP-1'),
        auth: FakeAuthRepository(),
        conversations: FakeConversationRepository(),
        summary: FakeSummaryRepository(),
        events: null,
        onLogout: () {},
        onConversationOpened: (_) async {},
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Inbox'), findsWidgets);
    expect(find.text('Summary'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
    await tester.tap(find.text('Summary'));
    await tester.pumpAndSettle();
    expect(find.text('Monthly activity'), findsOneWidget);
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Personal Information'), findsOneWidget);
  });
}
