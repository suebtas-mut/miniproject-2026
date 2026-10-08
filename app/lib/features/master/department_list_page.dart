import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import 'master_models.dart';
import 'master_providers.dart';
import 'widgets/list_states.dart';

class DepartmentListPage extends ConsumerStatefulWidget {
  const DepartmentListPage({super.key});

  @override
  ConsumerState<DepartmentListPage> createState() => _DepartmentListPageState();
}

class _DepartmentListPageState extends ConsumerState<DepartmentListPage> {
  static const int _pageSize = 10;
  int _page = 1;

  Future<void> _create() async {
    final saved = await DepartmentFormDialog.show(context);
    if (saved == true && mounted) {
      setState(() => _page = 1);
      refreshDepartmentOptions(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกแผนกแล้ว')),
      );
    }
  }

  Future<void> _edit(Department department) async {
    final saved =
        await DepartmentFormDialog.show(context, department: department);
    if (saved == true && mounted) {
      refreshDepartmentOptions(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกแผนกแล้ว')),
      );
    }
  }

  Future<void> _deactivate(Department department) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ปิดใช้งานแผนก'),
        content: Text(
          'ต้องการปิดใช้งานแผนก "${department.deptName}" ใช่หรือไม่? '
          'ต้องไม่มีพนักงานอยู่ในแผนกนี้แล้ว',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('ยกเลิก'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('ปิดใช้งาน'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref
          .read(masterRepositoryProvider)
          .deactivateDepartment(department.deptId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(describeFailure(e))),
      );
      return;
    }
    if (!mounted) return;
    ref.invalidate(departmentsProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ปิดใช้งานแผนกแล้ว')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final departments = ref.watch(departmentsProvider);
    // T-023 — ซ่อนปุ่ม/รายการที่ผู้ใช้ไม่มีสิทธิ์ DEPT.EDIT
    final canEdit = ref.watch(
        authControllerProvider.select((state) => state.can('DEPT.EDIT')));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'แผนกทั้งหมด',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (canEdit)
                FilledButton.icon(
                  key: const Key('department-create'),
                  onPressed: _create,
                  icon: const Icon(Icons.add),
                  label: const Text('เพิ่มแผนก'),
                ),
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<List<Department>>(
            value: departments,
            onRetry: () => ref.invalidate(departmentsProvider),
            builder: (items) {
              if (items.isEmpty) {
                return const EmptyState(message: 'ยังไม่มีแผนกในระบบ');
              }
              final totalPages = max(1, (items.length / _pageSize).ceil());
              final page = _page > totalPages ? totalPages : _page;
              final start = (page - 1) * _pageSize;
              final slice = items.sublist(
                start,
                min(start + _pageSize, items.length),
              );
              return Column(
                children: [
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: slice.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final department = slice[index];
                        return ListTile(
                          key: Key('department-${department.deptId}'),
                          leading: const Icon(Icons.business_outlined),
                          title: Text(department.deptName),
                          subtitle: department.createdAt == null
                              ? null
                              : Text('เพิ่มเมื่อ ${department.createdAt}'),
                          trailing: canEdit
                              ? Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      tooltip: 'แก้ไข',
                                      icon: const Icon(Icons.edit_outlined),
                                      onPressed: () => _edit(department),
                                    ),
                                    IconButton(
                                      tooltip: 'ปิดใช้งาน',
                                      icon: const Icon(Icons.delete_outline),
                                      onPressed: () => _deactivate(department),
                                    ),
                                  ],
                                )
                              : null,
                        );
                      },
                    ),
                  ),
                  PagerBar(
                    page: page,
                    totalPages: totalPages,
                    total: items.length,
                    unit: 'แผนก',
                    onPageChanged: (value) => setState(() => _page = value),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class DepartmentFormDialog extends ConsumerStatefulWidget {
  const DepartmentFormDialog({super.key, this.department});

  final Department? department;

  static Future<bool?> show(BuildContext context, {Department? department}) {
    return showDialog<bool>(
      context: context,
      builder: (context) => DepartmentFormDialog(department: department),
    );
  }

  @override
  ConsumerState<DepartmentFormDialog> createState() =>
      _DepartmentFormDialogState();
}

class _DepartmentFormDialogState extends ConsumerState<DepartmentFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  bool _saving = false;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = widget.department?.deptName ?? '';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    final repository = ref.read(masterRepositoryProvider);
    final name = _nameCtrl.text.trim();
    try {
      if (widget.department == null) {
        await repository.createDepartment(deptName: name);
      } else {
        await repository.updateDepartment(widget.department!.deptId,
            deptName: name);
      }
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saveError = describeFailure(e);
      });
      return;
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: Text(widget.department == null ? 'เพิ่มแผนก' : 'แก้ไขแผนก'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_saveError != null) ...[
                  Container(
                    key: const Key('department-save-error'),
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
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'ชื่อแผนก *'),
                  maxLength: 100,
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'กรุณากรอกชื่อแผนก';
                    if (text.length > 100) return 'ต้องไม่เกิน 100 ตัวอักษร';
                    return null;
                  },
                ),
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
