import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

const pdfMimeType = 'application/pdf';
const maxPdfBytes = 20 * 1024 * 1024;

String formatPdfFileSize(int? size) {
  if (size == null || size < 0) return '';
  if (size < 1024) return '$size B';
  if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
  return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
}

class PdfAttachmentException implements Exception {
  const PdfAttachmentException(this.code);

  final String code;
}

class PdfAttachment {
  const PdfAttachment({
    required this.bytes,
    required this.filename,
    this.mimeType,
  });

  final Uint8List bytes;
  final String filename;
  final String? mimeType;

  int get fileSize => bytes.length;
}

bool isPdfMagicBytes(Uint8List bytes) =>
    bytes.length >= 5 && String.fromCharCodes(bytes.take(5)) == '%PDF-';

String sanitizePdfDisplayName(String? value) {
  final normalized = (value ?? 'document.pdf')
      .replaceAll(RegExp(r'[\\/]'), '_')
      .replaceAll(RegExp(r'\.{2,}'), '_')
      .replaceAll('"', '_')
      .replaceAll(RegExp(r'[\u0000-\u001f\u007f]'), '')
      .trim();
  if (normalized.isEmpty) return 'document.pdf';
  return normalized.length > 180 ? normalized.substring(0, 180) : normalized;
}

PdfAttachment validatePdfAttachment({
  required Uint8List bytes,
  required String? filename,
  String? mimeType,
}) {
  final safeName = sanitizePdfDisplayName(filename);
  if (!safeName.toLowerCase().endsWith('.pdf')) {
    throw const PdfAttachmentException('PDF_EXTENSION_REQUIRED');
  }
  final declaredMime = mimeType?.split(';').first.trim().toLowerCase();
  if (declaredMime != null &&
      declaredMime.isNotEmpty &&
      declaredMime != pdfMimeType &&
      declaredMime != 'application/octet-stream') {
    throw const PdfAttachmentException('PDF_MIME_REQUIRED');
  }
  if (bytes.isEmpty || bytes.length > maxPdfBytes) {
    throw const PdfAttachmentException('PDF_TOO_LARGE');
  }
  if (!isPdfMagicBytes(bytes)) {
    throw const PdfAttachmentException('PDF_SIGNATURE_INVALID');
  }
  return PdfAttachment(bytes: bytes, filename: safeName, mimeType: pdfMimeType);
}

class PdfAttachmentPicker {
  const PdfAttachmentPicker({MethodChannel channel = _defaultChannel})
      : _channel = channel;

  static const _defaultChannel = MethodChannel('click.lineoppo.chat/pdf');
  final MethodChannel _channel;

  Future<PdfAttachment?> pick() async {
    final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>('pickPdf');
    if (raw == null) return null;
    final rawBytes = raw['bytes'];
    final bytes = rawBytes is Uint8List
        ? rawBytes
        : rawBytes is List
            ? Uint8List.fromList(rawBytes.whereType<int>().toList())
            : Uint8List(0);
    return validatePdfAttachment(
      bytes: bytes,
      filename: raw['fileName'] as String?,
      mimeType: raw['mimeType'] as String?,
    );
  }
}

class PdfFileOpener {
  const PdfFileOpener({
    Future<Directory> Function()? temporaryDirectory,
    MethodChannel channel = _defaultChannel,
  })  : _temporaryDirectory = temporaryDirectory,
        _channel = channel;

  static const _defaultChannel = MethodChannel('click.lineoppo.chat/pdf');
  final Future<Directory> Function()? _temporaryDirectory;
  final MethodChannel _channel;

  Future<void> open(PdfAttachment attachment) async {
    final temporaryDirectory = _temporaryDirectory;
    final directory = temporaryDirectory == null
        ? await getTemporaryDirectory()
        : await temporaryDirectory();
    final safeName = sanitizePdfDisplayName(attachment.filename);
    final file = File(
        '${directory.path}/line-pdf-${DateTime.now().microsecondsSinceEpoch}-$safeName');
    await file.writeAsBytes(attachment.bytes, flush: true);
    try {
      final opened =
          await _channel.invokeMethod<bool>('openPdf', {'path': file.path});
      if (opened != true) {
        throw const PdfAttachmentException('PDF_VIEWER_UNAVAILABLE');
      }
    } on PlatformException catch (error) {
      throw PdfAttachmentException(error.code);
    }
  }
}
