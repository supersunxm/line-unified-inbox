import 'package:package_info_plus/package_info_plus.dart';

/// Formats the version of the APK currently installed on this device.
///
/// This intentionally accepts only PackageInfo and never release metadata
/// fetched from the backend. The About row must describe the installed app.
String formatInstalledAppVersion(PackageInfo packageInfo) {
  final version = packageInfo.version.trim();
  final build = packageInfo.buildNumber.trim();
  if (version.isEmpty || build.isEmpty) return 'OPPO LINE OA Chat';
  return 'OPPO LINE OA Chat · v$version+$build';
}
