import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import 'master_models.dart';
import 'master_providers.dart';
import 'widgets/list_states.dart';

class EmployeeFormDialog extends ConsumerStatefulWidget {
  const EmployeeFormDialog({super.key, this.employee});

  final Employee? employee;

  static Future<bool?> show(BuildContext context, {Employee? employee}) {
    return showDialog<bool>(
      context: context,
      builder: (context) => EmployeeFormDialog(employee: employee),
    );
  }

  @override
  ConsumerState<EmployeeFormDialog> createState() => _EmployeeFormDialogState();
}

class _EmployeeFormDialogState extends ConsumerState<EmployeeFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _empCodeCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  int? _deptId;
  int? _positionId;
  final Set<int> _roleIds = <int>{};
  bool _roleIdsSeeded = false;
  String? _roleError;
  bool _saving = false;
  String? _saveError;

  bool get _isEdit => widget.employee != null;

  @override
  void initState() {
    super.initState();
    final employee = widget.employee;
    if (employee != null) {
      _empCodeCtrl.text = employee.empCode;
      _firstNameCtrl.text = employee.firstName;
      _lastNameCtrl.text = employee.lastName;
      _phoneCtrl.text = employee.phone ?? '';
      _emailCtrl.text = employee.email ?? '';
      _usernameCtrl.text = employee.username;
      _deptId = employee.deptId;
      _positionId = employee.positionId;
    }
  }

  @override
  void dispose() {
    _empCodeCtrl.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final rolesValue = ref.read(rolesProvider);
    final roles = rolesValue.valueOrNull ?? const <Role>[];
    setState(() {
      _roleError = _roleIds.isEmpty ? 'กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท' : null;
      _saveError = null;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_deptId == null || _positionId == null) {
      setState(() => _saveError = 'กรุณาเลือกแผนกและตำแหน่งก่อนบันทึก');
      return;
    }
    if (_roleIds.isEmpty) return;

    setState(() => _saving = true);
    final repository = ref.read(masterRepositoryProvider);
    final password = _passwordCtrl.text;
    final roleIds = _roleIds.toList()..sort();
    final employee = widget.employee;
    try {
      if (employee == null) {
        await repository.createEmployee({
          'empCode': _empCodeCtrl.text.trim(),
          'firstName': _firstNameCtrl.text.trim(),
          'lastName': _lastNameCtrl.text.trim(),
          'phone':
              _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
          'email':
              _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
          'deptId': _deptId,
          'positionId': _positionId,
          'username': _usernameCtrl.text.trim(),
          'password': password,
          'roleIds': roleIds,
        });
      } else {
        final initialRoleIds = {
          for (final role in roles)
            if (employee.roles.contains(role.roleName)) role.roleId,
        };
        final rolesChanged =
            roleIds.join(',') != (initialRoleIds.toList()..sort()).join(',');
        await repository.updateEmployee(employee.empId, {
          'firstName': _firstNameCtrl.text.trim(),
          'lastName': _lastNameCtrl.text.trim(),
          'phone':
              _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
          'email':
              _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
          'deptId': _deptId,
          'positionId': _positionId,
          'username': _usernameCtrl.text.trim(),
          if (password.isNotEmpty) 'password': password,
          if (rolesChanged) 'roleIds': roleIds,
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saveError = describeFailure(e);
      });
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  String? _required(String? value, String message, {int? maxLength}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return message;
    if (maxLength != null && text.length > maxLength) {
      return 'ต้องไม่เกิน $maxLength ตัวอักษร';
    }
    return null;
  }

  String? _validateEmail(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    if (text.length > 120) return 'ต้องไม่เกิน 120 ตัวอักษร';
    if (!RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$').hasMatch(text)) {
      return 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    return null;
  }

  String? _validatePhone(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    if (text.length > 20) return 'ต้องไม่เกิน 20 ตัวอักษร';
    return null;
  }

  String? _validatePassword(String? value) {
    final text = value ?? '';
    if (text.isEmpty) {
      return _isEdit ? null : 'กรุณากรอกรหัสผ่าน';
    }
    if (text.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    return null;
  }

  void _seedRoleIds(List<Role> roles) {
    if (_roleIdsSeeded) return;
    _roleIdsSeeded = true;
    final employee = widget.employee;
    if (employee == null) return;
    _roleIds.addAll({
      for (final role in roles)
        if (employee.roles.contains(role.roleName)) role.roleId,
    });
  }

  @override
  Widget build(BuildContext context) {
    final departments = ref.watch(departmentsProvider);
    final positions = ref.watch(positionsProvider);
    final roles = ref.watch(rolesProvider);
    final theme = Theme.of(context);
    final rolesData = roles.valueOrNull;
    if (rolesData != null) _seedRoleIds(rolesData);

    return AlertDialog(
      title: Text(_isEdit ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_saveError != null) ...[
                  Container(
                    key: const Key('employee-save-error'),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _saveError!,
                      style:
                          TextStyle(color: theme.colorScheme.onErrorContainer),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _empCodeCtrl,
                  enabled: !_isEdit,
                  decoration: const InputDecoration(labelText: 'รหัสพนักงาน *'),
                  maxLength: 20,
                  validator: (v) =>
                      _required(v, 'กรุณากรอกรหัสพนักงาน', maxLength: 20),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _firstNameCtrl,
                  decoration: const InputDecoration(labelText: 'ชื่อ *'),
                  validator: (v) =>
                      _required(v, 'กรุณากรอกชื่อ', maxLength: 50),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _lastNameCtrl,
                  decoration: const InputDecoration(labelText: 'นามสกุล *'),
                  validator: (v) =>
                      _required(v, 'กรุณากรอกนามสกุล', maxLength: 50),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phoneCtrl,
                  decoration: const InputDecoration(labelText: 'เบอร์โทร'),
                  keyboardType: TextInputType.phone,
                  validator: _validatePhone,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(labelText: 'อีเมล'),
                  keyboardType: TextInputType.emailAddress,
                  validator: _validateEmail,
                ),
                const SizedBox(height: 12),
                departments.when(
                  data: (items) => DropdownButtonFormField<int>(
                    initialValue: _deptId,
                    decoration: const InputDecoration(labelText: 'แผนก *'),
                    items: [
                      for (final dept in items)
                        DropdownMenuItem(
                          value: dept.deptId,
                          child: Text(dept.deptName),
                        ),
                    ],
                    onChanged: (value) => setState(() => _deptId = value),
                    validator: (value) =>
                        value == null ? 'กรุณาเลือกแผนก' : null,
                  ),
                  error: (error, stackTrace) => const InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'แผนก *',
                      errorText: 'โหลดรายชื่อแผนกไม่สำเร็จ',
                    ),
                    child: SizedBox.shrink(),
                  ),
                  loading: () => const LinearProgressIndicator(),
                ),
                const SizedBox(height: 12),
                positions.when(
                  data: (items) => DropdownButtonFormField<int>(
                    initialValue: _positionId,
                    decoration: const InputDecoration(labelText: 'ตำแหน่ง *'),
                    items: [
                      for (final position in items)
                        DropdownMenuItem(
                          value: position.positionId,
                          child: Text(position.positionName),
                        ),
                    ],
                    onChanged: (value) => setState(() => _positionId = value),
                    validator: (value) =>
                        value == null ? 'กรุณาเลือกตำแหน่ง' : null,
                  ),
                  error: (error, stackTrace) => const InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'ตำแหน่ง *',
                      errorText: 'โหลดรายชื่อตำแหน่งไม่สำเร็จ',
                    ),
                    child: SizedBox.shrink(),
                  ),
                  loading: () => const LinearProgressIndicator(),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _usernameCtrl,
                  decoration: const InputDecoration(labelText: 'ชื่อผู้ใช้ *'),
                  validator: (v) =>
                      _required(v, 'กรุณากรอกชื่อผู้ใช้', maxLength: 50),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: _isEdit ? 'รหัสผ่านใหม่' : 'รหัสผ่าน *',
                    helperText:
                        _isEdit ? 'เว้นว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน' : null,
                  ),
                  validator: _validatePassword,
                ),
                const SizedBox(height: 16),
                Text('บทบาท *', style: theme.textTheme.labelLarge),
                const SizedBox(height: 8),
                AsyncSection<List<Role>>(
                  value: roles,
                  onRetry: () => ref.invalidate(rolesProvider),
                  builder: (items) => Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      for (final role in items.where((r) => r.isActive == 1))
                        FilterChip(
                          label: Text(role.roleName),
                          selected: _roleIds.contains(role.roleId),
                          onSelected: (selected) => setState(() {
                            if (selected) {
                              _roleIds.add(role.roleId);
                            } else {
                              _roleIds.remove(role.roleId);
                            }
                            _roleError = null;
                          }),
                        ),
                    ],
                  ),
                ),
                if (_roleError != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _roleError!,
                    key: const Key('employee-role-error'),
                    style: TextStyle(
                      color: theme.colorScheme.error,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('ยกเลิก'),
        ),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: _saving
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('บันทึก'),
        ),
      ],
    );
  }
}
