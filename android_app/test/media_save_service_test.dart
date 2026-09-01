import 'dart:typed_data';

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

  test('media save bridge forwards video bytes and succeeds', () async {
    MethodCall? captured;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      captured = call;
      return true;
    });

    await const MediaSaveService(channel: channel).saveVideo(
      Uint8List.fromList([4, 5, 6]),
      fileName: 'clip.mp4',
      mimeType: 'video/mp4',
    );
    expect(captured?.method, 'saveVideo');
    expect(captured?.arguments['fileName'], 'clip.mp4');
    expect(captured?.arguments['mimeType'], 'video/mp4');
    expect(captured?.arguments['bytes'], isA<Uint8List>());
  });

  test('media save bridge rejects empty video data', () async {
    await expectLater(
      const MediaSaveService(channel: channel).saveVideo(Uint8List(0)),
      throwsA(isA<PlatformException>()),
    );
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
