import 'dart:async';

import 'package:dio/dio.dart' show ResponseBody;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shuttle_app/core/network/api_client.dart';
import 'package:shuttle_app/core/network/api_error.dart';
import 'package:shuttle_app/core/providers.dart';
import 'package:shuttle_app/features/auth/auth_controller.dart';
import 'package:shuttle_app/features/auth/auth_models.dart';
import 'package:shuttle_app/features/driver/driver_models.dart';
import 'package:shuttle_app/features/driver/driver_providers.dart';
import 'package:shuttle_app/features/driver/manifest_screen.dart';
import 'package:shuttle_app/features/driver/scan_qr_screen.dart';
import 'package:shuttle_app/features/driver/trip_summary_screen.dart';

import 'support/fake_backend.dart';

/// Sprint 11 — T-050/T-051 (UC-25/26)
///
/// ครอบคลุม: สัญญา `POST /driver/bookings/scan` (CheckinResult · 409 ซ้ำ/
/// ผิดรอบ · 404 · 403) · debounce 2 วินาที (กันอ่านซ้ำ) · กันส่งซ้ำระหว่าง
/// POST · สถานะกล้อง (ไม่ได้รับอนุญาต / ไม่รองรับ + ลองอีกครั้ง) ·
/// ทางสำรอง R5 "กรอก Token เอง" · ปุ่มสแกน/ปิดรอบใน Manifest ตาม
/// `QR.SCAN`/`TRIP.END` · `POST /driver/trips/{id}/end` 204 → หน้าสรุป ·
/// 409 BR-10 · KPI สรุป + รายชื่อ No Show · การ์ดเสร็จแล้วใน D1
///
/// กล้องจริงบนเครื่อง Android เป็นการทดสอบแยกต่างหาก (R5) — เทสต์นี้
/// จำลองกล้องด้วย [FakeCamera] และ inject เวลาด้วย [fakeClock]
void main() {
  Map<String, dynamic> perm(
    int permId,
    String permCode,
    String module, {
    int sortNo = 0,
  }) =>
      {
        'permId': permId,
        'permCode': permCode,
        'permName': permCode,
        'module': module,
        'screenKey': null,
        'sortNo': sortNo,
      };

  Map<String, dynamic> authMe({
    required List<Map<String, dynamic>> permissions,
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
        'modules': {
          for (final permission in permissions) permission['module'] as String,
        }.toList(),
      };

  List<Map<String, dynamic>> driverPermissions({
    bool qrScan = true,
    bool tripStart = true,
    bool tripEnd = true,
  }) =>
      [
        if (qrScan) perm(40, 'QR.SCAN', 'driver', sortNo: 40),
        if (tripStart) perm(41, 'TRIP.START', 'driver', sortNo: 41),
        if (tripEnd) perm(42, 'TRIP.END', 'driver', sortNo: 42),
      ];

  final testStart = DateTime.now();

  String isoAt(int minutesFromStart) {
    final t = testStart.add(Duration(minutes: minutesFromStart));
    return '${t.year.toString().padLeft(4, '0')}-'
        '${t.month.toString().padLeft(2, '0')}-'
        '${t.day.toString().padLeft(2, '0')}T'
        '${t.hour.toString().padLeft(2, '0')}:'
        '${t.minute.toString().padLeft(2, '0')}:00';
  }

  Map<String, dynamic> passenger({
    int bookingId = 1,
    String bookingCode = 'BK-1',
    String customerName = 'สมชาย ใจดี',
    int seats = 2,
    int boardSeq = 1,
    String boardStopName = 'คลองเตย',
    int alightSeq = 2,
    String alightStopName = 'เอราวัณ',
    String status = 'checked_in',
    bool checkedIn = true,
  }) =>
      {
        'bookingId': bookingId,
        'bookingCode': bookingCode,
        'customerName': customerName,
        'seats': seats,
        'boardSeq': boardSeq,
        'boardStopName': boardStopName,
        'alightSeq': alightSeq,
        'alightStopName': alightStopName,
        'status': status,
        'checkedIn': checkedIn,
      };

  Map<String, dynamic> manifestFixture({
    List<Map<String, dynamic>>? passengers,
    int totalPassengers = 1,
    int tripId = 99,
    String tripStatus = 'running',
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
        'tripStatus': tripStatus,
        'plateNo': 'สย 2591',
        'passengers': passengers ?? [passenger()],
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
            'dwellMinutes': 0,
          },
        ],
      };

  Map<String, dynamic> checkinResult({
    String bookingCode = 'BK-20261001-0001',
    String customerName = 'สมชาย ใจดี',
    int seats = 2,
    String boardStopName = 'คลองเตย',
    String checkinTime = '2026-10-01T09:38:00',
    int boardSeq = 1,
    String message = 'เช็คอินสำเร็จ',
  }) =>
      {
        'bookingCode': bookingCode,
        'customerName': customerName,
        'seats': seats,
        'boardStopName': boardStopName,
        'checkinTime': checkinTime,
        'boardSeq': boardSeq,
        'message': message,
      };

  Map<String, dynamic> brief({
    int schedId = 1,
    int routeId = 1,
    String routeName = 'สายเหนือ',
    String departAt = '2026-10-01T09:30:00',
    String status = 'upcoming',
    String plateNo = 'สย 2591',
    int passengerCount = 8,
  }) =>
      {
        'schedId': schedId,
        'routeId': routeId,
        'routeName': routeName,
        'departAt': departAt,
        'totalMinutes': 13,
        'stopCount': 4,
        'status': status,
        'plateNo': plateNo,
        'passengerCount': passengerCount,
      };

  Map<String, dynamic> dayFixture(List<Map<String, dynamic>> trips) => {
        'serviceDate': '2026-10-01',
        'trips': trips,
      };

  ResponseBody errorJson(int status, String code, String message) =>
      jsonResponse(status, {'code': code, 'message': message});

  AuthState authStateFor(List<Map<String, dynamic>> permissions) =>
      AuthState.authenticatedFrom(
        'jwt-sprint11',
        authMe(permissions: permissions),
      );

  /// stub AuthController ไม่เรียก restoreSession (กัน microtask ชนกับ pump)
  Override stubAuth(List<Map<String, dynamic>> permissions) =>
      authControllerProvider.overrideWith(
        () => _StubAuthController(authStateFor(permissions)),
      );

  /// กล้องจำลอง — bind callback ของ ScanQrScreen แล้วยิงเหตุการณ์ได้เอง
  final camera = FakeCamera();
  var now = DateTime(2026, 10, 1, 9, 30);
  DateTime fakeClock() => now;

  Future<ShuttleHarness> pumpScan(
    WidgetTester tester, {
    required void Function(FakeBackend backend) routes,
    int tripId = 99,
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    routes(backend);
    final storage = FakeTokenStorage(token: 'jwt-sprint11');
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
        child: MaterialApp(
          home: ScanQrScreen(
            tripId: tripId,
            scannerBuilder: fakeScannerBuilder(camera),
            clock: fakeClock,
          ),
        ),
      ),
    );
    await pumpFrames(tester, count: 8);
    return ShuttleHarness(
      container: container,
      backend: backend,
      storage: storage,
    );
  }

  Future<ShuttleHarness> pumpHost(
    WidgetTester tester, {
    required Widget Function() home,
    required void Function(FakeBackend backend) routes,
    List<Map<String, dynamic>>? authPermissions,
    List<Override> overrides = const [],
    void Function(ProviderContainer container)? seed,
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    routes(backend);
    final storage = FakeTokenStorage(token: 'jwt-sprint11');
    final client = ApiClient(
      tokenStorage: storage,
      baseUrl: 'http://shuttle.test/api/v1',
    );
    client.dio.httpClientAdapter = backend;
    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(client),
        if (authPermissions != null) stubAuth(authPermissions),
        ...overrides,
      ],
    );
    addTearDown(container.dispose);
    seed?.call(container);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(home: home()),
      ),
    );
    await pumpFrames(tester, count: 12);
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

  void resetClock() {
    now = DateTime(2026, 10, 1, 9, 30);
    camera.reset();
  }

  group('Sprint 11 · T-050/T-051 contract parsing', () {
    test('parse CheckinResult ตาม OpenAPI + นับ KPI สรุปจากสถานะ booking', () {
      final result = parseCheckinResult(checkinResult());
      expect(result.bookingCode, 'BK-20261001-0001');
      expect(result.customerName, 'สมชาย ใจดี');
      expect(result.seats, 2);
      expect(result.boardStopName, 'คลองเตย');
      expect(result.checkinTime, '2026-10-01T09:38:00');
      expect(result.boardSeq, 1);
      expect(result.message, 'เช็คอินสำเร็จ');

      // ฟิลด์หายไป → ค่าเริ่มต้น (message = 'เช็คอินสำเร็จ')
      final minimal = parseCheckinResult({'bookingCode': 'BK-9'});
      expect(minimal.message, 'เช็คอินสำเร็จ');
      expect(minimal.customerName, isEmpty);

      expect(
          () => parseCheckinResult('not-a-map'), throwsA(isA<ApiException>()));
      expect(() => parseCheckinResult([1]), throwsA(isA<ApiException>()));

      final manifest = parseDriverManifest(manifestFixture(
        totalPassengers: 5,
        tripStatus: 'completed',
        passengers: [
          passenger(bookingCode: 'BK-1', status: 'completed', checkedIn: true),
          passenger(
              bookingId: 2,
              bookingCode: 'BK-2',
              customerName: 'สุดา รักดี',
              status: 'completed',
              checkedIn: true),
          passenger(
              bookingId: 3,
              bookingCode: 'BK-3',
              customerName: 'ปิยะ มั่นคง',
              status: 'no_show',
              checkedIn: false),
          passenger(
              bookingId: 4,
              bookingCode: 'BK-4',
              customerName: 'กานดา ศรีสุข',
              status: 'cancelled',
              checkedIn: false),
          passenger(
              bookingId: 5,
              bookingCode: 'BK-5',
              customerName: 'มนัส ใจเดียว',
              status: 'checked_in',
              checkedIn: true),
        ],
      ));
      expect(manifest.totalPassengers, 5);
      expect(manifest.boardedCount, 3); // completed×2 + checked_in×1
      expect(manifest.alightedCount, 2); // completed×2
      expect(manifest.noShowCount, 1);
      expect(manifest.noShowPassengers.single.customerName, 'ปิยะ มั่นคง');
      expect(manifest.cancelledCount, 1);
    });
  });

  group('Sprint 11 · T-050 หน้าสแกน QR (UC-25)', () {
    testWidgets(
        'สแกนสำเร็จ: ส่ง POST /driver/bookings/scan {qrToken,tripId} + Bearer '
        '· แสดงชื่อผู้โดยสารและจุดลง', (tester) async {
      resetClock();
      final harness = await pumpScan(
        tester,
        routes: (backend) {
          backend.on('POST', '/api/v1/driver/bookings/scan', (request) {
            return jsonResponse(200, checkinResult());
          });
        },
      );

      expect(find.text('สแกน QR ขึ้นรถ'), findsOneWidget);
      expect(find.byKey(const Key('fake-camera')), findsOneWidget);

      camera.fireToken('9f2c1a7e4b6d8f0a');
      await pumpFrames(tester);

      final requests =
          harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan');
      expect(requests, hasLength(1));
      expect(requests.single.headers['authorization'], 'Bearer jwt-sprint11');
      expect(requests.single.body, {
        'qrToken': '9f2c1a7e4b6d8f0a',
        'tripId': 99,
      });

      expect(find.byKey(const Key('scan-banner-ok')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('scan-banner')),
          matching: find.textContaining('เช็คอินสำเร็จ'),
        ),
        findsOneWidget,
      );
      expect(find.textContaining('สมชาย ใจดี'), findsOneWidget);
      expect(find.textContaining('จุดลง คลองเตย'), findsOneWidget);
      expect(find.byKey(const Key('scan-banner-ok')), findsOneWidget);
    });

    testWidgets(
        'debounce 2 วินาที: อ่านซ้ำภายใน 2s ไม่ส่ง POST · เกิน 2s ส่งได้',
        (tester) async {
      resetClock();
      final harness = await pumpScan(
        tester,
        routes: (backend) {
          backend.on('POST', '/api/v1/driver/bookings/scan', (request) {
            return jsonResponse(200, checkinResult());
          });
        },
      );

      camera.fireToken('tok-1');
      await pumpFrames(tester);
      camera.fireToken('tok-2'); // ภายใน 2 วินาที → ถูก debounce
      await pumpFrames(tester);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan'),
        hasLength(1),
      );

      now = now.add(const Duration(seconds: 3)); // เกิน 2 วินาที
      camera.fireToken('tok-3');
      await pumpFrames(tester);
      final requests =
          harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan');
      expect(requests, hasLength(2));
      expect((requests.last.body as Map)['qrToken'], 'tok-3');
    });

    testWidgets(
        'กันส่งซ้ำระหว่าง POST ค้าง: ยิงซ้ำระหว่างรอ → ไม่มี POST ที่สอง',
        (tester) async {
      resetClock();
      final gate = Completer<ResponseBody>();
      final harness = await pumpScan(
        tester,
        routes: (backend) {
          backend.on(
              'POST', '/api/v1/driver/bookings/scan', (request) => gate.future);
        },
      );

      camera.fireToken('tok-inflight');
      await pumpFrames(tester);
      expect(find.byKey(const Key('scan-sending')), findsOneWidget);

      now = now.add(const Duration(seconds: 5));
      camera.fireToken('tok-during-send'); // _sending กันไว้
      await pumpFrames(tester);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan'),
        hasLength(1),
      );

      gate.complete(jsonResponse(200, checkinResult()));
      await pumpFrames(tester);
      expect(find.byKey(const Key('scan-banner-ok')), findsOneWidget);
      expect(find.byKey(const Key('scan-sending')), findsNothing);
    });

    testWidgets(
        '409 ซ้ำ (BR-09): ข้อความเซิร์ฟเวอร์verbatim · สแกนต่อได้หลังล้มเหลว',
        (tester) async {
      resetClock();
      var call = 0;
      final harness = await pumpScan(
        tester,
        routes: (backend) {
          backend.on('POST', '/api/v1/driver/bookings/scan', (request) {
            call += 1;
            if (call == 1) {
              return errorJson(
                  409, 'BR09_ALREADY_CHECKED_IN', 'QR นี้ถูกเช็คอินไปแล้ว');
            }
            return jsonResponse(200, checkinResult(customerName: 'สุดา รักดี'));
          });
        },
      );

      camera.fireToken('tok-already');
      await pumpFrames(tester);
      expect(find.byKey(const Key('scan-banner-error')), findsOneWidget);
      expect(find.text('QR นี้ถูกเช็คอินไปแล้ว'), findsOneWidget);
      expect(find.byKey(const Key('scan-banner-ok')), findsNothing);

      // หลัง debounce — สแกนใหม่ได้ (เซิร์ฟเวอร์ตรวจซ้ำเอง)
      now = now.add(const Duration(seconds: 3));
      camera.fireToken('tok-other');
      await pumpFrames(tester);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan'),
        hasLength(2),
      );
      expect(find.byKey(const Key('scan-banner-ok')), findsOneWidget);
    });

    testWidgets(
        '409 ผิดรอบ (TC-25-01): แสดง "QR นี้ไม่ใช่รอบที่กำลังเดินรถ" สีแดง',
        (tester) async {
      resetClock();
      await pumpScan(
        tester,
        routes: (backend) {
          backend.on('POST', '/api/v1/driver/bookings/scan', (request) {
            return errorJson(
                409, 'BR09_WRONG_TRIP', 'QR นี้ไม่ใช่รอบที่กำลังเดินรถ');
          });
        },
      );

      camera.fireToken('tok-wrong-round');
      await pumpFrames(tester);
      expect(find.byKey(const Key('scan-banner-error')), findsOneWidget);
      expect(find.text('QR นี้ไม่ใช่รอบที่กำลังเดินรถ'), findsOneWidget);
    });

    testWidgets(
        '404 ไม่พบ token และ 403 ไม่มีสิทธิ์: ข้อความเซิร์ฟเวอร์ทั้งคู่',
        (tester) async {
      resetClock();
      var call = 0;
      final harness = await pumpScan(
        tester,
        routes: (backend) {
          backend.on('POST', '/api/v1/driver/bookings/scan', (request) {
            call += 1;
            if (call == 1) {
              return errorJson(404, 'QR_NOT_FOUND', 'ไม่พบ QR นี้ในระบบ');
            }
            return errorJson(403, 'FORBIDDEN', 'ไม่มีสิทธิ์สแกน QR');
          });
        },
      );

      camera.fireToken('tok-missing');
      await pumpFrames(tester);
      expect(find.text('ไม่พบ QR นี้ในระบบ'), findsOneWidget);

      now = now.add(const Duration(seconds: 3));
      camera.fireToken('tok-forbidden');
      await pumpFrames(tester);
      expect(find.text('ไม่มีสิทธิ์สแกน QR'), findsOneWidget);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan'),
        hasLength(2),
      );
    });

    testWidgets('สถานะกล้อง: permission denied / ไม่รองรับ + ปุ่มลองอีกครั้ง',
        (tester) async {
      resetClock();
      await pumpScan(tester, routes: (backend) {});

      camera.fireError(MobileScannerErrorCode.permissionDenied);
      await pumpFrames(tester);
      expect(find.text('ไม่ได้รับอนุญาตให้ใช้กล้อง'), findsOneWidget);
      expect(
        find.textContaining('กรอก Token เอง'),
        findsWidgets,
      );

      // ลองอีกครั้ง → กลับสู่พื้นที่กล้อง
      await tapKey(tester, const Key('scan-cam-retry'));
      expect(find.byKey(const Key('fake-camera')), findsOneWidget);
      expect(find.text('ไม่ได้รับอนุญาตให้ใช้กล้อง'), findsNothing);

      camera.fireError(MobileScannerErrorCode.unsupported);
      await pumpFrames(tester);
      expect(
        find.text('อุปกรณ์นี้ไม่สามารถสแกนด้วยกล้องได้'),
        findsOneWidget,
      );
    });

    testWidgets(
        'ทางสำรอง R5 "กรอก Token เอง": ว่างถูกบล็อก · พิมพ์แล้วส่ง POST',
        (tester) async {
      resetClock();
      final harness = await pumpScan(
        tester,
        routes: (backend) {
          backend.on('POST', '/api/v1/driver/bookings/scan', (request) {
            return jsonResponse(200, checkinResult(bookingCode: 'BK-MANUAL'));
          });
        },
      );

      await tapKey(tester, const Key('scan-manual-open'));
      expect(find.byKey(const Key('scan-manual-dialog')), findsOneWidget);

      // ว่าง → validation บล็อก ไม่ส่ง POST  dialog เปิดค้าง
      await tapKey(tester, const Key('scan-manual-submit'));
      expect(find.text('กรุณากรอก Token'), findsOneWidget);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan'),
        isEmpty,
      );

      await tester.enterText(
          find.byKey(const Key('scan-manual-field')), 'manual-token-1');
      await pumpFrames(tester, count: 4);
      await tapKey(tester, const Key('scan-manual-submit'));
      await pumpFrames(tester);

      final requests =
          harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan');
      expect(requests, hasLength(1));
      expect(requests.single.body, {
        'qrToken': 'manual-token-1',
        'tripId': 99,
      });
      expect(find.byKey(const Key('scan-banner-ok')), findsOneWidget);
      expect(find.textContaining('BK-MANUAL'), findsOneWidget);
    });
  });

  group('Sprint 11 · T-050/T-051 ใน Manifest (D2 → D3/D4)', () {
    testWidgets(
        'ปุ่มสแกน/ปิดรอบ แสดงตาม QR.SCAN/TRIP.END และ tripStatus=running '
        '(รอบเสร็จแล้วไม่แสดง)', (tester) async {
      // QR.SCAN + TRIP.END + running → ครบ
      await pumpHost(
        tester,
        home: () => const ManifestScreen(tripId: 99),
        authPermissions: driverPermissions(),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest',
              (request) => jsonResponse(200, manifestFixture()));
        },
      );
      expect(find.byKey(const Key('drv-scan')), findsOneWidget);
      expect(find.byKey(const Key('drv-end-open')), findsOneWidget);
    });

    testWidgets(
        'ไม่มี QR.SCAN → ไม่มีปุ่มสแกน · ไม่มี TRIP.END → ไม่มีปุ่มปิดรอบ',
        (tester) async {
      await pumpHost(
        tester,
        home: () => const ManifestScreen(tripId: 99),
        authPermissions: driverPermissions(qrScan: false, tripEnd: false),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest',
              (request) => jsonResponse(200, manifestFixture()));
        },
      );
      expect(find.byKey(const Key('drv-scan')), findsNothing);
      expect(find.byKey(const Key('drv-end-open')), findsNothing);
      expect(find.byKey(const Key('drv-manifest-title')), findsOneWidget);
    });

    testWidgets('รอบเสร็จแล้ว (tripStatus=completed): ไม่มีปุ่มสแกน/ปิดรอบ',
        (tester) async {
      await pumpHost(
        tester,
        home: () => const ManifestScreen(tripId: 99),
        authPermissions: driverPermissions(),
        routes: (backend) {
          backend.on(
              'GET',
              '/api/v1/driver/trips/99/manifest',
              (request) =>
                  jsonResponse(200, manifestFixture(tripStatus: 'completed')));
        },
      );
      expect(find.byKey(const Key('drv-scan')), findsNothing);
      expect(find.byKey(const Key('drv-end-open')), findsNothing);
    });

    testWidgets('แตะปุ่มสแกนใน Manifest → เปิดหน้าสแกน → ยิงผ่านกล้องจำลอง',
        (tester) async {
      resetClock();
      final testCamera = FakeCamera();
      final harness = await pumpHost(
        tester,
        home: () => const ManifestScreen(tripId: 99),
        authPermissions: driverPermissions(),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest',
              (request) => jsonResponse(200, manifestFixture()));
          backend.on('POST', '/api/v1/driver/bookings/scan',
              (request) => jsonResponse(200, checkinResult()));
        },
        overrides: [
          scanQrCameraBuilderProvider
              .overrideWithValue(fakeScannerBuilder(testCamera)),
        ],
      );

      await tapKey(tester, const Key('drv-scan'));
      expect(find.byType(ScanQrScreen), findsOneWidget);
      expect(find.byKey(const Key('fake-camera')), findsOneWidget);

      testCamera.fireToken('tok-from-manifest');
      await pumpFrames(tester);
      final requests =
          harness.backend.requestsFor('POST', '/api/v1/driver/bookings/scan');
      expect(requests, hasLength(1));
      expect((requests.single.body as Map)['qrToken'], 'tok-from-manifest');
      expect(find.byKey(const Key('scan-banner-ok')), findsOneWidget);
    });

    testWidgets('ปิดรอบ: dialog ยืนยัน BR-10 · "ยกเลิก" ไม่ส่ง POST',
        (tester) async {
      final harness = await pumpHost(
        tester,
        home: () => const ManifestScreen(tripId: 99),
        authPermissions: driverPermissions(),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest',
              (request) => jsonResponse(200, manifestFixture()));
        },
      );

      await tapKey(tester, const Key('drv-end-open'));
      expect(find.byKey(const Key('drv-end-dialog')), findsOneWidget);
      expect(find.text('ยืนยันการปิดรอบ?'), findsOneWidget);
      expect(find.textContaining('No Show ทันที (BR-10)'), findsOneWidget);

      await tapKey(tester, const Key('drv-end-cancel'));
      expect(find.byKey(const Key('drv-end-dialog')), findsNothing);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips/99/end'),
        isEmpty,
      );
    });

    testWidgets(
        'ปิดรอบสำเร็จ: POST /driver/trips/99/end → 204 → เปิดหน้าสรุป D4',
        (tester) async {
      final harness = await pumpHost(
        tester,
        home: () => const ManifestScreen(tripId: 99),
        authPermissions: driverPermissions(),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest',
              (request) => jsonResponse(200, manifestFixture()));
          backend.on('POST', '/api/v1/driver/trips/99/end',
              (request) => emptyResponse(204));
        },
      );

      await tapKey(tester, const Key('drv-end-open'));
      await tapKey(tester, const Key('drv-end-confirm'));
      await pumpFrames(tester);

      final endRequests =
          harness.backend.requestsFor('POST', '/api/v1/driver/trips/99/end');
      expect(endRequests, hasLength(1));
      expect(
          endRequests.single.headers['authorization'], 'Bearer jwt-sprint11');

      // pushReplacement → หน้าสรุปแทน Manifest
      expect(find.byKey(const Key('drv-sum-title')), findsOneWidget);
      expect(find.text('สรุปรอบ 09:30'), findsOneWidget);
      expect(find.byKey(const Key('drv-manifest-title')), findsNothing);
    });

    testWidgets(
        'ปิดรอบ 409 (BR-10 ยังปิดไม่ได้): ข้อความใน dialog · dialog ค้าง',
        (tester) async {
      final harness = await pumpHost(
        tester,
        home: () => const ManifestScreen(tripId: 99),
        authPermissions: driverPermissions(),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest',
              (request) => jsonResponse(200, manifestFixture()));
          backend.on(
              'POST',
              '/api/v1/driver/trips/99/end',
              (request) => errorJson(409, 'BR10_TRIP_NOT_RUNNING',
                  'รอบนี้ยังไม่ได้เริ่มหรือจบไปแล้ว'));
        },
      );

      await tapKey(tester, const Key('drv-end-open'));
      await tapKey(tester, const Key('drv-end-confirm'));
      await pumpFrames(tester);

      expect(find.byKey(const Key('drv-end-error')), findsOneWidget);
      expect(find.text('รอบนี้ยังไม่ได้เริ่มหรือจบไปแล้ว'), findsOneWidget);
      expect(find.byKey(const Key('drv-end-dialog')), findsOneWidget);
      expect(find.byKey(const Key('drv-sum-title')), findsNothing);
      expect(
        harness.backend.requestsFor('POST', '/api/v1/driver/trips/99/end'),
        hasLength(1),
      );
    });
  });

  group('Sprint 11 · T-051 หน้าสรุปหลังปิดรอบ (D4)', () {
    testWidgets(
        'KPI + รายชื่อ No Show + ยกเลิก: นับจากสถานะหลังปิดรอบ '
        '(completed/no_show/cancelled/checked_in)', (tester) async {
      await pumpHost(
        tester,
        home: () => const TripSummaryScreen(tripId: 99),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest', (request) {
            return jsonResponse(
              200,
              manifestFixture(
                tripStatus: 'completed',
                totalPassengers: 5,
                passengers: [
                  passenger(
                      bookingCode: 'BK-1',
                      status: 'completed',
                      checkedIn: true),
                  passenger(
                      bookingId: 2,
                      bookingCode: 'BK-2',
                      customerName: 'สุดา รักดี',
                      status: 'completed',
                      checkedIn: true),
                  passenger(
                      bookingId: 3,
                      bookingCode: 'BK-3',
                      customerName: 'ปิยะ มั่นคง',
                      status: 'no_show',
                      checkedIn: false),
                  passenger(
                      bookingId: 4,
                      bookingCode: 'BK-4',
                      customerName: 'กานดา ศรีสุข',
                      status: 'cancelled',
                      checkedIn: false),
                  passenger(
                      bookingId: 5,
                      bookingCode: 'BK-5',
                      customerName: 'มนัส ใจเดียว',
                      status: 'checked_in',
                      checkedIn: true),
                ],
              ),
            );
          });
        },
      );

      expect(find.text('สรุปรอบ 09:30'), findsOneWidget);
      expect(find.text('ผู้โดยสารทั้งหมด'), findsOneWidget);
      expect(find.text('ขึ้นรถจริง'), findsOneWidget);
      expect(find.text('ลงรถจริง'), findsOneWidget);
      expect(find.text('No Show'), findsOneWidget);
      expect(
        tester.widget<Text>(find.byKey(const Key('drv-sum-total'))).data,
        '5',
      );
      expect(
        tester.widget<Text>(find.byKey(const Key('drv-sum-boarded'))).data,
        '3',
      );
      expect(
        tester.widget<Text>(find.byKey(const Key('drv-sum-alighted'))).data,
        '2',
      );
      expect(
        tester.widget<Text>(find.byKey(const Key('drv-sum-noshow'))).data,
        '1',
      );
      expect(find.byKey(const Key('drv-sum-noshow-BK-3')), findsOneWidget);
      expect(find.textContaining('ปิยะ มั่นคง'), findsOneWidget);
      expect(find.text('ยกเลิกแล้ว 1 คน'), findsOneWidget);
      expect(find.textContaining('BR-10'), findsOneWidget);
    });

    testWidgets('ไม่มี No Show → "ไม่มีผู้โดยสาร No Show" (ทางเลือก 5a)',
        (tester) async {
      await pumpHost(
        tester,
        home: () => const TripSummaryScreen(tripId: 99),
        routes: (backend) {
          backend.on(
              'GET',
              '/api/v1/driver/trips/99/manifest',
              (request) => jsonResponse(
                    200,
                    manifestFixture(
                      tripStatus: 'completed',
                      passengers: [
                        passenger(
                            bookingCode: 'BK-1',
                            status: 'completed',
                            checkedIn: true),
                      ],
                    ),
                  ));
        },
      );
      expect(find.byKey(const Key('drv-sum-noshow-empty')), findsOneWidget);
      expect(find.text('ไม่มีผู้โดยสาร No Show'), findsOneWidget);
      expect(find.byKey(const Key('drv-sum-cancelled')), findsNothing);
    });

    testWidgets('สรุป 404: ข้อความ + ลองอีกครั้ง แล้วได้ข้อมูล',
        (tester) async {
      var call = 0;
      await pumpHost(
        tester,
        home: () => const TripSummaryScreen(tripId: 99),
        routes: (backend) {
          backend.on('GET', '/api/v1/driver/trips/99/manifest', (request) {
            call += 1;
            if (call == 1) {
              return errorJson(404, 'TRIP_NOT_FOUND', 'ไม่พบรอบเดินทางนี้');
            }
            return jsonResponse(
              200,
              manifestFixture(
                tripStatus: 'completed',
                passengers: [
                  passenger(
                      bookingCode: 'BK-1', status: 'no_show', checkedIn: false),
                ],
              ),
            );
          });
        },
      );

      expect(find.byKey(const Key('list-error-message')), findsOneWidget);
      expect(find.text('ไม่พบรอบเดินทางนี้'), findsOneWidget);

      await tester.ensureVisible(find.widgetWithText(
        FilledButton,
        'ลองอีกครั้ง',
      ));
      await pumpFrames(tester, count: 4);
      await tester.tap(find.widgetWithText(FilledButton, 'ลองอีกครั้ง'));
      await pumpFrames(tester, count: 10);

      expect(find.byKey(const Key('drv-sum-noshow-BK-1')), findsOneWidget);
      expect(find.byKey(const Key('list-error-message')), findsNothing);
    });
  });

  group('Sprint 11 · T-051 D1 การ์ดรอบเสร็จแล้ว', () {
    testWidgets(
        'การ์ด "เสร็จแล้ว" แตะ → เปิดหน้าสรุปเมื่อทราบรอบจากเครื่องนี้ · '
        'ไม่ทราบรอบ → ข้อความข้อจำกัด tripId', (tester) async {
      final day = dayFixture([
        brief(schedId: 1, status: 'upcoming'),
        brief(
          schedId: 2,
          status: 'completed',
          departAt: '2026-10-01T07:00:00',
          routeName: 'สายเหนือ',
        ),
      ]);

      // มี tripId ใน cache (เริ่มจากเครื่องนี้) → เปิดสรุป
      var harness = await pumpShuttle(
        tester,
        token: 'jwt-sprint11',
        initialLocation: '/driver',
        size: const Size(390, 844),
        routes: (backend) {
          backend.on(
              'GET',
              '/api/v1/auth/me',
              (request) =>
                  jsonResponse(200, authMe(permissions: driverPermissions())));
          backend.on('GET', '/api/v1/driver/today',
              (request) => jsonResponse(200, day));
          backend.on('GET', '/api/v1/driver/trips/99/manifest', (request) {
            return jsonResponse(
              200,
              manifestFixture(
                tripId: 99,
                tripStatus: 'completed',
                departAt: '2026-10-01T07:00:00',
                passengers: [
                  passenger(
                      bookingCode: 'BK-1', status: 'no_show', checkedIn: false),
                ],
              ),
            );
          });
        },
      );
      harness.container
          .read(startedTripsProvider.notifier)
          .update((all) => {...all, 2: 99});
      await pumpFrames(tester);

      expect(find.text('แตะเพื่อดูสรุปรอบ'), findsOneWidget);
      await tapKey(tester, const Key('drv-card-2'));
      expect(find.byKey(const Key('drv-sum-title')), findsOneWidget);
      expect(find.text('สรุปรอบ 07:00'), findsOneWidget);

      // ไม่มี tripId ใน cache → ข้อความข้อจำกัด
      await tester.pageBack();
      await pumpFrames(tester);
      harness.container.read(startedTripsProvider.notifier).update((all) {
        final copy = <int, int>{...all};
        copy.remove(2);
        return copy;
      });
      await pumpFrames(tester);
      await tapKey(tester, const Key('drv-card-2'));
      expect(
        find.text(
          'ไม่ทราบรอบเดินทาง (trip) ของรอบนี้ — '
          'เปิดได้เฉพาะรอบที่เริ่มจากอุปกรณ์นี้',
        ),
        findsOneWidget,
      );
    });
  });
}

/// กล้องจำลอง — ไม่แตะ platform channel ของ mobile_scanner
class FakeCamera {
  ScanQrTokenCallback? _onToken;
  ScanQrCameraErrorCallback? _onError;

  void bind(ScanQrTokenCallback onToken, ScanQrCameraErrorCallback onError) {
    _onToken = onToken;
    _onError = onError;
  }

  void fireToken(String token) => _onToken?.call(token);

  void fireError(MobileScannerErrorCode code) =>
      _onError?.call(MobileScannerException(errorCode: code));

  void reset() {
    _onToken = null;
    _onError = null;
  }
}

ScanQrCameraBuilder fakeScannerBuilder(FakeCamera camera) =>
    (context, onToken, onCameraError) {
      camera.bind(onToken, onCameraError);
      return const SizedBox(key: Key('fake-camera'), height: 240);
    };

/// AuthController stub — คืน state สำเร็จรูป ไม่เรียก restoreSession
/// (กัน microtask GET /auth/me ชนกับ pump ใน testWidgets ที่ mount Manifest ตรง ๆ)
class _StubAuthController extends AuthController {
  _StubAuthController(this._state);

  final AuthState _state;

  @override
  AuthState build() => _state;
}
