import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:line_oa_chat_hub/core/localization/localization.dart';

Widget _localizedApp(Locale locale, Widget child) => MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

void main() {
  testWidgets('English, Thai, and Chinese expose localized navigation',
      (tester) async {
    for (final testCase in const [
      (Locale('en'), 'Inbox', 'Need Reply'),
      (Locale('th'), 'ข้อความ', 'รอตอบ'),
      (Locale('zh', 'CN'), '消息', '待回复'),
    ]) {
      await tester.pumpWidget(_localizedApp(
        testCase.$1,
        Builder(
          builder: (context) => Column(
            children: [
              Text(AppLocalizations.of(context)!.inbox),
              Text(AppLocalizations.of(context)!.needReply),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text(testCase.$2), findsOneWidget);
      expect(find.text(testCase.$3), findsOneWidget);
    }
  });

  testWidgets('dynamic customer and product data stay unchanged',
      (tester) async {
    await tester.pumpWidget(_localizedApp(
      const Locale('th'),
      const Column(children: [Text('OBS-Sunx2'), Text('OPPO Find N6')]),
    ));
    expect(find.text('OBS-Sunx2'), findsOneWidget);
    expect(find.text('OPPO Find N6'), findsOneWidget);
  });

  test('language selection persists in device-local storage', () async {
    SharedPreferences.setMockInitialValues({});
    final controller = AppLanguageController(systemLocale: const Locale('en'));
    await controller.load();
    expect(controller.language, AppLanguage.english);
    await controller.setLanguage(AppLanguage.thai);

    final restored =
        AppLanguageController(systemLocale: const Locale('en'));
    await restored.load();
    expect(restored.language, AppLanguage.thai);
  });

  testWidgets('selecting a language updates the app immediately', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final controller =
        AppLanguageController(systemLocale: const Locale('en'));
    await tester.pumpWidget(
      AppLanguageScope(
        controller: controller,
        child: AnimatedBuilder(
          animation: controller,
          builder: (context, _) => _localizedApp(
            controller.locale,
            Builder(
              builder: (context) => Text(appLocalizations(context).inbox),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Inbox'), findsOneWidget);
    await controller.setLanguage(AppLanguage.simplifiedChinese);
    await tester.pumpAndSettle();
    expect(find.text('消息'), findsOneWidget);
  });
}
