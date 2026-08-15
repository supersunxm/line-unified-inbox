import 'package:flutter/material.dart';
import '../../core/localization/localization.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class OtpPage extends StatefulWidget {
  const OtpPage(
      {super.key,
      required this.auth,
      required this.phone,
      required this.challenge,
      required this.onVerified});
  final AuthRepository auth;
  final String phone;
  final OtpChallenge challenge;
  final VoidCallback onVerified;
  @override
  State<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends State<OtpPage> {
  final _otp = TextEditingController();
  bool _loading = false;
  String? _error;
  Future<void> _verify() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.auth.verifyOtp(widget.challenge.id, _otp.text);
      widget.onVerified();
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } catch (_) {
      setState(() => _error = 'Please request a new OTP and try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(appLocalizations(context).verifyOtp)),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(appLocalizations(context).codeSentTo(widget.phone)),
            const SizedBox(height: 20),
            TextField(
                controller: _otp,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: InputDecoration(
                    labelText: appLocalizations(context).sixDigitOtp,
                    border: const OutlineInputBorder())),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 16),
            FilledButton(
                onPressed: _loading ? null : _verify,
                child: Text(appLocalizations(context).verify)),
          ]),
        ),
      );
}
