import 'package:flutter/services.dart';

class MediaSaveService {
  const MediaSaveService({MethodChannel channel = _defaultChannel})
      : _channel = channel;

  static const MethodChannel _defaultChannel =
      MethodChannel('click.lineoppo.chat/media_save');

  final MethodChannel _channel;

  Future<void> saveImage(
    Uint8List bytes, {
    String? fileName,
    String? mimeType,
  }) async {
    if (bytes.isEmpty) {
      throw PlatformException(
        code: 'EMPTY_IMAGE',
        message: 'Image data is empty',
      );
    }
    final result = await _channel.invokeMethod<Object?>('saveImage', {
      'bytes': bytes,
      'fileName': fileName,
      'mimeType': mimeType,
    });
    if (result != true) {
      throw PlatformException(
        code: 'SAVE_FAILED',
        message: 'Image could not be saved',
      );
    }
  }
}
