import '../../core/network/api_client.dart';
import '../../core/network/api_error.dart';
import 'schedule_models.dart';

/// T-033 (UC-14/15/16) — รอบเวลา + มัดจำคนขับ/รถ + ประเภทรถ ตาม `docs/api/openapi.yaml`
///
/// หมายเหตุ (Q23): OpenAPI ไม่มี `PUT /schedules/{schedId}` — แก้เวลาออกไม่ได้;
/// มีแต่ `PUT /schedules/{schedId}/assignments` สำหรับมอบหมายคนขับ/รถเท่านั้น
class ScheduleRepository {
  ScheduleRepository(this._client);

  final ApiClient _client;

  /// GET /schedules — กรองด้วย `serviceDate` (yyyy-MM-dd) / `routeId` / `activeOnly`
  Future<List<Schedule>> fetchSchedules({
    String? serviceDate,
    int? routeId,
    bool activeOnly = true,
  }) async {
    final res = await _client.dio.get<dynamic>('/schedules', queryParameters: {
      'activeOnly': activeOnly,
      if (serviceDate != null && serviceDate.isNotEmpty)
        'serviceDate': serviceDate,
      if (routeId != null) 'routeId': routeId,
    });
    return parseSchedules(res.data);
  }

  /// GET /schedules/{schedId} — ใช้ดึง `vehicle.vehId` ตอนเริ่มรอบคนขับ (UC-23)
  Future<Schedule> fetchSchedule(int schedId) async {
    final res = await _client.dio.get<dynamic>('/schedules/$schedId');
    return _schedule(res.data);
  }

  /// POST /schedules — x-permission SCHED.EDIT · 409 ซ้ำ (route+date+depart) · 422 BR02
  Future<Schedule> createSchedule(Map<String, dynamic> body) async {
    final res = await _client.dio.post<dynamic>('/schedules', data: body);
    return _schedule(res.data);
  }

  /// DELETE /schedules/{schedId} — x-permission SCHED.EDIT · 409 เมื่อยังมีการจอง
  Future<void> cancelSchedule(int schedId) =>
      _client.dio.delete<void>('/schedules/$schedId');

  /// PUT /schedules/{schedId}/assignments — x-permission SCHED.EDIT
  /// 400 NOT_A_DRIVER · 409 BR04_DRIVER_CONFLICT
  Future<AssignmentResult> setAssignments(
    int schedId, {
    required int empId,
    required int vehId,
  }) async {
    final res = await _client.dio
        .put<dynamic>('/schedules/$schedId/assignments', data: {
      'empId': empId,
      'vehId': vehId,
    });
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException(
          'รูปแบบผลลัพธ์การมอบหมายจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return AssignmentResult.fromJson(data);
  }

  /// GET /vehicle-types — 401 เท่านั้น (ไม่มีสิทธิ์ VIEW แยกต่างหาก)
  Future<List<VehicleType>> fetchVehicleTypes() async {
    final res = await _client.dio.get<dynamic>('/vehicle-types');
    return parseVehicleTypes(res.data);
  }

  /// POST /vehicle-types — x-permission VEH.EDIT
  Future<VehicleType> createVehicleType(Map<String, dynamic> body) async {
    final res = await _client.dio.post<dynamic>('/vehicle-types', data: body);
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลประเภทรถจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return VehicleType.fromJson(data);
  }

  /// GET /vehicles — กรองด้วย `activeOnly` / `vtypeId`
  Future<List<Vehicle>> fetchVehicles({
    bool activeOnly = true,
    int? vtypeId,
  }) async {
    final res = await _client.dio.get<dynamic>('/vehicles', queryParameters: {
      'activeOnly': activeOnly,
      if (vtypeId != null) 'vtypeId': vtypeId,
    });
    return parseVehicles(res.data);
  }

  /// POST /vehicles — x-permission VEH.EDIT · 409 เมื่อ `plateNo` ซ้ำ
  Future<Vehicle> createVehicle(Map<String, dynamic> body) async {
    final res = await _client.dio.post<dynamic>('/vehicles', data: body);
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลรถจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return Vehicle.fromJson(data);
  }

  Schedule _schedule(dynamic data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลรอบเวลาจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return Schedule.fromJson(data);
  }
}
