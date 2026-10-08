import '../../core/network/api_error.dart';
import '../front/schedule_models.dart';

/// รอบเดินทางของคนขับ — OpenAPI `DriverTripBrief` (`GET /api/v1/driver/today`)
///
/// ข้อจำกัดสัญญา (บันทึกใน handoff sprint10): `DriverTripBrief` ไม่มี `tripId`
/// จึงเปิด Manifest หรือปิดรอบข้ามเครื่องไม่ได้ — ระบบเก็บ `tripId` ของรอบที่
/// เริ่มจากเครื่องนี้ไว้ใน `startedTripsProvider`
class DriverTripBrief {
  const DriverTripBrief({
    required this.schedId,
    required this.routeId,
    required this.routeName,
    required this.departAt,
    required this.totalMinutes,
    required this.stopCount,
    required this.status,
    required this.plateNo,
    required this.passengerCount,
  });

  factory DriverTripBrief.fromJson(Map<String, dynamic> json) =>
      DriverTripBrief(
        schedId: (json['schedId'] as num?)?.toInt() ?? 0,
        routeId: (json['routeId'] as num?)?.toInt() ?? 0,
        routeName: json['routeName'] as String? ?? '',
        departAt: json['departAt'] as String? ?? '',
        totalMinutes: (json['totalMinutes'] as num?)?.toInt() ?? 0,
        stopCount: (json['stopCount'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'upcoming',
        plateNo: json['plateNo'] as String? ?? '',
        passengerCount: (json['passengerCount'] as num?)?.toInt() ?? 0,
      );

  final int schedId;
  final int routeId;
  final String routeName;
  final String departAt;
  final int totalMinutes;
  final int stopCount;

  /// `upcoming` | `running` | `completed`
  final String status;
  final String plateNo;
  final int passengerCount;

  /// เวลาออกเดินทางเป็น `HH:mm` (ค่า ISO `departAt`)
  String get departTime => hhmm(departAt);

  bool get isUpcoming => status == 'upcoming';
  bool get isRunning => status == 'running';
}

/// ตารางงานวันของคนขับ — OpenAPI `DriverDay`
class DriverDay {
  const DriverDay({required this.serviceDate, required this.trips});

  final String serviceDate;
  final List<DriverTripBrief> trips;

  /// รอบที่ยังเดินไม่เสร็จ (ตรวจ conflict BR-04 ฝั่งไคลเอนต์)
  List<DriverTripBrief> get runningTrips => [
        for (final trip in trips)
          if (trip.isRunning) trip
      ];

  /// ผลรวมผู้โดยสารทุกรอบ (การ์ดสถิติ D1)
  int get totalPassengers =>
      trips.fold(0, (sum, trip) => sum + trip.passengerCount);
}

/// ผลลัพธ์ `POST /api/v1/driver/trips` — OpenAPI `Trip`
class Trip {
  const Trip({
    required this.tripId,
    required this.schedId,
    required this.driverId,
    required this.vehId,
    required this.startTime,
    this.endTime,
    required this.status,
  });

  factory Trip.fromJson(Map<String, dynamic> json) => Trip(
        tripId: (json['tripId'] as num?)?.toInt() ?? 0,
        schedId: (json['schedId'] as num?)?.toInt() ?? 0,
        driverId: (json['driverId'] as num?)?.toInt() ?? 0,
        vehId: (json['vehId'] as num?)?.toInt() ?? 0,
        startTime: json['startTime'] as String? ?? '',
        endTime: json['endTime'] as String?,
        status: json['status'] as String? ?? 'running',
      );

  final int tripId;
  final int schedId;
  final int driverId;
  final int vehId;
  final String startTime;
  final String? endTime;
  final String status;
}

/// ผู้โดยสารหนึ่งรายการใน Manifest — OpenAPI `ManifestPassenger`
class ManifestPassenger {
  const ManifestPassenger({
    required this.bookingId,
    required this.bookingCode,
    required this.customerName,
    required this.seats,
    required this.boardSeq,
    required this.boardStopName,
    required this.alightSeq,
    required this.alightStopName,
    required this.status,
    required this.checkedIn,
  });

  factory ManifestPassenger.fromJson(Map<String, dynamic> json) =>
      ManifestPassenger(
        bookingId: (json['bookingId'] as num?)?.toInt() ?? 0,
        bookingCode: json['bookingCode'] as String? ?? '',
        customerName: json['customerName'] as String? ?? '',
        seats: (json['seats'] as num?)?.toInt() ?? 0,
        boardSeq: (json['boardSeq'] as num?)?.toInt() ?? 0,
        boardStopName: json['boardStopName'] as String? ?? '',
        alightSeq: (json['alightSeq'] as num?)?.toInt() ?? 0,
        alightStopName: json['alightStopName'] as String? ?? '',
        status: json['status'] as String? ?? '',
        checkedIn: json['checkedIn'] as bool? ?? false,
      );

  final int bookingId;
  final String bookingCode;
  final String customerName;
  final int seats;
  final int boardSeq;
  final String boardStopName;
  final int alightSeq;
  final String alightStopName;
  final String status;
  final bool checkedIn;
}

/// Manifest ของรอบที่คนขับกำลังขับ — OpenAPI `DriverManifest`
/// (`GET /api/v1/driver/trips/{tripId}/manifest`, UC-24)
class DriverManifest {
  const DriverManifest({
    required this.schedId,
    required this.routeName,
    required this.serviceDate,
    required this.departAt,
    required this.totalPassengers,
    required this.totalSeats,
    required this.passengers,
    required this.tripId,
    required this.tripStatus,
    required this.plateNo,
    required this.stops,
  });

  factory DriverManifest.fromJson(Map<String, dynamic> json) => DriverManifest(
        schedId: (json['schedId'] as num?)?.toInt() ?? 0,
        routeName: json['routeName'] as String? ?? '',
        serviceDate: json['serviceDate'] as String? ?? '',
        departAt: json['departAt'] as String? ?? '',
        totalPassengers: (json['totalPassengers'] as num?)?.toInt() ?? 0,
        totalSeats: (json['totalSeats'] as num?)?.toInt() ?? 0,
        passengers: [
          for (final item in (json['passengers'] as List<dynamic>?) ?? const [])
            if (item is Map<String, dynamic>) ManifestPassenger.fromJson(item),
        ],
        tripId: (json['tripId'] as num?)?.toInt() ?? 0,
        tripStatus: json['tripStatus'] as String? ?? '',
        plateNo: json['plateNo'] as String? ?? '',
        stops: [
          for (final item in (json['stops'] as List<dynamic>?) ?? const [])
            if (item is Map<String, dynamic>) ScheduleStop.fromJson(item),
        ],
      );

  final int schedId;
  final String routeName;
  final String serviceDate;
  final String departAt;
  final int totalPassengers;
  final int totalSeats;
  final List<ManifestPassenger> passengers;
  final int tripId;
  final String tripStatus;
  final String plateNo;
  final List<ScheduleStop> stops;

  /// เวลาออกเดินทางเป็น `HH:mm`
  String get departTime => hhmm(departAt);

  /// จำนวนผู้โดยสารที่เช็คอินแล้ว (หัวข้อ D2 `ผู้โดยสารขึ้นรถ n / m`)
  int get checkedInCount =>
      passengers.where((passenger) => passenger.checkedIn).length;

  // นับสำหรับหน้าสรุป (UC-26 / จอ D4) — รองรับทั้งก่อนและหลังปิดรอบ:
  // ระหว่างเดินทางสถานะเป็น `reserved`/`checked_in` · หลัง `POST .../end`
  // เซิร์ฟเวอร์ (T-047) เปลี่ยน `reserved → no_show` และ `checked_in → completed`
  // (BR-10 + สูตรรายงาน R1) — ฝั่งไคลเอนต์นับจาก `status`/`checkedIn` ที่ได้จริง

  /// ขึ้นรถจริง — เช็คอินแล้ว หรือสถานะ `checked_in`/`completed`
  int get boardedCount => passengers
      .where((p) =>
          p.checkedIn || p.status == 'checked_in' || p.status == 'completed')
      .length;

  /// ลงรถจริง — สถานะ `completed` (รอบปิดแล้ว เซิร์ฟเวอร์ปิด booking)
  int get alightedCount =>
      passengers.where((p) => p.status == 'completed').length;

  /// No Show — สถานะ `no_show` (BR-10: reserved → no_show ตอนปิดรอบ)
  int get noShowCount => passengers.where((p) => p.status == 'no_show').length;

  /// รายชื่อ No Show สำหรับแสดงในหน้าสรุป
  List<ManifestPassenger> get noShowPassengers => [
        for (final passenger in passengers)
          if (passenger.status == 'no_show') passenger
      ];

  /// ยกเลิกแล้ว — สถานะ `cancelled`
  int get cancelledCount =>
      passengers.where((p) => p.status == 'cancelled').length;
}

/// ผลลัพธ์ `POST /api/v1/driver/bookings/scan` — OpenAPI `CheckinResult` (UC-25)
class CheckinResult {
  const CheckinResult({
    required this.bookingCode,
    required this.customerName,
    required this.seats,
    required this.boardStopName,
    required this.checkinTime,
    required this.boardSeq,
    required this.message,
  });

  factory CheckinResult.fromJson(Map<String, dynamic> json) => CheckinResult(
        bookingCode: json['bookingCode'] as String? ?? '',
        customerName: json['customerName'] as String? ?? '',
        seats: (json['seats'] as num?)?.toInt() ?? 0,
        boardStopName: json['boardStopName'] as String? ?? '',
        checkinTime: json['checkinTime'] as String? ?? '',
        boardSeq: (json['boardSeq'] as num?)?.toInt() ?? 0,
        message: json['message'] as String? ?? 'เช็คอินสำเร็จ',
      );

  final String bookingCode;
  final String customerName;
  final int seats;
  final String boardStopName;
  final String checkinTime;
  final int boardSeq;
  final String message;
}

DriverDay parseDriverDay(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบตารางงานคนขับจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  final trips = data['trips'];
  if (trips is! List) {
    throw const ApiException('รูปแบบตารางงานคนขับจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return DriverDay(
    serviceDate: data['serviceDate'] as String? ?? '',
    trips: [
      for (final item in trips)
        if (item is Map<String, dynamic>) DriverTripBrief.fromJson(item),
    ],
  );
}

Trip parseTrip(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException(
        'รูปแบบผลลัพธ์การเริ่มเดินทางจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return Trip.fromJson(data);
}

DriverManifest parseDriverManifest(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบ Manifest จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  final passengers = data['passengers'];
  final stops = data['stops'];
  if (passengers is! List || stops is! List) {
    throw const ApiException('รูปแบบ Manifest จากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return DriverManifest.fromJson(data);
}

CheckinResult parseCheckinResult(dynamic data) {
  if (data is! Map<String, dynamic>) {
    throw const ApiException('รูปแบบผลลัพธ์การเช็คอินจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }
  return CheckinResult.fromJson(data);
}
