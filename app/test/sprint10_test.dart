import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_client.dart';
import 'package:shuttle_app/core/network/api_error.dart';
import 'package:shuttle_app/core/providers.dart';
import 'package:shuttle_app/features/driver/driver_models.dart';
import 'package:shuttle_app/features/driver/manifest_screen.dart';

import 'support/fake_backend.dart';

/// Sprint 10 — T-048/T-049 (UC-22/23/24)
///
/// ครอบคลุม: สัญญา OpenAPI ของ `GET /driver/today` · `POST /driver/trips` ·
/// `GET /driver/trips/{tripId}/manifest` · `POST /driver/trips/{tripId}/end`,
/// x-permission `TRIP.START`/`TRIP.END`, conflict BR-04 (ปิดรอบเก่าก่อน/ออก),
/// 409 เริ่มซ้ำ, การเปิด Manifest ซ้ำ (ข้อจำกัด: `DriverTripBrief` ไม่มี
/// `tripId` — จำได้เฉพาะรอบที่เริ่มจากเครื่องนี้) และการจัดกลุ่มผู้โดยสาร
/// ขึ้น/ลง รายจุดจอดตาม stop_seq
void main() {
  Map<String, dynamic> perm(
    int permId,
    String permCode,
    String module, {
    int sortNo = 0,
    String? screenKey,
  }) =>
      {
        'permId': permId,
        'permCode': permCode,
        'permName': permCode,
        'module': module,
        'screenKey': screenKey,
        'sortNo': sortNo,
      };

  Map<String, dynamic> authMe({
    required List<Map<String, dynamic>> permissions,
    List<String>? modules,
    List<String> roles = const ['DRIVER'],
  }) =>
      {
        'user': {
          'empId': 7,
          'empCode': 'E007',
          'firstName': 'Ada',
          'lastName': 'Lovelace',
          'username': 'ada',
          'isActive': 1,
          'roles': roles,
        },
        'roles': roles,
        'permissions': permissions,
        'modules': modules ??
            {
              for (final permission in permissions)
                permission['module'] as String,
            }.toList(),
      };

  List<Map<String, dynamic>> driverPermissions({
    bool tripStart = true,
    bool tripEnd = true,
  }) =>
      [
        perm(40, 'QR.SCAN', 'driver', sortNo: 40),
        if (tripStart) perm(41, 'TRIP.START', 'driver', sortNo: 41),
        if (tripEnd) perm(42, 'TRIP.END', 'driver', sortNo: 42),
      ];

  // นาฬิกาอ้างอิง — จุดจอดใน Manifest ใช้เวลาสัมพัทธ์ (ผ่านแล้ว/ยังไม่ถึง)
  final testStart = DateTime.now();

  String isoAt(int minutesFromStart) {
    final t = testStart.add(Duration(minutes: minutesFromStart));
    return '${t.year.toString().padLeft(4, '0')}-'
        '${t.month.toString().padLeft(2, '0')}-'
        '${t.day.toString().padLeft(2, '0')}T'
        '${t.hour.toString().padLeft(2, '0')}:'
        '${t.minute.toString().padLeft(2, '0')}:00';
  }

  Map<String, dynamic> brief({
    int schedId = 1,
    int routeId = 1,
    String routeName = 'สายเหนือ',
    String departAt = '2026-10-01T09:30:00',
    String status = 'upcoming',
    String plateNo = 'สย 2591',
    int passengerCount = 8,
    int totalMinutes = 13,
    int stopCount = 4,
  }) =>
      {
        'schedId': schedId,
        'routeId': routeId,
        'routeName': routeName,
        'departAt': departAt,
        'totalMinutes': totalMinutes,
        'stopCount': stopCount,
        'status': status,
        'plateNo': plateNo,
        'passengerCount': passengerCount,
      };

  Map<String, dynamic> dayFixture(List<Map<String, dynamic>> trips) => {
        'serviceDate': '2026-10-01',
        'trips': trips,
      };

  Map<String, dynamic> scheduleDetail({
    required int schedId,
    int vehId = 9,
    String plateNo = 'สย 2591',
  }) =>
      {
        'schedId': schedId,
        'routeId': 1,
        'routeName': 'สายเหนือ',
        'serviceDate': '2026-10-01',
        'departAt': '2026-10-01T09:30:00',
        'isActive': 1,
        'vehicle': {
          'vehId': vehId,
          'plateNo': plateNo,
          'vtypeId': 1,
          'typeName': 'รถตู้ 15 ที่นั่ง',
          'capacity': 15,
          'isActive': 1,
        },
      };

  Map<String, dynamic> tripResult({
    required int tripId,
    required int schedId,
    int vehId = 9,
  }) =>
      {
        'tripId': tripId,
        'schedId': schedId,
        'driverId': 7,
        'vehId': vehId,
        'startTime': '2026-10-01T09:30:12',
        'endTime': null,
        'status': 'running',
      };

  List<Map<String, dynamic>> manifestPassengers() => [
        {
          'bookingId': 1,
          'bookingCode': 'BK-1',
          'customerName': 'สมชาย ใจดี',
          'seats': 2,
          'boardSeq': 1,
          'boardStopName': 'คลองเตย',
          'alightSeq': 3,
          'alightStopName': 'หมอชิต',
          'status': 'confirmed',
          'checkedIn': true,
        },
        {
          'bookingId': 2,
          'bookingCode': 'BK-2',
          'customerName': 'สุดา รักดี',
          'seats': 1,
          'boardSeq': 1,
          'boardStopName': 'คลองเตย',
          'alightSeq': 2,
          'alightStopName': 'เอราวัณ',
          'status': 'confirmed',
          'checkedIn': false,
        },
        {
          'bookingId': 3,
          'bookingCode': 'BK-3',
          'customerName': 'ปิยะ มั่นคง',
          'seats': 2,
          'boardSeq': 2,
          'boardStopName': 'เอราวัณ',
          'alightSeq': 3,
          'alightStopName': 'หมอชิต',
          'status': 'confirmed',
          'checkedIn': true,
        },
      ];

  // จุด 1 = ผ่านแล้ว (ย้อนหลัง) · จุด 2/3 = ยังไม่ถึง (ล่วงหน้า)
  Map<String, dynamic> manifestFixture({
    List<Map<String, dynamic>>? passengers,
    int totalPassengers = 3,
    int tripId = 55,
    String departAt = '2026-10-01T09:30:00',
  }) =>
      {
        'schedId': 1,
        'routeName': 'สายเหนือ',
        'serviceDate': '2026-10-01',
        'departAt': departAt,
        'totalPassengers': totalPassengers,
        'totalSeats': 15,
        'tripId': tripId,
        'tripStatus': 'running',
        'plateNo': 'สย 2591',
        'passengers': passengers ?? manifestPassengers(),
        'stops': [
          {
            'stopSeq': 1,
            'stopId': 1,
            'stopName': 'คลองเตย',
            'arriveAt': isoAt(-30),
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 2,
            'stopId': 2,
            'stopName': 'เอราวัณ',
            'arriveAt': isoAt(15),
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 3,
            'stopId': 3,
            'stopName': 'หมอชิต',
            'arriveAt': isoAt(45),
            'dwellMinutes': 0,
          },
        ],
      };

  Future<ShuttleHarness> pumpDriver(
    WidgetTester tester, {
    required Map<String, dynamic> me,
    Size size = const Size(390, 844),
    void Function(FakeBackend backend)? routes,
  }) {
    return pumpShuttle(
      tester,
      token: 'jwt-sprint10',
      initialLocation: '/driver',
      size: size,
      routes: (backend) {
        backend.on('GET', '/api/v1/auth/me', (request) {
          return jsonResponse(200, me);
        });
        routes?.call(backend);
      },
    );
  }

  /// แสดงหน้า Manifest ตรง ๆ ด้วย container/backend ชุดเดียวกับแอป
  /// (UC-24 ไม่มี x-permission จึงไม่ต้องผ่านเส้นทาง)
  Future<ShuttleHarness> pumpManifest(
    WidgetTester tester, {
    required void Function(FakeBackend backend) routes,
    int tripId = 55,
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    routes(backend);
    final storage = FakeTokenStorage(token: 'jwt-sprint10');
    final client = ApiClient(
      tokenStorage: storage,
      baseUrl: 'http://shuttle.test/api/v1',
    );
    client.dio.httpClientAdapter = backend;
    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(client),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(home: ManifestScreen(tripId: tripId)),
      ),
    );
    await pumpFrames(tester, count: 10);
    return ShuttleHarness(
      container: container,
      backend: backend,
      storage: storage,
    );
  }

  Future<void> tapKey(WidgetTester tester, Key key) async {
    final finder = find.byKey(key);
    await tester.ensureVisible(finder);
    await pumpFrames(tester, count: 4);
    await tester.tap(finder);
    await pumpFrames(tester, count: 8);
  }

  String? chipLabel(WidgetTester tester, int schedId) => tester
      .widget<Text>(
        find.descendant(
          of: find.byKey(Key('drv-status-$schedId')),
          matching: find.byType(Text),
        ),
      )
      .data;

  String? statValue(WidgetTester tester, Key key) =>
      tester.widget<Text>(find.byKey(key)).data;

  String? textOfKey(WidgetTester tester, Key key) =>
      tester.widget<Text>(find.byKey(key)).data;

  group('Sprint 10 · T-048/T-049 contract parsing', () {
    test(
        'parse รับสัญญา OpenAPI ของ DriverDay/Trip/DriverManifest และ reject รูปแบบผิด',
        () {
      final day = parseDriverDay(dayFixture([brief()]));
      expect(day.serviceDate, '2026-10-01');
      expect(day.trips, hasLength(1));
      expect(day.trips.first.departTime, '09:30');
      expect(day.totalPassengers, 8);
      expect(day.runningTrips, isEmpty);

      final runningDay = parseDriverDay(
        dayFixture([brief(status: 'running', schedId: 2)]),
      );
      expect(runningDay.runningTrips, hasLength(1));

      expect(
        () => parseDriverDay({'serviceDate': '2026-10-01', 'trips': 'bad'}),
        throwsA(isA<ApiException>()),
      );
      expect(() => parseDriverDay('not-a-map'), throwsA(isA<ApiException>()));

      final trip = parseTrip(tripResult(tripId: 55, schedId: 1));
      expect(trip.tripId, 55);
      expect(trip.schedId, 1);
      expect(trip.status, 'running');
      expect(trip.endTime, isNull);
      expect(() => parseTrip([1, 2]), throwsA(isA<ApiException>()));

      final manifest = parseDriverManifest(manifestFixture());
      expect(manifest.tripId, 55);
      expect(manifest.stops, hasLength(3));
      expect(manifest.stops.first.stopSeq, 1);
      expect(manifest.passengers, hasLength(3));
      expect(manifest.checkedInCount, 2);
      expect(manifest.departTime, '09:30');
      expect(manifest.passengers.first.checkedIn, isTrue);
      expect(
        () => parseDriverManifest({
          'schedId': 1,
          'passengers': <dynamic>[],
          'stops': null,
        }),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('Sprint 10 · T-048 D1 ตารางงานคนขับ', () {
    testWidgets(
        'D1 contract: GET /driver/today มี serviceDate+Bearer · การ์ดครบ · เลือกอัตโนมัติ',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(
              200,
              dayFixture([
                brief(),
                brief(
                  schedId: 2,
                  routeId: 2,
                  routeName: 'สายในเมือง',
                  departAt: '2026-10-01T11:00:00',
                  passengerCount: 10,
                  totalMinutes: 25,
                  stopCount: 6,
                ),
              ]),
            );
          });
        },
      );

      final todayReqs =
          harness.backend.requestsFor('GET', '/api/v1/driver/today');
      expect(todayReqs, hasLength(1));
      expect(
        todayReqs.single.query['serviceDate'],
        matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')),
      );
      expect(todayReqs.single.headers['authorization'], 'Bearer jwt-sprint10');
      expect(harness.location, '/driver');

      expect(find.byKey(const Key('drv-appbar-date')), findsOneWidget);
      expect(find.text('คนขับ · 2026-10-01'), findsOneWidget);
      expect(find.byKey(const Key('drv-card-1')), findsOneWidget);
      expect(find.byKey(const Key('drv-card-2')), findsOneWidget);
      expect(find.text('09:30 · สายเหนือ'), findsOneWidget);
      expect(find.text('11:00 · สายในเมือง'), findsOneWidget);
      expect(find.text('13 นาที · 4 จุดจอด · รถ สย 2591'), findsOneWidget);
      expect(find.text('25 นาที · 6 จุดจอด · รถ สย 2591'), findsOneWidget);
      expect(find.text('ผู้โดยสาร 8 คน'), findsOneWidget);
      expect(statValue(tester, const Key('drv-stat-rounds')), '2');
      expect(statValue(tester, const Key('drv-stat-passengers')), '18');
      expect(chipLabel(tester, 1), 'ถัดไป');
      expect(chipLabel(tester, 2), 'รอ');
      expect(find.byKey(const Key('drv-filter-all')), findsOneWidget);
      expect(find.byKey(const Key('drv-filter-1')), findsOneWidget);
      expect(find.byKey(const Key('drv-filter-2')), findsOneWidget);
      expect(find.byKey(const Key('drv-br04-note')), findsOneWidget);
      expect(find.byKey(const Key('drv-conflict-banner')), findsNothing);

      // เลือกรอบแรก (upcoming) อัตโนมัติ — แตะการ์ดรอบ 2 แล้วปุ่มเปลี่ยนตาม
      expect(find.text('เริ่มเดินทางรอบ 09:30'), findsOneWidget);
      await tapKey(tester, const Key('drv-card-2'));
      expect(find.text('เริ่มเดินทางรอบ 11:00'), findsOneWidget);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips'),
        isEmpty,
      );
    });

    testWidgets('D1 วันว่าง: EmptyState และไม่มีปุ่มเริ่มเดินทาง',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(200, dayFixture([]));
          });
        },
      );
      expect(find.byKey(const Key('list-empty')), findsOneWidget);
      expect(find.text('ยังไม่มีรอบเดินทางในวันนี้'), findsOneWidget);
      expect(find.byKey(const Key('drv-start')), findsNothing);
      expect(harness.location, '/driver');
    });

    testWidgets(
        'D1 403 (ไม่มีบทบาท): แสดงข้อความเซิร์ฟเวอร์ + ลองอีกครั้งแล้วได้ข้อมูล',
        (tester) async {
      var calls = 0;
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            calls += 1;
            if (calls == 1) {
              return jsonResponse(
                403,
                {'code': 'FORBIDDEN', 'message': 'บัญชีนี้ไม่มีบทบาท DRIVER'},
              );
            }
            return jsonResponse(200, dayFixture([brief()]));
          });
        },
      );

      expect(find.byKey(const Key('list-error-message')), findsOneWidget);
      expect(find.text('บัญชีนี้ไม่มีบทบาท DRIVER'), findsOneWidget);

      await tester.tap(find.text('ลองอีกครั้ง'));
      await pumpFrames(tester, count: 10);

      expect(
        harness.backend.requestsFor('GET', '/api/v1/driver/today'),
        hasLength(2),
      );
      expect(find.byKey(const Key('drv-card-1')), findsOneWidget);
      expect(harness.location, '/driver');
    });

    testWidgets('D1 ไม่มี TRIP.START: ปุ่มเริ่มเดินทางปิดใช้งานและไม่มี POST',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(
          permissions: driverPermissions(tripStart: false),
        ),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(200, dayFixture([brief()]));
          });
        },
      );

      final button = tester.widget<FilledButton>(
        find.byKey(const Key('drv-start')),
      );
      expect(button.onPressed, isNull);
      expect(find.text('เริ่มเดินทางรอบ 09:30'), findsOneWidget);

      await tapKey(tester, const Key('drv-start'));
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips'),
        isEmpty,
      );
      expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules/1'),
        isEmpty,
      );
      expect(harness.location, '/driver');
    });

    testWidgets(
        'D1 กรองตามเส้นทาง: แตะชิปเส้นทางแล้วการ์ดกรองตาม · ทั้งหมดคืนมา',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(
              200,
              dayFixture([
                brief(),
                brief(
                  schedId: 2,
                  routeId: 2,
                  routeName: 'สายในเมือง',
                  departAt: '2026-10-01T11:00:00',
                ),
              ]),
            );
          });
        },
      );

      expect(find.byKey(const Key('drv-card-1')), findsOneWidget);
      expect(find.byKey(const Key('drv-card-2')), findsOneWidget);

      await tapKey(tester, const Key('drv-filter-2'));
      expect(find.byKey(const Key('drv-card-1')), findsNothing);
      expect(find.byKey(const Key('drv-card-2')), findsOneWidget);

      await tapKey(tester, const Key('drv-filter-all'));
      expect(find.byKey(const Key('drv-card-1')), findsOneWidget);
      expect(find.byKey(const Key('drv-card-2')), findsOneWidget);
      expect(
        harness.backend.requestsFor('GET', '/api/v1/driver/today'),
        hasLength(1),
      );
    });

    testWidgets(
        'conflict BR-04: เตือนรอบค้าง + หมายเหตุข้อจำกัด tripId · "ออก" ไม่ส่ง POST',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(
              200,
              dayFixture([
                brief(),
                brief(
                  schedId: 2,
                  departAt: '2026-10-01T11:00:00',
                  status: 'running',
                ),
              ]),
            );
          });
        },
      );

      expect(find.byKey(const Key('drv-conflict-banner')), findsOneWidget);
      expect(find.text('มีรอบกำลังเดิน: 11:00 · สายเหนือ'), findsOneWidget);

      await tapKey(tester, const Key('drv-start'));

      expect(find.byKey(const Key('drv-conflict-dialog')), findsOneWidget);
      expect(find.text('มีรอบเดินทางค้างอยู่'), findsOneWidget);
      expect(
        find.text('รอบ 11:00 · สายเหนือ · รถ สย 2591'),
        findsOneWidget,
      );
      // DriverTripBrief ไม่มี tripId → ยังไม่รู้รอบค้างนี้ (ไม่ได้เริ่มจากเครื่องนี้)
      expect(find.byKey(const Key('drv-conflict-gap')), findsOneWidget);
      expect(find.byKey(const Key('drv-conflict-end')), findsNothing);

      await tapKey(tester, const Key('drv-conflict-cancel'));
      expect(find.byKey(const Key('drv-conflict-dialog')), findsNothing);
      expect(harness.location, '/driver');
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips'),
        isEmpty,
      );
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips/2/end'),
        isEmpty,
      );
      expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules/1'),
        isEmpty,
      );
    });
  });

  group('Sprint 10 · T-048 เริ่มรอบ (UC-23)', () {
    testWidgets(
        'เริ่มรอบสำเร็จ: GET schedule หา vehId → POST {schedId,vehId} → เปิด Manifest',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(200, dayFixture([brief()]));
          });
          backend.on('GET', '/api/v1/schedules/1', (request) {
            return jsonResponse(200, scheduleDetail(schedId: 1));
          });
          backend.on('POST', '/api/v1/driver/trips', (request) {
            return jsonResponse(201, tripResult(tripId: 55, schedId: 1));
          });
          backend.on('GET', '/api/v1/driver/trips/55/manifest', (request) {
            return jsonResponse(200, manifestFixture());
          });
        },
      );

      await tapKey(tester, const Key('drv-start'));

      final scheduleReqs =
          harness.backend.requestsFor('GET', '/api/v1/schedules/1');
      expect(scheduleReqs, hasLength(1));
      expect(
        scheduleReqs.single.headers['authorization'],
        'Bearer jwt-sprint10',
      );

      final startReqs =
          harness.backend.requestsFor('POST', '/api/v1/driver/trips');
      expect(startReqs, hasLength(1));
      expect(startReqs.single.body, {'schedId': 1, 'vehId': 9});

      expect(find.byKey(const Key('drv-manifest-title')), findsOneWidget);
      expect(textOfKey(tester, const Key('drv-manifest-title')),
          'รอบ 09:30 · สายเหนือ');
      expect(textOfKey(tester, const Key('drv-manifest-boarded')),
          'ผู้โดยสารขึ้นรถ 2 / 3');
      expect(find.byKey(const Key('drv-manifest-list')), findsOneWidget);
      expect(find.byKey(const Key('drv-conflict-dialog')), findsNothing);
      // เริ่มสำเร็จ → โหลดตารางวันใหม่ (รอบกลายเป็น running)
      expect(
        harness.backend.requestsFor('GET', '/api/v1/driver/today').length,
        greaterThanOrEqualTo(2),
      );
    });

    testWidgets(
        'POST /driver/trips 409 (เริ่มซ้ำ): ข้อความจากเซิร์ฟเวอร์ · ไม่เปิด Manifest · ปุ่มกลับมาใช้ได้',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(200, dayFixture([brief()]));
          });
          backend.on('GET', '/api/v1/schedules/1', (request) {
            return jsonResponse(200, scheduleDetail(schedId: 1));
          });
          backend.on('POST', '/api/v1/driver/trips', (request) {
            return jsonResponse(
              409,
              {
                'code': 'TRIP_ALREADY_STARTED',
                'message': 'เริ่มเดินทางรอบนี้ไปแล้ว',
              },
            );
          });
        },
      );

      await tapKey(tester, const Key('drv-start'));
      await pumpFrames(tester, count: 15);

      expect(find.text('เริ่มเดินทางรอบนี้ไปแล้ว'), findsOneWidget);
      expect(find.byKey(const Key('drv-manifest-title')), findsNothing);
      expect(harness.location, '/driver');
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips'),
        hasLength(1),
      );
      final button = tester.widget<FilledButton>(
        find.byKey(const Key('drv-start')),
      );
      expect(button.onPressed, isNotNull);
    });

    testWidgets(
        'conflict → "ปิดรอบเก่าก่อน": end เสร็จแล้วเริ่มรอบใหม่ได้ (วงจรครบ UC-23)',
        (tester) async {
      var phase = 0;
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            if (phase == 0) {
              return jsonResponse(
                200,
                dayFixture([
                  brief(schedId: 2, departAt: '2026-10-01T09:00:00'),
                  brief(),
                ]),
              );
            }
            return jsonResponse(
              200,
              dayFixture([
                brief(
                  schedId: 2,
                  departAt: '2026-10-01T09:00:00',
                  status: 'running',
                ),
                brief(),
              ]),
            );
          });
          backend.on('GET', '/api/v1/schedules/2', (request) {
            return jsonResponse(200, scheduleDetail(schedId: 2));
          });
          backend.on('GET', '/api/v1/schedules/1', (request) {
            return jsonResponse(200, scheduleDetail(schedId: 1));
          });
          backend.on('POST', '/api/v1/driver/trips', (request) {
            final body = request.body as Map<String, dynamic>;
            if (body['schedId'] == 2) {
              phase = 1;
              return jsonResponse(201, tripResult(tripId: 7, schedId: 2));
            }
            return jsonResponse(201, tripResult(tripId: 8, schedId: 1));
          });
          backend.on('GET', '/api/v1/driver/trips/7/manifest', (request) {
            return jsonResponse(
              200,
              manifestFixture(tripId: 7, departAt: '2026-10-01T09:00:00'),
            );
          });
          backend.on('GET', '/api/v1/driver/trips/8/manifest', (request) {
            return jsonResponse(200, manifestFixture(tripId: 8));
          });
          backend.on('POST', '/api/v1/driver/trips/7/end', (request) {
            return emptyResponse(204);
          });
        },
      );

      // ขั้นที่ 1: เริ่มรอบแรก (ยังไม่มี conflict)
      expect(find.text('เริ่มเดินทางรอบ 09:00'), findsOneWidget);
      await tapKey(tester, const Key('drv-start'));
      expect(textOfKey(tester, const Key('drv-manifest-title')),
          'รอบ 09:00 · สายเหนือ');

      // กลับมา — รอบแรกเป็น running แล้ว
      await tester.pageBack();
      await pumpFrames(tester, count: 15);
      expect(chipLabel(tester, 2), 'กำลังเดิน');
      expect(find.byKey(const Key('drv-conflict-banner')), findsOneWidget);

      // ขั้นที่ 2: เลือกอีกรอบ → conflict → ปิดรอบเก่า → เริ่มต่อ
      await tapKey(tester, const Key('drv-card-1'));
      expect(find.text('เริ่มเดินทางรอบ 09:30'), findsOneWidget);
      await tapKey(tester, const Key('drv-start'));

      expect(find.byKey(const Key('drv-conflict-dialog')), findsOneWidget);
      expect(
        find.text('รอบ 09:00 · สายเหนือ · รถ สย 2591'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('drv-conflict-gap')), findsNothing);
      expect(find.byKey(const Key('drv-conflict-end')), findsOneWidget);

      await tapKey(tester, const Key('drv-conflict-end'));
      await pumpFrames(tester, count: 20);

      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips/7/end'),
        hasLength(1),
      );
      final startReqs =
          harness.backend.requestsFor('POST', '/api/v1/driver/trips');
      expect(startReqs, hasLength(2));
      expect(startReqs[0].body, {'schedId': 2, 'vehId': 9});
      expect(startReqs[1].body, {'schedId': 1, 'vehId': 9});
      expect(textOfKey(tester, const Key('drv-manifest-title')),
          'รอบ 09:30 · สายเหนือ');
      expect(find.byKey(const Key('drv-manifest-list')), findsOneWidget);
    });

    testWidgets(
        'ไม่มี TRIP.END: conflict dialog ไม่โชว์ปิดรอบ และไม่โชว์หมายเหตุ tripId gap',
        (tester) async {
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions(tripEnd: false)),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            return jsonResponse(
              200,
              dayFixture([
                brief(),
                brief(
                  schedId: 2,
                  departAt: '2026-10-01T11:00:00',
                  status: 'running',
                ),
              ]),
            );
          });
        },
      );

      await tapKey(tester, const Key('drv-start'));

      expect(find.byKey(const Key('drv-conflict-dialog')), findsOneWidget);
      expect(find.byKey(const Key('drv-conflict-end')), findsNothing);
      expect(find.byKey(const Key('drv-conflict-gap')), findsNothing);

      await tapKey(tester, const Key('drv-conflict-cancel'));
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips'),
        isEmpty,
      );
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips/2/end'),
        isEmpty,
      );
      expect(harness.location, '/driver');
    });

    testWidgets(
        'รอบ running ในเครื่องนี้: แตะการ์ดเพื่อเปิด Manifest ซ้ำได้ (tripId จาก 201)',
        (tester) async {
      var started = false;
      final harness = await pumpDriver(
        tester,
        me: authMe(permissions: driverPermissions()),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/today', (request) {
            if (!started) {
              return jsonResponse(200, dayFixture([brief()]));
            }
            return jsonResponse(200, dayFixture([brief(status: 'running')]));
          });
          backend.on('GET', '/api/v1/schedules/1', (request) {
            return jsonResponse(200, scheduleDetail(schedId: 1));
          });
          backend.on('POST', '/api/v1/driver/trips', (request) {
            started = true;
            return jsonResponse(201, tripResult(tripId: 55, schedId: 1));
          });
          backend.on('GET', '/api/v1/driver/trips/55/manifest', (request) {
            return jsonResponse(200, manifestFixture());
          });
        },
      );

      // เริ่มรอบ → manifest เปิด (ครั้งที่ 1)
      await tapKey(tester, const Key('drv-start'));
      expect(find.byKey(const Key('drv-manifest-list')), findsOneWidget);

      // กลับมา → การ์ดเป็น "กำลังเดิน" → แตะเพื่อเปิดซ้ำ (ครั้งที่ 2)
      await tester.pageBack();
      await pumpFrames(tester, count: 15);
      expect(chipLabel(tester, 1), 'กำลังเดิน');
      expect(find.text('แตะเพื่อดู Manifest'), findsOneWidget);

      await tapKey(tester, const Key('drv-card-1'));
      expect(find.byKey(const Key('drv-manifest-list')), findsOneWidget);
      expect(
        harness.backend.requestsFor('GET', '/api/v1/driver/trips/55/manifest'),
        hasLength(2),
      );
      expect(textOfKey(tester, const Key('drv-manifest-title')),
          'รอบ 09:30 · สายเหนือ');
    });
  });

  group('Sprint 10 · T-049 Manifest (UC-24)', () {
    testWidgets(
        'Manifest: จัดกลุ่มขึ้น/ลง รายจุดจอดตาม stop_seq + ผ่านแล้ว ✓ + ถัดไป + รายชื่อครบ',
        (tester) async {
      final harness = await pumpManifest(
        tester,
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/55/manifest', (request) {
            return jsonResponse(200, manifestFixture());
          });
        },
      );

      final manifestReqs = harness.backend
          .requestsFor('GET', '/api/v1/driver/trips/55/manifest');
      expect(manifestReqs, hasLength(1));
      expect(
        manifestReqs.single.headers['authorization'],
        'Bearer jwt-sprint10',
      );

      expect(textOfKey(tester, const Key('drv-manifest-title')),
          'รอบ 09:30 · สายเหนือ');
      expect(textOfKey(tester, const Key('drv-manifest-boarded')),
          'ผู้โดยสารขึ้นรถ 2 / 3');
      expect(find.byKey(const Key('drv-manifest-progress')), findsOneWidget);
      expect(
          textOfKey(tester, const Key('drv-manifest-next')), 'ถัดไป: เอราวัณ');

      // เรียงตาม stop_seq
      final y1 =
          tester.getTopLeft(find.byKey(const Key('drv-stop-1-header'))).dy;
      final y2 =
          tester.getTopLeft(find.byKey(const Key('drv-stop-2-header'))).dy;
      final y3 =
          tester.getTopLeft(find.byKey(const Key('drv-stop-3-header'))).dy;
      expect(y1, lessThan(y2));
      expect(y2, lessThan(y3));

      expect(
        textOfKey(tester, const Key('drv-stop-1-header')),
        contains('จุดที่ 1 · คลองเตย'),
      );
      expect(
        textOfKey(tester, const Key('drv-stop-3-header')),
        contains('จุดที่ 3 · หมอชิต'),
      );

      // จุด 1 ผ่านแล้ว (ย้อนหลัง) · จุด 2/3 ยังไม่ถึง
      expect(find.byKey(const Key('drv-stop-1-passed')), findsOneWidget);
      expect(find.byKey(const Key('drv-stop-2-passed')), findsNothing);
      expect(find.byKey(const Key('drv-stop-3-passed')), findsNothing);

      // จุดสุดท้าย = ปลายทาง
      expect(find.byKey(const Key('drv-stop-3-terminal')), findsOneWidget);
      expect(find.byKey(const Key('drv-stop-1-terminal')), findsNothing);

      // นับขึ้น/ลง รายจุดจอด (รวมศูนย์)
      expect(textOfKey(tester, const Key('drv-stop-1-board')), 'ขึ้น 2 คน');
      expect(textOfKey(tester, const Key('drv-stop-1-alight')), 'ลง 0 คน');
      expect(textOfKey(tester, const Key('drv-stop-2-board')), 'ขึ้น 1 คน');
      expect(textOfKey(tester, const Key('drv-stop-2-alight')), 'ลง 1 คน');
      expect(textOfKey(tester, const Key('drv-stop-3-board')), 'ขึ้น 0 คน');
      expect(textOfKey(tester, const Key('drv-stop-3-alight')), 'ลง 2 คน');

      // รายชื่อผู้โดยสารแสดงทั้งฝั่งขึ้นและลง (คนละจุดจอด)
      expect(find.text('สมชาย ใจดี'), findsNWidgets(2));
      expect(find.text('สุดา รักดี'), findsNWidgets(2));
      expect(find.text('ปิยะ มั่นคง'), findsNWidgets(2));

      // แถวสถานะ: เช็คอินแล้ว/รอเช็คอิน (ขาขึ้น) · รอลง (ขาลง)
      expect(
        find.descendant(
          of: find.byKey(const Key('drv-stop-1-board-BK-1')),
          matching: find.text('เช็คอินแล้ว'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('drv-stop-1-board-BK-2')),
          matching: find.text('รอเช็คอิน'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('drv-stop-2-board-BK-3')),
          matching: find.text('เช็คอินแล้ว'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('drv-stop-2-alight-BK-2')),
          matching: find.text('รอลง'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('drv-stop-3-alight-BK-1')),
          matching: find.text('รอลง'),
        ),
        findsOneWidget,
      );

      // ฝั่งขึ้นอยู่ก่อนฝั่งลงในจุดจอดเดียวกัน
      final board2Y =
          tester.getTopLeft(find.byKey(const Key('drv-stop-2-board-BK-3'))).dy;
      final alight2Y =
          tester.getTopLeft(find.byKey(const Key('drv-stop-2-alight-BK-2'))).dy;
      expect(board2Y, lessThan(alight2Y));
    });

    testWidgets(
        'Manifest 404: ข้อความจากเซิร์ฟเวอร์ + ลองอีกครั้งแล้วโหลดสำเร็จ',
        (tester) async {
      var calls = 0;
      final harness = await pumpManifest(
        tester,
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/55/manifest', (request) {
            calls += 1;
            if (calls == 1) {
              return jsonResponse(
                404,
                {'code': 'NOT_FOUND', 'message': 'ไม่พบรอบเดินทาง'},
              );
            }
            return jsonResponse(200, manifestFixture());
          });
        },
      );

      expect(find.byKey(const Key('list-error-message')), findsOneWidget);
      expect(find.text('ไม่พบรอบเดินทาง'), findsOneWidget);

      await tester.tap(find.text('ลองอีกครั้ง'));
      await pumpFrames(tester, count: 10);

      expect(
        harness.backend.requestsFor('GET', '/api/v1/driver/trips/55/manifest'),
        hasLength(2),
      );
      expect(textOfKey(tester, const Key('drv-manifest-boarded')),
          'ผู้โดยสารขึ้นรถ 2 / 3');
      expect(find.byKey(const Key('drv-manifest-list')), findsOneWidget);
    });

    testWidgets(
        'Manifest ไม่มีผู้โดยสาร: หัวข้อ 0/0 · progress ไม่หารศูนย์ · นับขึ้น/ลง เป็น 0',
        (tester) async {
      await pumpManifest(
        tester,
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/55/manifest', (request) {
            return jsonResponse(
              200,
              manifestFixture(
                passengers: <Map<String, dynamic>>[],
                totalPassengers: 0,
              ),
            );
          });
        },
      );

      expect(textOfKey(tester, const Key('drv-manifest-boarded')),
          'ผู้โดยสารขึ้นรถ 0 / 0');
      expect(find.byKey(const Key('drv-manifest-progress')), findsOneWidget);
      expect(
          textOfKey(tester, const Key('drv-manifest-next')), 'ถัดไป: เอราวัณ');
      expect(textOfKey(tester, const Key('drv-stop-1-board')), 'ขึ้น 0 คน');
      expect(textOfKey(tester, const Key('drv-stop-3-alight')), 'ลง 0 คน');
      expect(find.byKey(const Key('drv-manifest-list')), findsOneWidget);
    });
  });
}
