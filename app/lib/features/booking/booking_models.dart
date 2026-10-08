import '../../core/network/api_error.dart';
import '../front/schedule_models.dart';

/// ที่นั่ง 1 ใบในแผนผัง — OpenAPI `SeatMap.seats[]`
/// (`status`: available | reserved | checked_in | occupied)
class Seat {
  const Seat({required this.seatNo, required this.status});

  factory Seat.fromJson(Map<String, dynamic> json) => Seat(
        seatNo: (json['seatNo'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? '',
      );

  final int seatNo;
  final String status;
}

/// แผนผังที่นั่งของรอบ — OpenAPI `SeatMap`
/// (`GET /schedules/{schedId}/seats?serviceDate=…`)
class SeatMap {
  const SeatMap({
    required this.schedId,
    required this.totalSeats,
    required this.bookedSeats,
    required this.availableSeats,
    required this.maxSeatsPerBooking,
    this.seats = const [],
  });

  factory SeatMap.fromJson(Map<String, dynamic> json) => SeatMap(
        schedId: (json['schedId'] as num?)?.toInt() ?? 0,
        totalSeats: (json['totalSeats'] as num?)?.toInt() ?? 0,
        bookedSeats: (json['bookedSeats'] as num?)?.toInt() ?? 0,
        availableSeats: (json['availableSeats'] as num?)?.toInt() ?? 0,
        // BR-06 — ค่าเริ่มต้น 4 เมื่อเซิร์ฟเวอร์ไม่ส่งมา
        maxSeatsPerBooking: (json['maxSeatsPerBooking'] as num?)?.toInt() ?? 4,
        seats: [
          for (final item in (json['seats'] as List<dynamic>?) ?? const [])
            if (item is Map<String, dynamic>) Seat.fromJson(item),
        ],
      );

  final int schedId;
  final int totalSeats;
  final int bookedSeats;
  final int availableSeats;
  final int maxSeatsPerBooking;
  final List<Seat> seats;
}

/// การจองของผู้ใช้ — OpenAPI `Booking`
/// (คำตอบ 201 ของ `POST /bookings`, รายการ `GET /bookings`,
///  รายละเอียด `GET /bookings/{bookingCode}`)
class BookingRecord {
  const BookingRecord({
    required this.bookingId,
    required this.bookingCode,
    required this.schedId,
    required this.boardStopId,
    required this.alightStopId,
    required this.seats,
    this.status = 'reserved',
    this.bookTime = '',
    this.qrToken,
    this.routeName = '',
    this.departAt = '',
    this.serviceDate = '',
    this.boardStopName = '',
    this.alightStopName = '',
    this.custId,
    this.customerName = '',
    this.cancelTime,
  });

  factory BookingRecord.fromJson(Map<String, dynamic> json) => BookingRecord(
        bookingId: (json['bookingId'] as num?)?.toInt() ?? 0,
        bookingCode: json['bookingCode'] as String? ?? '',
        schedId: (json['schedId'] as num?)?.toInt() ?? 0,
        boardStopId: (json['boardStopId'] as num?)?.toInt() ?? 0,
        alightStopId: (json['alightStopId'] as num?)?.toInt() ?? 0,
        seats: (json['seats'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'reserved',
        bookTime: json['bookTime'] as String? ?? '',
        qrToken: json['qrToken'] as String?,
        routeName: json['routeName'] as String? ?? '',
        departAt: json['departAt'] as String? ?? '',
        serviceDate: json['serviceDate'] as String? ?? '',
        boardStopName: json['boardStopName'] as String? ?? '',
        alightStopName: json['alightStopName'] as String? ?? '',
        custId: (json['custId'] as num?)?.toInt(),
        customerName: json['customerName'] as String? ?? '',
        cancelTime: json['cancelTime'] as String?,
      );

  final int bookingId;
  final String bookingCode;
  final int schedId;
  final int boardStopId;
  final int alightStopId;
  final int seats;
  final String status;
  final String bookTime;
  final String? qrToken;
  final String routeName;
  final String departAt;
  final String serviceDate;
  final String boardStopName;
  final String alightStopName;
  final int? custId;
  final String customerName;

  /// เวลาที่ยกเลิก (`cancelTime` · null เมื่อยังไม่ถูกยกเลิก)
  final String? cancelTime;

  /// เวลาออกเดินทางเป็น `HH:mm` (ค่า ISO `departAt`)
  String get departTime => _hhmm(departAt);
}

SeatMap parseSeatMap(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบแผนผังที่นั่งจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return SeatMap.fromJson(data);
}

BookingRecord parseBooking(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบผลการจองจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return BookingRecord.fromJson(data);
}

/// รายการจองของฉัน — OpenAPI `GET /bookings` คืน **array** ของ `Booking`
List<BookingRecord> parseBookings(dynamic data) {
  if (data is! List) {
    throw const ApiException('รูปแบบรายการจองจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return [for (final item in data) parseBooking(item)];
}

/// UC-17 — กรองรอบฝั่ง UI ให้แสดงเฉพาะรอบที่ผู้ใช้ "ขึ้นรถได้จริง"
///
/// - **BR-05**: เวลาถึง **จุดขึ้น** ของรอบต้องห่างจาก `now` อย่างน้อย 20 นาที
///   (เทียบ `schedule_stop.arriveAt` ของจุดขึ้น ไม่ใช่เวลาออกเดินทาง —
///   สูตร Oracle `arrive_at - SYSTIMESTAMP >= INTERVAL '20' MINUTE`)
/// - **BR-12**: จุดขึ้นและจุดลงต้องอยู่ใน `stops` ของรอบนั้น
/// - **BR-11**: ลำดับจุดขึ้นต้องน้อยกว่าจุดลง (`stopSeq`)
/// - **BR-07**: ซ่อนรอบที่ทราบแน่ว่าที่นั่งเต็ม (`seatsAvailable == 0`)
///
/// รอบที่ไม่มีข้อมูล `stops` หรือไม่มีเวลาถึงจุดขึ้น จะถูก "ซ่อน" เพราะ
/// ตรวจสอบ BR-05/BR-11/BR-12 ไม่ได้ (UC-17 ให้แสดงเฉพาะรอบที่ขึ้นได้จริง)
/// และยังคงตรวจซ้ำที่เซิร์ฟเวอร์ตอน `POST /bookings`
///
/// `now` ระบุได้เพื่อให้เทสต์กำหนดเวลาเอง (ค่าเริ่มต้น = เวลาปัจจุบัน)
List<Schedule> boardableTrips(
  List<Schedule> schedules, {
  required int boardStopId,
  required int alightStopId,
  DateTime? now,
}) {
  final clock = now ?? DateTime.now();
  final result = <Schedule>[];
  for (final schedule in schedules) {
    if ((schedule.seatsAvailable ?? 1) < 1) continue; // BR-07
    if (schedule.stops.isEmpty) continue; // ตรวจสอบไม่ได้ → ไม่แสดง
    ScheduleStop? board;
    ScheduleStop? alight;
    for (final stop in schedule.stops) {
      if (stop.stopId == boardStopId) board = stop;
      if (stop.stopId == alightStopId) alight = stop;
    }
    if (board == null || alight == null) continue; // BR-12
    if (board.stopSeq >= alight.stopSeq) continue; // BR-11
    final arriveAt = DateTime.tryParse(board.arriveAt);
    if (arriveAt == null) continue; // ไม่ทราบเวลาถึงจุดขึ้น → BR-05 ตรวจไม่ได้
    if (arriveAt.difference(clock) < const Duration(minutes: 20)) {
      continue; // BR-05
    }
    result.add(schedule);
  }
  return result;
}

String _hhmm(String iso) {
  if (iso.length >= 16 && iso[10] == 'T') return iso.substring(11, 16);
  final parsed = DateTime.tryParse(iso);
  if (parsed != null) {
    return '${parsed.hour.toString().padLeft(2, '0')}'
        ':${parsed.minute.toString().padLeft(2, '0')}';
  }
  return iso;
}
