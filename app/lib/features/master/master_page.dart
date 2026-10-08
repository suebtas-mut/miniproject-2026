import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/account_menu.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_models.dart';
import '../../features/master/department_list_page.dart';
import '../../features/master/employee_list_page.dart';
import '../../features/master/permission_matrix_page.dart';
import '../../features/master/position_list_page.dart';

class MasterPage extends ConsumerWidget {
  const MasterPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // T-023 — แท็บ Permission Matrix มีเฉพาะผู้ที่มีสิทธิ์ ROLE.EDIT
    final canMatrix = ref.watch(
        authControllerProvider.select((state) => state.can('ROLE.EDIT')));
    // แท็บพนักงานมีเฉพาะผู้มี EMP.VIEW (TC-09-01 — ถอนสิทธิ์แล้วแท็บหาย)
    final canViewEmployees = ref
        .watch(authControllerProvider.select((state) => state.can('EMP.VIEW')));
    final tabs = [
      if (canViewEmployees) const Tab(text: 'พนักงาน'),
      const Tab(text: 'แผนก'),
      const Tab(text: 'ตำแหน่ง'),
      if (canMatrix)
        const Tab(text: 'สิทธิ์', key: Key('master-tab-permissions')),
    ];
    final pages = [
      if (canViewEmployees) const EmployeeListPage(),
      const DepartmentListPage(),
      const PositionListPage(),
      if (canMatrix) const PermissionMatrixPage(),
    ];
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('ข้อมูลหลัก'),
          actions: const [AccountMenu()],
          bottom: TabBar(tabs: tabs),
        ),
        body: TabBarView(children: pages),
      ),
    );
  }
}
