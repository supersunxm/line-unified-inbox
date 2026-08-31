from pathlib import Path

root = Path(__file__).resolve().parents[1]
patcher = root / "scripts/apply-mobile-video-feature.py"
text = patcher.read_text()

old_api = '''replace_once(
    "android_app/lib/core/network/api_client.dart",
    "      response = await _sendAndRead(request);\\n    } on TimeoutException {\\n      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');\\n      throw ApiException(0, 'NETWORK_TIMEOUT', 'The service timed out');\\n    } catch (_) {\\n      SafeLogger.networkFailure(code: 'NETWORK_ERROR');\\n      throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');\\n    }\\n    Map<String, dynamic> decoded = <String, dynamic>{};",
    "      response = await _sendAndRead(request, timeout: timeout);\\n    } on TimeoutException {\\n      SafeLogger.networkFailure(code: 'NETWORK_TIMEOUT');\\n      throw ApiException(0, 'NETWORK_TIMEOUT', 'The service timed out');\\n    } catch (_) {\\n      SafeLogger.networkFailure(code: 'NETWORK_ERROR');\\n      throw ApiException(0, 'NETWORK_ERROR', 'Unable to reach the service');\\n    }\\n    Map<String, dynamic> decoded = <String, dynamic>{};",
)'''
new_api = '''replace_once(
    "android_app/lib/core/network/api_client.dart",
    "    request.files.add(http.MultipartFile.fromBytes(field, bytes,\\n        filename: filename, contentType: _imageMediaType(mimeType, filename)));\\n    late http.Response response;\\n    try {\\n      response = await _sendAndRead(request);",
    "    request.files.add(http.MultipartFile.fromBytes(field, bytes,\\n        filename: filename, contentType: _imageMediaType(mimeType, filename)));\\n    late http.Response response;\\n    try {\\n      response = await _sendAndRead(request, timeout: timeout);",
)'''
if old_api not in text:
    raise SystemExit("api patch block not found")
text = text.replace(old_api, new_api, 1)

old_repo = '''replace_once(
    "android_app/lib/features/inbox/conversation_repository.dart",
    "        bytes: bytes,\\n        idempotencyKey: idempotencyKey);",
    "        bytes: bytes,\\n        idempotencyKey: idempotencyKey,\\n        timeout: timeout);",
)'''
new_repo = '''replace_once(
    "android_app/lib/features/inbox/conversation_repository.dart",
    "    final result = await _api.postMultipart(path,\\n        field: field,\\n        filename: filename,\\n        mimeType: mimeType,\\n        bytes: bytes,\\n        idempotencyKey: idempotencyKey);",
    "    final result = await _api.postMultipart(path,\\n        field: field,\\n        filename: filename,\\n        mimeType: mimeType,\\n        bytes: bytes,\\n        idempotencyKey: idempotencyKey,\\n        timeout: timeout);",
)'''
if old_repo not in text:
    raise SystemExit("repository patch block not found")
text = text.replace(old_repo, new_repo, 1)

patcher.write_text(text)
Path(__file__).unlink()
