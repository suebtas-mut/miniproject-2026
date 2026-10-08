import 'dart:convert';

import 'package:dio/dio.dart' show Headers, ResponseBody;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_client.dart';
import 'package:shuttle_app/core/network/api_error.dart';
import 'package:shuttle_app/core/providers.dart';
import 'package:shuttle_app/features/auth/auth_controller.dart';
import 'package:shuttle_app/features/auth/auth_models.dart';
import 'package:shuttle_app/features/report/report_models.dart';
import 'package:shuttle_app/features/report/report_page.dart';
import 'package:shuttle_app/features/report/report_providers.dart';

import 'support/fake_backend.dart';

/// Sprint 13 — T-059 (หน้าจอ R4/R6 + export) · T-061/T-062 (regression + trace)
///
/// ครอบคลุม: สัญญา `GET /reports/r4` และ `/reports/r6` (OpenAPI from/to +
/// rows) · parse เข้ม + KPI · แท็บ R4/R6 โหลดเมื่อเลือก + สถานะโหลด/ว่าง/
/// ผิดพลาด+ลองอีกครั้ง · ตัวกรองปี/ช่วงวันที่ร่วมกันทุกแท็บ · ไม่มีสิทธิ์
/// RPT.R4/RPT.R6 (ฝั่งไคลเอน) ไม่ยิง API · export CSV/XLSX (UC-30) ตาม
/// `GET /reports/{id}/export?format=` + Content-Disposition · error แสดง
/// ข้อความเซิร์ฟเวอร์ · integration ข้ามแท็บ R1→R4→R6 + เปลี่ยนปี
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
    List<String> roles = const ['STAFF'],
  }) =>
      {
        'user': {
          'empId': 9,
          'empCode': 'E009',
          'firstName': 'Ann',
          'lastName': 'Lee',
          'username': 'ann',
          'isActive': 1,
          'roles': roles,
        },
        'roles': roles,
        'permissions': permissions,
        'modules': {
          for (final permission in permissions) permission['module'] as String,
        }.toList(),
      };

  List<Map<String, dynamic>> reportPermissions({
    bool r1 = true,
    bool r4 = true,
    bool r6 = true,
  }) =>
      [
        if (r1) perm(90, 'RPT.R1', 'report', sortNo: 90),
        if (r4) perm(94, 'RPT.R4', 'report', sortNo: 94),
        if (r6) perm(96, 'RPT.R6', 'report', sortNo: 96),
      ];

  Map<String, dynamic> r4Row({
    String period = 'morning',
    int totalPassengers = 40,
    double avgPerTrip = 4.0,
  }) =>
      {
        'period': period,
        'totalPassengers': totalPassengers,
        'avgPerTrip': avgPerTrip,
      };

  Map<String, dynamic> report4({
    String from = '2025-01-01',
    String to = '2025-12-31',
    List<Map<String, dynamic>>? rows,
  }) =>
      {
        'from': from,
        'to': to,
        'rows': rows ??
            [
              r4Row(),
              r4Row(
                period: 'afternoon',
                totalPassengers: 25,
                avgPerTrip: 2.5,
              ),
              r4Row(period: 'evening', totalPassengers: 18, avgPerTrip: 1.8),
            ],
      };

  Map<String, dynamic> r6Row({
    int vehId = 1,
    String plateNo = 'กข-1234',
    int totalTrips = 8,
    int totalPassengers = 64,
    int totalMinutes = 360,
  }) =>
      {
        'vehId': vehId,
        'plateNo': plateNo,
        'totalTrips': totalTrips,
        'totalPassengers': totalPassengers,
        'totalMinutes': totalMinutes,
      };

  Map<String, dynamic> report6({List<Map<String, dynamic>>? rows}) => {
        'rows': rows ??
            [
              r6Row(),
              r6Row(
                vehId: 2,
                plateNo: 'กค-5678',
                totalTrips: 5,
                totalPassengers: 30,
                totalMinutes: 150,
              ),
            ],
      };

  Map<String, dynamic> report1({
    String from = '2025-01-01',
    String to = '2025-12-31',
  }) =>
      {
        'from': from,
        'to': to,
        'rows': [
          {
            'serviceDate': '2025-01-06',
            'routeId': 1,
            'routeName': 'สายเหนือ',
            'totalTrips': 4,
            'totalPassengers': 12,
            'completed': 11,
            'noShow': 1,
            'attendanceRate': 91.67,
          },
        ],
      };

  ResponseBody errorJson(int status, String code, String message) =>
      jsonResponse(status, {'code': code, 'message': message});

  ResponseBody csvResponse(int status, String csv, {String? fileName}) =>
      ResponseBody.fromString(
        csv,
        status,
        headers: {
          Headers.contentTypeHeader: ['text/csv'],
          if (fileName != null)
            'content-disposition': ['attachment; filename="$fileName"'],
        },
      );

  List<Map<String, dynamic>> routesFixture() => [
        {
          'routeId': 1,
          'routeName': 'สายเหนือ',
          'totalMinutes': 45,
          'stopCount': 4,
          'isActive': 1,
        },
      ];

  AuthState authStateFor(List<Map<String, dynamic>> permissions) =>
      AuthState.authenticatedFrom(
        'jwt-sprint13',
        authMe(permissions: permissions),
      );

  Override stubAuth(List<Map<String, dynamic>> permissions) =>
      authControllerProvider.overrideWith(
        () => _StubAuthController(authStateFor(permissions)),
      );

  Future<ShuttleHarness> pumpReport(
    WidgetTester tester, {
    required void Function(FakeBackend backend) routes,
    List<Map<String, dynamic>>? authPermissions,
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    routes(backend);
    final storage = FakeTokenStorage(token: 'jwt-sprint13');
    final client = ApiClient(
      tokenStorage: storage,
      baseUrl: 'http://shuttle.test/api/v1',
    );
    client.dio.httpClientAdapter = backend;
    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(client),
        stubAuth(authPermissions ?? reportPermissions()),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: ReportPage()),
      ),
    );
    await pumpFrames(tester, count: 12);
    return ShuttleHarness(
      container: container,
      backend: backend,
      storage: storage,
    );
  }

  /// ตั้งค่า backend มาตรฐาน: routes + r1 + r4 + r6
  void stubAllReports(FakeBackend backend) {
    backend.on('GET', '/api/v1/routes',
        (request) => jsonResponse(200, routesFixture()));
    backend.on(
        'GET', '/api/v1/reports/r1', (request) => jsonResponse(200, report1()));
    backend.on(
        'GET', '/api/v1/reports/r4', (request) => jsonResponse(200, report4()));
    backend.on(
        'GET', '/api/v1/reports/r6', (request) => jsonResponse(200, report6()));
  }

  Future<void> openTab(WidgetTester tester, String tabKey) async {
    await tester.tap(find.byKey(Key(tabKey)));
    await pumpFrames(tester, count: 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Contract parsing (unit)
  // ─────────────────────────────────────────────────────────────────────────

  test('parse ReportR4 ตาม OpenAPI + KPI + ป้ายช่วงเวลาไทย', () {
    final report = parseReportR4(report4());

    expect(report.from, '2025-01-01');
    expect(report.to, '2025-12-31');
    expect(report.rows, hasLength(3));
    expect(report.rows.first.period, 'morning');
    expect(report.rows.first.periodLabel, 'เช้า');
    expect(report.rows[1].periodLabel, 'บ่าย');
    expect(report.rows[2].periodLabel, 'เย็น');
    expect(report.rows.first.avgPerTrip, 4.0);

    expect(report.totalPassengers, 83); // 40+25+18
    expect(report.busiestPeriod?.period, 'morning');
    expect(report.busiestPeriod?.periodLabel, 'เช้า');
  });

  test('parse ReportR4 รูปแบบผิด → ApiException', () {
    expect(
      () => parseReportR4({'from': '2025-01-01', 'rows': 'x'}),
      throwsA(isA<ApiException>()),
    );
    expect(() => parseReportR4(42), throwsA(isA<ApiException>()));
  });

  test('parse ReportR6 ตาม OpenAPI + KPI ผลรวม', () {
    final report = parseReportR6(report6());

    expect(report.rows, hasLength(2));
    expect(report.rows.first.plateNo, 'กข-1234');
    expect(report.rows.first.totalMinutes, 360);

    expect(report.totalTrips, 13); // 8+5
    expect(report.totalPassengers, 94); // 64+30
    expect(report.totalMinutes, 510); // 360+150
    expect(report.busiestVehicle?.vehId, 1);
    expect(report.busiestVehicle?.plateNo, 'กข-1234');
  });

  test('parse ReportR6 รูปแบบผิด → ApiException', () {
    expect(() => parseReportR6({'rows': 3}), throwsA(isA<ApiException>()));
    expect(() => parseReportR6([1, 2]), throwsA(isA<ApiException>()));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T-059 — R4: โหลด + KPI + กราฟ + ตาราง
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets(
      'แท็บ R4: GET /reports/r4 (from/to + Bearer) · KPI + กราฟ + ตาราง '
      'ช่วงเวลาไทย', (tester) async {
    final harness = await pumpReport(tester, routes: stubAllReports);
    await openTab(tester, 'report-tab-r4');

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r4');
    expect(calls, hasLength(1));
    expect(calls.single.query['from'], '2025-01-01');
    expect(calls.single.query['to'], '2025-12-31');
    expect(calls.single.query.containsKey('routeId'), isFalse);
    expect(calls.single.headers['authorization'], 'Bearer jwt-sprint13');

    // KPI
    expect(find.byKey(const Key('r4-kpi-passengers')), findsOneWidget);
    expect(find.text('83'), findsOneWidget);
    expect(find.byKey(const Key('r4-kpi-busiest')), findsOneWidget);
    expect(find.text('เช้า'), findsWidgets); // KPI + กราฟ + ตาราง

    // กราฟ + ตาราง
    expect(find.byKey(const Key('r4-chart')), findsOneWidget);
    expect(find.byKey(const Key('r4-chart-x-0')), findsOneWidget);
    expect(find.byKey(const Key('r4-table')), findsOneWidget);
    expect(find.byKey(const Key('r4-period-morning')), findsOneWidget);
    expect(find.byKey(const Key('r4-period-afternoon')), findsOneWidget);
    expect(find.byKey(const Key('r4-period-evening')), findsOneWidget);
    expect(find.text('4.00'), findsOneWidget);
    expect(find.text('2.50'), findsOneWidget);
  });

  testWidgets('แท็บ R4: สถานะกำลังโหลด → list-loading · ตอบแล้วมี r4-content',
      (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/api/v1/routes',
        (request) => jsonResponse(200, routesFixture()));
    backend.on(
        'GET', '/api/v1/reports/r1', (request) => jsonResponse(200, report1()));
    backend.on('GET', '/api/v1/reports/r4', (request) {
      return Future<ResponseBody>.delayed(
        const Duration(milliseconds: 300),
        () => jsonResponse(200, report4()),
      );
    });
    final storage = FakeTokenStorage(token: 'jwt-sprint13');
    final client = ApiClient(
      tokenStorage: storage,
      baseUrl: 'http://shuttle.test/api/v1',
    );
    client.dio.httpClientAdapter = backend;
    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(client),
        stubAuth(reportPermissions()),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: ReportPage()),
      ),
    );
    await pumpFrames(tester, count: 8);

    // แตะแท็บแล้ว pump สั้น ๆ — ยังไม่พ้น delay 300ms ของ backend
    await tester.tap(find.byKey(const Key('report-tab-r4')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byKey(const Key('list-loading')), findsOneWidget);
    expect(find.byKey(const Key('r4-content')), findsNothing);

    await tester.pump(const Duration(milliseconds: 400));
    await pumpFrames(tester, count: 6);
    expect(find.byKey(const Key('list-loading')), findsNothing);
    expect(find.byKey(const Key('r4-content')), findsOneWidget);
  });

  testWidgets('แท็บ R4: rows ว่าง → list-empty ข้อความไม่มีข้อมูล',
      (tester) async {
    await pumpReport(tester, routes: (backend) {
      stubAllReports(backend);
      backend.on('GET', '/api/v1/reports/r4',
          (request) => jsonResponse(200, report4(rows: [])));
    });
    await openTab(tester, 'report-tab-r4');

    expect(find.byKey(const Key('list-empty')), findsOneWidget);
    expect(
      find.text('ไม่มีข้อมูลผู้โดยสารในช่วงวันที่เลือก'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('r4-content')), findsNothing);
  });

  testWidgets('แท็บ R4: 500 → ข้อความ · ลองอีกครั้ง GET ซ้ำแล้วได้ข้อมูล',
      (tester) async {
    var calls = 0;
    final harness = await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1()));
      backend.on('GET', '/api/v1/reports/r4', (request) {
        calls++;
        if (calls == 1) {
          return errorJson(500, 'INTERNAL', 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่');
        }
        return jsonResponse(200, report4());
      });
    });
    await openTab(tester, 'report-tab-r4');

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'ลองอีกครั้ง'));
    await pumpFrames(tester, count: 10);

    expect(calls, 2);
    expect(find.byKey(const Key('list-error-message')), findsNothing);
    expect(find.byKey(const Key('r4-content')), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/reports/r4'), hasLength(2));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T-059 — R6: โหลด + KPI + กราฟ + ตาราง
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets(
      'แท็บ R6: GET /reports/r6 (from/to + Bearer) · KPI + กราฟ + ตาราง รายคัน',
      (tester) async {
    final harness = await pumpReport(tester, routes: stubAllReports);
    await openTab(tester, 'report-tab-r6');

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r6');
    expect(calls, hasLength(1));
    expect(calls.single.query['from'], '2025-01-01');
    expect(calls.single.query['to'], '2025-12-31');
    expect(calls.single.headers['authorization'], 'Bearer jwt-sprint13');

    // KPI
    expect(find.byKey(const Key('r6-kpi-trips')), findsOneWidget);
    expect(find.text('13'), findsOneWidget); // รวมรอบ 8+5
    expect(find.byKey(const Key('r6-kpi-passengers')), findsOneWidget);
    expect(find.text('94'), findsOneWidget); // ผู้โดยสาร 64+30
    expect(find.byKey(const Key('r6-kpi-minutes')), findsOneWidget);
    expect(find.text('510'), findsOneWidget); // นาที 360+150
    expect(find.byKey(const Key('r6-kpi-busiest')), findsOneWidget);

    // กราฟ + ตาราง
    expect(find.byKey(const Key('r6-chart')), findsOneWidget);
    expect(find.byKey(const Key('r6-chart-x-0')), findsOneWidget);
    expect(find.byKey(const Key('r6-table')), findsOneWidget);
    expect(find.byKey(const Key('r6-plate-1')), findsOneWidget);
    expect(find.byKey(const Key('r6-plate-2')), findsOneWidget);
    expect(find.text('กข-1234'), findsWidgets);
    expect(find.text('กค-5678'), findsWidgets);
  });

  testWidgets('แท็บ R6: rows ว่าง → list-empty ข้อความไม่มีข้อมูล',
      (tester) async {
    await pumpReport(tester, routes: (backend) {
      stubAllReports(backend);
      backend.on('GET', '/api/v1/reports/r6',
          (request) => jsonResponse(200, report6(rows: [])));
    });
    await openTab(tester, 'report-tab-r6');

    expect(find.byKey(const Key('list-empty')), findsOneWidget);
    expect(
      find.text('ไม่มีข้อมูลการใช้งานรถในช่วงวันที่เลือก'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('r6-content')), findsNothing);
  });

  testWidgets('แท็บ R6: 500 → ข้อความ · ลองอีกครั้ง GET ซ้ำแล้วได้ข้อมูล',
      (tester) async {
    var calls = 0;
    await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1()));
      backend.on('GET', '/api/v1/reports/r6', (request) {
        calls++;
        if (calls == 1) {
          return errorJson(500, 'INTERNAL', 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่');
        }
        return jsonResponse(200, report6());
      });
    });
    await openTab(tester, 'report-tab-r6');

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'ลองอีกครั้ง'));
    await pumpFrames(tester, count: 10);
    expect(calls, 2);
    expect(find.byKey(const Key('r6-content')), findsOneWidget);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ตัวกรองร่วมกันทุกแท็บ (ปี / ช่วงวันที่)
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets('เปลี่ยนปี 2568 → 2567 บนแท็บ R4: GET /reports/r4 ใหม่ ปี 2024',
      (tester) async {
    final harness = await pumpReport(tester, routes: stubAllReports);
    await openTab(tester, 'report-tab-r4');

    harness.container.read(reportR1QueryProvider.notifier).setYear(2567);
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r4');
    expect(calls, hasLength(2));
    expect(calls.last.query['from'], '2024-01-01');
    expect(calls.last.query['to'], '2024-12-31');
  });

  testWidgets('เลือกช่วงวันที่เอง: GET /reports/r6 ใหม่ด้วย from/to ที่กำหนด',
      (tester) async {
    final harness = await pumpReport(tester, routes: stubAllReports);
    await openTab(tester, 'report-tab-r6');

    harness.container
        .read(reportR1QueryProvider.notifier)
        .setDateRange(DateTime(2025, 6, 1), DateTime(2025, 6, 30));
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r6');
    expect(calls, hasLength(2));
    expect(calls.last.query['from'], '2025-06-01');
    expect(calls.last.query['to'], '2025-06-30');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // สิทธิ์ฝั่งไคลเอน (ไม่ยิง API)
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets(
      'ไม่มี RPT.R4 (ไคลเอน): ข้อความไม่มีสิทธิ์ R4 · ไม่ยิง /reports/r4',
      (tester) async {
    final harness = await pumpReport(
      tester,
      authPermissions: reportPermissions(r4: false),
      routes: stubAllReports,
    );
    await openTab(tester, 'report-tab-r4');

    expect(find.byKey(const Key('report-no-permission')), findsOneWidget);
    expect(
      find.text('ไม่มีสิทธิ์ดูรายงาน R4 (ต้องมีสิทธิ์ RPT.R4)'),
      findsOneWidget,
    );
    expect(harness.backend.requestsFor('GET', '/api/v1/reports/r4'), isEmpty);
  });

  testWidgets(
      'ไม่มี RPT.R6 (ไคลเอน): ข้อความไม่มีสิทธิ์ R6 · ไม่ยิง /reports/r6',
      (tester) async {
    final harness = await pumpReport(
      tester,
      authPermissions: reportPermissions(r6: false),
      routes: stubAllReports,
    );
    await openTab(tester, 'report-tab-r6');

    expect(find.byKey(const Key('report-no-permission')), findsOneWidget);
    expect(
      find.text('ไม่มีสิทธิ์ดูรายงาน R6 (ต้องมีสิทธิ์ RPT.R6)'),
      findsOneWidget,
    );
    expect(harness.backend.requestsFor('GET', '/api/v1/reports/r6'), isEmpty);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UC-30 — export (CSV / XLSX)
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets(
      'ส่งออก R1 CSV: ปุ่ม r1-export → เลือก CSV → GET export?format=csv '
      '+ Content-Disposition แสดงชื่อไฟล์ + ตัวอย่างเนื้อหา', (tester) async {
    const csv =
        'service_date,route_name,total_trips,total_passengers,attendance_rate\n'
        '2025-01-06,สายเหนือ,4,12,91.67\n';
    final harness = await pumpReport(tester, routes: (backend) {
      stubAllReports(backend);
      backend.on(
        'GET',
        '/api/v1/reports/r1/export',
        (request) => csvResponse(
          200,
          csv,
          fileName: 'R1_20250101-20251231.csv',
        ),
      );
    });

    expect(find.byKey(const Key('r1-export')), findsOneWidget);
    await tester.tap(find.byKey(const Key('r1-export')));
    await pumpFrames(tester, count: 6);
    await tester.tap(find.byKey(const Key('export-r1-csv')));
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor(
      'GET',
      '/api/v1/reports/r1/export',
    );
    expect(calls, hasLength(1));
    expect(calls.single.query['format'], 'csv');
    expect(calls.single.headers['authorization'], 'Bearer jwt-sprint13');

    expect(find.byKey(const Key('export-r1-result')), findsOneWidget);
    expect(
      find.text('ส่งออกสำเร็จ: R1_20250101-20251231.csv'),
      findsOneWidget,
    );
    expect(find.textContaining('service_date,route_name'), findsOneWidget);
  });

  testWidgets('ส่งออก R4 XLSX: GET export?format=xlsx · แสดงจำนวนไบต์',
      (tester) async {
    final xlsxBytes = utf8.encode('PK-fake-xlsx-binary');
    final harness = await pumpReport(tester, routes: (backend) {
      stubAllReports(backend);
      backend.on('GET', '/api/v1/reports/r4', (request) {
        // แท็บ R1 เปิดก่อน — ต้องมี r4 ด้วยเมื่อเปิดแท็บ
        return jsonResponse(200, report4());
      });
      backend.on(
        'GET',
        '/api/v1/reports/r4/export',
        (request) => ResponseBody.fromBytes(
          xlsxBytes,
          200,
          headers: {
            Headers.contentTypeHeader: [
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
            'content-disposition': [
              'attachment; filename="R4_20250101-20251231.xlsx"',
            ],
          },
        ),
      );
    });
    await openTab(tester, 'report-tab-r4');

    await tester.tap(find.byKey(const Key('r4-export')));
    await pumpFrames(tester, count: 6);
    await tester.tap(find.byKey(const Key('export-r4-xlsx')));
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor(
      'GET',
      '/api/v1/reports/r4/export',
    );
    expect(calls, hasLength(1));
    expect(calls.single.query['format'], 'xlsx');
    expect(find.byKey(const Key('export-r4-result')), findsOneWidget);
    expect(
      find.text('ส่งออกสำเร็จ: R4_20250101-20251231.xlsx'),
      findsOneWidget,
    );
    expect(find.textContaining('${xlsxBytes.length} ไบต์'), findsOneWidget);
  });

  testWidgets('ส่งออก R6 CSV: GET export?format=csv + แสดงชื่อไฟล์ fallback',
      (tester) async {
    final harness = await pumpReport(tester, routes: (backend) {
      stubAllReports(backend);
      backend.on(
        'GET',
        '/api/v1/reports/r6/export',
        (request) => csvResponse(200, 'veh_id,plate_no\n1,กข-1234\n'),
      );
    });
    await openTab(tester, 'report-tab-r6');

    await tester.tap(find.byKey(const Key('r6-export')));
    await pumpFrames(tester, count: 6);
    await tester.tap(find.byKey(const Key('export-r6-csv')));
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor(
      'GET',
      '/api/v1/reports/r6/export',
    );
    expect(calls, hasLength(1));
    expect(calls.single.query['format'], 'csv');
    expect(find.byKey(const Key('export-r6-result')), findsOneWidget);
    // ไม่มี Content-Disposition → fallback R6.csv
    expect(find.text('ส่งออกสำเร็จ: R6.csv'), findsOneWidget);
    expect(find.textContaining('veh_id,plate_no'), findsOneWidget);
  });

  testWidgets('ส่งออกล้มเหลว (503): snackbar ข้อความเซิร์ฟเวอร์',
      (tester) async {
    await pumpReport(tester, routes: (backend) {
      stubAllReports(backend);
      backend.on(
        'GET',
        '/api/v1/reports/r1/export',
        (request) =>
            errorJson(503, 'UNAVAILABLE', 'บริการส่งออกรายงานไม่พร้อม'),
      );
    });

    await tester.tap(find.byKey(const Key('r1-export')));
    await pumpFrames(tester, count: 6);
    await tester.tap(find.byKey(const Key('export-r1-csv')));
    await pumpFrames(tester, count: 10);

    expect(find.text('บริการส่งออกรายงานไม่พร้อม'), findsOneWidget);
    expect(find.byKey(const Key('export-r1-result')), findsNothing);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Integration ข้ามแท็บ (regression)
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets(
      'integration: R1 → R4 → R6 ครบทั้ง 3 แท็บ + เปลี่ยนปี → GET ใหม่ทุกแท็บ '
      'ที่มีสิทธิ์', (tester) async {
    final harness = await pumpReport(tester, routes: stubAllReports);

    // R1 (แท็บเริ่มต้น)
    expect(find.byKey(const Key('r1-content')), findsOneWidget);

    // R4
    await openTab(tester, 'report-tab-r4');
    expect(find.byKey(const Key('r4-content')), findsOneWidget);

    // R6
    await openTab(tester, 'report-tab-r6');
    expect(find.byKey(const Key('r6-content')), findsOneWidget);

    // เปลี่ยนปี → แท็บที่ active อยู่ (R6) โหลดใหม่ด้วยช่วงปี 2024 ·
    // แท็บที่ dispose ไปแล้ว (R1/R4) ไม่ refire จนกว่าจะกลับไปเปิด
    harness.container.read(reportR1QueryProvider.notifier).setYear(2567);
    await pumpFrames(tester, count: 10);

    expect(
      harness.backend
          .requestsFor('GET', '/api/v1/reports/r6')
          .last
          .query['from'],
      '2024-01-01',
    );
    // ทุกแท็บถูกยิงอย่างน้อย 1 ครั้งตอนเปิดดู (regression ครบทั้ง 3)
    expect(
      harness.backend.requestsFor('GET', '/api/v1/reports/r1'),
      isNotEmpty,
    );
    expect(
      harness.backend.requestsFor('GET', '/api/v1/reports/r4'),
      isNotEmpty,
    );
  });
}

/// AuthController stub — คืน state สำเร็จรูป ไม่เรียก restoreSession
class _StubAuthController extends AuthController {
  _StubAuthController(this._state);

  final AuthState _state;

  @override
  AuthState build() => _state;
}
