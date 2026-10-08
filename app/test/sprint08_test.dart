import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_error.dart';
import 'package:shuttle_app/features/booking/booking_models.dart';
import 'package:shuttle_app/features/front/schedule_models.dart';

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

  List<Map<String, dynamic>> bookingPermissions() => [
        perm(30, 'BK.CREATE', 'booking', sortNo: 30),
        perm(31, 'BK.VIEW', 'booking', sortNo: 31),
        perm(32, 'BK.CANCEL', 'booking', sortNo: 32),
      ];

  List<Map<String, dynamic>> viewOnlyPermissions() => [
        perm(31, 'BK.VIEW', 'booking', sortNo: 31),
        perm(32, 'BK.CANCEL', 'booking', sortNo: 32),
      ];

  // นาฬิกาอ้างอิงของไฟล์เทสต์ — รอบที่ต้อง "แสดง" สร้างจากเวลาสัมพัทธ์
  // (+5 ชม.) จึงผ่าน BR-05 โดยไม่พังเมื่อนาฬิกาจริงผ่านวันที่ fixture เดิม
  final testStart = DateTime.now();

  String isoAt(int minutesFromStart) {
    final t = testStart.add(Duration(minutes: minutesFromStart));
    return '${t.year.toString().padLeft(4, '0')}-'
        '${t.month.toString().padLeft(2, '0')}-'
        '${t.day.toString().padLeft(2, '0')}T'
        '${t.hour.toString().padLeft(2, '0')}:'
        '${t.minute.toString().padLeft(2, '0')}:00';
  }

  String hhmmAt(int minutesFromStart) =>
      isoAt(minutesFromStart).substring(11, 16);

  Map<String, dynamic> stopItem(int id, String name) => {
        'stopId': id,
        'stopName': name,
        'isActive': 1,
      };

  List<Map<String, dynamic>> stopsFixture() => [
        stopItem(1, 'คลองเตย'),
        stopItem(2, 'เอราวัณ'),
        stopItem(3, 'หมอชิต'),
      ];

  // วันที่: รอบที่ต้อง "แสดง" (okTrip) ใช้เวลาสัมพัทธ์จาก testStart → ผ่าน BR-05 เสมอ
  // · BR-05 unit test ฉีด `now` คงที่เอง · รอบที่ต้อง "ซ่อน" กรองด้วย BR-11/BR-12/
  // เต็ม/ไม่มี stops (ไม่ขึ้นกับวันที่) จึงทุกเทสต์ไม่ขึ้นกับวันที่รัน
  Map<String, dynamic> scheduleFixture({
    required int id,
    required String departAt,
    required int seatsAvailable,
    List<Map<String, dynamic>>? stops,
    String boardArriveAt = '2026-12-01T09:40:00',
  }) =>
      {
        'schedId': id,
        'routeId': 1,
        'routeName': 'สายเหนือ',
        'serviceDate': '2026-12-01',
        'departAt': departAt,
        'isActive': 1,
        'totalMinutes': 45,
        'stopCount': 3,
        'seatsTotal': 15,
        'seatsBooked': 15 - seatsAvailable,
        'seatsAvailable': seatsAvailable,
        'stops': stops ??
            [
              {
                'stopSeq': 1,
                'stopId': 1,
                'stopName': 'คลองเตย',
                'arriveAt': boardArriveAt,
                'dwellMinutes': 2,
              },
              {
                'stopSeq': 2,
                'stopId': 2,
                'stopName': 'เอราวัณ',
                'arriveAt': '2026-12-01T09:55:00',
                'dwellMinutes': 2,
              },
              {
                'stopSeq': 3,
                'stopId': 3,
                'stopName': 'หมอชิต',
                'arriveAt': '2026-12-01T10:15:00',
                'dwellMinutes': 0,
              },
            ],
      };

  // รอบที่ขึ้นได้จริง: คลองเตย(seq1) → หมอชิต(seq3)
  // เวลาสัมพัทธ์ testStart+5 ชม. → ห่าง cutoff 20 นาทีมาก แสดงได้เสมอ
  Map<String, dynamic> okTrip({int seatsAvailable = 10, int id = 1}) =>
      scheduleFixture(
        id: id,
        departAt: isoAt(290),
        seatsAvailable: seatsAvailable,
        boardArriveAt: isoAt(300),
      );

  // จุดขึ้นอยู่หลังจุดลง (หมอชิต seq1 → คลองเตย seq3) — ผิด BR-11
  Map<String, dynamic> reversedTrip() => scheduleFixture(
        id: 2,
        departAt: '2026-12-01T11:00:00',
        seatsAvailable: 8,
        stops: [
          {
            'stopSeq': 1,
            'stopId': 3,
            'stopName': 'หมอชิต',
            'arriveAt': '2026-12-01T11:10:00',
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 2,
            'stopId': 2,
            'stopName': 'เอราวัณ',
            'arriveAt': '2026-12-01T11:25:00',
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 3,
            'stopId': 1,
            'stopName': 'คลองเตย',
            'arriveAt': '2026-12-01T11:45:00',
            'dwellMinutes': 0,
          },
        ],
      );

  // ไม่มีจุดขึ้น/จุดลงในเส้นทางของรอบ — ผิด BR-12
  Map<String, dynamic> missingStopTrip() => scheduleFixture(
        id: 3,
        departAt: '2026-12-01T13:00:00',
        seatsAvailable: 6,
        stops: [
          {
            'stopSeq': 1,
            'stopId': 2,
            'stopName': 'เอราวัณ',
            'arriveAt': '2026-12-01T13:10:00',
            'dwellMinutes': 0,
          },
        ],
      );

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

  Future<ShuttleHarness> pumpBooking(
    WidgetTester tester, {
    required Map<String, dynamic> me,
    Size size = const Size(390, 844),
    void Function(FakeBackend backend)? routes,
  }) {
    return pumpShuttle(
      tester,
      token: 'jwt-sprint08',
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

  Future<void> tapKey(WidgetTester tester, Key key) async {
    final finder = find.byKey(key);
    await tester.ensureVisible(finder);
    await pumpFrames(tester, count: 4);
    await tester.tap(finder);
    await pumpFrames(tester, count: 8);
  }

  Future<void> selectStops(WidgetTester tester) async {
    await selectFromDropdown(tester, const Key('book-board-stop'), 'คลองเตย');
    await selectFromDropdown(tester, const Key('book-alight-stop'), 'หมอชิต');
  }

  /// ขั้นที่ 1 → ขั้นที่ 2 (ค้นหารอบเวลา)
  Future<void> openTrips(WidgetTester tester) async {
    await selectStops(tester);
    await tapKey(tester, const Key('book-next'));
  }

  /// ขั้นที่ 2 → ขั้นที่ 3 (ถัดไปสู่หน้ายืนยัน)
  Future<void> openConfirm(WidgetTester tester) async {
    await tapKey(tester, const Key('book-next'));
  }

  String countText(WidgetTester tester) =>
      tester.widget<Text>(find.byKey(const Key('book-count'))).data ?? '';

  // ---------- T-040 unit: models + กรองรอบฝั่ง UI ----------

  test('SeatMap/Booking models แยกค่าตาม OpenAPI และปฏิเสธรูปแบบผิด', () {
    final map = parseSeatMap(seatMapFixture(schedId: 1, available: 11));
    expect(map.schedId, 1);
    expect(map.totalSeats, 15);
    expect(map.bookedSeats, 4);
    expect(map.availableSeats, 11);
    expect(map.maxSeatsPerBooking, 4);
    expect(map.seats, hasLength(15));
    expect(map.seats.first.seatNo, 1);
    expect(map.seats.first.status, 'available');
    expect(map.seats.last.status, 'reserved');

    final booking = parseBooking(bookingFixture(seats: 2));
    expect(booking.bookingId, 9);
    expect(booking.bookingCode, 'BK-20261201-0007');
    expect(booking.schedId, 1);
    expect(booking.boardStopId, 1);
    expect(booking.alightStopId, 3);
    expect(booking.seats, 2);
    expect(booking.status, 'reserved');
    expect(booking.qrToken, 'tok-abcdef123456');
    expect(booking.routeName, 'สายเหนือ');
    expect(booking.departTime, '09:30');
    expect(booking.boardStopName, 'คลองเตย');
    expect(booking.alightStopName, 'หมอชิต');

    expect(
      () => parseSeatMap('not-a-map'),
      throwsA(isA<ApiException>()),
    );
    expect(
      () => parseSeatMap([1, 2]),
      throwsA(isA<ApiException>()),
    );
    expect(
      () => parseBooking(42),
      throwsA(isA<ApiException>()),
    );
  });

  test('boardableTrips กรอง BR-05/BR-11/BR-12 + รอบเต็ม + รอบที่ตรวจสอบไม่ได้',
      () {
    final schedules = [
      Schedule.fromJson(okTrip()),
      Schedule.fromJson(reversedTrip()),
      Schedule.fromJson(missingStopTrip()),
      Schedule.fromJson(okTrip(seatsAvailable: 0, id: 4)),
      Schedule.fromJson(scheduleFixture(
        id: 5,
        departAt: '2026-12-01T15:00:00',
        seatsAvailable: 5,
        stops: const [],
      )),
    ];

    final filtered = boardableTrips(
      schedules,
      boardStopId: 1,
      alightStopId: 3,
      now: testStart,
    );

    // 1 = ผ่านทุกเงื่อนไข (ถึงจุดขึ้น testStart+5 ชม. → BR-05 ผ่าน)
    // 2 = BR-11 (สลับลำดับ) · 3 = BR-12 (จุดไม่อยู่ในรอบ) · 4 = BR-07 (เต็ม)
    // 5 = ไม่มีข้อมูล stops → ตรวจสอบ BR-05/11/12 ไม่ได้ → ไม่แสดง
    expect(filtered.map((s) => s.schedId).toList(), [1]);
  });

  test(
      'BR-05: ซ่อนรอบที่เหลือเวลาถึงจุดขึ้นน้อยกว่า 20 นาที '
      '(เทียบเวลาถึงจุดขึ้น ไม่ใช่เวลาออกเดินทาง · ครบ 20 นาที = ยังแสดง)', () {
    // นาฬิกาคงที่: 2026-12-01 09:00
    final now = DateTime(2026, 12, 1, 9, 0);

    List<Schedule> filter({
      required String boardArriveAt,
      String departAt = '2026-12-01T11:00:00',
    }) =>
        boardableTrips(
          [
            Schedule.fromJson(scheduleFixture(
              id: 7,
              departAt: departAt,
              seatsAvailable: 5,
              boardArriveAt: boardArriveAt,
            )),
          ],
          boardStopId: 1,
          alightStopId: 3,
          now: now,
        );

    // 15 นาที → ซ่อน
    expect(filter(boardArriveAt: '2026-12-01T09:15:00'), isEmpty);
    // น้อยกว่า 20 นาที (19 นาที) → ซ่อน
    expect(filter(boardArriveAt: '2026-12-01T09:19:00'), isEmpty);
    // ครบ 20 นาทีพอดี → แสดง (สูตร Oracle `>= 20 นาที`)
    expect(filter(boardArriveAt: '2026-12-01T09:20:00'), hasLength(1));
    // มากกว่า 20 นาที → แสดง
    expect(filter(boardArriveAt: '2026-12-01T09:40:00'), hasLength(1));

    // แม้ `departAt` จะอยู่ห่าง 2 ชั่วโมง (11:00) แต่เวลาถึงจุดขึ้นเหลือ 15 นาที
    // → ซ่อน: ยืนยันว่าเทียบกับเวลาถึง "จุดขึ้นรถ" ไม่ใช่เวลาออก (สูตร UC-17)
    expect(
      filter(
          boardArriveAt: '2026-12-01T09:15:00',
          departAt: '2026-12-01T11:00:00'),
      isEmpty,
    );

    // arriveAt ของจุดขึ้นว่าง/อ่านไม่ได้ → ตรวจ BR-05 ไม่ได้ → ไม่แสดง
    expect(filter(boardArriveAt: ''), isEmpty);
    expect(filter(boardArriveAt: 'not-a-date'), isEmpty);
  });

  // ---------- T-040: เลือกจุดขึ้น–ลง ----------

  testWidgets(
      'เลือกจุดขึ้น–ลง: GET /stops ตามสเปก + บังคับเลือกทั้งสองจุด + '
      'BR-11 ห้ามจุดขึ้น = จุดลง (ยังไม่มี GET /schedules)', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
    );
    await pumpFrames(tester, count: 20);

    expect(find.byKey(const Key('book-board-stop')), findsOneWidget);
    expect(find.byKey(const Key('book-alight-stop')), findsOneWidget);
    expect(find.byKey(const Key('book-date')), findsOneWidget);

    final stopsRequests = harness.backend.requestsFor('GET', '/api/v1/stops');
    expect(stopsRequests, isNotEmpty);
    for (final request in stopsRequests) {
      expect(request.headers['authorization'], 'Bearer jwt-sprint08');
      expect(request.query['activeOnly'], 'true');
    }

    // ยังไม่เลือกจุดจอด → แจ้งเตือน และไม่มีการค้นหารอบ
    await tapKey(tester, const Key('book-next'));
    expect(find.text('กรุณาเลือกจุดจอดขึ้นและจุดจอดลงรถ'), findsOneWidget);
    expect(find.byKey(const Key('book-stops-error')), findsOneWidget);
    expect(harness.backend.requestsFor('GET', '/api/v1/schedules'), isEmpty);

    // เลือกจุดขึ้น = จุดลง → BR-11
    await selectFromDropdown(tester, const Key('book-board-stop'), 'คลองเตย');
    await selectFromDropdown(tester, const Key('book-alight-stop'), 'คลองเตย');
    await tapKey(tester, const Key('book-next'));
    expect(find.text('จุดจอดลงต้องอยู่หลังจุดจอดขึ้น'), findsOneWidget);
    expect(harness.backend.requestsFor('GET', '/api/v1/schedules'), isEmpty);
  });

  testWidgets(
      'จุดจอดโหลดไม่สำเร็จ: แสดงข้อความผิดพลาด + ปุ่มลองใหม่ แล้วใช้ได้ใหม่',
      (tester) async {
    var failStops = true;
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/stops', (request) {
          if (failStops) {
            return jsonResponse(500, {
              'code': 'INTERNAL',
              'message': 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่',
            });
          }
          return jsonResponse(200, stopsFixture());
        });
      },
    );
    await pumpFrames(tester, count: 20);

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่'), findsOneWidget);
    expect(find.text('ลองอีกครั้ง'), findsOneWidget);
    expect(
      find.byKey(const Key('book-board-stop')),
      findsNothing,
      reason: 'โหลดจุดจอดไม่สำเร็จต้องไม่แสดง dropdown ว่างเปล่า',
    );
    expect(
      harness.backend.requestsFor('GET', '/api/v1/stops'),
      isNotEmpty,
    );

    failStops = false;
    await tester.tap(find.text('ลองอีกครั้ง'));
    await pumpFrames(tester, count: 20);

    expect(find.byKey(const Key('list-error-message')), findsNothing);
    expect(find.byKey(const Key('book-board-stop')), findsOneWidget);
    expect(find.byKey(const Key('book-alight-stop')), findsOneWidget);
    expect(
      harness.backend.requestsFor('GET', '/api/v1/stops').length,
      greaterThanOrEqualTo(2),
      reason: 'ปุ่มลองใหม่ต้องยิง GET /stops ซ้ำ',
    );
  });

  // ---------- T-040: happy path ----------

  testWidgets(
      'จองสำเร็จ: availableOnly+serviceDate → กรองรอบ → แผนผังที่นั่ง → '
      'POST ตรง BookingCreate → แสดงรหัสการจอง', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(
              200, [okTrip(), reversedTrip(), missingStopTrip()]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(200, seatMapFixture(schedId: 1, available: 10));
        });
        backend.on('POST', '/api/v1/bookings', (request) {
          return jsonResponse(201, bookingFixture(seats: 2));
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);

    // contract: GET /schedules
    final tripRequests =
        harness.backend.requestsFor('GET', '/api/v1/schedules');
    expect(tripRequests, hasLength(1));
    final tripQuery = tripRequests.first.query;
    expect(tripRequests.first.headers['authorization'], 'Bearer jwt-sprint08');
    expect(tripQuery['activeOnly'], 'true');
    expect(tripQuery['availableOnly'], 'true');
    expect(
      RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(tripQuery['serviceDate'] ?? ''),
      isTrue,
      reason: 'serviceDate ต้องเป็น yyyy-MM-dd',
    );

    // แสดงเฉพาะรอบที่ขึ้นได้จริง (BR-11/BR-12 กรองออก)
    expect(find.byKey(const Key('book-trip-1')), findsOneWidget);
    expect(find.byKey(const Key('book-trip-2')), findsNothing);
    expect(find.byKey(const Key('book-trip-3')), findsNothing);
    expect(
      tester.widget<Text>(find.byKey(const Key('book-trip-time-1'))).data,
      '${hhmmAt(290)} น. · สายเหนือ',
    );
    expect(
      tester.widget<Text>(find.byKey(const Key('book-trip-stops-1'))).data,
      'คลองเตย → หมอชิต',
    );
    expect(
      tester.widget<Text>(find.byKey(const Key('book-trip-seats-1'))).data,
      'เหลือ 10 ที่นั่ง',
    );

    // เลือกรอบ → ดึงแผนผังที่นั่ง (contract)
    await tapKey(tester, const Key('book-trip-1'));
    final seatRequests =
        harness.backend.requestsFor('GET', '/api/v1/schedules/1/seats');
    expect(seatRequests, hasLength(1));
    expect(seatRequests.first.headers['authorization'], 'Bearer jwt-sprint08');
    expect(
      RegExp(r'^\d{4}-\d{2}-\d{2}$')
          .hasMatch(seatRequests.first.query['serviceDate'] ?? ''),
      isTrue,
      reason: 'serviceDate ต้องเป็น yyyy-MM-dd',
    );
    expect(find.byKey(const Key('book-seat-info')), findsOneWidget);
    expect(find.text('ที่นั่งว่าง 10 จาก 15 ที่นั่ง'), findsOneWidget);
    expect(find.text('จองครั้งละไม่เกิน 4 ที่นั่ง'), findsOneWidget);
    expect(countText(tester), '1');

    // เลือก 2 ที่นั่ง → หน้ายืนยัน
    await tapKey(tester, const Key('book-seat-plus'));
    expect(countText(tester), '2');
    await openConfirm(tester);
    expect(find.byKey(const Key('book-summary')), findsOneWidget);
    expect(find.text('ยืนยันการจอง'), findsOneWidget);

    // ยืนยัน → POST /bookings ร่างกายตรง `BookingCreate` เป๊ะ
    await tapKey(tester, const Key('book-confirm'));
    await pumpFrames(tester, count: 10);

    final posts = harness.backend.requestsFor('POST', '/api/v1/bookings');
    expect(posts, hasLength(1));
    expect(posts.first.headers['authorization'], 'Bearer jwt-sprint08');
    expect(posts.first.body, {
      'schedId': 1,
      'boardStopId': 1,
      'alightStopId': 3,
      'seats': 2,
    });

    // ผลสำเร็จจากเซิร์ฟเวอร์จริง (201) — แสดงรหัสการจอง
    expect(find.byKey(const Key('booking-success')), findsOneWidget);
    expect(find.text('รหัสการจอง: BK-20261201-0007'), findsOneWidget);
    expect(find.text('จองที่นั่งสำเร็จ'), findsWidgets);
    expect(find.byKey(const Key('book-confirm')), findsNothing);
  });

  // ---------- T-040: รอบว่าง/กรองหมด ----------

  testWidgets(
      'ไม่มีรอบที่ขึ้นได้จริง (BR-11/BR-12 กรองหมด) → '
      'แจ้ง "ไม่มีรอบที่จองได้ในวันนี้"', (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [reversedTrip(), missingStopTrip()]);
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);

    expect(find.byKey(const Key('list-empty')), findsOneWidget);
    expect(find.text('ไม่มีรอบที่จองได้ในวันนี้'), findsOneWidget);
    expect(find.byKey(const Key('book-trip-1')), findsNothing);
    expect(find.byKey(const Key('book-trip-2')), findsNothing);
    expect(find.byKey(const Key('book-trip-3')), findsNothing);
  });

  testWidgets(
      'BR-05 ฝั่งรายการ: รอบที่ถึงจุดขึ้นอีก 10 นาทีไม่ถูกแสดง '
      '· รอบที่ยังห่างมากแสดงตามเดิม', (tester) async {
    final now = DateTime.now();
    String iso(DateTime t) => '${t.year.toString().padLeft(4, '0')}-'
        '${t.month.toString().padLeft(2, '0')}-'
        '${t.day.toString().padLeft(2, '0')}T'
        '${t.hour.toString().padLeft(2, '0')}:'
        '${t.minute.toString().padLeft(2, '0')}:00';

    await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [
            // ถึงจุดขึ้นอีก 10 นาที → BR-05 ต้องซ่อน (ไม่ต้องรอ server)
            scheduleFixture(
              id: 6,
              departAt: iso(now.add(const Duration(minutes: 9))),
              seatsAvailable: 5,
              boardArriveAt: iso(now.add(const Duration(minutes: 10))),
            ),
            // ห่าง 5 ชั่วโมง (สัมพัทธ์ testStart) → แสดง
            okTrip(id: 1),
          ]);
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);

    expect(
      find.byKey(const Key('book-trip-6')),
      findsNothing,
      reason: 'BR-05: เหลือเวลาถึงจุดขึ้นน้อยกว่า 20 นาทีต้องไม่แสดง',
    );
    expect(find.byKey(const Key('book-trip-1')), findsOneWidget);
  });

  // ---------- T-040: ข้อผิดพลาดโหลดรอบ ----------

  testWidgets('รอบเวลา: ข้อผิดพลาดจากเซิร์ฟเวอร์แสดงตามที่มา + ปุ่มลองใหม่',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(500, {
            'code': 'INTERNAL',
            'message': 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่'), findsOneWidget);
    expect(find.text('ลองอีกครั้ง'), findsOneWidget);
  });

  // ---------- T-040: BR-06 / BR-07 clamp ----------

  testWidgets(
      'จำนวนที่นั่ง: BR-06 เลือกได้ 1–4 (เกิน 4 เพิ่มไม่ได้ · ต่ำสุด 1)',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [
            okTrip(seatsAvailable: 10),
          ]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(200, seatMapFixture(schedId: 1, available: 10));
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    await tapKey(tester, const Key('book-trip-1'));

    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    expect(countText(tester), '4');

    final plus =
        tester.widget<IconButton>(find.byKey(const Key('book-seat-plus')));
    expect(plus.onPressed, isNull, reason: 'เกิน 4 ที่นั่งตาม BR-06');

    await tester.tap(find.byKey(const Key('book-seat-plus')));
    await pumpFrames(tester, count: 6);
    expect(countText(tester), '4');

    await tapKey(tester, const Key('book-seat-minus'));
    await tapKey(tester, const Key('book-seat-minus'));
    await tapKey(tester, const Key('book-seat-minus'));
    expect(countText(tester), '1');
    final minus =
        tester.widget<IconButton>(find.byKey(const Key('book-seat-minus')));
    expect(minus.onPressed, isNull, reason: 'ต่ำสุด 1 ที่นั่ง');
  });

  testWidgets('จำนวนที่นั่ง: BR-07 จำกัดไม่เกินที่นั่งว่าง (ว่าง 3 → สูงสุด 3)',
      (tester) async {
    await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [
            okTrip(seatsAvailable: 3),
          ]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(200, seatMapFixture(schedId: 1, available: 3));
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    expect(
      tester.widget<Text>(find.byKey(const Key('book-trip-seats-1'))).data,
      'เหลือ 3 ที่นั่ง',
    );
    await tapKey(tester, const Key('book-trip-1'));

    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    expect(countText(tester), '3');
    final plus =
        tester.widget<IconButton>(find.byKey(const Key('book-seat-plus')));
    expect(plus.onPressed, isNull, reason: 'เกินที่นั่งว่าง (BR-07)');

    // ยังไปหน้ายืนยันได้ (เลือกได้ตั้งแต่ 1 ที่นั่ง)
    await openConfirm(tester);
    expect(find.byKey(const Key('book-summary')), findsOneWidget);
  });

  // ---------- T-040: แผนผังที่นั่งพัง ----------

  testWidgets(
      'แผนผังที่นั่ง 404 → แสดงข้อความเซิร์ฟเวอร์ · '
      'ยังใช้ seatsAvailable จากรอบเดินหน้าต่อได้', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [
            okTrip(seatsAvailable: 10),
          ]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(404, {
            'code': 'NOT_FOUND',
            'message': 'ไม่พบรอบเวลานี้',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    await tapKey(tester, const Key('book-trip-1'));

    expect(find.byKey(const Key('book-seat-info')), findsNothing);
    expect(find.text('ไม่พบรอบเวลานี้'), findsOneWidget);
    expect(find.text('ลองอีกครั้ง'), findsOneWidget);

    // fallback: seatsAvailable = 10 → BR-06 จำกัดที่ 4 เหมือนเดิม
    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    await tapKey(tester, const Key('book-seat-plus'));
    expect(countText(tester), '4');

    await openConfirm(tester);
    expect(find.byKey(const Key('book-summary')), findsOneWidget);
    expect(harness.backend.requestsFor('GET', '/api/v1/schedules/1/seats'),
        hasLength(1));
  });

  // ---------- T-040: ข้อผิดพลาดตอนยืนยัน (cutoff/full-seat ฯลฯ) ----------

  Future<ShuttleHarness> walkToConfirm(
    WidgetTester tester, {
    required void Function(FakeBackend backend) postRoute,
  }) {
    return pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [
            okTrip(seatsAvailable: 10),
          ]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(200, seatMapFixture(schedId: 1, available: 10));
        });
        postRoute(backend);
      },
    );
  }

  testWidgets(
      'ยืนยัน: 409 SEATS_FULL แสดงข้อความที่นั่งเต็มตามที่มา · '
      'ไม่มีผลสำเร็จปลอม', (tester) async {
    final harness = await walkToConfirm(
      tester,
      postRoute: (backend) {
        backend.on('POST', '/api/v1/bookings', (request) {
          return jsonResponse(409, {
            'code': 'SEATS_FULL',
            'message': 'ที่นั่งเต็มแล้ว',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    await tapKey(tester, const Key('book-trip-1'));
    await openConfirm(tester);
    await tapKey(tester, const Key('book-confirm'));
    await pumpFrames(tester, count: 10);

    expect(find.byKey(const Key('book-confirm-error')), findsOneWidget);
    expect(find.text('ที่นั่งเต็มแล้ว'), findsOneWidget);
    expect(find.byKey(const Key('booking-success')), findsNothing);
    expect(find.byKey(const Key('book-summary')), findsOneWidget,
        reason: 'ยังอยู่หน้ายืนยัน ไม่ข้ามไปหน้าสำเร็จ');
    expect(
        harness.backend.requestsFor('POST', '/api/v1/bookings'), hasLength(1));
  });

  testWidgets(
      'ยืนยัน: BR-05 (cutoff) ที่เซิร์ฟเวอร์ตรวจตอน POST → '
      'แสดงข้อความ "กรุณาจองล่วงหน้าอย่างน้อย 20 นาที…"', (tester) async {
    await walkToConfirm(
      tester,
      postRoute: (backend) {
        backend.on('POST', '/api/v1/bookings', (request) {
          return jsonResponse(422, {
            'code': 'BR05_LEAD_TIME',
            'message': 'กรุณาจองล่วงหน้าอย่างน้อย 20 นาทีก่อนรถถึงจุดขึ้น',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    await tapKey(tester, const Key('book-trip-1'));
    await openConfirm(tester);
    await tapKey(tester, const Key('book-confirm'));
    await pumpFrames(tester, count: 10);

    expect(
      find.text('กรุณาจองล่วงหน้าอย่างน้อย 20 นาทีก่อนรถถึงจุดขึ้น'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('book-confirm-error')), findsOneWidget);
    expect(find.byKey(const Key('booking-success')), findsNothing);
  });

  testWidgets(
      'ยืนยัน: 422 BR06_SEATS_RANGE (เซิร์ฟเวอร์ตรวจซ้ำ) แสดงข้อความตามที่มา',
      (tester) async {
    await walkToConfirm(
      tester,
      postRoute: (backend) {
        backend.on('POST', '/api/v1/bookings', (request) {
          return jsonResponse(422, {
            'code': 'BR06_SEATS_RANGE',
            'message': 'จองได้ 1-4 ที่นั่งต่อครั้ง',
            'details': {'min': 1, 'max': 4, 'received': 5},
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    await tapKey(tester, const Key('book-trip-1'));
    await openConfirm(tester);
    await tapKey(tester, const Key('book-confirm'));
    await pumpFrames(tester, count: 10);

    expect(find.text('จองได้ 1-4 ที่นั่งต่อครั้ง'), findsOneWidget);
    expect(find.byKey(const Key('booking-success')), findsNothing);
  });

  testWidgets('ยืนยัน: 403 แสดงข้อความจากเซิร์ฟเวอร์ (ไม่มีสิทธิ์จอง)',
      (tester) async {
    await walkToConfirm(
      tester,
      postRoute: (backend) {
        backend.on('POST', '/api/v1/bookings', (request) {
          return jsonResponse(403, {
            'code': 'FORBIDDEN',
            'message': 'ไม่มีสิทธิ์จองรถในขณะนี้',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    await tapKey(tester, const Key('book-trip-1'));
    await openConfirm(tester);
    await tapKey(tester, const Key('book-confirm'));
    await pumpFrames(tester, count: 10);

    expect(find.text('ไม่มีสิทธิ์จองรถในขณะนี้'), findsOneWidget);
    expect(find.byKey(const Key('booking-success')), findsNothing);
  });

  // ---------- T-040: BK.CREATE ----------

  testWidgets(
      'ไม่มี BK.CREATE: ดูขั้นตอนได้แต่ปุ่มยืนยันปิดใช้งาน · ไม่มี POST',
      (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: viewOnlyPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [
            okTrip(seatsAvailable: 10),
          ]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(200, seatMapFixture(schedId: 1, available: 10));
        });
        // ไม่ลงทะเบียน POST /bookings — ถ้าถูกเรียกจะติดบันทึกใน requests
      },
    );
    await pumpFrames(tester, count: 20);

    await openTrips(tester);
    await tapKey(tester, const Key('book-trip-1'));
    await openConfirm(tester);

    expect(find.byKey(const Key('book-summary')), findsOneWidget);
    final confirm =
        tester.widget<FilledButton>(find.byKey(const Key('book-confirm')));
    expect(confirm.onPressed, isNull, reason: 'ไม่มี BK.CREATE = ยืนยันไม่ได้');

    await tester.tap(find.byKey(const Key('book-confirm')));
    await pumpFrames(tester, count: 10);

    expect(harness.backend.requestsFor('POST', '/api/v1/bookings'), isEmpty);
    expect(find.byKey(const Key('booking-success')), findsNothing);
  });

  // ---------- T-040: มือถือ 390px ----------

  testWidgets(
      'มือถือ 390px: หัวข้อ stepper ครบ 4 ขั้น · เดินครบทุกขั้น '
      'ยังอยู่ที่ /booking', (tester) async {
    final harness = await pumpBooking(
      tester,
      me: authMe(permissions: bookingPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/schedules', (request) {
          return jsonResponse(200, [
            okTrip(seatsAvailable: 10),
          ]);
        });
        backend.on('GET', '/api/v1/schedules/1/seats', (request) {
          return jsonResponse(200, seatMapFixture(schedId: 1, available: 10));
        });
        backend.on('POST', '/api/v1/bookings', (request) {
          return jsonResponse(201, bookingFixture(seats: 1));
        });
      },
    );
    await pumpFrames(tester, count: 20);

    expect(harness.location, '/booking');
    for (var i = 0; i < 4; i++) {
      expect(find.byKey(Key('book-step-label-$i')), findsOneWidget,
          reason: 'หัวข้อขั้นที่ ${i + 1} ต้องแสดงตั้งแต่แรก');
    }

    await openTrips(tester);
    expect(harness.location, '/booking');
    await tapKey(tester, const Key('book-trip-1'));
    await openConfirm(tester);
    expect(find.text('ยืนยันการจอง'), findsOneWidget);
    expect(harness.location, '/booking');

    await tapKey(tester, const Key('book-confirm'));
    await pumpFrames(tester, count: 10);
    expect(find.byKey(const Key('booking-success')), findsOneWidget);
    expect(harness.location, '/booking');
  });
}
