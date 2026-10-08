import 'dart:convert';

import '../../core/network/api_error.dart';

/// แถวของรายงาน R1 — ตรงกับ schema `rows[]` ของ `GET /api/v1/reports/r1`
/// (OpenAPI: serviceDate, routeId, routeName, totalTrips, totalPassengers,
///  completed, noShow, attendanceRate)
class ReportR1Row {
  const ReportR1Row({
    required this.serviceDate,
    required this.routeId,
    required this.routeName,
    required this.totalTrips,
    required this.totalPassengers,
    required this.completed,
    required this.noShow,
    required this.attendanceRate,
  });

  factory ReportR1Row.fromJson(Map<String, dynamic> json) => ReportR1Row(
        serviceDate: json['serviceDate'] as String? ?? '',
        routeId: (json['routeId'] as num?)?.toInt() ?? 0,
        routeName: json['routeName'] as String? ?? '',
        totalTrips: (json['totalTrips'] as num?)?.toInt() ?? 0,
        totalPassengers: (json['totalPassengers'] as num?)?.toInt() ?? 0,
        completed: (json['completed'] as num?)?.toInt() ?? 0,
        noShow: (json['noShow'] as num?)?.toInt() ?? 0,
        attendanceRate: (json['attendanceRate'] as num?)?.toDouble() ?? 0,
      );

  /// `yyyy-MM-dd` (คริสต์ศักราช ตาม OpenAPI `format: date`)
  final String serviceDate;
  final int routeId;
  final String routeName;
  final int totalTrips;
  final int totalPassengers;

  /// ผู้โดยสารที่ขึ้นรถจริง (`completed`)
  final int completed;

  /// ไม่มา (`no_show` — BR-10 ตอนปิดรอบ)
  final int noShow;

  /// อัตราการมาจริง % = completed ÷ (completed + noShow) × 100
  /// (ตัด `cancelled` ออก — ตามสูตร OpenAPI R1)
  final double attendanceRate;

  /// วันที่ย่อสำหรับแกนกราฟ/ตาราง เช่น "1 ต.ค."
  String get shortDate {
    final parts = serviceDate.split('-');
    if (parts.length != 3) return serviceDate;
    final day = int.tryParse(parts[2]) ?? 0;
    final month = switch (int.tryParse(parts[1]) ?? 0) {
      1 => 'ม.ค.',
      2 => 'ก.พ.',
      3 => 'มี.ค.',
      4 => 'เม.ย.',
      5 => 'พ.ค.',
      6 => 'มิ.ย.',
      7 => 'ก.ค.',
      8 => 'ส.ค.',
      9 => 'ก.ย.',
      10 => 'ต.ค.',
      11 => 'พ.ย.',
      12 => 'ธ.ค.',
      _ => '',
    };
    return day > 0 && month.isNotEmpty ? '$day $month' : serviceDate;
  }
}

/// ผลลัพธ์ `GET /api/v1/reports/r1` — OpenAPI response ของรายงาน R1 (UC-27)
class ReportR1 {
  const ReportR1({
    required this.from,
    required this.to,
    required this.rows,
  });

  final String from;
  final String to;
  final List<ReportR1Row> rows;

  // ── KPI สรุป (นับจาก rows ที่ได้ ไม่ใช่ค่าเฉลี่ยของ %) ──────────────────

  /// ผลรวมจำนวนรอบทั้งช่วง
  int get totalTrips => rows.fold(0, (sum, row) => sum + row.totalTrips);

  /// ผลรวมผู้โดยสารที่จองทั้งช่วง
  int get totalPassengers =>
      rows.fold(0, (sum, row) => sum + row.totalPassengers);

  /// ผลรวมผู้โดยสารที่ขึ้นรถจริง (`completed`)
  int get totalCompleted => rows.fold(0, (sum, row) => sum + row.completed);

  /// ผลรวมไม่มา (`no_show`)
  int get totalNoShow => rows.fold(0, (sum, row) => sum + row.noShow);

  /// อัตราการมาจริงถ่วงน้ำหนักของช่วงทั้งหมด (%) =
  /// totalCompleted ÷ (totalCompleted + totalNoShow) × 100
  /// — guard หารศูนย์เมื่อไม่มีข้อมูล
  double get overallAttendanceRate {
    final denominator = totalCompleted + totalNoShow;
    if (denominator == 0) return 0;
    return totalCompleted / denominator * 100;
  }
}

/// parse เข้ม — รูปแบบผิดจาก OpenAPI → [ApiException] (ไม่เดาค่าเงียบ)
ReportR1 parseReportR1(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบรายงาน R1 จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  final rows = data['rows'];
  if (rows is! List) {
    throw const ApiException('รูปแบบรายงาน R1 จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return ReportR1(
    from: data['from'] as String? ?? '',
    to: data['to'] as String? ?? '',
    rows: [
      for (final item in rows)
        if (item is Map<String, dynamic>) ReportR1Row.fromJson(item),
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// R4 — ยอดผู้โดยสารแยกตามช่วงเวลา (UC-28) · OpenAPI `ReportR4`
// ─────────────────────────────────────────────────────────────────────────────

/// แถวของรายงาน R4 — `rows[]` ของ `GET /api/v1/reports/r4`
/// (period: morning|afternoon|evening, totalPassengers, avgPerTrip)
class ReportR4Row {
  const ReportR4Row({
    required this.period,
    required this.totalPassengers,
    required this.avgPerTrip,
  });

  factory ReportR4Row.fromJson(Map<String, dynamic> json) => ReportR4Row(
        period: json['period'] as String? ?? '',
        totalPassengers: (json['totalPassengers'] as num?)?.toInt() ?? 0,
        avgPerTrip: (json['avgPerTrip'] as num?)?.toDouble() ?? 0,
      );

  /// `morning` | `afternoon` | `evening` (OpenAPI enum)
  final String period;
  final int totalPassengers;
  final double avgPerTrip;

  /// ป้ายภาษาไทยสำหรับแกนกราฟ/ตาราง
  String get periodLabel => switch (period) {
        'morning' => 'เช้า',
        'afternoon' => 'บ่าย',
        'evening' => 'เย็น',
        _ => period,
      };
}

/// ผลลัพธ์ `GET /api/v1/reports/r4` — OpenAPI response ของรายงาน R4 (UC-28)
class ReportR4 {
  const ReportR4({
    required this.from,
    required this.to,
    required this.rows,
  });

  final String from;
  final String to;
  final List<ReportR4Row> rows;

  /// ผลรวมผู้โดยสารทั้งช่วง
  int get totalPassengers =>
      rows.fold(0, (sum, row) => sum + row.totalPassengers);

  /// ช่วงเวลาที่คนใช้มากที่สุด (ไม่รวมแถวที่ผู้โดยสาร = 0 เมื่อเท่ากันเลือกแถวแรก)
  ReportR4Row? get busiestPeriod {
    if (rows.isEmpty) return null;
    return rows.reduce((a, b) => b.totalPassengers > a.totalPassengers ? b : a);
  }
}

/// parse เข้ม — รูปแบบผิดจาก OpenAPI → [ApiException]
ReportR4 parseReportR4(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบรายงาน R4 จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  final rows = data['rows'];
  if (rows is! List) {
    throw const ApiException('รูปแบบรายงาน R4 จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return ReportR4(
    from: data['from'] as String? ?? '',
    to: data['to'] as String? ?? '',
    rows: [
      for (final item in rows)
        if (item is Map<String, dynamic>) ReportR4Row.fromJson(item),
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// R6 — สถิติการใช้งานรถ (UC-29) · OpenAPI `/api/reports/r6`
// ─────────────────────────────────────────────────────────────────────────────

/// แถวของรายงาน R6 — `rows[]` ของ `GET /api/v1/reports/r6`
class ReportR6Row {
  const ReportR6Row({
    required this.vehId,
    required this.plateNo,
    required this.totalTrips,
    required this.totalPassengers,
    required this.totalMinutes,
  });

  factory ReportR6Row.fromJson(Map<String, dynamic> json) => ReportR6Row(
        vehId: (json['vehId'] as num?)?.toInt() ?? 0,
        plateNo: json['plateNo'] as String? ?? '',
        totalTrips: (json['totalTrips'] as num?)?.toInt() ?? 0,
        totalPassengers: (json['totalPassengers'] as num?)?.toInt() ?? 0,
        totalMinutes: (json['totalMinutes'] as num?)?.toInt() ?? 0,
      );

  final int vehId;
  final String plateNo;
  final int totalTrips;
  final int totalPassengers;

  /// ผลรวม `route.total_minutes` ของทุกรอบที่ใช้รถคันนี้ (OpenAPI)
  final int totalMinutes;
}

/// ผลลัพธ์ `GET /api/v1/reports/r6` — OpenAPI response ของรายงาน R6 (UC-29)
/// (ไม่มี from/to ใน response — มีเฉพาะ `rows`)
class ReportR6 {
  const ReportR6({required this.rows});

  final List<ReportR6Row> rows;

  int get totalTrips => rows.fold(0, (sum, row) => sum + row.totalTrips);
  int get totalPassengers =>
      rows.fold(0, (sum, row) => sum + row.totalPassengers);
  int get totalMinutes => rows.fold(0, (sum, row) => sum + row.totalMinutes);

  /// รถที่มีผู้โดยสารมากที่สุด
  ReportR6Row? get busiestVehicle {
    if (rows.isEmpty) return null;
    return rows.reduce((a, b) => b.totalPassengers > a.totalPassengers ? b : a);
  }
}

/// parse เข้ม — รูปแบบผิดจาก OpenAPI → [ApiException]
ReportR6 parseReportR6(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบรายงาน R6 จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  final rows = data['rows'];
  if (rows is! List) {
    throw const ApiException('รูปแบบรายงาน R6 จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return ReportR6(
    rows: [
      for (final item in rows)
        if (item is Map<String, dynamic>) ReportR6Row.fromJson(item),
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export (UC-30) — `GET /api/v1/reports/{reportId}/export?format=csv|xlsx`
// ─────────────────────────────────────────────────────────────────────────────

/// ไฟล์ที่ได้จาก endpoint ส่งออก — เก็บ bytes + ชื่อไฟล์จาก `Content-Disposition`
class ReportExportFile {
  const ReportExportFile({
    required this.format,
    required this.fileName,
    required this.bytes,
  });

  /// `csv` | `xlsx`
  final String format;
  final String fileName;
  final List<int> bytes;

  /// เนื้อหาข้อความ (เฉพาะ CSV) — xlsx เป็นไบนารี ไม่แปลงเป็น text
  String get text => utf8.decode(bytes, allowMalformed: true);
}
