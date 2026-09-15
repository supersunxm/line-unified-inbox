import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/network/api_exception.dart';
import 'package:line_oa_chat_hub/core/network/connectivity_service.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/features/auth/auth_repository.dart';
import 'package:line_oa_chat_hub/features/auth/login_page.dart';
import 'package:line_oa_chat_hub/features/auth/pin_entry_page.dart';
import 'package:line_oa_chat_hub/features/auth/pin_management_page.dart';
import 'package:line_oa_chat_hub/features/auth/pin_setup_page.dart';

class _Online extends ConnectivityService {
  @override
  Future<bool> get isOnline async => true;
}

class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository()
      : super(ApiClient(TokenStore(), connectivity: _Online()), TokenStore());

  int pinLoginCalls = 0;
  int passwordLoginCalls = 0;
  String pinLoginErrorCode = 'INVALID_PIN';

  @override
  Future<void> loginWithPin(String employeeId, String pin) async {
    pinLoginCalls += 1;
    throw ApiException(401, pinLoginErrorCode, 'Incorrect PIN');
  }

  @override
  Future<void> login(String identifier, String password) async {
    passwordLoginCalls += 1;
  }
}

Widget _harness(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

Future<void> _tapDigits(WidgetTester tester, String digits) async {
  for (final digit in digits.split('')) {
    await tester.tap(find.text(digit).last);
    await tester.pump();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('PIN keypad submits automatically after six digits',
      (tester) async {
    String? submittedPin;
    String? submittedConfirmation;
    var completed = false;
    await tester.pumpWidget(_harness(PinSetupPage(
      submit: (pin, confirmation) async {
        submittedPin = pin;
        submittedConfirmation = confirmation;
      },
      onCompleted: () async => completed = true,
    )));

    expect(find.text('Set 6-digit PIN'), findsOneWidget);
    await _tapDigits(tester, '123456');
    expect(find.text('Confirm your PIN'), findsOneWidget);
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();

    expect(submittedPin, '123456');
    expect(submittedConfirmation, '123456');
    expect(completed, isTrue);
  });

  testWidgets('login methods keep the existing password flow available',
      (tester) async {
    final auth = _FakeAuthRepository();
    var loggedIn = false;
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      onLoggedIn: () async => loggedIn = true,
      onRegister: () {},
    )));

    expect(find.text('Sign in with PIN'), findsOneWidget);
    expect(find.text('Sign in with password'), findsOneWidget);
    await tester.tap(find.text('Sign in with password'));
    await tester.pump();
    expect(find.text('Sign in with PIN'), findsNothing);
    expect(find.text('Sign in', skipOffstage: false), findsOneWidget);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '12345678');
    await tester.enterText(fields.at(1), 'Password@123');
    await tester.tap(find.text('Sign in', skipOffstage: false));
    await tester.pumpAndSettle();

    expect(auth.passwordLoginCalls, 1);
    expect(loggedIn, isTrue);
  });

  testWidgets('PIN confirmation mismatch clears the second entry',
      (tester) async {
    await tester.pumpWidget(_harness(PinSetupPage(
      submit: (_, __) async {},
      onCompleted: () async {},
    )));

    await _tapDigits(tester, '123456');
    await _tapDigits(tester, '123457');
    await tester.pump();

    expect(find.text('PINs do not match.'), findsOneWidget);
    expect(find.bySemanticsLabel('0 of 6 PIN digits entered'), findsOneWidget);
  });

  testWidgets('PIN login auto-submits once and exposes forgot-PIN fallback',
      (tester) async {
    final auth = _FakeAuthRepository();
    var loggedIn = false;
    await tester.pumpWidget(_harness(PinEntryPage(
      auth: auth,
      employeeId: '12345678',
      onLoggedIn: () async => loggedIn = true,
      onUsePassword: () {},
    )));

    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();
    expect(auth.pinLoginCalls, 1);
    expect(loggedIn, isFalse);
    expect(find.text('Incorrect PIN.'), findsOneWidget);
    expect(find.text('Forgot PIN?'), findsOneWidget);
  });

  testWidgets('PIN login offers a neutral password fallback', (tester) async {
    final auth = _FakeAuthRepository();
    await tester.pumpWidget(_harness(PinEntryPage(
      auth: auth,
      employeeId: '12345678',
      onLoggedIn: () async {},
      onUsePassword: () {},
    )));

    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();
    expect(find.text('No PIN yet or forgot it? Sign in with your password.'),
        findsOneWidget);
    expect(find.text('Forgot PIN?'), findsOneWidget);
  });

  testWidgets('settings exposes PIN management actions', (tester) async {
    await tester.pumpWidget(_harness(PinManagementPage(
      auth: _FakeAuthRepository(),
      employeeId: '12345678',
      pinEnabled: true,
    )));

    expect(find.text('6-digit PIN'), findsOneWidget);
    expect(find.text('Change PIN'), findsOneWidget);
    expect(find.text('Reset PIN / Forgot PIN'), findsOneWidget);
    expect(find.text('Turn off PIN'), findsOneWidget);
  });

  testWidgets('PIN entry remains scrollable without small-screen overflow',
      (tester) async {
    tester.view.physicalSize = const Size(320, 480);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(_harness(PinEntryPage(
      auth: _FakeAuthRepository(),
      employeeId: '12345678',
      onLoggedIn: () async {},
      onUsePassword: () {},
    )));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text('Forgot PIN?'), findsOneWidget);
  });

  testWidgets('PIN keypad ignores input while verification is in flight',
      (tester) async {
    final auth = _FakeAuthRepository();
    await tester.pumpWidget(_harness(PinEntryPage(
      auth: auth,
      employeeId: '12345678',
      onLoggedIn: () async {},
      onUsePassword: () {},
    )));

    await _tapDigits(tester, '123456');
    await tester.tap(find.text('1').last);
    await tester.pumpAndSettle();
    expect(auth.pinLoginCalls, 1);
  });
}
