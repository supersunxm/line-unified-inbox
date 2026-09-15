import 'package:flutter/material.dart';

import '../../core/localization/localization.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';
import 'pin_setup_page.dart';

class PinManagementPage extends StatefulWidget {
  const PinManagementPage({
    super.key,
    required this.auth,
    required this.employeeId,
    required this.pinEnabled,
  });

  final AuthRepository auth;
  final String employeeId;
  final bool pinEnabled;

  @override
  State<PinManagementPage> createState() => _PinManagementPageState();
}

class _PinManagementPageState extends State<PinManagementPage> {
  late bool _pinEnabled = widget.pinEnabled;
  bool _loading = false;

  Future<void> _setup() async {
    final changed = await _openPinSetup(widget.auth.setupPin);
    if (changed && mounted) setState(() => _pinEnabled = true);
  }

  Future<void> _change() async {
    final verification = await _askVerification();
    if (verification == null || !mounted) return;
    final changed =
        await _openPinSetup((pin, confirmationPin) => widget.auth.changePin(
              currentPin: verification.currentPin,
              currentPassword: verification.currentPassword,
              pin: pin,
              confirmationPin: confirmationPin,
            ));
    if (changed && mounted) setState(() => _pinEnabled = true);
  }

  Future<void> _reset() async {
    final password = await _askPassword();
    if (password == null || !mounted) return;
    final changed = await _openPinSetup((pin, confirmationPin) =>
        widget.auth.resetPin(password, pin, confirmationPin));
    if (changed && mounted) setState(() => _pinEnabled = true);
  }

  Future<void> _disable() async {
    final password = await _askPassword();
    if (password == null || !mounted) return;
    setState(() => _loading = true);
    try {
      await widget.auth.disablePin(password);
      if (mounted) {
        setState(() => _pinEnabled = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(appLocalizations(context).pinDisabledSuccess)));
      }
    } on ApiException catch (error) {
      if (mounted) _showError(error.message);
    } catch (_) {
      if (mounted) _showError(appLocalizations(context).pinUnableToSave);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<bool> _openPinSetup(
      Future<void> Function(String, String) submit) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PinSetupPage(
          employeeId: widget.employeeId,
          submit: submit,
          onCompleted: () async => Navigator.of(context).pop(true),
        ),
      ),
    );
    return changed == true;
  }

  Future<_PinVerification?> _askVerification() async {
    final controller = TextEditingController();
    var usePin = true;
    String? error;
    final result = await showDialog<_PinVerification>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final l10n = appLocalizations(context);
          return AlertDialog(
            title: Text(l10n.verifyPinOrPassword),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                RadioGroup<bool>(
                  groupValue: usePin,
                  onChanged: (value) {
                    if (value != null) {
                      setDialogState(() {
                        usePin = value;
                        controller.clear();
                        error = null;
                      });
                    }
                  },
                  child: Column(
                    children: [
                      if (_pinEnabled)
                        RadioListTile<bool>(
                            value: true, title: Text(l10n.currentPin)),
                      RadioListTile<bool>(
                          value: false, title: Text(l10n.password)),
                    ],
                  ),
                ),
                TextField(
                  controller: controller,
                  autofocus: true,
                  obscureText: true,
                  keyboardType:
                      usePin ? TextInputType.number : TextInputType.text,
                  maxLength: usePin ? 6 : null,
                  decoration: InputDecoration(
                      labelText: usePin ? l10n.currentPin : l10n.password,
                      errorText: error),
                ),
              ],
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: Text(l10n.cancel)),
              FilledButton(
                onPressed: () {
                  if ((usePin &&
                          !RegExp(r'^\d{6}$').hasMatch(controller.text)) ||
                      (!usePin && controller.text.isEmpty)) {
                    setDialogState(() => error = l10n.verificationRequired);
                    return;
                  }
                  Navigator.of(dialogContext).pop(_PinVerification(
                      usePin ? controller.text : null,
                      usePin ? null : controller.text));
                },
                child: Text(l10n.continueLabel),
              ),
            ],
          );
        },
      ),
    );
    controller.dispose();
    return result;
  }

  Future<String?> _askPassword() async {
    final controller = TextEditingController();
    String? error;
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final l10n = appLocalizations(context);
          return AlertDialog(
            title: Text(l10n.verifyPassword),
            content: TextField(
              controller: controller,
              autofocus: true,
              obscureText: true,
              decoration:
                  InputDecoration(labelText: l10n.password, errorText: error),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: Text(l10n.cancel)),
              FilledButton(
                onPressed: () {
                  if (controller.text.isEmpty) {
                    setDialogState(() => error = l10n.verificationRequired);
                    return;
                  }
                  Navigator.of(dialogContext).pop(controller.text);
                },
                child: Text(l10n.continueLabel),
              ),
            ],
          );
        },
      ),
    );
    controller.dispose();
    return result;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.loginSecurity)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.pin_outlined),
              title: Text(l10n.pinSixDigits),
              subtitle: Text(
                  _pinEnabled ? l10n.pinStatusEnabled : l10n.pinStatusDisabled),
              trailing: Icon(
                  _pinEnabled
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  color: _pinEnabled ? Colors.green : null),
            ),
          ),
          const SizedBox(height: 16),
          if (!_pinEnabled)
            FilledButton.icon(
                onPressed: _loading ? null : _setup,
                icon: const Icon(Icons.add),
                label: Text(l10n.setupPin))
          else ...[
            OutlinedButton.icon(
                onPressed: _loading ? null : _change,
                icon: const Icon(Icons.edit_outlined),
                label: Text(l10n.changePin)),
            const SizedBox(height: 12),
            OutlinedButton.icon(
                onPressed: _loading ? null : _reset,
                icon: const Icon(Icons.restart_alt),
                label: Text(l10n.resetPin)),
            const SizedBox(height: 12),
            TextButton.icon(
                onPressed: _loading ? null : _disable,
                icon: const Icon(Icons.lock_open_outlined),
                label: Text(l10n.disablePin)),
          ],
        ],
      ),
    );
  }
}

class _PinVerification {
  const _PinVerification(this.currentPin, this.currentPassword);

  final String? currentPin;
  final String? currentPassword;
}
