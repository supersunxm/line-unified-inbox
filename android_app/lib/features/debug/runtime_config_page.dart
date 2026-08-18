import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/config/app_config.dart';

class RuntimeConfigPage extends StatefulWidget {
  const RuntimeConfigPage({super.key});

  @override
  State<RuntimeConfigPage> createState() => _RuntimeConfigPageState();
}

class _RuntimeConfigPageState extends State<RuntimeConfigPage> {
  PackageInfo? _packageInfo;

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((value) {
      if (mounted) setState(() => _packageInfo = value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final packageInfo = _packageInfo;
    final apiBaseUrl = AppConfig.apiBaseUrl;

    return Scaffold(
      appBar: AppBar(title: const Text('Runtime diagnostics')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _DiagnosticRow(
            label: 'App version',
            value: packageInfo == null
                ? 'Loading…'
                : '${packageInfo.version}+${packageInfo.buildNumber}',
          ),
          _DiagnosticRow(
            label: 'APP_ENV',
            value: AppConfig.appEnvironment,
          ),
          _DiagnosticRow(
            label: 'API_BASE_URL',
            value: apiBaseUrl.isEmpty ? '<EMPTY>' : apiBaseUrl,
          ),
          const SizedBox(height: 16),
          Text(
            apiBaseUrl.isEmpty
                ? 'FAIL: API_BASE_URL was not injected into this APK.'
                : 'OK: API_BASE_URL is present in this APK.',
            style: TextStyle(
              color: apiBaseUrl.isEmpty ? Colors.red : Colors.green,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _DiagnosticRow extends StatelessWidget {
  const _DiagnosticRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 4),
            SelectableText(value),
          ],
        ),
      );
}
