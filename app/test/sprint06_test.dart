import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_error.dart';
import 'package:shuttle_app/core/router/app_router.dart';
import 'package:shuttle_app/features/front/front_models.dart';

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

  List<Map<String, dynamic>> frontPermissions({bool edit = true}) => [
        perm(6, 'ROUTE.VIEW', 'front', sortNo: 6),
        if (edit) perm(7, 'ROUTE.EDIT', 'front', sortNo: 7),
      ];

  Map<String, dynamic> stopItem(
    int id,
    String name, {
    String? address,
  }) =>
      {
        'stopId': id,
        'stopName': name,
        if (address != null) 'address': address,
        'latitude': 13.75,
        'longitude': 100.5,
        'isActive': 1,
      };

  List<Map<String, dynamic>> stopFixture() => [
        stopItem(1, 'คลองเตย', address: 'ถนนสุขุมวิท'),
        stopItem(2, 'เอราวัณ'),
        stopItem(3, 'หมอชิต'),
        stopItem(4, 'บางกะปิ'),
      ];

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

  void frontRoutes(FakeBackend backend) {
    backend.on('GET', '/api/v1/stops', (request) {
      return jsonResponse(200, stopFixture());
    });
    backend.on('GET', '/api/v1/routes', (request) {
      return jsonResponse(200, [routeFixture()]);
    });
  }

  Future<ShuttleHarness> pumpSprint06(
    WidgetTester tester, {
    required Map<String, dynamic> me,
    String initialLocation = '/front',
    Size size = const Size(390, 844),
    void Function(FakeBackend backend)? routes,
  }) {
    return pumpShuttle(
      tester,
      token: 'jwt-sprint06',
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

  Future<void> addStopToRoute(
    WidgetTester tester, {
    required String stopName,
    required String minutes,
  }) async {
    final addButton = find.byKey(const Key('add-stop'));
    await tester.ensureVisible(addButton);
    await pumpFrames(tester, count: 4);
    await tester.tap(addButton);
    await pumpFrames(tester, count: 15);
    await selectFromDropdown(tester, const Key('add-stop-select'), stopName);
    await tester.enterText(
      find.byKey(const Key('add-stop-minutes')),
      minutes,
    );
    await pumpFrames(tester, count: 4);
    final confirm = find.byKey(const Key('add-stop-confirm'));
    await tester.ensureVisible(confirm);
    await pumpFrames(tester, count: 4);
    await tester.tap(confirm);
    await pumpFrames(tester, count: 15);
  }

  Future<void> openRoute1(WidgetTester tester) async {
    final tile = find.byKey(const Key('route-1'));
    await tester.ensureVisible(tile);
    await pumpFrames(tester, count: 4);
    await tester.tap(tile);
    await pumpFrames(tester, count: 20);
  }

  Future<void> tapKey(WidgetTester tester, Key key) async {
    final finder = find.byKey(key);
    await tester.ensureVisible(finder);
    await pumpFrames(tester, count: 4);
    await tester.tap(finder);
    await pumpFrames(tester, count: 8);
  }

  // ---------- T-028 unit: models ----------

  test('front models parse OpenAPI shapes and reject wrong shape', () {
    final stops = parseStops(stopFixture());
    expect(stops, hasLength(4));
    expect(stops.first.stopName, 'คลองเตย');
    expect(stops.first.address, 'ถนนสุขุมวิท');
    expect(stops.first.isActive, 1);

    final routes = parseRoutes([routeFixture()]);
    expect(routes, hasLength(1));
    final route = routes.single;
    expect(route.routeName, 'สายเหนือ');
    expect(route.totalMinutes, 45);
    expect(route.resolvedStopCount, 3);
    expect(route.stops, hasLength(3));
    expect(route.stops.first.stopSeq, 1);
    expect(route.stops.first.travelMinutes, 10);

    expect(
      () => parseStops({'items': <dynamic>[]}),
      throwsA(isA<ApiException>()),
    );
    expect(
      () => parseRoutes('not-a-list'),
      throwsA(isA<ApiException>()),
    );
  });

  // ---------- T-028: stop list + search ----------

  testWidgets(
      'จุดจอด: GET /stops ตามสเปก (Bearer + activeOnly) '
      'และค้นหาส่งพารามิเตอร์ search หลัง debounce', (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'จุดจอด');

    expect(find.byKey(const Key('stop-1')), findsOneWidget);
    expect(find.text('คลองเตย'), findsOneWidget);
    expect(find.text('เอราวัณ'), findsOneWidget);

    final initial = harness.backend.requestsFor('GET', '/api/v1/stops');
    expect(initial, isNotEmpty);
    expect(initial.first.headers['authorization'], 'Bearer jwt-sprint06');
    expect(initial.first.query['activeOnly'], 'true');
    expect(initial.first.query.containsKey('search'), isFalse);

    final searchField = find.byKey(const Key('stop-search'));
    await tester.ensureVisible(searchField);
    await pumpFrames(tester, count: 4);
    await tester.enterText(searchField, 'คลองเตย');
    // debounce 350ms
    await pumpFrames(tester, count: 8);
    await pumpFrames(tester, count: 10);

    final after = harness.backend.requestsFor('GET', '/api/v1/stops');
    expect(after, hasLength(2));
    expect(after.last.query['search'], 'คลองเตย');
    expect(after.last.query['activeOnly'], 'true');
  });

  // ---------- T-028: create stop ----------

  testWidgets(
      'เพิ่มจุดจอด: ชื่อว่างถูกบล็อกไม่ส่ง POST '
      'POST /stops สำเร็จ 201 ตาม StopInput + snackbar + โหลดใหม่',
      (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('POST', '/api/v1/stops', (request) {
          return jsonResponse(201, {
            'stopId': 5,
            'stopName': 'ท่าเรือคลองเตย',
            'isActive': 1,
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'จุดจอด');
    await tapKey(tester, const Key('stop-create'));
    expect(find.byKey(const Key('stop-name')), findsOneWidget);

    // ชื่อว่าง => validator บล็อก ไม่มี POST
    await tapKey(tester, const Key('stop-save'));
    expect(find.text('กรุณากรอกชื่อจุดจอด'), findsOneWidget);
    expect(harness.backend.requestsFor('POST', '/api/v1/stops'), isEmpty);

    await tester.enterText(
      find.byKey(const Key('stop-name')),
      'ท่าเรือคลองเตย',
    );
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('stop-save')));
    await pumpFrames(tester, count: 20);

    final posts = harness.backend.requestsFor('POST', '/api/v1/stops');
    expect(posts, hasLength(1));
    expect(posts.single.headers['authorization'], 'Bearer jwt-sprint06');
    expect(posts.single.body, {'stopName': 'ท่าเรือคลองเตย'});

    expect(find.byKey(const Key('stop-save-error')), findsNothing);
    expect(find.byKey(const Key('stop-name')), findsNothing); // dialog ปิดแล้ว
    expect(find.text('บันทึกจุดจอดแล้ว'), findsOneWidget);
    expect(harness.backend.requestsFor('GET', '/api/v1/stops'), hasLength(2));
  });

  testWidgets('เพิ่มจุดจอด: 409 ชื่อซ้ำ แสดงข้อความเซิร์ฟเวอร์ใน dialog',
      (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('POST', '/api/v1/stops', (request) {
          return jsonResponse(409, {
            'code': 'DUPLICATE_STOP_NAME',
            'message': 'ชื่อจุดจอดนี้มีอยู่ในระบบแล้ว',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'จุดจอด');
    await tapKey(tester, const Key('stop-create'));
    await tester.enterText(find.byKey(const Key('stop-name')), 'เอราวัณ');
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('stop-save')));
    await pumpFrames(tester, count: 20);

    expect(
      find.descendant(
        of: find.byKey(const Key('stop-save-error')),
        matching: find.text('ชื่อจุดจอดนี้มีอยู่ในระบบแล้ว'),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('stop-name')), findsOneWidget); // dialog ค้าง
    expect(harness.backend.requestsFor('GET', '/api/v1/stops'), hasLength(1));
  });

  // ---------- T-028: deactivate stop ----------

  testWidgets('ปิดใช้งานจุดจอด: 204 สำเร็จ + โหลดรายการใหม่', (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('DELETE', '/api/v1/stops/1', (request) {
          return emptyResponse(204);
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'จุดจอด');

    Finder deleteIcon() => find.descendant(
          of: find.byKey(const Key('stop-1')),
          matching: find.byIcon(Icons.delete_outline),
        );

    await tester.ensureVisible(deleteIcon());
    await pumpFrames(tester, count: 4);
    await tester.tap(deleteIcon());
    await pumpFrames(tester, count: 10);
    await tester.tap(find.widgetWithText(FilledButton, 'ปิดใช้งาน'));
    await pumpFrames(tester, count: 20);

    expect(find.text('ปิดใช้งานจุดจอดแล้ว'), findsOneWidget);
    expect(harness.backend.requestsFor('GET', '/api/v1/stops'), hasLength(2));
    expect(
        harness.backend.requestsFor('DELETE', '/api/v1/stops/1'), hasLength(1));
  });

  testWidgets('ปิดใช้งานจุดจอด: 409 แสดงข้อความเซิร์ฟเวอร์ ไม่โหลดใหม่',
      (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('DELETE', '/api/v1/stops/1', (request) {
          return jsonResponse(409, {
            'code': 'STOP_STILL_REFERENCED',
            'message': 'ไม่สามารถปิดใช้งานได้ เนื่องจากมีเส้นทางอ้างอิงอยู่',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openTab(tester, 'จุดจอด');

    Finder deleteIcon() => find.descendant(
          of: find.byKey(const Key('stop-1')),
          matching: find.byIcon(Icons.delete_outline),
        );

    await tester.ensureVisible(deleteIcon());
    await pumpFrames(tester, count: 4);
    await tester.tap(deleteIcon());
    await pumpFrames(tester, count: 10);
    await tester.tap(find.widgetWithText(FilledButton, 'ปิดใช้งาน'));
    await pumpFrames(tester, count: 20);

    expect(
      find.text('ไม่สามารถปิดใช้งานได้ เนื่องจากมีเส้นทางอ้างอิงอยู่'),
      findsOneWidget,
    );
    expect(harness.backend.requestsFor('GET', '/api/v1/stops'), hasLength(1));
    expect(
        harness.backend.requestsFor('DELETE', '/api/v1/stops/1'), hasLength(1));
  });

  // ---------- T-028: route list ----------

  testWidgets(
      'เส้นทาง: GET /routes ตามสเปก (Bearer + includeStops) '
      'และแสดงจำนวนจุดจอด/เวลารวม', (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
    );
    await pumpFrames(tester, count: 20);

    expect(find.byKey(const Key('route-1')), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('route-summary-1'))).data,
      '3 จุดจอด · 45 นาที',
    );

    final requests = harness.backend.requestsFor('GET', '/api/v1/routes');
    expect(requests, hasLength(1));
    expect(requests.single.headers['authorization'], 'Bearer jwt-sprint06');
    expect(requests.single.query['includeStops'], 'true');
    expect(requests.single.query['activeOnly'], 'true');
  });

  // ---------- T-028: ordered stops editor ----------

  testWidgets(
      'แก้เส้นทาง: แก้นาที เรียงลำดับ เพิ่มจุดจอด '
      'total คำนวณสด BR-01 และ PUT ส่งตามลำดับอาร์เรย์', (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('PUT', '/api/v1/routes/1', (request) {
          return jsonResponse(200, routeFixture());
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openRoute1(tester);

    // ข้อมูลเดิมจากเซิร์ฟเวอร์
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('route-name')))
          .controller!
          .text,
      'สายเหนือ',
    );
    expect(find.text('คลองเตย'), findsOneWidget);
    expect(find.text('เอราวัณ'), findsOneWidget);
    expect(find.text('หมอชิต'), findsOneWidget);
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('travel-minutes-0')))
          .controller!
          .text,
      '10',
    );
    // BR-01 — เวลารวมแสดงอัตโนมัติ 10+15+20
    expect(find.text('เวลารวมทั้งเส้นทาง: 45 นาที'), findsOneWidget);

    // แก้นาทีแถวแรก => รวมเปลี่ยนทันที
    await tester.enterText(
      find.byKey(const Key('travel-minutes-0')),
      '30',
    );
    await pumpFrames(tester, count: 5);
    expect(find.text('เวลารวมทั้งเส้นทาง: 65 นาที'), findsOneWidget);

    // เรียงลำดับ: ย้ายแถว 0 ลงล่าง
    await tester.tap(find.byKey(const Key('move-down-0')));
    await pumpFrames(tester, count: 5);
    expect(
      tester.widget<Text>(find.byKey(const Key('route-stop-name-0'))).data,
      'เอราวัณ',
    );
    expect(
      tester.widget<Text>(find.byKey(const Key('route-stop-name-1'))).data,
      'คลองเตย',
    );

    // เพิ่มจุดจอดท้ายแถว (BR-03 กันซ้ำใน dialog)
    await addStopToRoute(tester, stopName: 'บางกะปิ', minutes: '5');
    expect(
      tester.widget<Text>(find.byKey(const Key('route-stop-name-3'))).data,
      'บางกะปิ',
    );
    expect(find.text('เวลารวมทั้งเส้นทาง: 70 นาที'), findsOneWidget);
    expect(find.byKey(const Key('route-min-stops')), findsNothing);

    // บันทึก => PUT /routes/1 ตามสเปก
    await tapKey(tester, const Key('route-save'));
    await pumpFrames(tester, count: 10);

    final puts = harness.backend.requestsFor('PUT', '/api/v1/routes/1');
    expect(puts, hasLength(1));
    expect(puts.single.headers['authorization'], 'Bearer jwt-sprint06');
    expect(puts.single.body, {
      'routeName': 'สายเหนือ',
      'description': 'วิ่งฝั่งเหนือ',
      'totalMinutes': 70,
      'stops': [
        {'stopId': 2, 'travelMinutes': 15},
        {'stopId': 1, 'travelMinutes': 30},
        {'stopId': 3, 'travelMinutes': 20},
        {'stopId': 4, 'travelMinutes': 5},
      ],
    });

    expect(find.byKey(const Key('route-save-error')), findsNothing);
    expect(find.text('บันทึกเส้นทางแล้ว'), findsOneWidget); // กลับมาที่ลิสต์
    expect(find.byKey(const Key('route-1')), findsOneWidget);
    expect(harness.backend.requestsFor('GET', '/api/v1/routes'), hasLength(2));
  });

  // ---------- T-028: validation ----------

  testWidgets('สร้างเส้นทาง: น้อยกว่า 2 จุดจอดถูกบล็อก (ไม่มี POST)',
      (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
    );
    await pumpFrames(tester, count: 20);
    await tapKey(tester, const Key('route-create'));

    expect(find.byKey(const Key('route-min-stops')), findsOneWidget);
    expect(find.byKey(const Key('route-stops-empty')), findsOneWidget);

    await tester.enterText(find.byKey(const Key('route-name')), 'สายทดสอบ');
    await pumpFrames(tester, count: 4);

    // 0 จุดจอด
    await tapKey(tester, const Key('route-save'));
    expect(harness.backend.requestsFor('POST', '/api/v1/routes'), isEmpty);

    // 1 จุดจอด — ยังต่ำกว่า BR ขั้นต่ำ
    await addStopToRoute(tester, stopName: 'คลองเตย', minutes: '5');
    expect(find.byKey(const Key('route-min-stops')), findsOneWidget);
    expect(find.byKey(const Key('route-stop-name-0')), findsOneWidget);

    await tapKey(tester, const Key('route-save'));
    expect(harness.backend.requestsFor('POST', '/api/v1/routes'), isEmpty);
  });

  testWidgets(
      'เพิ่มผ่าน dialog: ไม่เสนอจุดที่อยู่ในเส้นทางแล้ว นาทีติดลบถูกบล็อก '
      'ครบ 2 จุดบันทึก POST 201 ตามสเปก', (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('POST', '/api/v1/routes', (request) {
          return jsonResponse(201, {
            'routeId': 9,
            'routeName': 'สายใต้',
            'totalMinutes': 15,
            'isActive': 1,
            'stopCount': 2,
            'stops': [
              {
                'stopSeq': 1,
                'stopId': 1,
                'stopName': 'คลองเตย',
                'travelMinutes': 5
              },
              {
                'stopSeq': 2,
                'stopId': 2,
                'stopName': 'เอราวัณ',
                'travelMinutes': 10
              },
            ],
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await tapKey(tester, const Key('route-create'));
    await tester.enterText(find.byKey(const Key('route-name')), 'สายใต้');
    await pumpFrames(tester, count: 4);

    // เพิ่มจุดแรก
    await addStopToRoute(tester, stopName: 'คลองเตย', minutes: '5');
    expect(
      tester.widget<Text>(find.byKey(const Key('route-stop-name-0'))).data,
      'คลองเตย',
    );

    // เปิด dialog ใหม่และเปิดเมนู: ไม่เสนอ 'คลองเตย' ที่อยู่ในรายการแล้ว (BR-03)
    await tapKey(tester, const Key('add-stop'));
    final dropdown = find.byKey(const Key('add-stop-select'));
    await tester.ensureVisible(dropdown);
    await pumpFrames(tester, count: 4);
    await tester.tap(dropdown);
    await pumpFrames(tester, count: 10);
    // จุดที่มีแล้วมีเฉพาะแถวในฟอร์ม (1) ไม่ใช่ในเมนูเพิ่ม
    expect(find.text('คลองเตย'), findsOneWidget);
    expect(find.text('เอราวัณ'), findsOneWidget);
    expect(find.text('บางกะปิ'), findsOneWidget);
    // เลือกจุดจากรายการที่ยังไม่อยู่ในเส้นทาง
    await tester.tap(find.text('เอราวัณ').last);
    await pumpFrames(tester, count: 10);

    // นาทีติดลบถูกบล็อก dialog ไม่ปิด
    await tester.enterText(
      find.byKey(const Key('add-stop-minutes')),
      '-1',
    );
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('add-stop-confirm')));
    await pumpFrames(tester, count: 8);
    expect(find.text('นาทีต้องเป็นจำนวนเต็มไม่น้อยกว่า 0'), findsOneWidget);
    expect(find.byKey(const Key('add-stop-confirm')), findsOneWidget);
    expect(find.byKey(const Key('route-stop-name-1')), findsNothing);

    // แก้เป็น 0+ แล้วยืนยัน
    await tester.enterText(
      find.byKey(const Key('add-stop-minutes')),
      '10',
    );
    await pumpFrames(tester, count: 4);
    await tester.tap(find.byKey(const Key('add-stop-confirm')));
    await pumpFrames(tester, count: 15);
    expect(find.byKey(const Key('add-stop-confirm')), findsNothing);
    expect(
      tester.widget<Text>(find.byKey(const Key('route-stop-name-1'))).data,
      'เอราวัณ',
    );
    expect(find.text('เวลารวมทั้งเส้นทาง: 15 นาที'), findsOneWidget);

    // บันทึก => POST /routes ครบ 2 จุด
    await tapKey(tester, const Key('route-save'));
    await pumpFrames(tester, count: 10);

    final posts = harness.backend.requestsFor('POST', '/api/v1/routes');
    expect(posts, hasLength(1));
    expect(posts.single.headers['authorization'], 'Bearer jwt-sprint06');
    expect(posts.single.body, {
      'routeName': 'สายใต้',
      'totalMinutes': 15,
      'stops': [
        {'stopId': 1, 'travelMinutes': 5},
        {'stopId': 2, 'travelMinutes': 10},
      ],
    });
    expect(find.text('บันทึกเส้นทางแล้ว'), findsOneWidget);
    expect(harness.backend.requestsFor('GET', '/api/v1/routes'), hasLength(2));
  });

  testWidgets('นาทีไม่ใช่จำนวนเต็ม: บันทึกถูกบล็อก ไม่มี PUT', (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
    );
    await pumpFrames(tester, count: 20);
    await openRoute1(tester);

    await tester.enterText(find.byKey(const Key('travel-minutes-0')), 'abc');
    await pumpFrames(tester, count: 5);
    await tapKey(tester, const Key('route-save'));
    await pumpFrames(tester, count: 5);

    expect(find.text('นาทีต้องเป็นจำนวนเต็มไม่น้อยกว่า 0'), findsOneWidget);
    expect(harness.backend.requestsFor('PUT', '/api/v1/routes/1'), isEmpty);
    expect(find.byKey(const Key('route-save-error')), findsNothing);
  });

  // ---------- T-028: server errors ----------

  testWidgets('422 BR01_TOTAL_MISMATCH: แสดงข้อความเซิร์ฟเวอร์ หน้าไม่ปิด',
      (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('PUT', '/api/v1/routes/1', (request) {
          return jsonResponse(422, {
            'code': 'BR01_TOTAL_MISMATCH',
            'message': 'ผลรวมเวลาเดินทางไม่ตรงกับ totalMinutes',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openRoute1(tester);
    await tapKey(tester, const Key('route-save'));
    await pumpFrames(tester, count: 10);

    expect(
        harness.backend.requestsFor('PUT', '/api/v1/routes/1'), hasLength(1));
    expect(
      find.descendant(
        of: find.byKey(const Key('route-save-error')),
        matching: find.text('ผลรวมเวลาเดินทางไม่ตรงกับ totalMinutes'),
      ),
      findsOneWidget,
    );
    expect(
        find.byKey(const Key('route-name')), findsOneWidget); // ยังอยู่ในฟอร์ม
    expect(find.byKey(const Key('route-save')), findsOneWidget);
  });

  testWidgets('403: แสดงข้อความเซิร์ฟเวอร์ หน้าไม่ปิด', (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      routes: (backend) {
        backend.on('PUT', '/api/v1/routes/1', (request) {
          return jsonResponse(403, {
            'code': 'FORBIDDEN',
            'message': 'ไม่มีสิทธิ์เข้าถึงส่วนนี้',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    await openRoute1(tester);
    await tapKey(tester, const Key('route-save'));
    await pumpFrames(tester, count: 10);

    expect(
        harness.backend.requestsFor('PUT', '/api/v1/routes/1'), hasLength(1));
    expect(
      find.descendant(
        of: find.byKey(const Key('route-save-error')),
        matching: find.text('ไม่มีสิทธิ์เข้าถึงส่วนนี้'),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('route-name')), findsOneWidget);
  });

  // ---------- T-028: permissions ----------

  testWidgets(
      'มี ROUTE.VIEW อย่างเดียว: ไม่มีปุ่มสร้าง/แก้ไข '
      'เปิดดูฟอร์มได้แต่แก้ไข/บันทึกไม่ได้', (tester) async {
    await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions(edit: false)),
    );
    await pumpFrames(tester, count: 20);

    // แท็บเส้นทาง — ไม่มีปุ่มเพิ่ม ไม่มีไอคอนแก้ไข
    expect(find.byKey(const Key('route-create')), findsNothing);
    expect(
      find.descendant(
        of: find.byKey(const Key('route-1')),
        matching: find.byIcon(Icons.edit_outlined),
      ),
      findsNothing,
    );

    // แท็บจุดจอด — ไม่มีปุ่มเพิ่ม/ลบ/แก้ไข
    await openTab(tester, 'จุดจอด');
    expect(find.byKey(const Key('stop-create')), findsNothing);
    expect(
      find.descendant(
        of: find.byKey(const Key('stop-1')),
        matching: find.byIcon(Icons.edit_outlined),
      ),
      findsNothing,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('stop-1')),
        matching: find.byIcon(Icons.delete_outline),
      ),
      findsNothing,
    );

    // เปิดดูเส้นทางแบบอ่านอย่างเดียว
    await openTab(tester, 'เส้นทาง');
    await openRoute1(tester);
    expect(find.byKey(const Key('route-save')), findsNothing);
    expect(find.byKey(const Key('add-stop')), findsNothing);
    expect(find.byKey(const Key('move-up-0')), findsNothing);
    expect(find.byKey(const Key('remove-stop-0')), findsNothing);
    expect(
      tester.widget<TextFormField>(find.byKey(const Key('route-name'))).enabled,
      isFalse,
    );
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('travel-minutes-0')))
          .enabled,
      isFalse,
    );
  });

  testWidgets('ไม่มี ROUTE.VIEW: FrontPage แสดงข้อความไม่มีสิทธิ์',
      (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: const [], modules: const ['front']),
      initialLocation: '/',
    );
    await pumpFrames(tester, count: 20);
    expect(harness.location, '/');

    harness.container.read(routerProvider).go('/front');
    await pumpFrames(tester, count: 15);

    expect(harness.location, '/front');
    expect(find.byKey(const Key('front-forbidden')), findsOneWidget);
    expect(find.byType(Tab), findsNothing);
  });

  // ---------- T-028: responsive shell ----------

  testWidgets('มือถือ 390px: NavigationBar + สลับแท็บใช้งานได้',
      (tester) async {
    final harness = await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
    );
    await pumpFrames(tester, count: 20);

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
    expect(find.text('เส้นทางและจุดจอด'), findsOneWidget);

    // แท็บแรกคือเส้นทาง
    expect(find.byKey(const Key('route-1')), findsOneWidget);

    await openTab(tester, 'จุดจอด');
    expect(find.byKey(const Key('stop-search')), findsOneWidget);
    expect(find.byKey(const Key('stop-1')), findsOneWidget);
    expect(harness.location, '/front');
  });

  testWidgets('แท็บเล็ต 800px: NavigationRail แทน NavigationBar',
      (tester) async {
    await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
      size: const Size(800, 600),
    );
    await pumpFrames(tester, count: 20);

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('เส้นทาง'), findsWidgets); // จุดหมายเมนู + แท็บ
    expect(find.byKey(const Key('route-1')), findsOneWidget);
    expect(find.byKey(const Key('route-create')), findsOneWidget);
  });

  testWidgets(
      'สร้างเส้นทาง กรอกข้อมูลแล้วย้อนกลับ: กลับมาแท็บเส้นทาง '
      'ข้อมูลไม่ค้าง สลับแท็บไป/กลับใช้งานได้', (tester) async {
    await pumpSprint06(
      tester,
      me: authMe(permissions: frontPermissions()),
    );
    await pumpFrames(tester, count: 20);

    await tapKey(tester, const Key('route-create'));
    await tester.enterText(find.byKey(const Key('route-name')), 'สายชั่วคราว');
    await pumpFrames(tester, count: 4);
    expect(find.byKey(const Key('route-name')), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await pumpFrames(tester, count: 20);

    expect(find.byKey(const Key('route-name')), findsNothing);
    expect(find.text('สายชั่วคราว'), findsNothing);
    expect(find.byKey(const Key('route-create')), findsOneWidget);
    expect(find.byKey(const Key('route-1')), findsOneWidget);

    await openTab(tester, 'จุดจอด');
    expect(find.byKey(const Key('stop-search')), findsOneWidget);
    expect(find.byKey(const Key('stop-1')), findsOneWidget);

    await openTab(tester, 'เส้นทาง');
    expect(find.byKey(const Key('route-1')), findsOneWidget);
    expect(find.byKey(const Key('route-create')), findsOneWidget);
  });
}
