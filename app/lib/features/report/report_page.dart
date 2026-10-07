import 'package:flutter/material.dart';

import '../../layout/module_placeholder.dart';

class ReportPage extends StatelessWidget {
  const ReportPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ModulePlaceholder(
      title: 'รายงาน',
      description: 'R1 จำนวนคนขึ้น–ลง · R4 สรุปยอดรายวันรายเส้นทาง · R6 สถิติงานคนขับ',
      sprintHint: 'หน้าจริง: Sprint 12 (T-058) และ Sprint 13 (T-059)',
    );
  }
}
