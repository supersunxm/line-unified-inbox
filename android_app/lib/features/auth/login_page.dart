import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.auth, required this.onLoggedIn, required this.onRegister});
  final AuthRepository auth;
  final VoidCallback onLoggedIn;
  final VoidCallback onRegister;
  @override State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    try { await widget.auth.login(_email.text, _password.text); widget.onLoggedIn(); }
    on ApiException catch (error) {
      setState(() => _error = switch (error.code) { 'ACCOUNT_PENDING_APPROVAL' => 'Your account is waiting for administrator approval.', 'ACCOUNT_REJECTED' => 'This account was rejected. Please contact an administrator.', 'INVALID_CREDENTIALS' => 'Invalid email or password.', _ => error.message });
    } catch (_) { setState(() => _error = 'Unable to sign in. Please try again.'); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  @override void dispose() { _email.dispose(); _password.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Padding(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Spacer(), const Icon(Icons.support_agent, size: 72), const SizedBox(height: 24), Text('LINE OA Chat Hub', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center), const SizedBox(height: 8), const Text('Sign in with your approved account.', textAlign: TextAlign.center), const SizedBox(height: 24), TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())), const SizedBox(height: 12), TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder())), if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))), const SizedBox(height: 16), FilledButton(onPressed: _loading ? null : _submit, child: _loading ? const CircularProgressIndicator() : const Text('Sign in')), TextButton(onPressed: _loading ? null : widget.onRegister, child: const Text('Create BM account')), const Spacer()]))));
}
