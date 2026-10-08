import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:shuttle_app/core/network/api_error.dart';
import 'package:shuttle_app/features/booking/booking_models.dart';
import 'package:shuttle_app/features/booking/booking_providers.dart';

import 'support/fake_backend.dart';

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
    List<String> roles = const ['CUSTOMER'],
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

  List<Map<String, dynamic>> fullBookingPermissions() => [
        perm(30, 'BK.CREATE', 'booking', sortNo: 30),
        perm(31, 'BK.VIEW', 'booking', sortNo: 31),
        perm(32, 'BK.CANCEL', 'booking', sortNo: 32),
      ];

  // ไม่มี BK.CANCEL — ใช้ตรวจ UC-21 x-permission
  List<Map<String, dynamic>> noCancelPermissions() => [
        perm(30, 'BK.CREATE', 'booking', sortNo: 30),
        perm(31, 'BK.VIEW', 'booking', sortNo: 31),
      ];

  // นาฬิกาอ้างอิง — เทสต์ที่ต้องผ่าน BR-05 ใช้เวลาสัมพัทธ์ (รอบ +5 ชม.)
  final testStart = DateTime.now();

  String isoAt(int minutesFromStart) {
    final t = testStart.add(Duration(minutes: minutesFromStart));
    return '${t.year.toString().padLeft(4, '0')}-'
        '${t.month.toString().padLeft(2, '0')}-'
        '${t.day.toString().padLeft(2, '0')}T'
        '${t.hour.toString().padLeft(2, '0')}:'
        '${t.minute.toString().padLeft(2, '0')}:00';
  }

  List<Map<String, dynamic>> stopsFixture() => [
        {'stopId': 1, 'stopName': 'คลองเตย', 'isActive': 1},
        {'stopId': 2, 'stopName': 'เอราวัณ', 'isActive': 1},
        {'stopId': 3, 'stopName': 'หมอชิต', 'isActive': 1},
      ];

  // รายการจองสำหรับ GET /bookings — เวลาคงที่ (หน้านี้ไม่มี logic ขึ้นกับนาฬิกา)
  Map<String, dynamic> myBooking({
    required int id,
    required String code,
    required String status,
    int seats = 2,
    String? qrToken = 'tok-qr',
    String? cancelTime,
  }) =>
      {
        'bookingId': id,
        'bookingCode': code,
        'custId': 7,
        'customerName': 'Ada Lovelace',
        'schedId': 1,
        'boardStopId': 1,
        'alightStopId': 3,
        'seats': seats,
        'status': status,
        'bookTime': '2026-12-01T08:00:00',
        'qrToken': qrToken == null ? null : '$qrToken-$code',
        'routeName': 'สายเหนือ',
        'departAt': '2026-12-01T09:30:00',
        'serviceDate': '2026-12-01',
        'boardStopName': 'คลองเตย',
        'alightStopName': 'หมอชิต',
        'cancelTime': cancelTime,
      };

  Map<String, dynamic> seatMapFixture({
    required int schedId,
    required int available,
  }) =>
      {
        'schedId': schedId,
        'totalSeats': 15,
        'bookedSeats': 15 - available,
        'availableSeats': available,
        'maxSeatsPerBooking': 4,
        'seats': [
          for (var seatNo = 1; seatNo <= 15; seatNo++)
            {
              'seatNo': seatNo,
              'status': seatNo <= available ? 'available' : 'reserved',
            },
        ],
      };

  Map<String, dynamic> bookingFixture({required int seats}) => {
        'bookingId': 9,
        'bookingCode': 'BK-20261201-0007',
        'custId': 7,
        'customerName': 'Ada Lovelace',
        'schedId': 1,
        'boardStopId': 1,
        'alightStopId': 3,
        'seats': seats,
        'status': 'reserved',
        'bookTime': '2026-12-01T08:00:00',
        'qrToken': 'tok-abcdef123456',
        'routeName': 'สายเหนือ',
        'departAt': '2026-12-01T09:30:00',
        'serviceDate': '2026-12-01',
        'boardStopName': 'คลองเตย',
        'alightStopName': 'หมอชิต',
      };

  // รอบที่ต้องแสดงใน T12 — เวลาสัมพัทธ์ผ่าน BR-05 เสมอ
  Map<String, dynamic> okTrip({int seatsAvailable = 10, int id = 1}) => {
        'schedId': id,
        'routeId': 1,
        'routeName': 'สายเหนือ',
        'serviceDate': '2026-12-01',
        'departAt': isoAt(290),
        'isActive': 1,
        'totalMinutes': 45,
        'stopCount': 3,
        'seatsTotal': 15,
        'seatsBooked': 15 - seatsAvailable,
        'seatsAvailable': seatsAvailable,
        'stops': [
          {
            'stopSeq': 1,
            'stopId': 1,
            'stopName': 'คลองเตย',
            'arriveAt': isoAt(300),
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 2,
            'stopId': 2,
            'stopName': 'เอราวัณ',
            'arriveAt': isoAt(315),
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 3,
            'stopId': 3,
            'stopName': 'หมอชิต',
            'arriveAt': isoAt(345),
            'dwellMinutes': 0,
          },
        ],
      };

  Future<ShuttleHarness> pumpBooking(
    WidgetTester tester, {
    required Map<String, dynamic> me,
    Size size = const Size(390, 844),
    void Function(FakeBackend backend)? routes,
  }) {
    return pumpShuttle(
      tester,
      token: 'jwt-sprint09',
      initialLocation: '/booking',
      size: size,
      routes: (backend) {
        backend.on('GET', '/api/v1/auth/me', (request) {
          return jsonResponse(200, me);
        });
        backend.on('GET', '/api/v1/stops', (request) {
          return jsonResponse(200, stopsFixture());
        });
        routes?.call(backend);
      },
    );
  }

  Future<void> tapKey(WidgetTester tester, Key key) async {
    final finder = find.byKey(key);
    await tester.ensureVisible(finder);
    await pumpFrames(tester, count: 4);
    await tester.tap(finder);
    await pumpFrames(tester, count: 8);
  }

  Future<void> selectFromDropdown(
    WidgetTester tester,
    Key key,
    String label,
  ) async {
    final dropdown = find.byKey(key);
    await tester.ensureVisible(dropdown);
    await pumpFrames(tester, count: 4);
    await tester.tap(dropdown);
    await pumpFrames(tester, count: 10);
    await tester.tap(find.text(label).last);
    await pumpFrames(tester, count: 10);
  }

  Future<void> openMyBookings(WidgetTester tester) async {
    await tapKey(tester, const Key('book-my-trips'));
    await pumpFrames(tester, count: 10);
  }

  // ---------- T-041: โมเดล ----------

  test('parseBookings อ่าน array ของ Booking + ปฏิเสธรูปแบบผิด', () {
    final bookings = parseBookings([
      myBooking(id: 1, code: 'BK-1', status: 'reserved'),
      myBooking(
        id: 2,
        code: 'BK-2',
        status: 'cancelled',
        cancelTime: '2026-12-01T08:30:00',
      ),
    ]);
    expect(bookings, hasLength(2));
    expect(bookings.first.status, 'reserved');
    expect(bookings.first.custId, 7);
    expect(bookings.first.customerName, 'Ada Lovelace');
    expect(bookings.first.qrToken, 'tok-qr-BK-1');
    expect(bookings.last.status, 'cancelled');
    expect(bookings.last.cancelTime, '2026-12-01T08:30:00');
    expect(bookings.last.departTime, '09:30');

    expect(
      () => parseBookings({'code': 'X'}),
      throwsA(isA<ApiException>()),
      reason: 'ไม่ใช่ array → ต้อง throw ApiException',
    );
    expect(
      () => parseBookings([123]),
      throwsA(isA<ApiException>()),
      reason: 'รายการที่ไม่ใช่ object → ต้อง throw ApiException',
    );
  });

  // ---------- T-041: รายการของฉัน + กรองตามแท็บ ----------

  testWidgets(
      'My Booking: ทางเข้าจากหน้าจอง → GET /bookings?status=reserved '
      '(Bearer) + การ์ดครบ + ยังอยู่ที่ /booking', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          if (request.query['status'] == 'reserved') {
            return jsonResponse(200, [
              myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
            ]);
          }
          return jsonResponse(200, []);
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);

    expect(find.text('การเดินทางของฉัน'), findsOneWidget);
    expect(find.byKey(const Key('mybk-card-BK-20261201-0001')), findsOneWidget);
    expect(
      tester
          .widget<Text>(find.byKey(const Key('mybk-title-BK-20261201-0001')))
          .data,
      'สายเหนือ · รอบ 09:30',
    );
    expect(
      find.text('2026-12-01 · ที่นั่ง 2'),
      findsOneWidget,
    );
    expect(find.text('คลองเตย → หมอชิต'), findsOneWidget);
    expect(find.byKey(const Key('mybk-list')), findsOneWidget);

    // contract: GET /bookings
    final requests = harness.backend.requestsFor('GET', '/api/v1/bookings');
    final reservedRequests =
        requests.where((r) => r.query['status'] == 'reserved').toList();
    expect(reservedRequests, hasLength(1));
    expect(
      reservedRequests.first.headers['authorization'],
      'Bearer jwt-sprint09',
    );
    expect(harness.location, '/booking');
  });

  testWidgets(
      'My Booking: สลับแท็บส่ง status=completed / cancelled ตามลำดับ '
      '· ปุ่มยกเลิกมีเฉพาะ reserved', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          switch (request.query['status']) {
            case 'reserved':
              return jsonResponse(200, [
                myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
              ]);
            case 'completed':
              return jsonResponse(200, [
                myBooking(id: 2, code: 'BK-20261201-0002', status: 'completed'),
              ]);
            case 'cancelled':
              return jsonResponse(200, [
                myBooking(
                  id: 3,
                  code: 'BK-20261201-0003',
                  status: 'cancelled',
                  cancelTime: '2026-12-01T08:30:00',
                ),
              ]);
            default:
              return jsonResponse(200, []);
          }
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    // reserved — มีทั้งปุ่ม QR และยกเลิก
    expect(find.byKey(const Key('mybk-qr-BK-20261201-0001')), findsOneWidget);
    expect(
        find.byKey(const Key('mybk-cancel-BK-20261201-0001')), findsOneWidget);

    await tapKey(tester, const Key('mybk-tab-1'));
    expect(find.byKey(const Key('mybk-card-BK-20261201-0002')), findsOneWidget);
    // completed — UC-21 เงื่อนไขตั้งต้น: ไม่มีปุ่มยกเลิก
    expect(find.byKey(const Key('mybk-cancel-BK-20261201-0002')), findsNothing);
    expect(find.byKey(const Key('mybk-qr-BK-20261201-0002')), findsOneWidget);
    expect(
      find.text('เดินทางแล้ว'),
      findsWidgets,
      reason: 'status chip ของ completed',
    );

    await tapKey(tester, const Key('mybk-tab-2'));
    expect(find.byKey(const Key('mybk-card-BK-20261201-0003')), findsOneWidget);
    expect(find.byKey(const Key('mybk-cancel-BK-20261201-0003')), findsNothing);

    // contract: ทุกแท็บส่ง status query ที่ต่างกัน
    final statuses = harness.backend
        .requestsFor('GET', '/api/v1/bookings')
        .map((r) => r.query['status'])
        .toSet();
    expect(statuses, containsAll(['reserved', 'completed', 'cancelled']));
  });

  testWidgets('My Booking: แท็บว่างแสดง empty state', (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, []);
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);

    expect(find.byKey(const Key('list-empty')), findsOneWidget);
    expect(find.text('ยังไม่มีรายการในแท็บนี้'), findsOneWidget);
    expect(find.byKey(const Key('mybk-list')), findsNothing);
  });

  testWidgets('My Booking: โหลดล้มเหลว → ข้อความตามที่มา + ลองใหม่ได้',
      (tester) async {
    var failed = true;
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          if (request.query['status'] == 'reserved' && failed) {
            failed = false;
            return jsonResponse(500, {
              'code': 'INTERNAL',
              'message': 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่',
            });
          }
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่'), findsOneWidget);
    expect(find.byKey(const Key('mybk-list')), findsNothing);

    await tester.tap(find.text('ลองอีกครั้ง'));
    await pumpFrames(tester, count: 10);

    expect(find.byKey(const Key('mybk-card-BK-20261201-0001')), findsOneWidget);
    final reservedGets = harness.backend
        .requestsFor('GET', '/api/v1/bookings')
        .where((r) => r.query['status'] == 'reserved')
        .toList();
    expect(reservedGets, hasLength(2), reason: 'ลองใหม่ → ต้องยิง GET ซ้ำ');
  });

  // ---------- T-041: QR (UC-20) ----------

  testWidgets(
      'ดู QR: GET /bookings/{code} (Bearer) → วาด QrImageView จาก qrToken '
      '+ รายละเอียดครบ', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0001', (request) {
          return jsonResponse(200,
              myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'));
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-qr-BK-20261201-0001'));

    expect(find.byKey(const Key('qr-code')), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    // qr_flutter 4.1.0 ไม่เปิดอ่าน data ภายนอก (private `_data`) — ตรวจ token
    // ที่หน้า QR ดึงมาจาก provider แทน (data: token ต่อจากบรรทัดต้นทาง)
    final detail = await harness.container
        .read(bookingDetailProvider('BK-20261201-0001').future);
    expect(detail.qrToken, 'tok-qr-BK-20261201-0001');
    expect(detail.status, 'reserved');
    expect(find.byKey(const Key('qr-booking-code')), findsOneWidget);
    expect(find.text('การจอง BK-20261201-0001'), findsOneWidget);
    expect(find.text('แสดง QR ที่จุดขึ้นรถตามเวลาเดินทาง'), findsOneWidget);
    expect(find.text('คลองเตย'), findsWidgets);
    expect(find.text('หมอชิต'), findsWidgets);
    expect(find.text('ที่นั่ง'), findsWidgets);

    final details =
        harness.backend.requestsFor('GET', '/api/v1/bookings/BK-20261201-0001');
    expect(details, hasLength(1));
    expect(details.first.headers['authorization'], 'Bearer jwt-sprint09');
  });

  testWidgets('UC-20 2a: การจองถูกยกเลิก → หน้า QR ไม่แสดง QR', (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          if (request.query['status'] == 'cancelled') {
            return jsonResponse(200, [
              myBooking(
                id: 3,
                code: 'BK-20261201-0003',
                status: 'cancelled',
                cancelTime: '2026-12-01T08:30:00',
              ),
            ]);
          }
          return jsonResponse(200, []);
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0003', (request) {
          return jsonResponse(
              200,
              myBooking(
                id: 3,
                code: 'BK-20261201-0003',
                status: 'cancelled',
                cancelTime: '2026-12-01T08:30:00',
              ));
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-tab-2'));
    await tapKey(tester, const Key('mybk-qr-BK-20261201-0003'));

    expect(find.byKey(const Key('qr-cancelled')), findsOneWidget);
    expect(find.text('การจองนี้ถูกยกเลิกแล้ว'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);
  });

  testWidgets('ดู QR: 403 (จองของผู้อื่น) → แสดง message ตามที่มา',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0001', (request) {
          return jsonResponse(403, {
            'code': 'FORBIDDEN',
            'message': 'เป็นการจองของผู้อื่น',
          });
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-qr-BK-20261201-0001'));

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เป็นการจองของผู้อื่น'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);
  });

  // ---------- T-041: ยกเลิก (UC-21) ----------

  testWidgets(
      'ยกเลิก: ยืนยัน dialog → POST /bookings/{code}/cancel (Bearer, ไม่มี body) '
      '→ 204 + snackbar + โหลดรายการใหม่', (tester) async {
    var reservedCancelled = false;
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          if (request.query['status'] == 'reserved') {
            if (reservedCancelled) return jsonResponse(200, []);
            return jsonResponse(200, [
              myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
            ]);
          }
          return jsonResponse(200, []);
        });
        backend.on('POST', '/api/v1/bookings/BK-20261201-0001/cancel',
            (request) {
          reservedCancelled = true;
          return emptyResponse(204);
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-cancel-BK-20261201-0001'));

    expect(find.byKey(const Key('mybk-cancel-dialog')), findsOneWidget);
    expect(
      find.text('ต้องการยกเลิกการจอง BK-20261201-0001 ใช่หรือไม่?'),
      findsOneWidget,
    );

    await tapKey(tester, const Key('mybk-cancel-confirm'));
    await pumpFrames(tester, count: 10);

    expect(find.byKey(const Key('mybk-cancel-dialog')), findsNothing);
    expect(find.text('ยกเลิกการจองแล้ว'), findsOneWidget);
    // โหลดใหม่ → reserved ว่าง (รายการย้ายไปแท็บ "ยกเลิก")
    expect(find.byKey(const Key('list-empty')), findsOneWidget);

    final cancels = harness.backend
        .requestsFor('POST', '/api/v1/bookings/BK-20261201-0001/cancel');
    expect(cancels, hasLength(1));
    expect(cancels.first.headers['authorization'], 'Bearer jwt-sprint09');
    expect(cancels.first.body, isNull,
        reason: 'OpenAPI: reason ไม่บังคับ → ไม่ส่ง body');
    final reservedGets = harness.backend
        .requestsFor('GET', '/api/v1/bookings')
        .where((r) => r.query['status'] == 'reserved')
        .toList();
    expect(reservedGets, hasLength(2), reason: 'ต้องดึงรายการใหม่หลัง 204');
  });

  testWidgets(
      'ยกเลิก: 409 CANCEL_NOT_ALLOWED → แสดง message ใน dialog '
      '· dialog ค้าง · ไม่โหลดรายการใหม่', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
        backend.on('POST', '/api/v1/bookings/BK-20261201-0001/cancel',
            (request) {
          return jsonResponse(409, {
            'code': 'CANCEL_NOT_ALLOWED',
            'message': 'ยกเลิกไม่ได้ เนื่องจากเช็คอินแล้ว',
          });
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-cancel-BK-20261201-0001'));
    await tapKey(tester, const Key('mybk-cancel-confirm'));
    await pumpFrames(tester, count: 10);

    expect(find.byKey(const Key('mybk-cancel-error')), findsOneWidget);
    expect(find.text('ยกเลิกไม่ได้ เนื่องจากเช็คอินแล้ว'), findsOneWidget);
    expect(find.byKey(const Key('mybk-cancel-dialog')), findsOneWidget);
    expect(
        harness.backend
            .requestsFor('POST', '/api/v1/bookings/BK-20261201-0001/cancel'),
        hasLength(1));
    final reservedGets = harness.backend
        .requestsFor('GET', '/api/v1/bookings')
        .where((r) => r.query['status'] == 'reserved')
        .toList();
    expect(reservedGets, hasLength(1), reason: 'ล้มเหลว → ห้าม reload');
    expect(find.byKey(const Key('mybk-card-BK-20261201-0001')), findsOneWidget);
  });

  testWidgets('ไม่มี BK.CANCEL → ดูรายการ/QR ได้ แต่ไม่มีปุ่มยกเลิก',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: noCancelPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);

    expect(find.byKey(const Key('mybk-card-BK-20261201-0001')), findsOneWidget);
    expect(find.byKey(const Key('mybk-qr-BK-20261201-0001')), findsOneWidget);
    expect(find.byKey(const Key('mybk-cancel-BK-20261201-0001')), findsNothing);
    expect(find.byKey(const Key('mybk-cancel-dialog')), findsNothing);
  });

  // ---------- T-041: จองสำเร็จ → QR (UC-20 trigger) ----------

  testWidgets('จองสำเร็จ → ปุ่ม "ดู QR เช็คอิน" → GET /bookings/{code} แสดง QR',
      (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [okTrip()]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(200, seatMapFixture(schedId: 1, available: 10));
        });
        backend.on('POST', '/api/v1/bookings', (request) {
          return jsonResponse(201, bookingFixture(seats: 1));
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0007', (request) {
          return jsonResponse(200, bookingFixture(seats: 1));
        });
      },
    );
    await pumpFrames(tester, count: 20);

    // เดิน flow จองครบ (เหมือน T-040): เลือกจุด → ค้นรอบ → ยืนยัน
    await selectFromDropdown(tester, const Key('book-board-stop'), 'คลองเตย');
    await selectFromDropdown(tester, const Key('book-alight-stop'), 'หมอชิต');
    await tapKey(tester, const Key('book-next'));
    await tapKey(tester, const Key('book-trip-1'));
    await tapKey(tester, const Key('book-next'));
    await tapKey(tester, const Key('book-confirm'));
    await pumpFrames(tester, count: 10);

    expect(find.byKey(const Key('booking-success')), findsOneWidget);
    expect(find.byKey(const Key('book-view-qr')), findsOneWidget);

    await tapKey(tester, const Key('book-view-qr'));
    await pumpFrames(tester, count: 10);

    expect(find.text('การจอง BK-20261201-0007'), findsOneWidget);
    expect(find.byKey(const Key('qr-code')), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    final detail = await harness.container
        .read(bookingDetailProvider('BK-20261201-0007').future);
    expect(detail.qrToken, 'tok-abcdef123456');

    final details =
        harness.backend.requestsFor('GET', '/api/v1/bookings/BK-20261201-0007');
    expect(details, hasLength(1));
    expect(details.first.headers['authorization'], 'Bearer jwt-sprint09');
  });

  // ---------- T-041: defect ตาม Codex r1 — กันปิด dialog ระหว่าง POST ----------

  testWidgets(
      'ยกเลิก: POST ค้างอยู่ → PopScope กัน Back · กันแตะพื้นหลัง · กดยืนยันซ้ำไม่ยิงซ้ำ '
      '· 204 ตามมา → snackbar + reload', (tester) async {
    var reservedCancelled = false;
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          if (request.query['status'] == 'reserved') {
            if (reservedCancelled) return jsonResponse(200, []);
            return jsonResponse(200, [
              myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
            ]);
          }
          return jsonResponse(200, []);
        });
        backend.on('POST', '/api/v1/bookings/BK-20261201-0001/cancel',
            (request) async {
          await Future<void>.delayed(const Duration(milliseconds: 4000));
          reservedCancelled = true;
          return emptyResponse(204);
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-cancel-BK-20261201-0001'));

    await tester.tap(find.byKey(const Key('mybk-cancel-confirm')));
    await pumpFrames(tester, count: 4); // 200ms < 4000ms — POST ยังค้าง

    // ระหว่างส่ง: ปุ่มยืนยันถูกปิด + PopScope (ancestor ของ dialog) กัน Back
    final confirm = tester
        .widget<FilledButton>(find.byKey(const Key('mybk-cancel-confirm')));
    expect(confirm.onPressed, isNull);
    final blockedScopes = find.ancestor(
      of: find.byKey(const Key('mybk-cancel-dialog')),
      matching: find.byWidgetPredicate((w) => w is PopScope && !w.canPop),
    );
    expect(blockedScopes, findsWidgets,
        reason: 'PopScope canPop=false ต้องเป็น ancestor ของ dialog');

    // กด Back จริงระหว่าง POST (behavioral) — ต้องไม่ปิด dialog
    // และไม่ pop route ใด ๆ ใต้ dialog
    await tester.binding.handlePopRoute();
    await pumpFrames(tester, count: 4);
    expect(
      find.byKey(const Key('mybk-cancel-dialog')),
      findsOneWidget,
      reason: 'Back ระหว่าง POST ต้องถูก PopScope กัน — dialog ต้องค้างอยู่',
    );
    expect(
      find.byKey(const Key('mybk-list')),
      findsOneWidget,
      reason: 'Back ระหว่าง POST ต้องไม่ pop หน้ารายการใต้ dialog',
    );

    // เมคคานิกส์หลักของ back: Navigator.maybePop บน navigator ของ dialog
    // ใน Flutter เวอร์ชันนี้ maybePop คืนค่า true ทั้งเมื่อ "pop จริง" และ
    // "ถูก veto" (doNotPop → onPopInvokedWithResult → true) จึงพิสูจน์ด้วย
    // ผลลัพธ์จริงแทนค่า return: ปล่อยเวลา 8×50ms=400ms ให้แอนิเมชันปิดจบ
    // (ยัง < 4000ms ที่ POST จะยังค้างอยู่) → dialog/หน้ารายการต้องยังอยู่
    final dialogScope =
        tester.element(find.byKey(const Key('mybk-cancel-dialog')));
    await Navigator.of(dialogScope).maybePop();
    await pumpFrames(tester, count: 8);
    expect(
      find.byKey(const Key('mybk-cancel-dialog')),
      findsOneWidget,
      reason: 'maybePop ต้องถูก PopScope veto — dialog ต้องไม่ปิดระหว่าง POST',
    );
    expect(
      find.byKey(const Key('mybk-list')),
      findsOneWidget,
      reason: 'maybePop ต้องไม่ pop หน้ารายการใต้ dialog',
    );

    // แตะพื้นหลัง (scrim) — ต้องไม่ปิด dialog
    await tester.tapAt(const Offset(3, 3));
    await pumpFrames(tester, count: 4);
    expect(find.byKey(const Key('mybk-cancel-dialog')), findsOneWidget);

    // กดยืนยันซ้ำ — ต้องไม่ยิง POST ซ้ำ
    await tester.tap(find.byKey(const Key('mybk-cancel-confirm')));
    await pumpFrames(tester, count: 4);
    expect(
      harness.backend
          .requestsFor('POST', '/api/v1/bookings/BK-20261201-0001/cancel'),
      hasLength(1),
    );

    // รอ 204 (t=4000ms ในเพจไทม์ไลน์) → ปิด dialog + snackbar + reload
    // 80×50ms=4000ms → สิ้นสุดที่ ~t=5200ms: snackbar อายุ 1.2s < 4s ยังเห็นอยู่
    await pumpFrames(tester, count: 80);
    expect(find.byKey(const Key('mybk-cancel-dialog')), findsNothing);
    expect(find.text('ยกเลิกการจองแล้ว'), findsOneWidget);
    final reservedGets = harness.backend
        .requestsFor('GET', '/api/v1/bookings')
        .where((r) => r.query['status'] == 'reserved')
        .toList();
    expect(reservedGets, hasLength(2));
    expect(find.byKey(const Key('list-empty')), findsOneWidget);
  });

  // ---------- T-041: สาขาสถานะของหน้า QR ที่ยังไม่มีเทสต์ ----------

  testWidgets(
      'UC-20 2b: รายละเอียดเป็น checked_in → แสดง QR + Chip "เช็คอินแล้ว"',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0001', (request) {
          return jsonResponse(200,
              myBooking(id: 1, code: 'BK-20261201-0001', status: 'checked_in'));
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-qr-BK-20261201-0001'));

    expect(find.byKey(const Key('qr-checked-in')), findsOneWidget);
    expect(find.byKey(const Key('qr-code')), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.byKey(const Key('qr-cancelled')), findsNothing);
    expect(find.byKey(const Key('qr-not-available')), findsNothing);
  });

  testWidgets('หน้า QR: completed → ไม่แสดง QR (เดินทางเสร็จสิ้นแล้ว)',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 2, code: 'BK-20261201-0002', status: 'completed'),
          ]);
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0002', (request) {
          return jsonResponse(200,
              myBooking(id: 2, code: 'BK-20261201-0002', status: 'completed'));
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-qr-BK-20261201-0002'));

    expect(find.byKey(const Key('qr-not-available')), findsOneWidget);
    expect(find.text('เดินทางเสร็จสิ้นแล้ว'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);
    expect(find.byKey(const Key('qr-code')), findsNothing);
  });

  testWidgets('หน้า QR: qrToken ว่าง → qr-missing ไม่ว่าสถานะจะเป็นอะไร',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0001', (request) {
          return jsonResponse(
              200,
              myBooking(
                id: 1,
                code: 'BK-20261201-0001',
                status: 'reserved',
                qrToken: null,
              ));
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-qr-BK-20261201-0001'));

    expect(find.byKey(const Key('qr-missing')), findsOneWidget);
    expect(find.text('ไม่พบ QR สำหรับรายการนี้'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);
  });

  // ---------- T-041: defect ตาม Codex r1 — พิสูจน์ว่า QR วาดจาก qrToken จริง ----------

  testWidgets(
      'QR encoder proof: พิกเซลจาก QrPainter ของหน้าจริง = พิกเซลจาก '
      'QrImageView ที่สร้างจากรหัส token คาดหมาย', (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: fullBookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/bookings', (request) {
          return jsonResponse(200, [
            myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'),
          ]);
        });
        backend.on('GET', '/api/v1/bookings/BK-20261201-0001', (request) {
          return jsonResponse(200,
              myBooking(id: 1, code: 'BK-20261201-0001', status: 'reserved'));
        });
      },
    );
    await pumpFrames(tester, count: 10);

    await openMyBookings(tester);
    await tapKey(tester, const Key('mybk-qr-BK-20261201-0001'));
    expect(find.byType(QrImageView), findsOneWidget);

    final painterFinder = find
        .byWidgetPredicate((w) => w is CustomPaint && w.painter is QrPainter);
    expect(painterFinder, findsWidgets);
    final actualPainter =
        tester.widget<CustomPaint>(painterFinder.first).painter! as QrPainter;
    // Picture.toImage/toByteData เป็นงาน async ของ engine — ต้องรันใน
    // runAsync (โซน async จริง) ไม่งั้นค้างใน fake-async ของ widget test
    final actualBytes = (await tester.runAsync(() async {
      final image = await actualPainter.toImage(220);
      return image.toByteData(format: ui.ImageByteFormat.rawRgba);
    }))!;

    // สร้างภาพคาดหมายด้วยพารามิเตอร์เดียวกับ QrImageView บนหน้าจริง
    // (data = qrToken ที่ API ส่งมา · size 220 · พื้นหลังขาว)
    await tester.pumpWidget(MaterialApp(
      home: QrImageView(
        data: 'tok-qr-BK-20261201-0001',
        size: 220,
        backgroundColor: Colors.white,
      ),
    ));
    await pumpFrames(tester, count: 4);
    final expectedFinder = find
        .byWidgetPredicate((w) => w is CustomPaint && w.painter is QrPainter);
    expect(expectedFinder, findsWidgets);
    final expectedPainter =
        tester.widget<CustomPaint>(expectedFinder.first).painter! as QrPainter;
    final expectedBytes = (await tester.runAsync(() async {
      final image = await expectedPainter.toImage(220);
      return image.toByteData(format: ui.ImageByteFormat.rawRgba);
    }))!;

    expect(actualBytes.lengthInBytes, expectedBytes.lengthInBytes);
    expect(
      actualBytes.buffer.asUint8List(),
      orderedEquals(expectedBytes.buffer.asUint8List()),
      reason: 'ภาพ QR บนหน้าจริงต้องมาจาก qrToken เดียวกับที่ API ส่งมา',
    );
  });
}
