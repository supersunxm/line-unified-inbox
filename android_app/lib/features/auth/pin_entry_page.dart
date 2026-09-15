import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/localization/localization.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';
import 'pin_entry_widgets.dart';

class PinEntryPage extends StatefulWidget {
  const PinEntryPage({
    super.key,
    required this.auth,
    required this.employeeId,
    required this.onLoggedIn,
    required this.onUsePassword,
  });

  final AuthRepository auth;
  final String employeeId;
  final Future<void> Function() onLoggedIn;
  final VoidCallback onUsePassword;

  @override
  State<PinEntryPage> createState() => _PinEntryPageState();
}

class _PinEntryPageState extends State<PinEntryPage> {
  String _pin = '';
  String? _error;
  bool _loading = false;

  void _append(String digit) {
    if (_loading || _pin.length >= 6) return;
    final next = '$_pin$digit';
    setState(() {
      _pin = next;
      _error = null;
    });
    if (next.length == 6) unawaited(_submit(next));
  }

  void _delete() {
    if (_loading || _pin.isEmpty) return;
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _error = null;
    });
  }

  Future<void> _submit(String pin) async {
    setState(() => _loading = true);
    try {
      await widget.auth.loginWithPin(widget.employeeId, pin);
      if (!mounted) return;
      Navigator.of(context).pop();
      await widget.onLoggedIn();
    } on ApiException catch (error) {
      if (!mounted) return;
      final l10n = appLocalizations(context);
      setState(() {
        _pin = '';
        _error = switch (error.code) {
          'PIN_LOCKED' => l10n.pinLocked,
          'INVALID_PIN' || 'INVALID_PIN_CREDENTIALS' => l10n.incorrectPin,
          _ => error.message,
        };
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _pin = '';
          _error = appLocalizations(context).unableToSignIn;
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _footer(BuildContext context) {
    final l10n = appLocalizations(context);
    return Column(
      children: [
        if (_error != null)
          Text(_error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
              textAlign: TextAlign.center),
        Text(l10n.pinPasswordFallback, textAlign: TextAlign.center),
        TextButton(
            onPressed: _loading ? null : widget.onUsePassword,
            child: Text(l10n.forgotPin)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    return PinEntryScaffold(
      employeeId: widget.employeeId,
      employeeLabel: l10n.employeeId,
      title: l10n.pinLoginTitle,
      subtitle: l10n.pinLoginSubtitle,
      enteredLength: _pin.length,
      hasError: _error != null,
      loading: _loading,
      dotsSemanticLabel: l10n.pinDotsEntered(_pin.length),
      deleteSemanticLabel: l10n.deletePinDigit,
      onDigit: _append,
      onDelete: _delete,
      footer: _footer(context),
    );
  }
}
