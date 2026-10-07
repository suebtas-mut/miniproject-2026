import 'package:flutter/material.dart';

import '../../layout/module_placeholder.dart';

class MasterPage extends StatelessWidget {
  const MasterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ModulePlaceholder(
      title: 'ข้อมูลหลัก',
      description: 'จัดการพนักงาน · แผนก · ตำแหน่ง · บทบาท · ตารางสิทธิ์ (Permission Matrix)',
      sprintHint: 'หน้าจริง: Sprint 4 (T-018) และ Sprint 5 (T-023)',
    );
  }
}
