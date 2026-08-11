import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.auth, required this.onOtpRequested});
  final AuthRepository auth;
  final void Function(String phone, OtpChallenge challenge) onOtpRequested;
  @override State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _phone = TextEditingController();
  bool _loading = false;
  String? _error;
  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    try { final challenge = await widget.auth.sendOtp(_phone.text); widget.onOtpRequested(_phone.text, challenge); }
    on ApiException catch (error) { setState(() => _error = error.message); }
    catch (_) { setState(() => _error = 'Unable to request verification code'); }
    finally { if (mounted) setState(() => _loading = false); }
  }
  @override void dispose() { _phone.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Padding(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Spacer(), const Icon(Icons.support_agent, size: 72), const SizedBox(height: 24), Text('LINE OA Chat Hub', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center), const SizedBox(height: 8), const Text('Enter your Thai mobile number to receive a login code.', textAlign: TextAlign.center), const SizedBox(height: 24), TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile number', border: OutlineInputBorder())), if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))), const SizedBox(height: 16), FilledButton(onPressed: _loading ? null : _submit, child: _loading ? const CircularProgressIndicator() : const Text('Send OTP')), const Spacer()]))) ;
}
