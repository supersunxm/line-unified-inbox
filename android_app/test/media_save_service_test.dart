import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/services/media_save_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('click.lineoppo.chat/media_save');

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('media save bridge forwards image bytes and succeeds', () async {
    MethodCall? captured;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      captured = call;
      return true;
    });

    await const MediaSaveService(channel: channel).saveImage(
      Uint8List.fromList([1, 2, 3]),
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    );
    expect(captured?.method, 'saveImage');
    expect(captured?.arguments['fileName'], 'photo.jpg');
    expect(captured?.arguments['mimeType'], 'image/jpeg');
    expect(captured?.arguments['bytes'], isA<Uint8List>());
  });

  test('media save bridge surfaces native failures without crashing', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      channel,
      (_) async => throw PlatformException(code: 'SAVE_FAILED'),
    );
    await expectLater(
      const MediaSaveService(channel: channel).saveImage(
        Uint8List.fromList([1]),
      ),
      throwsA(isA<PlatformException>()),
    );
  });
}
