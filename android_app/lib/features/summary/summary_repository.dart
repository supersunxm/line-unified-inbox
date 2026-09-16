import '../../core/models/models.dart';
import '../../core/network/api_client.dart';

class SummaryFollowerSnapshot {
  const SummaryFollowerSnapshot({
    required this.available,
    required this.totalFollowers,
    required this.monthlyGrowth,
    required this.growthRate,
    required this.asOfDate,
    required this.baselineDate,
    required this.accountsExpected,
    required this.accountsWithData,
    required this.accountsCompared,
    required this.coverageRate,
    this.reason,
  });

  final bool available;
  final String? reason;
  final int? totalFollowers;
  final int? monthlyGrowth;
  final double? growthRate;
  final String? asOfDate;
  final String? baselineDate;
  final int accountsExpected;
  final int accountsWithData;
  final int accountsCompared;
  final double coverageRate;

  factory SummaryFollowerSnapshot.fromJson(Map<String, dynamic> json) =>
      SummaryFollowerSnapshot(
        available: json['available'] == true,
        reason: json['reason'] as String?,
        totalFollowers: (json['totalFollowers'] as num?)?.toInt(),
        monthlyGrowth: (json['monthlyGrowth'] as num?)?.toInt(),
        growthRate: (json['growthRate'] as num?)?.toDouble(),
        asOfDate: json['asOfDate'] as String?,
        baselineDate: json['baselineDate'] as String?,
        accountsExpected: (json['accountsExpected'] as num?)?.toInt() ?? 0,
        accountsWithData: (json['accountsWithData'] as num?)?.toInt() ?? 0,
        accountsCompared: (json['accountsCompared'] as num?)?.toInt() ?? 0,
        coverageRate: (json['coverageRate'] as num?)?.toDouble() ?? 0,
      );
}

class SummaryRepository {
  SummaryRepository(this._api);

  final ApiClient _api;
  SummaryFollowerSnapshot? _lastFollowers;

  SummaryFollowerSnapshot? get lastFollowers => _lastFollowers;

  Future<MonthlySummary> monthly(String month) async {
    _lastFollowers = null;
    final response =
        await _api.get('/mobile/summary/monthly', query: {'month': month});
    final rawFollowers = response['followers'];
    if (rawFollowers is Map<String, dynamic>) {
      _lastFollowers = SummaryFollowerSnapshot.fromJson(rawFollowers);
    } else if (rawFollowers is Map) {
      _lastFollowers = SummaryFollowerSnapshot.fromJson(
          Map<String, dynamic>.from(rawFollowers));
    }
    return MonthlySummary.fromJson(response);
  }
}
