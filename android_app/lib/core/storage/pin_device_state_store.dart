import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Stores only a device-local marker that an employee has used a working PIN.
///
/// The employee ID is fingerprinted before persistence. PINs and PIN hashes
/// are never stored on the device.
class PinDeviceStateStore {
  PinDeviceStateStore({SharedPreferencesAsync? preferences})
      : _preferences = preferences ?? SharedPreferencesAsync();

  static const employeeFingerprintsKey = 'pin_enabled_employee_ids_v1';

  final SharedPreferencesAsync _preferences;

  Future<bool> hasKnownPin(String employeeId) async {
    final fingerprint = _fingerprint(employeeId);
    final values =
        await _preferences.getStringList(employeeFingerprintsKey) ?? const [];
    return values.contains(fingerprint);
  }

  Future<void> recordPinEnabled(String employeeId) async {
    final fingerprint = _fingerprint(employeeId);
    final values = List<String>.from(
        await _preferences.getStringList(employeeFingerprintsKey) ?? const []);
    if (values.contains(fingerprint)) return;
    values.add(fingerprint);
    await _preferences.setStringList(employeeFingerprintsKey, values);
  }

  Future<void> forgetPin(String employeeId) async {
    final fingerprint = _fingerprint(employeeId);
    final values = List<String>.from(
        await _preferences.getStringList(employeeFingerprintsKey) ?? const []);
    if (!values.remove(fingerprint)) return;
    await _preferences.setStringList(employeeFingerprintsKey, values);
  }

  String _fingerprint(String employeeId) =>
      sha256.convert(utf8.encode(employeeId.trim())).toString();
}
