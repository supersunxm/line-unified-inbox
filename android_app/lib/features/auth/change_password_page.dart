import 'package:flutter/material.dart';

import '../../core/localization/localization.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({
    super.key,
    required this.auth,
    required this.onChanged,
    required this.onLogout,
  });

  final AuthRepository auth;
  final Future<void> Function() onChanged;
  final VoidCallback onLogout;

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmation = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  _ChangePasswordCopy get _copy {
    switch (Localizations.localeOf(context).languageCode) {
      case 'th':
        return const _ChangePasswordCopy(
          title: 'เปลี่ยนรหัสผ่าน',
          description: 'เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ',
          currentPassword: 'รหัสผ่านปัจจุบัน',
          newPassword: 'รหัสผ่านใหม่',
          confirmPassword: 'ยืนยันรหัสผ่านใหม่',
          save: 'บันทึกรหัสผ่าน',
          invalidCurrentPassword: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
          invalidNewPassword: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 12 ตัวอักษร',
          error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้',
          logout: 'ออกจากระบบ',
        );
      case 'zh':
        return const _ChangePasswordCopy(
          title: '修改密码',
          description: '为确保安全，请先设置新密码后再使用系统。',
          currentPassword: '当前密码',
          newPassword: '新密码',
          confirmPassword: '确认新密码',
          save: '保存密码',
          invalidCurrentPassword: '当前密码不正确',
          invalidNewPassword: '新密码至少需要 12 个字符',
          error: '无法修改密码',
          logout: '退出登录',
        );
      default:
        return const _ChangePasswordCopy(
          title: 'Change password',
          description:
              'For your security, please set a new password before using the system.',
          currentPassword: 'Current password',
          newPassword: 'New password',
          confirmPassword: 'Confirm new password',
          save: 'Save password',
          invalidCurrentPassword: 'The current password is incorrect.',
          invalidNewPassword:
              'The new password must be at least 12 characters.',
          error: 'Unable to change password.',
          logout: 'Sign out',
        );
    }
  }

  Future<void> _submit() async {
    final copy = _copy;
    final localizations = appLocalizations(context);
    final current = _currentPassword.text;
    final next = _newPassword.text;
    if (current.isEmpty) {
      setState(() => _error = copy.invalidCurrentPassword);
      return;
    }
    if (next.length < 12) {
      setState(() => _error = copy.invalidNewPassword);
      return;
    }
    if (next != _confirmation.text) {
      setState(() => _error = localizations.passwordsDoNotMatch);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.auth.changePassword(current, next);
      await widget.onChanged();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.code == 'INVALID_CREDENTIALS'
          ? copy.invalidCurrentPassword
          : error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = copy.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  InputDecoration _decoration(String label) =>
      InputDecoration(labelText: label, border: const OutlineInputBorder());

  @override
  Widget build(BuildContext context) {
    final copy = _copy;
    final localizations = appLocalizations(context);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 28),
              const Icon(Icons.lock_reset, size: 64),
              const SizedBox(height: 20),
              Text(
                copy.title,
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(copy.description, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              TextField(
                controller: _currentPassword,
                obscureText: true,
                enabled: !_loading,
                decoration: _decoration(copy.currentPassword),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _newPassword,
                obscureText: true,
                enabled: !_loading,
                decoration: _decoration(copy.newPassword),
              ),
              const SizedBox(height: 8),
              Text(
                '${localizations.passwordConditionsTitle}\n\n${localizations.passwordConditions}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirmation,
                obscureText: true,
                enabled: !_loading,
                decoration: _decoration(copy.confirmPassword),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(copy.save),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _loading ? null : widget.onLogout,
                child: Text(copy.logout),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChangePasswordCopy {
  const _ChangePasswordCopy({
    required this.title,
    required this.description,
    required this.currentPassword,
    required this.newPassword,
    required this.confirmPassword,
    required this.save,
    required this.invalidCurrentPassword,
    required this.invalidNewPassword,
    required this.error,
    required this.logout,
  });

  final String title;
  final String description;
  final String currentPassword;
  final String newPassword;
  final String confirmPassword;
  final String save;
  final String invalidCurrentPassword;
  final String invalidNewPassword;
  final String error;
  final String logout;
}
