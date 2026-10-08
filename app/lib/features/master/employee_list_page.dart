import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import 'employee_form_dialog.dart';
import 'master_models.dart';
import 'master_providers.dart';
import 'widgets/list_states.dart';

class EmployeeListPage extends ConsumerStatefulWidget {
  const EmployeeListPage({super.key});

  @override
  ConsumerState<EmployeeListPage> createState() => _EmployeeListPageState();
}

class _EmployeeListPageState extends ConsumerState<EmployeeListPage> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      ref.read(employeeQueryProvider.notifier).search(value);
    });
  }

  Future<void> _create() async {
    final saved = await EmployeeFormDialog.show(context);
    if (saved == true && mounted) {
      refreshEmployees(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกข้อมูลพนักงานแล้ว')),
      );
    }
  }

  Future<void> _edit(Employee employee) async {
    final saved = await EmployeeFormDialog.show(context, employee: employee);
    if (saved == true && mounted) {
      refreshEmployees(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกข้อมูลพนักงานแล้ว')),
      );
    }
  }

  Future<void> _deactivate(Employee employee) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ปิดใช้งานพนักงาน'),
        content: Text(
          'ต้องการปิดใช้งาน "${employee.fullName}" ใช่หรือไม่? '
          'ระบบจะเปลี่ยน is_active เป็น 0 (ไม่ลบข้อมูลจริง)',
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
          .deactivateEmployee(employee.empId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(describeFailure(e))),
      );
      return;
    }
    if (!mounted) return;
    refreshEmployees(ref);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ปิดใช้งานพนักงานแล้ว')),
    );
  }

  @override
  Widget build(BuildContext context) {
    // T-023 / TC-09-01 — ไม่มี EMP.VIEW ดูหน้าพนักงานไม่ได้ และไม่ต้องโหลดข้อมูล
    final canView = ref
        .watch(authControllerProvider.select((state) => state.can('EMP.VIEW')));
    if (!canView) {
      return const Center(
        child: Text(
          'ไม่มีสิทธิ์เข้าถึงส่วนนี้',
          key: Key('employee-forbidden'),
        ),
      );
    }
    final query = ref.watch(employeeQueryProvider);
    final employees = ref.watch(employeesProvider(query));
    final controller = ref.read(employeeQueryProvider.notifier);
    // T-023 — ซ่อนคอลัมน์จัดการเมื่อผู้ใช้ไม่มีสิทธิ์ EMP.EDIT
    final canEdit = ref
        .watch(authControllerProvider.select((state) => state.can('EMP.EDIT')));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('employee-search'),
                  controller: _searchCtrl,
                  decoration: const InputDecoration(
                    labelText: 'ค้นหา (รหัส / ชื่อ / ชื่อผู้ใช้)',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: _onSearchChanged,
                ),
              ),
              const SizedBox(width: 12),
              if (canEdit)
                FilledButton.icon(
                  key: const Key('employee-create'),
                  onPressed: _create,
                  icon: const Icon(Icons.person_add_alt_1),
                  label: const Text('เพิ่มพนักงาน'),
                ),
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<PagedEmployees>(
            value: employees,
            onRetry: () => ref.invalidate(employeesProvider(query)),
            builder: (data) {
              if (data.items.isEmpty) {
                return Column(
                  children: [
                    const Expanded(
                      child: EmptyState(
                        message: 'ไม่พบข้อมูลพนักงานตามเงื่อนไข',
                      ),
                    ),
                    PagerBar(
                      page: query.page,
                      totalPages: data.totalPages,
                      total: data.total,
                      unit: 'คน',
                      onPageChanged: controller.goToPage,
                    ),
                  ],
                );
              }
              return Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: SingleChildScrollView(
                        child: DataTable(
                          columns: [
                            const DataColumn(label: Text('รหัสพนักงาน')),
                            const DataColumn(label: Text('ชื่อ-นามสกุล')),
                            const DataColumn(label: Text('ตำแหน่ง')),
                            const DataColumn(label: Text('แผนก')),
                            const DataColumn(label: Text('ชื่อผู้ใช้')),
                            const DataColumn(label: Text('สถานะ')),
                            if (canEdit)
                              const DataColumn(label: Text('จัดการ')),
                          ],
                          rows: [
                            for (final employee in data.items)
                              DataRow(
                                cells: [
                                  DataCell(Text(employee.empCode)),
                                  DataCell(Text(employee.fullName)),
                                  DataCell(
                                    Text(employee.positionName ?? '-'),
                                  ),
                                  DataCell(Text(employee.deptName ?? '-')),
                                  DataCell(Text(employee.username)),
                                  DataCell(
                                    Text(
                                      employee.isActive == 1
                                          ? 'ใช้งาน'
                                          : 'ปิดใช้งาน',
                                      key: Key(
                                        'employee-active-${employee.empId}',
                                      ),
                                    ),
                                  ),
                                  if (canEdit)
                                    DataCell(
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          IconButton(
                                            tooltip: 'แก้ไข',
                                            icon: const Icon(
                                              Icons.edit_outlined,
                                            ),
                                            onPressed: () => _edit(employee),
                                          ),
                                          IconButton(
                                            tooltip: 'ปิดใช้งาน',
                                            icon: const Icon(
                                              Icons.person_off_outlined,
                                            ),
                                            onPressed: employee.isActive == 1
                                                ? () => _deactivate(employee)
                                                : null,
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  PagerBar(
                    page: query.page,
                    totalPages: data.totalPages,
                    total: data.total,
                    unit: 'คน',
                    onPageChanged: controller.goToPage,
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
