import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'report_models.dart';
import 'report_repository.dart';

final reportRepositoryProvider = Provider<ReportRepository>(
  (ref) => ReportRepository(ref.watch(apiClientProvider)),
);

/// ปี พ.ศ. → คริสต์ศักราช (2568 → 2025)
int buddhistToGregorian(int buddhistYear) => buddhistYear - 543;

/// คริสต์ศักราช → ปี พ.ศ. (2025 → 2568)
int gregorianToBuddhist(int gregorianYear) => gregorianYear + 543;

/// แปลง DateTime เป็นสตริง `yyyy-MM-dd` (OpenAPI `format: date`)
String gregorianIso(DateTime date) => '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

/// คำถามของรายงาน R1 — เก็บช่วงวันที่คริสต์ศักราชที่จะส่งจริง (`from`/`to`)
/// + ปี พ.ศ. ที่เลือก (สำหรับแสดงผล/แมปปุ่ม) + เส้นทางที่กรอง (ไม่บังคับ)
class ReportR1Query {
  const ReportR1Query({
    required this.from,
    required this.to,
    this.year,
    this.routeId,
  });

  /// ค่าเริ่มต้น — ปี พ.ศ. ที่ระบุ (เช่น 2568) → 1 ม.ค.–31 ธ.ค. ของปีคริสต์ศักราชที่ตรงกัน
  factory ReportR1Query.forBuddhistYear(int buddhistYear, {int? routeId}) {
    final gregorian = buddhistToGregorian(buddhistYear);
    return ReportR1Query(
      from: '$gregorian-01-01',
      to: '$gregorian-12-31',
      year: buddhistYear,
      routeId: routeId,
    );
  }

  /// ช่วงวันที่คริสต์ศักราช `yyyy-MM-dd` — ค่าที่ส่งจริงให้ API
  final String from;
  final String to;

  /// ปี พ.ศ. ที่ผู้ใช้เลือก (เช่น 2568) — `null` เมื่อเลือกช่วงวันที่เอง
  final int? year;

  /// กรองตามเส้นทาง — `null` = ทั้งหมด
  final int? routeId;

  ReportR1Query copyWith({
    String? from,
    String? to,
    int? year,
    int? routeId,
    bool clearYear = false,
    bool clearRouteId = false,
  }) =>
      ReportR1Query(
        from: from ?? this.from,
        to: to ?? this.to,
        year: clearYear ? null : (year ?? this.year),
        routeId: clearRouteId ? null : (routeId ?? this.routeId),
      );

  @override
  bool operator ==(Object other) =>
      other is ReportR1Query &&
      other.from == from &&
      other.to == to &&
      other.year == year &&
      other.routeId == routeId;

  @override
  int get hashCode => Object.hash(from, to, year, routeId);
}

/// ควบคุมตัวกรองรายงาน — ค่าเริ่มต้นปี 2568 (ปีที่มีข้อมูล seed ตามแผน T-052)
class ReportR1QueryController extends Notifier<ReportR1Query> {
  @override
  ReportR1Query build() => ReportR1Query.forBuddhistYear(2568);

  /// เลือกปี พ.ศ. → ปรับ `from`/`to` เป็น 1 ม.ค.–31 ธ.ค. ของปีนั้น
  void setYear(int buddhistYear) {
    state = ReportR1Query.forBuddhistYear(
      buddhistYear,
      routeId: state.routeId,
    );
  }

  /// เลือกช่วงวันที่เอง (คริสต์ศักราช) — ล้างค่าปีที่เลือกไว้
  void setDateRange(DateTime from, DateTime to) {
    state = state.copyWith(
      from: gregorianIso(from),
      to: gregorianIso(to),
      clearYear: true,
    );
  }

  /// กรองตามเส้นทาง — `null` = ทั้งหมด
  void setRouteId(int? routeId) {
    state = state.copyWith(routeId: routeId, clearRouteId: routeId == null);
  }
}

final reportR1QueryProvider =
    NotifierProvider<ReportR1QueryController, ReportR1Query>(
  ReportR1QueryController.new,
);

/// โหลดรายงาน R1 ตาม query ปัจจุบัน — เปลี่ยน query = โหลดใหม่
final reportR1Provider =
    FutureProvider.autoDispose.family<ReportR1, ReportR1Query>(
  (ref, query) => ref.watch(reportRepositoryProvider).fetchReportR1(
        from: query.from,
        to: query.to,
        routeId: query.routeId,
      ),
  name: 'reportR1',
);

/// โหลดรายงาน R4 ตาม query ปัจจุบัน (ใช้ `from`/`to` เดียวกับ R1 —
/// ตัวกรองปี/ช่วงวันที่ร่วมกันทุกแท็บ · `routeId` ไม่ได้ใช้กับ R4 ตามสเปก)
final reportR4Provider =
    FutureProvider.autoDispose.family<ReportR4, ReportR1Query>(
  (ref, query) => ref.watch(reportRepositoryProvider).fetchReportR4(
        from: query.from,
        to: query.to,
      ),
  name: 'reportR4',
);

/// โหลดรายงาน R6 ตาม query ปัจจุบัน (ใช้ `from`/`to` เดียวกับ R1 ·
/// `routeId` ไม่ได้ใช้กับ R6 ตามสเปก)
final reportR6Provider =
    FutureProvider.autoDispose.family<ReportR6, ReportR1Query>(
  (ref, query) => ref.watch(reportRepositoryProvider).fetchReportR6(
        from: query.from,
        to: query.to,
      ),
  name: 'reportR6',
);
