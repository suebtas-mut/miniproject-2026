import 'package:flutter/material.dart';

import '../../layout/module_placeholder.dart';

class FrontPage extends StatelessWidget {
  const FrontPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ModulePlaceholder(
      title: 'เส้นทางและรอบเวลา',
      description: 'จุดจอด · เส้นทาง (เวลารวมอัตโนมัติ) · รถ · ตารางเดินรถ · การมอบหมายคนขับ/รถ',
      sprintHint: 'หน้าจริง: Sprint 6 (T-028) และ Sprint 7 (T-033)',
    );
  }
}
