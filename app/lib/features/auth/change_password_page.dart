import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_controller.dart';

class ChangePasswordPage extends ConsumerStatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  ConsumerState<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends ConsumerState<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _oldCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _oldCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final error =
        await ref.read(authControllerProvider.notifier).changePassword(
              oldPassword: _oldCtrl.text,
              newPassword: _newCtrl.text,
            );
    if (!mounted) return;
    setState(() {
      _loading = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('เปลี่ยนรหัสผ่าน'),
        leading: BackButton(
          onPressed: () => context.canPop() ? context.pop() : context.go('/'),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.lock_reset,
                      size: 56, color: theme.colorScheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    'เปลี่ยนรหัสผ่าน',
                    style: theme.textTheme.titleLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร '
                    'เมื่อบันทึกสำเร็จจะต้องเข้าสู่ระบบใหม่',
                    style: theme.textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  if (_error != null) ...[
                    Container(
                      key: const Key('change-password-error'),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: theme.colorScheme.onErrorContainer,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextFormField(
                    controller: _oldCtrl,
                    obscureText: _obscure,
                    decoration: const InputDecoration(
                      labelText: 'รหัสผ่านเดิม',
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                    validator: (v) => (v == null || v.isEmpty)
                        ? 'กรุณากรอกรหัสผ่านเดิม'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _newCtrl,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'รหัสผ่านใหม่',
                      prefixIcon: const Icon(Icons.password),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) {
                        return 'กรุณากรอกรหัสผ่านใหม่';
                      }
                      if (v.length < 8) {
                        return 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _confirmCtrl,
                    obscureText: _obscure,
                    decoration: const InputDecoration(
                      labelText: 'ยืนยันรหัสผ่านใหม่',
                      prefixIcon: Icon(Icons.password_outlined),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) {
                        return 'กรุณายืนยันรหัสผ่านใหม่';
                      }
                      if (v != _newCtrl.text) {
                        return 'รหัสผ่านใหม่ไม่ตรงกัน';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('บันทึกรหัสผ่านใหม่'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
