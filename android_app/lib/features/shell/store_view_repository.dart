import '../../core/models/models.dart';
import '../../core/network/api_client.dart';

class StoreViewRepository {
  StoreViewRepository(this._api);

  final ApiClient _api;

  Future<List<Store>> stores() async {
    final result = await _api.get('/auth/store-context/stores');
    return (result['items'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((item) => Store.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }
}
