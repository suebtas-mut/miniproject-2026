import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../../layout/adaptive_shell.dart' show kShellDestinations;
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import 'master_models.dart';
import 'master_providers.dart';
import 'widgets/list_states.dart';

/// T-023 / UC-09 — Permission Matrix (ตารางติ๊ก Role ↔ Permission)
///
/// - โหลดสิทธิ์ทั้ง 21 รายการจาก `GET /permissions` และบทบาทจาก `GET /roles`
/// - ติ๊กแล้วบันทึกด้วย `PUT /roles/{roleId}/permissions` (เขียนทั้งตารางของบทบาทนั้น)
/// - ไม่มีปุ่มเพิ่ม/แก้/ลบสิทธิ์ (UC-08 = Q24 ยังไม่มี endpoint — คงไว้ชัดเจนว่าใช้ไม่ได้)
/// - ต้องมีสิทธิ์ `ROLE.EDIT` — ไม่มีจึงซ่อนทั้งแท็บและหน้า
class PermissionMatrixPage extends ConsumerStatefulWidget {
  const PermissionMatrixPage({super.key});

  @override
  ConsumerState<PermissionMatrixPage> createState() =>
      _PermissionMatrixPageState();
}

class _PermissionMatrixPageState extends ConsumerState<PermissionMatrixPage> {
  int? _roleId;
  Set<int>? _checked;
  Set<int>? _baseline;
  bool _loadingRole = false;
  String? _roleLoadError;
  bool _saving = false;
  String? _saveError;
  bool _saved = false;

  bool get _dirty =>
      _roleId != null &&
      _checked != null &&
      _baseline != null &&
      !setEquals(_checked, _baseline);

  Future<void> _selectRole(int roleId) async {
    if (_saving || roleId == _roleId) return;
    setState(() {
      _roleId = roleId;
      _checked = null;
      _baseline = null;
      _loadingRole = true;
      _roleLoadError = null;
      _saveError = null;
      _saved = false;
    });
    try {
      final current =
          await ref.read(masterRepositoryProvider).fetchRolePermissions(roleId);
      if (!mounted || _roleId != roleId) return;
      setState(() {
        _checked = {...current.permIds};
        _baseline = {...current.permIds};
        _loadingRole = false;
      });
    } catch (e) {
      if (!mounted || _roleId != roleId) return;
      setState(() {
        _loadingRole = false;
        _roleLoadError = describeFailure(e);
      });
    }
  }

  void _toggle(Permission permission) {
    final checked = _checked;
    if (checked == null) return;
    final next = {...checked};
    if (!next.remove(permission.permId)) {
      next.add(permission.permId);
    }
    setState(() {
      _checked = next;
      _saveError = null;
      _saved = false;
    });
  }

  Future<void> _save() async {
    final roleId = _roleId;
    final checked = _checked;
    if (roleId == null || checked == null || !_dirty || _saving) return;
    setState(() {
      _saving = true;
      _saveError = null;
      _saved = false;
    });
    final permIds = checked.toList()..sort();
    try {
      await ref.read(masterRepositoryProvider).saveRolePermissions(
            roleId,
            permIds,
          );
      if (!mounted) return;
      // ผลของ PUT นี้เป็นของบทบาทที่สั่งตอนเริ่มเท่านั้น
      // — ถ้าสถานะถูกเปลี่ยนระหว่างรอ ห้ามเขียนทับ baseline ของบทบาทใหม่
      if (_roleId != roleId) {
        setState(() => _saving = false);
        return;
      }
      setState(() {
        _saving = false;
        _baseline = {...checked};
        _saved = true;
      });
      ref.invalidate(rolesProvider); // รีเฟรช permCount ใน dropdown/รายการบทบาท
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        if (_roleId == roleId) {
          _saveError = describeFailure(e);
        }
      });
    }
  }

  String _moduleLabel(String module) {
    for (final destination in kShellDestinations) {
      if (destination.path == '/$module') return destination.label;
    }
    return module;
  }

  @override
  Widget build(BuildContext context) {
    // ป้องกันซ้ำแม้จะถูกเรียกโดยตรง — ไม่มี ROLE.EDIT ดูหน้าไม่ได้
    final canEdit = ref.watch(
        authControllerProvider.select((state) => state.can('ROLE.EDIT')));
    if (!canEdit) {
      return const Center(
        child: Text(
          'ไม่มีสิทธิ์เข้าถึงส่วนนี้',
          key: Key('matrix-forbidden'),
        ),
      );
    }

    final theme = Theme.of(context);
    final roles = ref.watch(rolesProvider);
    final permissions = ref.watch(permissionsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Permission Matrix — ตารางติ๊กสิทธิ์',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'เลือกบทบาท ติ๊กสิทธิ์ที่อนุญาต แล้วกดบันทึก — '
                'ผู้ใช้ที่ล็อกอินอยู่ต้อง Login ใหม่เพื่อให้สิทธิ์ใหม่มีผล',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<List<Role>>(
            value: roles,
            onRetry: () => ref.invalidate(rolesProvider),
            builder: (roleItems) => AsyncSection<List<Permission>>(
              value: permissions,
              onRetry: () => ref.invalidate(permissionsProvider),
              builder: (permissionItems) => _buildBody(
                context,
                roleItems,
                permissionItems,
              ),
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_roleLoadError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      _roleLoadError!,
                      key: const Key('matrix-role-error'),
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
                if (_saveError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      _saveError!,
                      key: const Key('matrix-save-error'),
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
                if (_saved)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'บันทึกสิทธิ์แล้ว — ผู้ใช้ต้อง Login ใหม่ '
                      'เพื่อให้สิทธิ์ใหม่มีผล',
                      key: const Key('matrix-save-success'),
                      style: TextStyle(color: theme.colorScheme.primary),
                    ),
                  ),
                FilledButton(
                  key: const Key('matrix-save'),
                  onPressed: !_saving && _dirty ? _save : null,
                  child: _saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('บันทึกสิทธิ์'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBody(
    BuildContext context,
    List<Role> roleItems,
    List<Permission> permissionItems,
  ) {
    if (roleItems.isEmpty) {
      return const EmptyState(message: 'ยังไม่มีบทบาทในระบบ');
    }
    if (permissionItems.isEmpty) {
      return const EmptyState(message: 'ยังไม่มีสิทธิ์ในระบบ');
    }

    final modulesInOrder = <String>[
      ...kPermissionModules,
      ...{
        for (final permission in permissionItems) permission.module,
      }.where((module) => !kPermissionModules.contains(module)),
    ];

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        DropdownButtonFormField<int>(
          key: const Key('matrix-role'),
          initialValue: _roleId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'บทบาท (Role) *'),
          items: [
            for (final role in roleItems)
              DropdownMenuItem<int>(
                value: role.roleId,
                child: Text('${role.roleName} (${role.permCount} สิทธิ์)'),
              ),
          ],
          onChanged: _saving
              ? null
              : (value) {
                  if (value != null) _selectRole(value);
                },
        ),
        if (_loadingRole)
          const Padding(
            padding: EdgeInsets.only(top: 16),
            child: LinearProgressIndicator(key: Key('matrix-role-loading')),
          ),
        const SizedBox(height: 8),
        for (final module in modulesInOrder) ...[
          Builder(
            builder: (context) {
              final group = permissionItems
                  .where((permission) => permission.module == module)
                  .toList()
                ..sort((a, b) {
                  final bySort = a.sortNo.compareTo(b.sortNo);
                  return bySort != 0
                      ? bySort
                      : a.permCode.compareTo(b.permCode);
                });
              if (group.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 12, bottom: 4),
                    child: Text(
                      _moduleLabel(module),
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  for (final permission in group)
                    CheckboxListTile(
                      key: Key('matrix-perm-${permission.permCode}'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(permission.permName),
                      subtitle: Text(permission.permCode),
                      value: _checked?.contains(permission.permId) ?? false,
                      onChanged: _checked == null || _saving
                          ? null
                          : (_) => _toggle(permission),
                    ),
                ],
              );
            },
          ),
        ],
      ],
    );
  }
}
