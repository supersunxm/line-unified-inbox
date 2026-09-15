import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/core/network/api_client.dart';
import 'package:line_oa_chat_hub/core/network/api_exception.dart';
import 'package:line_oa_chat_hub/core/network/connectivity_service.dart';
import 'package:line_oa_chat_hub/core/storage/token_store.dart';
import 'package:line_oa_chat_hub/core/storage/pin_device_state_store.dart';
import 'package:line_oa_chat_hub/features/auth/auth_repository.dart';
import 'package:line_oa_chat_hub/features/auth/login_page.dart';
import 'package:line_oa_chat_hub/features/auth/pin_entry_page.dart';
import 'package:line_oa_chat_hub/features/auth/pin_management_page.dart';
import 'package:line_oa_chat_hub/features/auth/pin_setup_page.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

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
  bool pinLoginSucceeds = false;
  String? passwordIdentifier;
  String? passwordLoginErrorCode;
  String passwordLoginErrorMessage = 'Unable to reach the service';

  @override
  Future<void> loginWithPin(String employeeId, String pin) async {
    pinLoginCalls += 1;
    if (pinLoginSucceeds) return;
    final statusCode = {
      'OFFLINE',
      'NETWORK_TIMEOUT',
      'NETWORK_ERROR',
      'CONFIGURATION_ERROR',
      'SESSION_RECOVERY_TEMPORARY',
    }.contains(pinLoginErrorCode)
        ? 0
        : 401;
    throw ApiException(statusCode, pinLoginErrorCode, 'Incorrect PIN');
  }

  @override
  Future<void> login(String identifier, String password) async {
    passwordLoginCalls += 1;
    passwordIdentifier = identifier;
    final errorCode = passwordLoginErrorCode;
    if (errorCode != null) {
      final statusCode = {
        'OFFLINE',
        'NETWORK_TIMEOUT',
        'NETWORK_ERROR',
        'SERVICE_UNAVAILABLE',
      }.contains(errorCode)
          ? 0
          : 401;
      throw ApiException(statusCode, errorCode, passwordLoginErrorMessage);
    }
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

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  testWidgets('PIN keypad submits automatically after six digits',
      (tester) async {
    String? submittedPin;
    String? submittedConfirmation;
    var completed = false;
    final pinState = PinDeviceStateStore();
    await tester.pumpWidget(_harness(PinSetupPage(
      employeeId: '12345678',
      submit: (pin, confirmation) async {
        submittedPin = pin;
        submittedConfirmation = confirmation;
      },
      onCompleted: () async => completed = true,
      onEnrollmentRecorded: pinState.recordPinEnabled,
    )));

    expect(find.text('Set 6-digit PIN'), findsOneWidget);
    await _tapDigits(tester, '123456');
    expect(find.text('Confirm your PIN'), findsOneWidget);
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();

    expect(submittedPin, '123456');
    expect(submittedConfirmation, '123456');
    expect(completed, isTrue);
    expect(await pinState.hasKnownPin('12345678'), isTrue);
  });

  test('device-local PIN state stores only a non-sensitive marker', () async {
    final preferences = SharedPreferencesAsync();
    final pinState = PinDeviceStateStore(preferences: preferences);

    await pinState.recordPinEnabled('12345678');

    expect(await pinState.hasKnownPin('12345678'), isTrue);
    expect(await pinState.hasKnownPin('87654321'), isFalse);
    final stored = await preferences
        .getStringList(PinDeviceStateStore.employeeFingerprintsKey);
    expect(stored, isNot(contains('12345678')));
    expect(stored, isNot(contains('123456')));
  });

  testWidgets('optional PIN enrollment can be skipped after password login',
      (tester) async {
    var skipped = false;
    await tester.pumpWidget(_harness(PinSetupPage(
      employeeId: '12345678',
      submit: (_, __) async {},
      onCompleted: () async {},
      allowLater: true,
      onLater: () => skipped = true,
    )));

    expect(find.text('Later'), findsOneWidget);
    await tester.ensureVisible(find.text('Later'));
    await tester.tap(find.text('Later'));
    expect(skipped, isTrue);
  });

  testWidgets('login methods keep the existing password flow available',
      (tester) async {
    final auth = _FakeAuthRepository();
    final pinState = PinDeviceStateStore();
    var loggedIn = false;
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
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

  testWidgets('unknown employee routes to password guidance and preserves ID',
      (tester) async {
    final auth = _FakeAuthRepository();
    final pinState = PinDeviceStateStore();
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();

    expect(find.text('PIN not set up yet'), findsOneWidget);
    expect(
      find.text(
          'Sign in with your password first, then set a 6-digit PIN for your next sign-in.'),
      findsOneWidget,
    );
    expect(find.text('Enter 6-digit PIN'), findsNothing);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(
        tester.widget<TextField>(find.byType(TextField).first).controller?.text,
        '12345678');

    await tester.enterText(find.byType(TextField).at(1), 'Password@123');
    await tester.tap(find.text('Sign in with password'));
    await tester.pumpAndSettle();
    expect(auth.passwordLoginCalls, 1);
    expect(auth.passwordIdentifier, '12345678');
  });

  testWidgets('PIN unavailable fallback does not show a stale PIN error',
      (tester) async {
    final auth = _FakeAuthRepository()
      ..pinLoginErrorCode = 'INVALID_PIN_CREDENTIALS';
    final pinState = PinDeviceStateStore();
    await pinState.recordPinEnabled('12345678');
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign in with password'));
    await tester.pumpAndSettle();

    expect(find.text('This PIN is not available'), findsOneWidget);
    expect(find.text('Incorrect PIN.'), findsNothing);
    expect(
      find.text(
          'Unable to connect to the service. Check your connection and try again.'),
      findsNothing,
    );
  });

  testWidgets('PIN network error clears when switching to password',
      (tester) async {
    final auth = _FakeAuthRepository()..pinLoginErrorCode = 'NETWORK_ERROR';
    final pinState = PinDeviceStateStore();
    await pinState.recordPinEnabled('12345678');
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();
    final serviceError =
        'Unable to connect to the service. Check your connection and try again.';
    expect(find.text(serviceError), findsOneWidget);

    await tester.ensureVisible(find.text('Forgot PIN?'));
    await tester.tap(find.text('Forgot PIN?'));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.text(serviceError), findsNothing);
    expect(find.text('This PIN is not available'), findsOneWidget);
  });

  testWidgets('wrong PIN feedback clears when switching to password',
      (tester) async {
    final auth = _FakeAuthRepository();
    final pinState = PinDeviceStateStore();
    await pinState.recordPinEnabled('12345678');
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();
    expect(find.text('Incorrect PIN.'), findsOneWidget);

    await tester.ensureVisible(find.text('Forgot PIN?'));
    await tester.tap(find.text('Forgot PIN?'));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.text('Incorrect PIN.'), findsNothing);
  });

  testWidgets('password error remains on password flow only', (tester) async {
    final auth = _FakeAuthRepository()
      ..passwordLoginErrorCode = 'INVALID_CREDENTIALS';
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.tap(find.text('Sign in with password'));
    await tester.pump();
    await tester.enterText(find.byType(TextField).at(0), '12345678');
    await tester.enterText(find.byType(TextField).at(1), 'wrong-password');
    await tester.tap(find.text('Sign in', skipOffstage: false));
    await tester.pumpAndSettle();

    expect(find.text('Invalid email or password.'), findsOneWidget);
  });

  testWidgets('returning to sign-in methods clears password error',
      (tester) async {
    final auth = _FakeAuthRepository()
      ..passwordLoginErrorCode = 'INVALID_CREDENTIALS';
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.tap(find.text('Sign in with password'));
    await tester.pump();
    await tester.enterText(find.byType(TextField).at(0), '12345678');
    await tester.enterText(find.byType(TextField).at(1), 'wrong-password');
    await tester.tap(find.text('Sign in', skipOffstage: false));
    await tester.pumpAndSettle();
    expect(find.text('Invalid email or password.'), findsOneWidget);

    await tester.tap(find.text('Back to sign-in methods'));
    await tester.pumpAndSettle();

    expect(find.text('Invalid email or password.'), findsNothing);
    expect(find.text('Sign in with PIN'), findsOneWidget);

    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();

    expect(find.text('PIN not set up yet'), findsOneWidget);
    expect(find.text('Invalid email or password.'), findsNothing);
  });

  testWidgets('successful password login clears transient error',
      (tester) async {
    final auth = _FakeAuthRepository()
      ..passwordLoginErrorCode = 'INVALID_CREDENTIALS';
    var loggedIn = false;
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      onLoggedIn: () async => loggedIn = true,
      onRegister: () {},
    )));

    await tester.tap(find.text('Sign in with password'));
    await tester.pump();
    await tester.enterText(find.byType(TextField).at(0), '12345678');
    await tester.enterText(find.byType(TextField).at(1), 'wrong-password');
    await tester.tap(find.text('Sign in', skipOffstage: false));
    await tester.pumpAndSettle();
    expect(find.text('Invalid email or password.'), findsOneWidget);

    auth.passwordLoginErrorCode = null;
    await tester.tap(find.text('Sign in', skipOffstage: false));
    await tester.pumpAndSettle();

    expect(loggedIn, isTrue);
    expect(find.text('Invalid email or password.'), findsNothing);
  });

  testWidgets('completed PIN login records the employee for this device',
      (tester) async {
    final auth = _FakeAuthRepository()..pinLoginSucceeds = true;
    final pinState = PinDeviceStateStore();
    var loggedIn = false;
    await tester.pumpWidget(_harness(PinEntryPage(
      auth: auth,
      employeeId: '12345678',
      onLoggedIn: () async => loggedIn = true,
      onPinLoginSuccess: pinState.recordPinEnabled,
      onUsePassword: () {},
    )));

    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();

    expect(loggedIn, isTrue);
    expect(await pinState.hasKnownPin('12345678'), isTrue);
  });

  testWidgets('known employee opens the PIN keypad on the same device',
      (tester) async {
    final auth = _FakeAuthRepository();
    final pinState = PinDeviceStateStore();
    await pinState.recordPinEnabled('12345678');
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();

    expect(find.text('Enter 6-digit PIN'), findsOneWidget);
    expect(find.text('PIN not set up yet'), findsNothing);
  });

  testWidgets('lost local state falls back to password without probing account',
      (tester) async {
    final auth = _FakeAuthRepository();
    final pinState = PinDeviceStateStore();
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();

    expect(auth.pinLoginCalls, 0);
    expect(find.text('PIN not set up yet'), findsOneWidget);
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

  testWidgets(
      'backend PIN-unavailable response opens neutral password recovery',
      (tester) async {
    final auth = _FakeAuthRepository()
      ..pinLoginErrorCode = 'INVALID_PIN_CREDENTIALS';
    final pinState = PinDeviceStateStore();
    await pinState.recordPinEnabled('12345678');
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();

    expect(find.text('This PIN is not available'), findsOneWidget);
    expect(find.text('Unable to connect to the service'), findsNothing);
    expect(await pinState.hasKnownPin('12345678'), isFalse);
    await tester.tap(find.text('Sign in with password'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsNWidgets(2));
    expect(
        tester.widget<TextField>(find.byType(TextField).first).controller?.text,
        '12345678');
  });

  testWidgets('network PIN failure uses service-unavailable feedback',
      (tester) async {
    final auth = _FakeAuthRepository()..pinLoginErrorCode = 'NETWORK_ERROR';
    final pinState = PinDeviceStateStore();
    await pinState.recordPinEnabled('12345678');
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();

    expect(
        find.text(
            'Unable to connect to the service. Check your connection and try again.'),
        findsOneWidget);
    expect(find.text('This PIN is not available'), findsNothing);
  });

  testWidgets('PIN lockout keeps the lockout feedback', (tester) async {
    final auth = _FakeAuthRepository()..pinLoginErrorCode = 'PIN_LOCKED';
    final pinState = PinDeviceStateStore();
    await pinState.recordPinEnabled('12345678');
    await tester.pumpWidget(_harness(LoginPage(
      auth: auth,
      pinDeviceState: pinState,
      onLoggedIn: () async {},
      onRegister: () {},
    )));

    await tester.enterText(find.byType(TextField).first, '12345678');
    await tester.tap(find.text('Sign in with PIN'));
    await tester.pumpAndSettle();
    await _tapDigits(tester, '123456');
    await tester.pumpAndSettle();

    expect(find.text('PIN sign-in is temporarily locked. Try again later.'),
        findsOneWidget);
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
