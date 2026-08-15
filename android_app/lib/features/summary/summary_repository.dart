import '../../core/models/models.dart';
import '../../core/network/api_client.dart';

class SummaryRepository {
  SummaryRepository(this._api);

  final ApiClient _api;

  Future<MonthlySummary> monthly(String month) async {
    final response =
        await _api.get('/mobile/summary/monthly', query: {'month': month});
    return MonthlySummary.fromJson(response);
  }
}
