import '../../core/network/api_client.dart';
import 'driver_models.dart';

/// T-048/T-049 (UC-22/23/24) — ตารางงาน / เริ่มรอบ / Manifest ของคนขับ
/// ตาม `docs/api/openapi.yaml` (`/api/v1`)
class DriverRepository {
  DriverRepository(this._client);

  final ApiClient _client;

  /// GET /driver/today — UC-22 รอบของตัวเองในวัน `serviceDate` (yyyy-MM-dd)
  /// เซิร์ฟเวอร์กรองด้วย empId ของ token (ผู้โดยสารไม่เห็นรอบนี้)
  Future<DriverDay> fetchDriverToday({required String serviceDate}) async {
    final res = await _client.dio.get<dynamic>(
      '/driver/today',
      queryParameters: {'serviceDate': serviceDate},
    );
    return parseDriverDay(res.data);
  }

  /// POST /driver/trips — UC-23 · x-permission `TRIP.START` · body `{schedId, vehId}`
  /// 201 = เริ่มสำเร็จ · 409 = เริ่มซ้ำ / รถไม่ตรงกับที่จัดไว้
  /// (ข้อความแสดงผลใช้ของที่เซิร์ฟเวอร์ส่งมา)
  Future<Trip> startTrip({required int schedId, required int vehId}) async {
    final res = await _client.dio.post<dynamic>(
      '/driver/trips',
      data: {'schedId': schedId, 'vehId': vehId},
    );
    return parseTrip(res.data);
  }

  /// GET /driver/trips/{tripId}/manifest — UC-24 ผู้โดยสารขึ้น/ลง รายจุดจอด
  Future<DriverManifest> fetchDriverManifest({required int tripId}) async {
    final res =
        await _client.dio.get<dynamic>('/driver/trips/$tripId/manifest');
    return parseDriverManifest(res.data);
  }

  /// POST /driver/trips/{tripId}/end — ปิดรอบเดินรถ (UC-26)
  /// · x-permission `TRIP.END` · 204
  /// ใช้ในทางเลือก "ปิดรอบเก่าก่อน" ของ conflict dialog (UC-23)
  /// และปุ่ม "ปิดรอบการเดินทาง" ใน Manifest (T-051)
  Future<void> endTrip({required int tripId}) =>
      _client.dio.post<void>('/driver/trips/$tripId/end');

  /// POST /driver/bookings/scan — UC-25 เช็คอินขึ้นรถด้วย QR
  /// · x-permission `QR.SCAN` · BR-09
  /// 200 = สำเร็จ (`CheckinResult`) · 409 = สแกนซ้ำ / ผิดรอบ (ข้อความเซิร์ฟเวอร์)
  /// · 404 = ไม่พบ `qrToken`
  Future<CheckinResult> scanCheckin({
    required String qrToken,
    required int tripId,
  }) async {
    final res = await _client.dio.post<dynamic>(
      '/driver/bookings/scan',
      data: {'qrToken': qrToken, 'tripId': tripId},
    );
    return parseCheckinResult(res.data);
  }
}
