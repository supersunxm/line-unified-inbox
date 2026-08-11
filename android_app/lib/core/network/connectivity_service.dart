import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  ConnectivityService({Connectivity? connectivity}) : _connectivity = connectivity ?? Connectivity();
  final Connectivity _connectivity;

  Future<bool> get isOnline async => !(await _connectivity.checkConnectivity()).contains(ConnectivityResult.none);
  Stream<bool> get changes => _connectivity.onConnectivityChanged.map((results) => !results.contains(ConnectivityResult.none));
}
