import 'package:flutter/material.dart';

import 'driver_schedule_screen.dart';

/// หน้าคนขับ (เส้นทาง `/driver`)
///
/// Sprint 10 (T-048/T-049): ตารางงานรายวัน + เริ่มรอบ + Manifest (UC-22/23/24)
/// Sprint 11 (T-050/T-051): สแกน QR + ปิดรอบ (ยังเป็น placeholder ภายนอกไฟล์นี้)
class DriverPage extends StatelessWidget {
  const DriverPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const DriverScheduleScreen();
  }
}
