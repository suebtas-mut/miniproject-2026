import '../../core/network/api_client.dart';
import '../front/schedule_models.dart';
import 'booking_models.dart';

/// T-040 (UC-17/UC-18) — จองรถ ตาม `docs/api/openapi.yaml`
///
/// - `GET /schedules?availableOnly=true` = รอบที่ยังมีที่นั่งว่าง (ฝั่งเซิร์ฟเวอร์กรอง BR-07)
/// - `GET /schedules/{schedId}/seats` = แผนผังที่นั่ง (BR-06/BR-07)
/// - `POST /bookings` = สร้างการจอง (x-permission BK.CREATE · 409 SEATS_FULL · 422 BR06/BR07)
///   เงื่อนไขเวลา BR-05 ถูกตรวจฝั่งเซิร์ฟเวอร์ที่ POST — คืน Error message มาให้ UI แสดงตามที่มา
class BookingRepository {
  BookingRepository(this._client);

  final ApiClient _client;

  /// GET /schedules — เฉพาะรอบที่จองได้: `serviceDate` (yyyy-MM-dd) +
  /// `activeOnly=true` + `availableOnly=true`
  Future<List<Schedule>> fetchAvailableSchedules({
    required String serviceDate,
  }) async {
    final res = await _client.dio.get<dynamic>('/schedules', queryParameters: {
      'serviceDate': serviceDate,
      'activeOnly': true,
      'availableOnly': true,
    });
    return parseSchedules(res.data);
  }

  /// GET /schedules/{schedId}/seats — `serviceDate` ต้องตรงกับ
  /// `schedule.service_date` (OpenAPI) · 404 เมื่อไม่พบรอบ
  Future<SeatMap> fetchSeatMap({
    required int schedId,
    required String serviceDate,
  }) async {
    final res = await _client.dio
        .get<dynamic>('/schedules/$schedId/seats', queryParameters: {
      'serviceDate': serviceDate,
    });
    return parseSeatMap(res.data);
  }

  /// POST /bookings — x-permission BK.CREATE · รูปแบบกายภาพตาม `BookingCreate`
  /// (seats 1–4) · 409 `SEATS_FULL` · 422 `BR06_SEATS_RANGE`/`BR07_STOP_ORDER`
  Future<BookingRecord> createBooking({
    required int schedId,
    required int boardStopId,
    required int alightStopId,
    required int seats,
  }) async {
    final res = await _client.dio.post<dynamic>('/bookings', data: {
      'schedId': schedId,
      'boardStopId': boardStopId,
      'alightStopId': alightStopId,
      'seats': seats,
    });
    return parseBooking(res.data);
  }

  /// GET /bookings — UC-19 รายการจองของฉัน (เซิร์ฟเวอร์กรองตามผู้ login)
  /// · `status` = กรองตามแท็บ (BookingStatus: reserved | checked_in |
  /// completed | cancelled | no_show) · ไม่ส่ง = ทั้งหมด
  Future<List<BookingRecord>> fetchMyBookings({String? status}) async {
    final res = await _client.dio.get<dynamic>(
      '/bookings',
      queryParameters: status == null ? null : {'status': status},
    );
    return parseBookings(res.data);
  }

  /// GET /bookings/{bookingCode} — UC-20 รายละเอียด + `qrToken`
  /// · 403 = เป็นการจองของผู้อื่น · 404 = ไม่พบ
  Future<BookingRecord> fetchBooking({required String bookingCode}) async {
    final res = await _client.dio.get<dynamic>('/bookings/$bookingCode');
    return parseBooking(res.data);
  }

  /// POST /bookings/{bookingCode}/cancel — UC-21 · x-permission BK.CANCEL
  /// · 204 สำเร็จ (ไม่มี body) · 409 `CANCEL_NOT_ALLOWED` (เช็คอินแล้ว/เลยเวลา)
  /// เงื่อนไขเวลายกเลิก (Q6/ASM-07-2) เซิร์ฟเวอร์ตรวจ — UI แสดง message ตามที่มา
  Future<void> cancelBooking({required String bookingCode}) async {
    await _client.dio.post<dynamic>('/bookings/$bookingCode/cancel');
  }
}
