import 'package:flutter/material.dart';

import '../../layout/module_placeholder.dart';

class BookingPage extends StatelessWidget {
  const BookingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ModulePlaceholder(
      title: 'จองรถ',
      description: 'เลือกจุดขึ้น–ลง · เลือกรอบเวลา · ยืนยันที่นั่ง · QR ตั๋ว · ยกเลิกการจอง',
      sprintHint: 'หน้าจริง: Sprint 8 (T-040) และ Sprint 9 (T-041)',
    );
  }
}
