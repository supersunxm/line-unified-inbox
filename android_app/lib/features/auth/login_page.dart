import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';
import '../../core/localization/localization.dart';
import 'auth_repository.dart';

class LoginPage extends StatefulWidget {
  const LoginPage(
      {super.key,
      required this.auth,
      required this.onLoggedIn,
      required this.onRegister});
  final AuthRepository auth;
  final VoidCallback onLoggedIn;
  final VoidCallback onRegister;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    final localizations = appLocalizations(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.auth.login(_email.text, _password.text);
      widget.onLoggedIn();
    } on ApiException catch (error) {
      setState(() => _error = switch (error.code) {
            'ACCOUNT_PENDING_APPROVAL' => localizations.accountPendingMessage,
            'ACCOUNT_REJECTED' => localizations.accountRejectedMessage,
            'INVALID_CREDENTIALS' => localizations.invalidCredentials,
            _ => error.message
          });
    } catch (_) {
      setState(() => _error = localizations.unableToSignIn);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = appLocalizations(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Icon(Icons.support_agent, size: 72),
              const SizedBox(height: 24),
              Text(localizations.appName,
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(localizations.signInApproved, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                      labelText: localizations.email,
                      border: const OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: InputDecoration(
                      labelText: localizations.password,
                      border: const OutlineInputBorder())),
              if (_error != null)
                Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(_error!,
                        style: const TextStyle(color: Colors.red))),
              const SizedBox(height: 16),
              FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const CircularProgressIndicator()
                      : Text(localizations.login)),
              TextButton(
                  onPressed: _loading ? null : widget.onRegister,
                  child: Text(localizations.createBmAccount)),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
