import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../front/schedule_models.dart';
import 'booking_models.dart';
import 'booking_repository.dart';

final bookingRepositoryProvider = Provider<BookingRepository>(
  (ref) => BookingRepository(ref.watch(apiClientProvider)),
);

/// รอบที่ยังจองได้ของวันที่เลือก — คีย์ = `serviceDate` (yyyy-MM-dd)
final availableTripsProvider =
    FutureProvider.autoDispose.family<List<Schedule>, String>(
  (ref, serviceDate) => ref
      .watch(bookingRepositoryProvider)
      .fetchAvailableSchedules(serviceDate: serviceDate),
  name: 'availableTrips',
);

/// แผนผังที่นั่งของรอบ — คีย์ = 'schedId|serviceDate'
/// (`serviceDate` ต้องตรงกับ `schedule.service_date` ตาม OpenAPI)
final seatMapProvider = FutureProvider.autoDispose.family<SeatMap, String>(
  (ref, key) {
    final separator = key.indexOf('|');
    final schedId = int.parse(key.substring(0, separator));
    final serviceDate = key.substring(separator + 1);
    return ref
        .watch(bookingRepositoryProvider)
        .fetchSeatMap(schedId: schedId, serviceDate: serviceDate);
  },
  name: 'seatMap',
);

/// UC-19 — รายการจองของฉัน กรองตามแท็บ · คีย์ = `status`
/// ('' = ไม่กรอง · 'reserved' | 'checked_in' | 'completed' | 'cancelled')
final myBookingsProvider =
    FutureProvider.autoDispose.family<List<BookingRecord>, String>(
  (ref, status) => ref.watch(bookingRepositoryProvider).fetchMyBookings(
        status: status.isEmpty ? null : status,
      ),
  name: 'myBookings',
);

/// UC-20 — รายละเอียดการจอง (สร้าง QR) · คีย์ = `bookingCode`
final bookingDetailProvider =
    FutureProvider.autoDispose.family<BookingRecord, String>(
  (ref, bookingCode) => ref
      .watch(bookingRepositoryProvider)
      .fetchBooking(bookingCode: bookingCode),
  name: 'bookingDetail',
);
