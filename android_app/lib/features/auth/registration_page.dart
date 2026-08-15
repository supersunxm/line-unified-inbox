import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class RegistrationPage extends StatefulWidget {
  const RegistrationPage({super.key, required this.auth, required this.onSubmitted, required this.onBack});
  final AuthRepository auth;
  final VoidCallback onSubmitted;
  final VoidCallback onBack;
  @override State<RegistrationPage> createState() => _RegistrationPageState();
}

class _RegistrationPageState extends State<RegistrationPage> {
  final _name = TextEditingController(), _employeeId = TextEditingController(), _email = TextEditingController(), _password = TextEditingController(), _confirm = TextEditingController();
  List<Store> _stores = const []; String? _storeId; String _role = 'STAFF'; bool _loading = true; String? _error;
  @override void initState() { super.initState(); _loadStores(); }
  Future<void> _loadStores() async { try { _stores = await widget.auth.stores(); } on ApiException catch (error) { _error = switch (error.code) { 'CONFIGURATION_ERROR' => error.message, 'NETWORK_ERROR' => 'Cannot reach the backend. Check the API URL and network connection.', _ => 'Backend store request failed (${error.statusCode}): ${error.message}' }; } catch (_) { _error = 'Unexpected error while loading stores.'; } if (mounted) setState(() => _loading = false); }
  Future<void> _submit() async {
    if (_password.text != _confirm.text) { setState(() => _error = 'Passwords do not match.'); return; }
    if (_employeeId.text.trim().isEmpty) { setState(() => _error = 'Employee ID is required.'); return; }
    if (_storeId == null) { setState(() => _error = 'Select a store.'); return; }
    setState(() { _loading = true; _error = null; });
      try { await widget.auth.register(name: _name.text, employeeId: _employeeId.text, email: _email.text, storeId: _storeId!, role: _role, password: _password.text); widget.onSubmitted(); }
    on ApiException catch (error) { setState(() => _error = error.message); }
    catch (_) { setState(() => _error = 'Unable to submit registration.'); }
    finally { if (mounted) setState(() => _loading = false); }
  }
  @override void dispose() { _name.dispose(); _employeeId.dispose(); _email.dispose(); _password.dispose(); _confirm.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Create BM account'), leading: IconButton(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back))), body: _loading && _stores.isEmpty ? const Center(child: CircularProgressIndicator()) : ListView(padding: const EdgeInsets.all(24), children: [TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder())), const SizedBox(height: 12), TextField(controller: _employeeId, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Employee ID', border: OutlineInputBorder())), const SizedBox(height: 12), TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())), const SizedBox(height: 12), DropdownButtonFormField<String>(isExpanded: true, initialValue: _storeId, decoration: const InputDecoration(labelText: 'Store', border: OutlineInputBorder()), items: _stores.map((store) => DropdownMenuItem(value: store.id, child: Text(store.name))).toList(), onChanged: (value) => setState(() => _storeId = value)), const SizedBox(height: 12), DropdownButtonFormField<String>(isExpanded: true, initialValue: _role, decoration: const InputDecoration(labelText: 'Role', border: OutlineInputBorder()), items: const [DropdownMenuItem(value: 'STAFF', child: Text('Staff')), DropdownMenuItem(value: 'STORE_MANAGER', child: Text('Store manager'))], onChanged: (value) => setState(() => _role = value ?? 'STAFF')), const SizedBox(height: 12), TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password (12+ characters)', border: OutlineInputBorder())), const SizedBox(height: 12), TextField(controller: _confirm, obscureText: true, decoration: const InputDecoration(labelText: 'Confirm password', border: OutlineInputBorder())), if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))), const SizedBox(height: 16), FilledButton(onPressed: _loading ? null : _submit, child: const Text('Submit registration'))]));
}
