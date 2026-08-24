import 'package:flutter/material.dart';

import '../../core/localization/localization.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class RegistrationPage extends StatefulWidget {
  const RegistrationPage({
    super.key,
    required this.auth,
    required this.onSubmitted,
    required this.onBack,
  });

  final AuthRepository auth;
  final VoidCallback onSubmitted;
  final VoidCallback onBack;

  @override
  State<RegistrationPage> createState() => _RegistrationPageState();
}

class _RegistrationPageState extends State<RegistrationPage> {
  final _name = TextEditingController();
  final _employeeId = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  List<Store> _stores = const [];
  String? _storeId;
  String _role = 'STAFF';
  bool _loading = true;
  String? _error;

  bool get _isHq => _role == 'HQ';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadStores();
    });
  }

  Future<void> _loadStores() async {
    final localizations = appLocalizations(context);
    try {
      _stores = await widget.auth.stores();
    } on ApiException catch (error) {
      _error = switch (error.code) {
        'CONFIGURATION_ERROR' => error.message,
        'NETWORK_ERROR' => localizations.cannotReachBackend,
        _ =>
          'Backend store request failed (${error.statusCode}): ${error.message}'
      };
    } catch (_) {
      _error = localizations.unexpectedStoreError;
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submit() async {
    final localizations = appLocalizations(context);
    if (_password.text != _confirm.text) {
      setState(() => _error = localizations.passwordsDoNotMatch);
      return;
    }
    if (_employeeId.text.trim().isEmpty) {
      setState(() => _error = localizations.employeeIdRequired);
      return;
    }
    if (!_isHq && _storeId == null) {
      setState(() => _error = localizations.selectStore);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_isHq) {
        await widget.auth.registerHq(
          name: _name.text,
          employeeId: _employeeId.text,
          email: _email.text,
          password: _password.text,
        );
      } else {
        await widget.auth.register(
          name: _name.text,
          employeeId: _employeeId.text,
          email: _email.text,
          storeId: _storeId!,
          role: _role,
          password: _password.text,
        );
      }
      widget.onSubmitted();
    } on ApiException catch (error) {
      setState(() => _error = error.code == 'DUPLICATE_EMPLOYEE_ID'
          ? localizations.employeeIdAlreadyRegistered
          : error.message);
    } catch (_) {
      setState(() => _error = localizations.unableToSubmitRegistration);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _employeeId.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    if (_loading && _stores.isEmpty) {
      return Scaffold(
          appBar: AppBar(title: const Text('Create account')),
          body: const Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create account'),
        leading: IconButton(
            onPressed: widget.onBack,
            tooltip: l10n.back,
            icon: const Icon(Icons.arrow_back)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(
              controller: _name,
              decoration: InputDecoration(
                  labelText: l10n.name, border: const OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(
              controller: _employeeId,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                  labelText: l10n.employeeId,
                  border: const OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                  labelText: l10n.email, border: const OutlineInputBorder())),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: _role,
            decoration: InputDecoration(
                labelText: l10n.role, border: const OutlineInputBorder()),
            items: [
              DropdownMenuItem(value: 'STAFF', child: Text(l10n.staff)),
              DropdownMenuItem(
                  value: 'STORE_MANAGER', child: Text(l10n.storeManager)),
              const DropdownMenuItem(
                  value: 'HQ', child: Text('HQ / Head Office — Full access')),
            ],
            onChanged: (value) => setState(() => _role = value ?? 'STAFF'),
          ),
          const SizedBox(height: 12),
          if (!_isHq)
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _storeId,
              decoration: InputDecoration(
                  labelText: l10n.store, border: const OutlineInputBorder()),
              items: _stores
                  .map((store) => DropdownMenuItem(
                      value: store.id, child: Text(store.name)))
                  .toList(),
              onChanged: (value) => setState(() => _storeId = value),
            )
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'HQ accounts are not attached to a store. After approval they receive Web + Mobile access, HQ workspace, all stores, account management, reply, and Main OA permissions.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ),
          const SizedBox(height: 12),
          TextField(
              controller: _password,
              obscureText: true,
              decoration: InputDecoration(
                  labelText: l10n.passwordRequirement,
                  border: const OutlineInputBorder())),
          const SizedBox(height: 8),
          Text(
            '${l10n.passwordConditionsTitle}\n\n${l10n.passwordConditions}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          TextField(
              controller: _confirm,
              obscureText: true,
              decoration: InputDecoration(
                  labelText: l10n.confirmPassword,
                  border: const OutlineInputBorder())),
          if (_error != null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child:
                    Text(_error!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 16),
          FilledButton(
              onPressed: _loading ? null : _submit,
              child: Text(l10n.submitRegistration)),
        ],
      ),
    );
  }
}
