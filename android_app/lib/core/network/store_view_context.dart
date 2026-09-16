import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/models.dart';

class StoreViewContextController extends ChangeNotifier {
  Store? _store;

  Store? get store => _store;
  String? get storeId => _store?.id;
  bool get isActive => _store != null;

  void enter(Store store) {
    if (_store?.id == store.id) return;
    _store = store;
    notifyListeners();
  }

  void exit() {
    if (_store == null) return;
    _store = null;
    notifyListeners();
  }
}

class StoreViewHttpClient extends http.BaseClient {
  StoreViewHttpClient(this.context, {http.Client? inner})
      : _inner = inner ?? http.Client();

  final StoreViewContextController context;
  final http.Client _inner;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    final storeId = context.storeId;
    if (storeId != null && request.headers.containsKey('Authorization')) {
      request.headers['X-Act-As-Store-Id'] = storeId;
    }
    return _inner.send(request);
  }

  @override
  void close() => _inner.close();
}
