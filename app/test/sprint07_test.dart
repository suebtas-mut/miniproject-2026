import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_error.dart';
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
    List<String> roles = const ['STAFF'],
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

  List<Map<String, dynamic>> allFrontPermissions() => [
        perm(6, 'ROUTE.VIEW', 'front', sortNo: 6),
        perm(7, 'ROUTE.EDIT', 'front', sortNo: 7),
        perm(8, 'VEH.EDIT', 'front', sortNo: 8),
        perm(9, 'SCHED.EDIT', 'front', sortNo: 9),
      ];

  List<Map<String, dynamic>> viewOnlyPermissions() => [
        perm(6, 'ROUTE.VIEW', 'front', sortNo: 6),
      ];

  Map<String, dynamic> stopItem(int id, String name) => {
        'stopId': id,
        'stopName': name,
        'isActive': 1,
      };

  Map<String, dynamic> routeFixture() => {
        'routeId': 1,
        'routeName': 'สายเหนือ',
        'description': 'วิ่งฝั่งเหนือ',
        'totalMinutes': 45,
        'isActive': 1,
        'stopCount': 3,
        'stops': [
          {
            'stopSeq': 1,
            'stopId': 1,
            'stopName': 'คลองเตย',
            'travelMinutes': 10
          },
          {
            'stopSeq': 2,
            'stopId': 2,
            'stopName': 'เอราวัณ',
            'travelMinutes': 15
          },
          {
            'stopSeq': 3,
            'stopId': 3,
            'stopName': 'หมอชิต',
            'travelMinutes': 20
          },
        ],
      };

  Map<String, dynamic> vehicleFixture() => {
        'vehId': 1,
        'plateNo': 'กข 1234',
        'vtypeId': 1,
        'typeName': 'รถตู้ 15 ที่นั่ง',
        'capacity': 15,
        'isActive': 1,
      };

  Map<String, dynamic> vehicleFixture2() => {
        'vehId': 2,
        'plateNo': 'กข 5678',
        'vtypeId': 2,
        'typeName': 'รถบัส 40 ที่นั่ง',
        'capacity': 40,
        'isActive': 1,
      };

  List<Map<String, dynamic>> vehicleTypeFixture() => [
        {
          'vtypeId': 1,
          'typeName': 'รถตู้ 15 ที่นั่ง',
          'capacity': 15,
          'isActive': 1,
        },
        {
          'vtypeId': 2,
          'typeName': 'รถบัส 40 ที่นั่ง',
          'capacity': 40,
          'isActive': 1,
        },
      ];

  String isoPlus(String iso, int minutes) {
    final date = DateTime.parse(iso).add(Duration(minutes: minutes));
    String two(int value) => value.toString().padLeft(2, '0');
    return '${date.year.toString().padLeft(4, '0')}-${two(date.month)}-'
        '${two(date.day)}T${two(date.hour)}:${two(date.minute)}:00';
  }

  Map<String, dynamic> scheduleFixture({
    required int id,
    required String departAt,
    required bool assigned,
  }) =>
      {
        'schedId': id,
        'routeId': 1,
        'routeName': 'สายเหนือ',
        'serviceDate': departAt.substring(0, 10),
        'departAt': departAt,
        'isActive': 1,
        'totalMinutes': 45,
        'stopCount': 3,
        'seatsTotal': 15,
        'seatsBooked': assigned ? 4 : 0,
        'seatsAvailable': assigned ? 11 : 15,
        if (assigned)
          'driver': {'empId': 5, 'empCode': 'E005', 'fullName': 'สมชาย ใจดี'},
        if (assigned) 'vehicle': vehicleFixture(),
        'stops': [
          {
            'stopSeq': 1,
            'stopId': 1,
            'stopName': 'คลองเตย',
            'arriveAt': isoPlus(departAt, 10),
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 2,
            'stopId': 2,
            'stopName': 'เอราวัณ',
            'arriveAt': isoPlus(departAt, 25),
            'dwellMinutes': 2,
          },
          {
            'stopSeq': 3,
            'stopId': 3,
            'stopName': 'หมอชิต',
            'arriveAt': isoPlus(departAt, 45),
            'dwellMinutes': 0,
          },
        ],
      };

  List<Map<String, dynamic>> scheduleFixtureList() => [
        scheduleFixture(
          id: 1,
          departAt: '2026-10-01T09:30:00',
          assigned: true,
        ),
        scheduleFixture(
          id: 2,
          departAt: '2026-10-01T11:00:00',
          assigned: false,
        ),
      ];

  List<Map<String, dynamic>> rolesFixture() => [
        {'roleId': 1, 'roleName': 'ADMIN', 'isActive': 1},
        {'roleId': 3, 'roleName': 'DRIVER', 'isActive': 1},
      ];

  Map<String, dynamic> employeesFixture() => {
        'items': [
          {
            'empId': 5,
            'empCode': 'E005',
            'firstName': 'สมชาย',
            'lastName': 'ใจดี',
            'username': 'somchai',
            'isActive': 1,
            'roles': ['DRIVER'],
          },
        ],
        'total': 1,
        'page': 1,
        'pageSize': 200,
      };

  void frontRoutes(FakeBackend backend) {
    backend.on('GET', '/api/v1/stops', (request) {
      return jsonResponse(200, [
        stopItem(1, 'คลองเตย'),
        stopItem(2, 'เอราวัณ'),
      ]);
    });
    backend.on('GET', '/api/v1/routes', (request) {
      return jsonResponse(200, [routeFixture()]);
    });
    backend.on('GET', '/api/v1/schedules', (request) {
      return jsonResponse(200, scheduleFixtureList());
    });
    backend.on('GET', '/api/v1/vehicles', (request) {
      return jsonResponse(200, [vehicleFixture(), vehicleFixture2()]);
    });
  }

  Future<ShuttleHarness> pumpSprint07(
    WidgetTester tester, {
    required Map<String, dynamic> me,
    String initialLocation = '/front',
    Size size = const Size(390, 844),
    void Function(FakeBackend backend)? routes,
  }) {
    return pumpShuttle(
      tester,
      token: 'jwt-sprint07',
      initialLocation: initialLocation,
      size: size,
      routes: (backend) {
        backend.on('GET', '/api/v1/auth/me', (request) {
          return jsonResponse(200, me);
        });
        frontRoutes(backend);
        routes?.call(backend);
      },
    );
  }

  Future<void> openTab(WidgetTester tester, String label) async {
    await tester.tap(find.widgetWithText(Tab, label));
    await pumpFrames(tester, count: 15);
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

  // ---------- T-033 unit: models ----------

  test('schedule/vehicle models parse OpenAPI shapes and reject wrong shape',
      () {
    final schedules = parseSchedules(scheduleFixtureList());
    expect(schedules, hasLength(2));
    final assigned = schedules.first;
    expect(assigned.schedId, 1);
    expect(assigned.routeName, 'สายเหนือ');
    expect(assigned.serviceDate, '2026-10-01');
    expect(assigned.departAt, '2026-10-01T09:30:00');
    expect(assigned.departTime, '09:30');
    expect(assigned.seatsBooked, 4);
    expect(assigned.driver?.empId, 5);
    expect(assigned.driver?.fullName, 'สมชาย ใจดี');
    expect(assigned.vehicle?.plateNo, 'กข 1234');
    expect(assigned.stops, hasLength(3));
    expect(assigned.stops.first.stopSeq, 1);
    expect(assigned.stops.first.arriveTime, '09:40');

    final unassigned = schedules.last;
    expect(unassigned.driver, isNull);
    expect(unassigned.vehicle, isNull);
    expect(unassigned.departTime, '11:00');

    final vehicles = parseVehicles([vehicleFixture(), vehicleFixture2()]);
    expect(vehicles, hasLength(2));
    expect(vehicles.first.vehId, 1);
    expect(vehicles.first.typeName, 'รถตู้ 15 ที่นั่ง');
    expect(vehicles.last.capacity, 40);

    final types = parseVehicleTypes(vehicleTypeFixture());
    expect(types, hasLength(2));
    expect(types.first.vtypeId, 1);
    expect(types.last.capacity, 40);

    final assignment = AssignmentResult.fromJson({
      'schedId': 1,
      'driver': {'empId': 5, 'empCode': 'E005', 'fullName': 'สมชาย ใจดี'},
      'vehicle': vehicleFixture(),
    });
    expect(assignment.schedId, 1);
    expect(assignment.driver.fullName, 'สมชาย ใจดี');
    expect(assignment.vehicle.vehId, 1);

    expect(
      () => parseSchedules({'items': <dynamic>[]}),
      throwsA(isA<ApiException>()),
    );
    expect(
      () => parseVehicles('not-a-list'),
      throwsA(isA<ApiException>()),
    );
    expect(
      () => parseVehicleTypes(42),
      throwsA(isA<ApiException>()),
    );
  });

  // ---------- T-033: schedule list contract ----------

  testWidgets(
      'รอบเวลา: GET /schedules ตามสเปก (Bearer + serviceDate + activeOnly) '
      'แสดงรอบทั้งสอง + วันถัดไปส่ง serviceDate ใหม่', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');

    expect(
      tester.widget<Text>(find.byKey(const Key('sched-time-1'))).data,
      '09:30 น. · สายเหนือ',
    );
    expect(
      find.text('คนขับ: สมชาย ใจดี · รถ: กข 1234'),
      findsOneWidget,
    );
    expect(find.text('ที่นั่ง: 4/15'), findsOneWidget);
    expect(
      find.text('คนขับ: ยังไม่กำหนด · รถ: ยังไม่กำหนด'),
      findsOneWidget,
    );

    final initial = harness.backend.requestsFor('GET', '/api/v1/schedules');
    expect(initial, hasLength(1));
    expect(initial.first.headers['authorization'], 'Bearer jwt-sprint07');
    expect(initial.first.query['activeOnly'], 'true');
    expect(
      RegExp(r'^\d{4}-\d{2}-\d{2}$')
          .hasMatch(initial.first.query['serviceDate']!),
      isTrue,
      reason: 'serviceDate ต้องเป็น yyyy-MM-dd',
    );
    expect(initial.first.query.containsKey('routeId'), isFalse);

    await tapKey(tester, const Key('sched-next-day'));

    final after = harness.backend.requestsFor('GET', '/api/v1/schedules');
    expect(after, hasLength(2));
    expect(after.last.query['serviceDate'],
        isNot(after.first.query['serviceDate']));
    expect(
      RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(after.last.query['serviceDate']!),
      isTrue,
    );
  });

  testWidgets('รอบเวลา: กรองตามเส้นทางส่ง routeId', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');

    await selectFromDropdown(
      tester,
      const Key('sched-route-filter'),
      'สายเหนือ',
    );

    final requests = harness.backend.requestsFor('GET', '/api/v1/schedules');
    expect(requests, hasLength(2));
    expect(requests.last.query['routeId'], '1');
    expect(requests.last.query['serviceDate'], isNotEmpty);
  });

  testWidgets(
      'เพิ่มรอบเวลา: validation บล็อกฟอร์มว่างไม่ส่ง POST '
      'POST body ตรง ScheduleInput 201 + snackbar + โหลดใหม่', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('POST', '/api/v1/schedules', (request) {
          return jsonResponse(
              201,
              scheduleFixture(
                id: 99,
                departAt: '2026-10-01T09:30:00',
                assigned: false,
              ));
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');
    await tapKey(tester, const Key('sched-create'));
    expect(find.byKey(const Key('sched-form-route')), findsOneWidget);

    // ฟอร์มว่าง => validator บล็อก ไม่มี POST
    await tapKey(tester, const Key('sched-form-save'));
    expect(find.text('กรุณาเลือกเส้นทาง'), findsOneWidget);
    expect(find.text('กรุณากรอกเวลาออก'), findsOneWidget);
    expect(harness.backend.requestsFor('POST', '/api/v1/schedules'), isEmpty);

    await selectFromDropdown(tester, const Key('sched-form-route'), 'สายเหนือ');
    await tester.enterText(
      find.byKey(const Key('sched-form-date')),
      '2026-10-01',
    );
    await tester.enterText(
      find.byKey(const Key('sched-form-time')),
      '09:30',
    );
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('sched-form-save')));
    await pumpFrames(tester, count: 20);

    final posts = harness.backend.requestsFor('POST', '/api/v1/schedules');
    expect(posts, hasLength(1));
    expect(posts.single.headers['authorization'], 'Bearer jwt-sprint07');
    expect(posts.single.body, {
      'routeId': 1,
      'serviceDate': '2026-10-01',
      'departAt': '2026-10-01T09:30:00',
    });

    expect(find.byKey(const Key('sched-form-route')), findsNothing);
    expect(find.text('สร้างรอบเวลาแล้ว'), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules'), hasLength(2));
  });

  testWidgets('เพิ่มรอบเวลา: 409 รอบซ้ำ แสดงข้อความเซิร์ฟเวอร์ dialog ค้าง',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('POST', '/api/v1/schedules', (request) {
          return jsonResponse(409, {
            'code': 'DUPLICATE_SCHEDULE',
            'message': 'รอบเวลานี้มีอยู่ในระบบแล้ว',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');
    await tapKey(tester, const Key('sched-create'));
    await selectFromDropdown(tester, const Key('sched-form-route'), 'สายเหนือ');
    await tester.enterText(
      find.byKey(const Key('sched-form-date')),
      '2026-10-01',
    );
    await tester.enterText(find.byKey(const Key('sched-form-time')), '09:30');
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('sched-form-save')));
    await pumpFrames(tester, count: 20);

    expect(
      find.descendant(
        of: find.byKey(const Key('sched-form-save-error')),
        matching: find.text('รอบเวลานี้มีอยู่ในระบบแล้ว'),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('sched-form-route')), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules'), hasLength(1));
  });

  testWidgets('เพิ่มรอบเวลา: 422 BR02 แสดงข้อความเซิร์ฟเวอร์ dialog ค้าง',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('POST', '/api/v1/schedules', (request) {
          return jsonResponse(422, {
            'code': 'BR02_ARRIVE_MISMATCH',
            'message': 'เวลาถึงไม่ตรงกับ departAt + travelMinutes',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');
    await tapKey(tester, const Key('sched-create'));
    await selectFromDropdown(tester, const Key('sched-form-route'), 'สายเหนือ');
    await tester.enterText(
      find.byKey(const Key('sched-form-date')),
      '2026-10-01',
    );
    await tester.enterText(find.byKey(const Key('sched-form-time')), '09:30');
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('sched-form-save')));
    await pumpFrames(tester, count: 20);

    expect(
      find.descendant(
        of: find.byKey(const Key('sched-form-save-error')),
        matching: find.text('เวลาถึงไม่ตรงกับ departAt + travelMinutes'),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('sched-form-save')), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules'), hasLength(1));
  });

  // ---------- T-033: cancel round ----------

  testWidgets('ยกเลิกรอบ: confirm → DELETE 204 + โหลดใหม่ + snackbar',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('DELETE', '/api/v1/schedules/1', (request) {
          return emptyResponse(204);
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');

    await tapKey(tester, const Key('sched-cancel-btn-1'));
    await tester.tap(find.widgetWithText(FilledButton, 'ยกเลิกรอบ'));
    await pumpFrames(tester, count: 20);

    final deletes =
        harness.backend.requestsFor('DELETE', '/api/v1/schedules/1');
    expect(deletes, hasLength(1));
    expect(deletes.single.headers['authorization'], 'Bearer jwt-sprint07');
    expect(find.text('ยกเลิกรอบเดินทางแล้ว'), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules'), hasLength(2));
  });

  testWidgets('ยกเลิกรอบ: 409 มีการจอง แสดงข้อความ ไม่โหลดใหม่',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('DELETE', '/api/v1/schedules/1', (request) {
          return jsonResponse(409, {
            'code': 'BOOKINGS_EXIST',
            'message': 'มีการจองอยู่แล้ว 4 ที่นั่ง ไม่สามารถยกเลิกได้',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');

    await tapKey(tester, const Key('sched-cancel-btn-1'));
    await tester.tap(find.widgetWithText(FilledButton, 'ยกเลิกรอบ'));
    await pumpFrames(tester, count: 20);

    expect(
      find.text('มีการจองอยู่แล้ว 4 ที่นั่ง ไม่สามารถยกเลิกได้'),
      findsOneWidget,
    );
    expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules'), hasLength(1));
    expect(
      harness.backend.requestsFor('DELETE', '/api/v1/schedules/1'),
      hasLength(1),
    );
  });

  // ---------- T-033: driver/vehicle assignment ----------

  testWidgets(
      'มอบหมาย: โหลดคนขับตาม roleId DRIVER + PUT /assignments body '
      '{empId, vehId} 200 + snackbar + โหลดรอบใหม่', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/roles', (request) {
          return jsonResponse(200, rolesFixture());
        });
        backend.on('GET', '/api/v1/employees', (request) {
          return jsonResponse(200, employeesFixture());
        });
        backend.on('PUT', '/api/v1/schedules/1/assignments', (request) {
          return jsonResponse(200, {
            'schedId': 1,
            'driver': {
              'empId': 5,
              'empCode': 'E005',
              'fullName': 'สมชาย ใจดี',
            },
            'vehicle': vehicleFixture2(),
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');
    await tapKey(tester, const Key('sched-assign-btn-1'));
    await pumpFrames(tester, count: 30);

    // คนขับโหลดผ่าน GET /roles → DRIVER roleId → GET /employees?roleId=
    final roles = harness.backend.requestsFor('GET', '/api/v1/roles');
    expect(roles, hasLength(1));
    expect(roles.single.headers['authorization'], 'Bearer jwt-sprint07');
    final employees = harness.backend.requestsFor('GET', '/api/v1/employees');
    expect(employees, hasLength(1));
    expect(employees.single.query['roleId'], '3');
    expect(employees.single.query['activeOnly'], 'true');

    // ค่าเดิมถูกเลือกไว้แล้ว (preselect จาก round เดิม)
    expect(find.text('สมชาย ใจดี (E005)'), findsWidgets);

    await selectFromDropdown(
      tester,
      const Key('assign-vehicle-select'),
      'กข 5678 · รถบัส 40 ที่นั่ง',
    );
    await tester.tap(find.byKey(const Key('assign-save')));
    await pumpFrames(tester, count: 20);

    final puts =
        harness.backend.requestsFor('PUT', '/api/v1/schedules/1/assignments');
    expect(puts, hasLength(1));
    expect(puts.single.headers['authorization'], 'Bearer jwt-sprint07');
    expect(puts.single.body, {'empId': 5, 'vehId': 2});

    expect(find.text('กำหนดคนขับและรถแล้ว'), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules'), hasLength(2));
  });

  testWidgets(
      'มอบหมาย Conflict Alert: 409 BR04 แสดงข้อความเซิร์ฟเวอร์ '
      'dialog ค้าง ไม่โหลดรอบใหม่', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/roles', (request) {
          return jsonResponse(200, rolesFixture());
        });
        backend.on('GET', '/api/v1/employees', (request) {
          return jsonResponse(200, employeesFixture());
        });
        backend.on('PUT', '/api/v1/schedules/2/assignments', (request) {
          return jsonResponse(409, {
            'code': 'BR04_DRIVER_CONFLICT',
            'message': 'คนขับชนกับรอบที่ 2 (11:00)',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');
    await tapKey(tester, const Key('sched-assign-btn-2'));
    await pumpFrames(tester, count: 30);

    await selectFromDropdown(
      tester,
      const Key('assign-driver-select'),
      'สมชาย ใจดี (E005)',
    );
    await selectFromDropdown(
      tester,
      const Key('assign-vehicle-select'),
      'กข 1234 · รถตู้ 15 ที่นั่ง',
    );
    await tester.tap(find.byKey(const Key('assign-save')));
    await pumpFrames(tester, count: 20);

    expect(
      find.descendant(
        of: find.byKey(const Key('assign-error')),
        matching: find.text('คนขับชนกับรอบที่ 2 (11:00)'),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('assign-save')), findsOneWidget); // dialog ค้าง
    expect(
      harness.backend.requestsFor('PUT', '/api/v1/schedules/2/assignments'),
      hasLength(1),
    );
    expect(
        harness.backend.requestsFor('GET', '/api/v1/schedules'), hasLength(1));
  });

  testWidgets('มอบหมาย: 400 NOT_A_DRIVER แสดงข้อความเซิร์ฟเวอร์',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/roles', (request) {
          return jsonResponse(200, rolesFixture());
        });
        backend.on('GET', '/api/v1/employees', (request) {
          return jsonResponse(200, employeesFixture());
        });
        backend.on('PUT', '/api/v1/schedules/2/assignments', (request) {
          return jsonResponse(400, {
            'code': 'NOT_A_DRIVER',
            'message': 'พนักงานนี้ไม่ได้มีบทบาท DRIVER',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');
    await tapKey(tester, const Key('sched-assign-btn-2'));
    await pumpFrames(tester, count: 30);

    await selectFromDropdown(
      tester,
      const Key('assign-driver-select'),
      'สมชาย ใจดี (E005)',
    );
    await selectFromDropdown(
      tester,
      const Key('assign-vehicle-select'),
      'กข 1234 · รถตู้ 15 ที่นั่ง',
    );
    await tester.tap(find.byKey(const Key('assign-save')));
    await pumpFrames(tester, count: 20);

    expect(
      find.descendant(
        of: find.byKey(const Key('assign-error')),
        matching: find.text('พนักงานนี้ไม่ได้มีบทบาท DRIVER'),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('assign-driver-select')), findsOneWidget);
    expect(
      harness.backend.requestsFor('PUT', '/api/v1/schedules/2/assignments'),
      hasLength(1),
    );
  });

  // ---------- T-033 Q23: no departure edit ----------

  testWidgets(
      'Q23: ไม่มีการแก้เวลาออกของรอบ — ไม่มีปุ่มแก้ไข '
      'และไม่มี PUT /schedules/{id} จาก UI', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/roles', (request) {
          return jsonResponse(200, rolesFixture());
        });
        backend.on('GET', '/api/v1/employees', (request) {
          return jsonResponse(200, employeesFixture());
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รอบเวลา');

    // มีเฉพาะ สร้าง / มอบหมาย / ยกเลิก — ไม่มี affordance แก้เวลาออก
    expect(find.byKey(const Key('sched-create')), findsOneWidget);
    expect(find.byKey(const Key('sched-assign-btn-1')), findsOneWidget);
    expect(find.byKey(const Key('sched-cancel-btn-1')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('sched-1')),
        matching: find.byIcon(Icons.edit_outlined),
      ),
      findsNothing,
    );
    expect(find.textContaining('แก้เวลา'), findsNothing);
    expect(find.byTooltip('แก้ไขเวลาออก'), findsNothing);

    // ดูรายละเอียดจุดจอด (BR-02) ได้ตามปกติ
    await tapKey(tester, const Key('sched-1'));
    expect(find.byKey(const Key('sched-stop-1-1')), findsOneWidget);
    expect(find.text('09:40'), findsWidgets);

    // เปิด dialog มอบหมาย แล้วปิด — ไม่มีคำสั่ง PUT ที่ไม่ตรงสเปก
    await tapKey(tester, const Key('sched-assign-btn-1'));
    await pumpFrames(tester, count: 30);
    await tester.tap(find.widgetWithText(TextButton, 'ยกเลิก'));
    await pumpFrames(tester, count: 10);

    // เปิด confirm ยกเลิก แล้วปิด — ไม่มี DELETE
    await tapKey(tester, const Key('sched-cancel-btn-1'));
    await tester.tap(find.widgetWithText(TextButton, 'กลับ'));
    await pumpFrames(tester, count: 10);

    final puts = harness.backend.requests
        .where((request) => request.method == 'PUT')
        .toList();
    expect(puts, isEmpty,
        reason:
            'Q23 — UI ห้ามส่ง PUT ใด ๆ ที่ไม่ใช่ /assignments (ไม่มีเลยในเทสนี้)');
    expect(
      harness.backend.requestsFor('DELETE', '/api/v1/schedules/1'),
      isEmpty,
    );
  });

  // ---------- T-033: permissions ----------

  testWidgets(
      'มี ROUTE.VIEW อย่างเดียว: ดูรอบเวลา/รถได้ '
      'ไม่มีปุ่มสร้าง/ยกเลิก/มอบหมาย (SCHED.EDIT/VEH.EDIT)', (tester) async {
    await pumpSprint07(
      tester,
      me: authMe(permissions: viewOnlyPermissions()),
    );
    await pumpFrames(tester, count: 20);

    await openTab(tester, 'รอบเวลา');
    expect(find.byKey(const Key('sched-1')), findsOneWidget);
    expect(find.byKey(const Key('sched-create')), findsNothing);
    expect(find.byKey(const Key('sched-assign-btn-1')), findsNothing);
    expect(find.byKey(const Key('sched-cancel-btn-1')), findsNothing);

    await openTab(tester, 'รถ');
    expect(find.byKey(const Key('veh-1')), findsOneWidget);
    expect(find.byKey(const Key('veh-create')), findsNothing);
    expect(find.byKey(const Key('vtype-create')), findsNothing);
  });

  // ---------- T-033: vehicles ----------

  testWidgets('รถ: GET /vehicles ตามสเปก (Bearer + activeOnly) แสดงรายการ',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รถ');

    expect(find.text('กข 1234'), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('veh-info-1'))).data,
      'รถตู้ 15 ที่นั่ง · 15 ที่นั่ง',
    );
    expect(find.text('กข 5678'), findsOneWidget);

    final requests = harness.backend.requestsFor('GET', '/api/v1/vehicles');
    expect(requests, hasLength(1));
    expect(requests.single.headers['authorization'], 'Bearer jwt-sprint07');
    expect(requests.single.query['activeOnly'], 'true');
    // ยังไม่เปิดฟอร์มเพิ่ม — ยังไม่ดึงประเภทรถ
    expect(
        harness.backend.requestsFor('GET', '/api/v1/vehicle-types'), isEmpty);
  });

  testWidgets(
      'เพิ่มรถ: validation บล็อกฟอร์มว่างไม่ส่ง POST '
      'POST body ตรง VehicleInput 201 + snackbar + โหลดใหม่', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/vehicle-types', (request) {
          return jsonResponse(200, vehicleTypeFixture());
        });
        backend.on('POST', '/api/v1/vehicles', (request) {
          return jsonResponse(201, {
            'vehId': 3,
            'plateNo': 'ขก 9999',
            'vtypeId': 1,
            'typeName': 'รถตู้ 15 ที่นั่ง',
            'capacity': 15,
            'isActive': 1,
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รถ');
    await tapKey(tester, const Key('veh-create'));
    await pumpFrames(tester, count: 15);
    expect(find.byKey(const Key('veh-form-plate')), findsOneWidget);
    expect(
      harness.backend.requestsFor('GET', '/api/v1/vehicle-types'),
      hasLength(1),
    );

    // ฟอร์มว่าง => validator บล็อก ไม่มี POST
    await tapKey(tester, const Key('veh-form-save'));
    expect(find.text('กรุณากรอกทะเบียนรถ'), findsOneWidget);
    expect(find.text('กรุณาเลือกประเภทรถ'), findsOneWidget);
    expect(harness.backend.requestsFor('POST', '/api/v1/vehicles'), isEmpty);

    await tester.enterText(
      find.byKey(const Key('veh-form-plate')),
      'ขก 9999',
    );
    await selectFromDropdown(
      tester,
      const Key('veh-form-type'),
      'รถตู้ 15 ที่นั่ง · 15 ที่นั่ง',
    );
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('veh-form-save')));
    await pumpFrames(tester, count: 20);

    final posts = harness.backend.requestsFor('POST', '/api/v1/vehicles');
    expect(posts, hasLength(1));
    expect(posts.single.headers['authorization'], 'Bearer jwt-sprint07');
    expect(posts.single.body, {'plateNo': 'ขก 9999', 'vtypeId': 1});

    expect(find.byKey(const Key('veh-form-plate')), findsNothing);
    expect(find.text('เพิ่มรถแล้ว'), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/vehicles'), hasLength(2));
  });

  testWidgets('เพิ่มรถ: 409 ทะเบียนซ้ำ แสดงข้อความเซิร์ฟเวอร์ dialog ค้าง',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('GET', '/api/v1/vehicle-types', (request) {
          return jsonResponse(200, vehicleTypeFixture());
        });
        backend.on('POST', '/api/v1/vehicles', (request) {
          return jsonResponse(409, {
            'code': 'DUPLICATE_PLATE',
            'message': 'ทะเบียนนี้มีอยู่ในระบบแล้ว',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รถ');
    await tapKey(tester, const Key('veh-create'));
    await pumpFrames(tester, count: 15);
    await tester.enterText(
      find.byKey(const Key('veh-form-plate')),
      'กข 1234',
    );
    await selectFromDropdown(
      tester,
      const Key('veh-form-type'),
      'รถตู้ 15 ที่นั่ง · 15 ที่นั่ง',
    );
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('veh-form-save')));
    await pumpFrames(tester, count: 20);

    expect(
      find.descendant(
        of: find.byKey(const Key('veh-form-save-error')),
        matching: find.text('ทะเบียนนี้มีอยู่ในระบบแล้ว'),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('veh-form-plate')), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/vehicles'), hasLength(1));
  });

  testWidgets(
      'เพิ่มประเภทรถ: capacity 0 ถูกบล็อกไม่ส่ง POST '
      'POST body ตรง VehicleTypeInput 201 + snackbar', (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
      routes: (backend) {
        backend.on('POST', '/api/v1/vehicle-types', (request) {
          return jsonResponse(201, {
            'vtypeId': 3,
            'typeName': 'รถตู้ขนาดกลาง',
            'capacity': 16,
            'isActive': 1,
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'รถ');
    await tapKey(tester, const Key('vtype-create'));

    await tester.enterText(
      find.byKey(const Key('vtype-form-name')),
      'รถตู้ขนาดกลาง',
    );
    await tester.enterText(
      find.byKey(const Key('vtype-form-capacity')),
      '0',
    );
    await pumpFrames(tester, count: 4);
    await tapKey(tester, const Key('vtype-form-save'));
    expect(find.text('ต้องมากกว่า 0'), findsOneWidget);
    expect(
      harness.backend.requestsFor('POST', '/api/v1/vehicle-types'),
      isEmpty,
    );

    await tester.enterText(
      find.byKey(const Key('vtype-form-capacity')),
      '16',
    );
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('vtype-form-save')));
    await pumpFrames(tester, count: 20);

    final posts = harness.backend.requestsFor('POST', '/api/v1/vehicle-types');
    expect(posts, hasLength(1));
    expect(posts.single.body, {'typeName': 'รถตู้ขนาดกลาง', 'capacity': 16});
    expect(find.text('เพิ่มประเภทรถแล้ว'), findsOneWidget);
    expect(find.byKey(const Key('vtype-form-name')), findsNothing);
  });

  // ---------- T-033: four tabs regression ----------

  testWidgets('มือถือ 390px: 4 แท็บ สลับไป/กลับใช้งานได้ ไม่หลุด /front',
      (tester) async {
    final harness = await pumpSprint07(
      tester,
      me: authMe(permissions: allFrontPermissions()),
    );
    await pumpFrames(tester, count: 20);

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(Tab), findsNWidgets(4));

    // แท็บแรก — เส้นทาง
    expect(find.byKey(const Key('route-1')), findsOneWidget);

    await openTab(tester, 'จุดจอด');
    expect(find.byKey(const Key('stop-search')), findsOneWidget);
    expect(find.byKey(const Key('stop-1')), findsOneWidget);

    await openTab(tester, 'รอบเวลา');
    expect(find.byKey(const Key('sched-1')), findsOneWidget);
    expect(find.byKey(const Key('sched-route-filter')), findsOneWidget);

    await openTab(tester, 'รถ');
    expect(find.byKey(const Key('veh-1')), findsOneWidget);
    expect(find.byKey(const Key('veh-create')), findsOneWidget);

    await openTab(tester, 'เส้นทาง');
    expect(find.byKey(const Key('route-1')), findsOneWidget);
    expect(find.byKey(const Key('route-create')), findsOneWidget);

    expect(harness.location, '/front');
  });
}
