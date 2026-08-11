class ApiException implements Exception {
  ApiException(this.statusCode, this.code, this.message);
  final int statusCode;
  final String? code;
  final String message;

  bool get sessionExpired => statusCode == 401 || code == 'SESSION_EXPIRED';
  @override
  String toString() => message;
}
