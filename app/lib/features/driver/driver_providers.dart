import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'driver_models.dart';
import 'driver_repository.dart';

final driverRepositoryProvider = Provider<DriverRepository>(
  (ref) => DriverRepository(ref.watch(apiClientProvider)),
);

/// ตารางงานคนขับประจำวัน — UC-22 (`serviceDate` = yyyy-MM-dd)
final driverTodayProvider =
    FutureProvider.autoDispose.family<DriverDay, String>(
  (ref, serviceDate) => ref
      .watch(driverRepositoryProvider)
      .fetchDriverToday(serviceDate: serviceDate),
  name: 'driverToday',
);

/// Manifest ของรอบที่กำลังขับ — UC-24 (`tripId`)
final driverManifestProvider =
    FutureProvider.autoDispose.family<DriverManifest, int>(
  (ref, tripId) =>
      ref.watch(driverRepositoryProvider).fetchDriverManifest(tripId: tripId),
  name: 'driverManifest',
);

/// `tripId` ของรอบที่ "เริ่มจากเครื่องนี้" — `schedId → tripId`
///
/// `DriverTripBrief` ไม่มี `tripId` (ข้อจำกัดสัญญา OpenAPI) ระบบจึงจำได้
/// เฉพาะรอบที่เริ่มผ่านอุปกรณ์นี้ในรอบใช้งานนี้เท่านั้น — ใช้เปิด Manifest
/// ซ้ำและเลือก "ปิดรอบเก่าก่อน" ใน conflict dialog (UC-23)
final startedTripsProvider = StateProvider<Map<int, int>>((ref) => {});
