import '../../core/network/api_error.dart';

/// รถ (`vehicle`) — OpenAPI `Vehicle`
class Vehicle {
  const Vehicle({
    required this.vehId,
    required this.plateNo,
    required this.vtypeId,
    required this.typeName,
    required this.capacity,
    this.isActive = 1,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        vehId: (json['vehId'] as num?)?.toInt() ?? 0,
        plateNo: json['plateNo'] as String? ?? '',
        vtypeId: (json['vtypeId'] as num?)?.toInt() ?? 0,
        typeName: json['typeName'] as String? ?? '',
        capacity: (json['capacity'] as num?)?.toInt() ?? 0,
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
      );

  final int vehId;
  final String plateNo;
  final int vtypeId;
  final String typeName;
  final int capacity;
  final int isActive;
}

/// ประเภทรถ (`vehicle_type`) — OpenAPI `VehicleType`
class VehicleType {
  const VehicleType({
    required this.vtypeId,
    required this.typeName,
    required this.capacity,
    this.isActive = 1,
  });

  factory VehicleType.fromJson(Map<String, dynamic> json) => VehicleType(
        vtypeId: (json['vtypeId'] as num?)?.toInt() ?? 0,
        typeName: json['typeName'] as String? ?? '',
        capacity: (json['capacity'] as num?)?.toInt() ?? 0,
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
      );

  final int vtypeId;
  final String typeName;
  final int capacity;
  final int isActive;
}

/// ข้อมูลย่อพนักงาน — OpenAPI `EmployeeBrief` (ใช้แสดงคนขับในรอบเวลา)
class EmployeeBrief {
  const EmployeeBrief({
    required this.empId,
    this.empCode,
    required this.fullName,
  });

  factory EmployeeBrief.fromJson(Map<String, dynamic> json) => EmployeeBrief(
        empId: (json['empId'] as num?)?.toInt() ?? 0,
        empCode: json['empCode'] as String?,
        fullName: json['fullName'] as String? ?? '',
      );

  final int empId;
  final String? empCode;
  final String fullName;
}

/// จุดจอดตามลำดับในรอบ (`schedule_stop`) — OpenAPI `ScheduleStop` (BR-02)
class ScheduleStop {
  const ScheduleStop({
    required this.stopSeq,
    required this.stopId,
    required this.stopName,
    required this.arriveAt,
    this.dwellMinutes = 0,
  });

  factory ScheduleStop.fromJson(Map<String, dynamic> json) => ScheduleStop(
        stopSeq: (json['stopSeq'] as num?)?.toInt() ?? 0,
        stopId: (json['stopId'] as num?)?.toInt() ?? 0,
        stopName: json['stopName'] as String? ?? '',
        arriveAt: json['arriveAt'] as String? ?? '',
        dwellMinutes: (json['dwellMinutes'] as num?)?.toInt() ?? 0,
      );

  final int stopSeq;
  final int stopId;
  final String stopName;
  final String arriveAt;
  final int dwellMinutes;

  /// เวลาถึงเป็น `HH:mm` (ค่า ISO `arriveAt`)
  String get arriveTime => hhmm(arriveAt);
}

/// รอบเวลาเดินทาง (`schedule`) — OpenAPI `Schedule`
class Schedule {
  const Schedule({
    required this.schedId,
    required this.routeId,
    required this.routeName,
    required this.serviceDate,
    required this.departAt,
    this.isActive = 1,
    this.totalMinutes,
    this.stopCount,
    this.seatsTotal,
    this.seatsBooked,
    this.seatsAvailable,
    this.driver,
    this.vehicle,
    this.stops = const [],
  });

  factory Schedule.fromJson(Map<String, dynamic> json) => Schedule(
        schedId: (json['schedId'] as num?)?.toInt() ?? 0,
        routeId: (json['routeId'] as num?)?.toInt() ?? 0,
        routeName: json['routeName'] as String? ?? '',
        serviceDate: json['serviceDate'] as String? ?? '',
        departAt: json['departAt'] as String? ?? '',
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
        totalMinutes: (json['totalMinutes'] as num?)?.toInt(),
        stopCount: (json['stopCount'] as num?)?.toInt(),
        seatsTotal: (json['seatsTotal'] as num?)?.toInt(),
        seatsBooked: (json['seatsBooked'] as num?)?.toInt(),
        seatsAvailable: (json['seatsAvailable'] as num?)?.toInt(),
        driver: json['driver'] is Map<String, dynamic>
            ? EmployeeBrief.fromJson(json['driver'] as Map<String, dynamic>)
            : null,
        vehicle: json['vehicle'] is Map<String, dynamic>
            ? Vehicle.fromJson(json['vehicle'] as Map<String, dynamic>)
            : null,
        stops: [
          for (final item in (json['stops'] as List<dynamic>?) ?? const [])
            if (item is Map<String, dynamic>) ScheduleStop.fromJson(item),
        ],
      );

  final int schedId;
  final int routeId;
  final String routeName;
  final String serviceDate;
  final String departAt;
  final int isActive;
  final int? totalMinutes;
  final int? stopCount;
  final int? seatsTotal;
  final int? seatsBooked;
  final int? seatsAvailable;
  final EmployeeBrief? driver;
  final Vehicle? vehicle;
  final List<ScheduleStop> stops;

  /// เวลาออกเดินทางเป็น `HH:mm` (ค่า ISO `departAt`)
  String get departTime => hhmm(departAt);
}

/// ผลลัพธ์ `PUT /schedules/{schedId}/assignments` — OpenAPI `AssignmentResponse`
class AssignmentResult {
  const AssignmentResult({
    required this.schedId,
    required this.driver,
    required this.vehicle,
  });

  factory AssignmentResult.fromJson(Map<String, dynamic> json) =>
      AssignmentResult(
        schedId: (json['schedId'] as num?)?.toInt() ?? 0,
        driver: json['driver'] is Map<String, dynamic>
            ? EmployeeBrief.fromJson(json['driver'] as Map<String, dynamic>)
            : const EmployeeBrief(empId: 0, fullName: ''),
        vehicle: json['vehicle'] is Map<String, dynamic>
            ? Vehicle.fromJson(json['vehicle'] as Map<String, dynamic>)
            : const Vehicle(
                vehId: 0,
                plateNo: '',
                vtypeId: 0,
                typeName: '',
                capacity: 0,
              ),
      );

  final int schedId;
  final EmployeeBrief driver;
  final Vehicle vehicle;
}

List<Schedule> parseSchedules(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อรอบเวลา'))
        if (item is Map<String, dynamic>) Schedule.fromJson(item),
    ];

List<Vehicle> parseVehicles(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อรถ'))
        if (item is Map<String, dynamic>) Vehicle.fromJson(item),
    ];

List<VehicleType> parseVehicleTypes(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อประเภทรถ'))
        if (item is Map<String, dynamic>) VehicleType.fromJson(item),
    ];

/// ตัดเวลา `HH:mm` จากค่า ISO 8601 (เช่น `2026-10-01T09:30:00` → `09:30`)
String hhmm(String iso) {
  if (iso.length >= 16 && iso[10] == 'T') return iso.substring(11, 16);
  final parsed = DateTime.tryParse(iso);
  if (parsed != null) {
    return '${parsed.hour.toString().padLeft(2, '0')}'
        ':${parsed.minute.toString().padLeft(2, '0')}';
  }
  return iso;
}

List<dynamic> _expectList(dynamic data, String label) {
  if (data is List) return data;
  throw ApiException('รูปแบบ$labelจากเซิร์ฟเวอร์ไม่ถูกต้อง');
}
