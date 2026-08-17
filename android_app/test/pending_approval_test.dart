import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:line_oa_chat_hub/core/localization/localization.dart';
import 'package:line_oa_chat_hub/features/auth/pending_approval_page.dart';

void main() {
  testWidgets('pending approval stays usable on a narrow screen',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(
        locale: Locale('th'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: PendingApprovalPage(onBack: _noop),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('อยู่ในขั้นตอนการอนุมัติ'), findsOneWidget);
    expect(find.textContaining('sunny_typee'), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

void _noop() {}
