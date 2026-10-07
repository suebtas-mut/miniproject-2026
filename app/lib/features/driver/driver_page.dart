import 'package:flutter/material.dart';

import '../../layout/module_placeholder.dart';

class DriverPage extends StatelessWidget {
  const DriverPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ModulePlaceholder(
      title: 'งานคนขับ',
      description: 'ตารางงานรายวัน · เริ่ม/ปิดรอบเดินรถ · Manifest ผู้โดยสาร · สแกน QR',
      sprintHint: 'หน้าจริง: Sprint 10 (T-048/T-049) และ Sprint 11 (T-050/T-051)',
    );
  }
}
