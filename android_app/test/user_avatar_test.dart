import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/widgets/user_avatar.dart';

void main() {
  testWidgets('user avatar falls back to initials when picture URL is missing',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: UserAvatar(displayName: 'Alice')),
    ));
    expect(find.text('A'), findsOneWidget);
  });

  testWidgets('user avatar rejects malformed picture URLs safely',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: UserAvatar(displayName: 'Bob', imageUrl: 'not-a-url'),
      ),
    ));
    expect(find.text('B'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
