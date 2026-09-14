import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/features/chat/pdf_attachment.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final validBytes = Uint8List.fromList('%PDF-1.7\n%%EOF'.codeUnits);

  test('validates PDF extension, MIME, and magic bytes', () {
    final attachment = validatePdfAttachment(
      bytes: validBytes,
      filename: '../quote.pdf',
      mimeType: 'application/pdf; charset=binary',
    );
    expect(attachment.filename, '__quote.pdf');
    expect(attachment.mimeType, pdfMimeType);
    expect(attachment.fileSize, validBytes.length);
  });

  test('sanitizes path separators and control characters for display names',
      () {
    expect(sanitizePdfDisplayName('../quote\\final.pdf'), '__quote_final.pdf');
    expect(sanitizePdfDisplayName('\u0000quote.pdf'), 'quote.pdf');
    expect(sanitizePdfDisplayName(''), 'document.pdf');
  });

  test('rejects non-PDF extensions', () {
    expect(
      () => validatePdfAttachment(
        bytes: validBytes,
        filename: 'quote.exe',
        mimeType: 'application/pdf',
      ),
      throwsA(isA<PdfAttachmentException>()),
    );
  });

  test('rejects incorrect MIME types', () {
    expect(
      () => validatePdfAttachment(
        bytes: validBytes,
        filename: 'quote.pdf',
        mimeType: 'image/png',
      ),
      throwsA(isA<PdfAttachmentException>()),
    );
  });

  test('rejects invalid PDF signatures and empty files', () {
    expect(
      () => validatePdfAttachment(
        bytes: Uint8List.fromList('not pdf'.codeUnits),
        filename: 'quote.pdf',
      ),
      throwsA(isA<PdfAttachmentException>()),
    );
    expect(
      () => validatePdfAttachment(
        bytes: Uint8List(0),
        filename: 'quote.pdf',
      ),
      throwsA(isA<PdfAttachmentException>()),
    );
  });

  test('rejects PDFs over the centralized client size limit', () {
    final bytes = Uint8List(maxPdfBytes + 1);
    bytes.setRange(0, 5, '%PDF-'.codeUnits);
    expect(
      () => validatePdfAttachment(bytes: bytes, filename: 'large.pdf'),
      throwsA(isA<PdfAttachmentException>()),
    );
  });

  test('picker maps native channel data into a validated attachment', () async {
    const channel = MethodChannel('test/pdf-picker');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'pickPdf');
      return <String, dynamic>{
        'bytes': validBytes,
        'fileName': 'quote.pdf',
        'mimeType': 'application/pdf',
      };
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));
    final picked = await PdfAttachmentPicker(channel: channel).pick();
    expect(picked?.filename, 'quote.pdf');
    expect(picked?.mimeType, pdfMimeType);
  });
}
