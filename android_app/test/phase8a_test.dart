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
          store: Store(id: 'store-1', name: 'OBS Seacon Bangkae', code: '28243'),
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
    expect(CurrentUser.fromJson({
      'id': 'legacy',
      'displayName': 'Legacy',
      'role': 'VIEWER',
      'memberships': [],
      'stores': [],
      'permissions': <String, dynamic>{},
    }).employeeId, isNull);
  });

  testWidgets('profile hub opens personal information and handles legacy IDs',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: ProfilePage(
        user: user(),
        onLogout: () {},
        onPersonalInformation: () => Navigator.of(tester.element(find.text('Personal Information'))).push(
          MaterialPageRoute(builder: (_) => PersonalInformationPage(user: user())),
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

  testWidgets('summary is a truthful placeholder and registration shows employee ID',
      (tester) async {
    await tester.pumpWidget(MaterialApp(home: const SummaryPage()));
    expect(find.text('Monthly performance insights'), findsOneWidget);
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
    expect(find.text('Monthly performance insights'), findsOneWidget);
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Personal Information'), findsOneWidget);
  });
}
