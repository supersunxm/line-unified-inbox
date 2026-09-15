import 'package:flutter/material.dart';

import '../../core/config/app_config.dart';
import '../../core/localization/localization.dart';
import '../../core/network/api_exception.dart';
import '../../core/storage/pin_device_state_store.dart';
import '../debug/runtime_config_page.dart';
import 'auth_repository.dart';
import 'pin_entry_page.dart';

class LoginPage extends StatefulWidget {
  LoginPage({
    super.key,
    required this.auth,
    required this.onLoggedIn,
    required this.onRegister,
    PinDeviceStateStore? pinDeviceState,
  }) : pinDeviceState = pinDeviceState ?? PinDeviceStateStore();

  final AuthRepository auth;
  final Future<void> Function() onLoggedIn;
  final VoidCallback onRegister;
  final PinDeviceStateStore pinDeviceState;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

enum _PasswordGuidance { pinNotConfigured, pinUnavailable }

class _LoginPageState extends State<LoginPage> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _passwordMode = !AppConfig.pinLoginEnabled;
  bool _loading = false;
  String? _passwordError;
  _PasswordGuidance? _passwordGuidance;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  void _showPasswordLogin([_PasswordGuidance? guidance]) {
    if (_loading) return;
    setState(() {
      _passwordMode = true;
      _passwordGuidance = guidance;
      _passwordError = null;
    });
  }

  void _showLoginMethods() {
    if (_loading) return;
    setState(() {
      _passwordMode = false;
      _passwordGuidance = null;
      _passwordError = null;
    });
  }

  Future<void> _openPinLogin() async {
    final identifier = _identifier.text.trim();
    if (identifier.isEmpty) {
      setState(
          () => _passwordError = appLocalizations(context).employeeIdRequired);
      return;
    }
    setState(() {
      _passwordError = null;
      _passwordGuidance = null;
    });
    bool hasKnownPin;
    try {
      hasKnownPin = await widget.pinDeviceState.hasKnownPin(identifier);
    } catch (_) {
      // Missing local metadata must fail closed to password authentication.
      hasKnownPin = false;
    }
    if (!mounted) return;
    if (!hasKnownPin) {
      _showPasswordLogin(_PasswordGuidance.pinNotConfigured);
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => PinEntryPage(
          auth: widget.auth,
          employeeId: identifier,
          onLoggedIn: widget.onLoggedIn,
          onPinLoginSuccess: widget.pinDeviceState.recordPinEnabled,
          onPinUnavailable: widget.pinDeviceState.forgetPin,
          onUsePassword: () {
            Navigator.of(context).pop();
            if (mounted) {
              _showPasswordLogin(_PasswordGuidance.pinUnavailable);
            }
          },
        ),
      ),
    );
  }

  Future<void> _submitPassword() async {
    final l10n = appLocalizations(context);
    if (_identifier.text.trim().isEmpty) {
      setState(() => _passwordError = l10n.employeeIdRequired);
      return;
    }
    if (_password.text.isEmpty) {
      setState(() => _passwordError = l10n.passwordRequired);
      return;
    }
    setState(() {
      _loading = true;
      _passwordError = null;
    });
    try {
      await widget.auth.login(_identifier.text, _password.text);
      if (mounted) setState(() => _passwordError = null);
      await widget.onLoggedIn();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _passwordError = _errorMessage(error, l10n));
      }
    } catch (_) {
      if (mounted) setState(() => _passwordError = l10n.unableToSignIn);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _errorMessage(ApiException error, AppLocalizations l10n) =>
      switch (error.code) {
        'ACCOUNT_PENDING_APPROVAL' => l10n.accountPendingMessage,
        'ACCOUNT_REJECTED' => l10n.accountRejectedMessage,
        'INVALID_CREDENTIALS' => l10n.invalidCredentials,
        _ => error.message,
      };

  Widget _identityForm(BuildContext context, {required bool pinMode}) {
    final l10n = appLocalizations(context);
    return TextField(
      controller: _identifier,
      keyboardType: TextInputType.text,
      autocorrect: false,
      textCapitalization: TextCapitalization.none,
      decoration: InputDecoration(
        labelText: pinMode ? l10n.employeeId : l10n.employeeIdOrUsername,
        border: const OutlineInputBorder(),
      ),
    );
  }

  Widget _passwordForm(BuildContext context) {
    final l10n = appLocalizations(context);
    return Column(
      children: [
        if (_passwordGuidance != null) ...[
          Card(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    _passwordGuidance == _PasswordGuidance.pinNotConfigured
                        ? l10n.pinNotConfiguredTitle
                        : l10n.pinUnavailableTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _passwordGuidance == _PasswordGuidance.pinNotConfigured
                        ? l10n.pinNotConfiguredBody
                        : l10n.pinUnavailableBody,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        _identityForm(context, pinMode: false),
        const SizedBox(height: 12),
        TextField(
          controller: _password,
          obscureText: true,
          decoration: InputDecoration(
            labelText: l10n.password,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _loading ? null : _submitPassword,
          icon: _loading
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.lock_open_outlined),
          label: Text(
              _passwordGuidance == null ? l10n.login : l10n.signInWithPassword),
        ),
        if (AppConfig.pinLoginEnabled)
          TextButton(
            onPressed: _loading ? null : _showLoginMethods,
            child: Text(l10n.backToLoginMethods),
          ),
      ],
    );
  }

  Widget _pinChoice(BuildContext context) {
    final l10n = appLocalizations(context);
    return Column(
      children: [
        _identityForm(context, pinMode: true),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _loading ? null : _openPinLogin,
          icon: const Icon(Icons.lock_outline),
          label: Text(l10n.signInWithPin),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            const Expanded(child: Divider()),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(l10n.or),
            ),
            const Expanded(child: Divider()),
          ],
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _loading ? null : _showPasswordLogin,
          icon: const Icon(Icons.key_outlined),
          label: Text(l10n.signInWithPassword),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.asset(
                      'assets/images/LOGO_OBS.png',
                      height: 80,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) =>
                          const Icon(Icons.business, size: 72),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(l10n.appName,
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(l10n.signInApproved, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                _passwordMode ? _passwordForm(context) : _pinChoice(context),
                if (_passwordError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(_passwordError!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error),
                        textAlign: TextAlign.center),
                  ),
                const SizedBox(height: 12),
                TextButton(
                    onPressed: _loading ? null : widget.onRegister,
                    child: Text(l10n.createBmAccount)),
                TextButton.icon(
                  onPressed: _loading
                      ? null
                      : () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                              builder: (_) => const RuntimeConfigPage())),
                  icon: const Icon(Icons.developer_mode, size: 18),
                  label: const Text('Runtime diagnostics'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
