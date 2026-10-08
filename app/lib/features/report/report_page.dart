import 'package:flutter/material.dart';

import 'report_shell.dart';

/// หน้ารายงาน (เส้นทาง `/report`) — โฮสต์ [ReportShell] (UC-30)
///
/// R1 (T-058) ใช้งานได้จริง · R4/R6 อยู่ในขอบเขต Sprint 13 (T-059)
class ReportPage extends StatelessWidget {
  const ReportPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('รายงาน')),
      body: const ReportShell(),
    );
  }
}
