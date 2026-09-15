import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/localization/localization.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_spacing.dart';
import 'pin_entry_widgets.dart';

class PinSetupPage extends StatefulWidget {
  const PinSetupPage({
    super.key,
    required this.submit,
    required this.onCompleted,
    this.employeeId,
    this.allowLater = false,
    this.onLater,
    this.onEnrollmentRecorded,
  });

  final Future<void> Function(String pin, String confirmationPin) submit;
  final Future<void> Function() onCompleted;
  final String? employeeId;
  final bool allowLater;
  final VoidCallback? onLater;
  final Future<void> Function(String employeeId)? onEnrollmentRecorded;

  @override
  State<PinSetupPage> createState() => _PinSetupPageState();
}

enum _PinSetupStage { first, confirmation }

class _PinSetupPageState extends State<PinSetupPage> {
  _PinSetupStage _stage = _PinSetupStage.first;
  String _pin = '';
  String _firstPin = '';
  String? _error;
  bool _loading = false;

  void _append(String digit) {
    if (_loading || _pin.length >= 6) return;
    final next = '$_pin$digit';
    setState(() => _pin = next);
    if (next.length != 6) return;
    if (_stage == _PinSetupStage.first) {
      setState(() {
        _firstPin = next;
        _pin = '';
        _stage = _PinSetupStage.confirmation;
        _error = null;
      });
    } else {
      unawaited(_confirm(next));
    }
  }

  void _delete() {
    if (_loading || _pin.isEmpty) return;
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _error = null;
    });
  }

  Future<void> _confirm(String confirmationPin) async {
    if (confirmationPin != _firstPin) {
      setState(() {
        _pin = '';
        _error = appLocalizations(context).pinMismatch;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.submit(_firstPin, confirmationPin);
      if (widget.employeeId != null) {
        try {
          await widget.onEnrollmentRecorded?.call(widget.employeeId!);
        } catch (_) {
          // Local routing metadata must never block a successful enrollment.
        }
      }
      await widget.onCompleted();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code == 'PIN_MISMATCH'
            ? appLocalizations(context).pinMismatch
            : error.message);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = appLocalizations(context).pinUnableToSave);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Widget _footer(BuildContext context) {
    final l10n = appLocalizations(context);
    return Column(
      children: [
        Text(
          _stage == _PinSetupStage.first
              ? l10n.pinSetupStepOne
              : l10n.pinSetupStepTwo,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(_error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
              textAlign: TextAlign.center),
        ],
        if (_stage == _PinSetupStage.first &&
            widget.allowLater &&
            widget.onLater != null)
          TextButton(
              onPressed: _loading ? null : widget.onLater,
              child: Text(l10n.pinSetupLater)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    final confirmation = _stage == _PinSetupStage.confirmation;
    return PinEntryScaffold(
      employeeId: widget.employeeId,
      employeeLabel: l10n.employeeId,
      title: confirmation ? l10n.pinConfirmTitle : l10n.pinSetupTitle,
      subtitle: confirmation ? l10n.pinConfirmSubtitle : l10n.pinSetupSubtitle,
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
