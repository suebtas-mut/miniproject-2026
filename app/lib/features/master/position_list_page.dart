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

class PositionListPage extends ConsumerStatefulWidget {
  const PositionListPage({super.key});

  @override
  ConsumerState<PositionListPage> createState() => _PositionListPageState();
}

class _PositionListPageState extends ConsumerState<PositionListPage> {
  static const int _pageSize = 10;
  int _page = 1;

  Future<void> _create() async {
    final saved = await PositionFormDialog.show(context);
    if (saved == true && mounted) {
      setState(() => _page = 1);
      refreshDepartmentOptions(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกตำแหน่งแล้ว')),
      );
    }
  }

  Future<void> _edit(JobPosition position) async {
    final saved = await PositionFormDialog.show(context, position: position);
    if (saved == true && mounted) {
      refreshDepartmentOptions(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกตำแหน่งแล้ว')),
      );
    }
  }

  Future<void> _deactivate(JobPosition position) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ปิดใช้งานตำแหน่ง'),
        content: Text(
          'ต้องการปิดใช้งานตำแหน่ง "${position.positionName}" ใช่หรือไม่?',
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
          .deactivatePosition(position.positionId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(describeFailure(e))),
      );
      return;
    }
    if (!mounted) return;
    ref.invalidate(positionsProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ปิดใช้งานตำแหน่งแล้ว')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final positions = ref.watch(positionsProvider);
    final departments = ref.watch(departmentsProvider);
    // T-023 — ซ่อนปุ่ม/รายการที่ผู้ใช้ไม่มีสิทธิ์ POS.EDIT
    final canEdit = ref
        .watch(authControllerProvider.select((state) => state.can('POS.EDIT')));
    String? departmentName(int? deptId) {
      final items = departments.valueOrNull ?? const <Department>[];
      for (final department in items) {
        if (department.deptId == deptId) return department.deptName;
      }
      return null;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'ตำแหน่งทั้งหมด',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (canEdit)
                FilledButton.icon(
                  key: const Key('position-create'),
                  onPressed: _create,
                  icon: const Icon(Icons.add),
                  label: const Text('เพิ่มตำแหน่ง'),
                ),
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<List<JobPosition>>(
            value: positions,
            onRetry: () => ref.invalidate(positionsProvider),
            builder: (items) {
              if (items.isEmpty) {
                return const EmptyState(message: 'ยังไม่มีตำแหน่งในระบบ');
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
                        final position = slice[index];
                        return ListTile(
                          key: Key('position-${position.positionId}'),
                          leading: const Icon(Icons.work_outline),
                          title: Text(position.positionName),
                          subtitle: Text(
                            departmentName(position.deptId) ?? 'ไม่ระบุแผนก',
                          ),
                          trailing: canEdit
                              ? Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      tooltip: 'แก้ไข',
                                      icon: const Icon(Icons.edit_outlined),
                                      onPressed: () => _edit(position),
                                    ),
                                    IconButton(
                                      tooltip: 'ปิดใช้งาน',
                                      icon: const Icon(Icons.delete_outline),
                                      onPressed: () => _deactivate(position),
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
                    unit: 'ตำแหน่ง',
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

class PositionFormDialog extends ConsumerStatefulWidget {
  const PositionFormDialog({super.key, this.position});

  final JobPosition? position;

  static Future<bool?> show(BuildContext context, {JobPosition? position}) {
    return showDialog<bool>(
      context: context,
      builder: (context) => PositionFormDialog(position: position),
    );
  }

  @override
  ConsumerState<PositionFormDialog> createState() => _PositionFormDialogState();
}

class _PositionFormDialogState extends ConsumerState<PositionFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  int? _deptId;
  bool _saving = false;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = widget.position?.positionName ?? '';
    _deptId = widget.position?.deptId;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_deptId == null) {
      setState(() => _saveError = 'กรุณาเลือกแผนกก่อนบันทึก');
      return;
    }
    setState(() {
      _saving = true;
      _saveError = null;
    });
    final repository = ref.read(masterRepositoryProvider);
    final name = _nameCtrl.text.trim();
    try {
      if (widget.position == null) {
        await repository.createPosition(
          positionName: name,
          deptId: _deptId!,
        );
      } else {
        await repository.updatePosition(
          widget.position!.positionId,
          positionName: name,
          deptId: _deptId!,
        );
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
    final departments = ref.watch(departmentsProvider);
    return AlertDialog(
      title: Text(widget.position == null ? 'เพิ่มตำแหน่ง' : 'แก้ไขตำแหน่ง'),
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
                    key: const Key('position-save-error'),
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
                  decoration: const InputDecoration(labelText: 'ชื่อตำแหน่ง *'),
                  maxLength: 100,
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'กรุณากรอกชื่อตำแหน่ง';
                    if (text.length > 100) return 'ต้องไม่เกิน 100 ตัวอักษร';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                departments.when(
                  data: (items) => DropdownButtonFormField<int>(
                    initialValue: _deptId,
                    decoration: const InputDecoration(labelText: 'แผนก *'),
                    items: [
                      for (final department in items)
                        DropdownMenuItem(
                          value: department.deptId,
                          child: Text(department.deptName),
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
