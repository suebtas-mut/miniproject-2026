import 'package:dio/dio.dart' show ResponseBody;
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

/// Sprint 12 — T-058 (หน้าจอ R1 + กราฟ fl_chart + ตัวกรองปี 2568/ช่วงวันที่)
///
/// ครอบคลุม: สัญญา `GET /reports/r1` (OpenAPI from/to/routeId + rows) ·
/// parse เข้ม + KPI (นับผลรวม + อัตราการมาถ่วงน้ำหนัก + guard หารศูนย์) ·
/// โหลดอัตโนมัติเมื่อเปิดด้วยปี 2568 (2025-01-01..2025-12-31) ·
/// เปลี่ยนปี/ช่วงวันที่/เส้นทาง → GET ใหม่ · สถานะโหลด/ว่าง/ผิดพลาด+ลองอีกครั้ง ·
/// 403 ข้อความเซิร์ฟเวอร์ · ไม่มีสิทธิ์ RPT.R1 (ฝั่งไคลเอน) ไม่ยิง API ·
/// แท็บ R4/R6 = ที่ว่าง Sprint 13
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

  List<Map<String, dynamic>> reportPermissions({bool r1 = true}) => [
        if (r1) perm(90, 'RPT.R1', 'report', sortNo: 90),
      ];

  Map<String, dynamic> reportRow({
    String serviceDate = '2025-01-06',
    int routeId = 1,
    String routeName = 'สายเหนือ',
    int totalTrips = 4,
    int totalPassengers = 12,
    int completed = 11,
    int noShow = 1,
    double attendanceRate = 91.67,
  }) =>
      {
        'serviceDate': serviceDate,
        'routeId': routeId,
        'routeName': routeName,
        'totalTrips': totalTrips,
        'totalPassengers': totalPassengers,
        'completed': completed,
        'noShow': noShow,
        'attendanceRate': attendanceRate,
      };

  Map<String, dynamic> report1({
    String from = '2025-01-01',
    String to = '2025-12-31',
    List<Map<String, dynamic>>? rows,
  }) =>
      {
        'from': from,
        'to': to,
        'rows': rows ??
            [
              reportRow(),
              reportRow(
                serviceDate: '2025-01-07',
                totalTrips: 3,
                totalPassengers: 9,
                completed: 9,
                noShow: 0,
                attendanceRate: 100,
              ),
            ],
      };

  ResponseBody errorJson(int status, String code, String message) =>
      jsonResponse(status, {'code': code, 'message': message});

  List<Map<String, dynamic>> routesFixture() => [
        {
          'routeId': 1,
          'routeName': 'สายเหนือ',
          'totalMinutes': 45,
          'stopCount': 4,
          'isActive': 1,
        },
        {
          'routeId': 2,
          'routeName': 'สายใต้',
          'totalMinutes': 30,
          'stopCount': 3,
          'isActive': 1,
        },
      ];

  AuthState authStateFor(List<Map<String, dynamic>> permissions) =>
      AuthState.authenticatedFrom(
        'jwt-sprint12',
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
    final storage = FakeTokenStorage(token: 'jwt-sprint12');
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

  // ─────────────────────────────────────────────────────────────────────────
  // Contract parsing (unit)
  // ─────────────────────────────────────────────────────────────────────────

  test('parse ReportR1 ตาม OpenAPI + KPI นับผลรวม + อัตราการมาถ่วงน้ำหนัก', () {
    final report = parseReportR1(report1(
      rows: [
        reportRow(
          totalTrips: 4,
          totalPassengers: 12,
          completed: 11,
          noShow: 1,
          attendanceRate: 91.67,
        ),
        reportRow(
          serviceDate: '2025-01-07',
          totalTrips: 3,
          totalPassengers: 9,
          completed: 9,
          noShow: 0,
          attendanceRate: 100,
        ),
      ],
    ));

    expect(report.from, '2025-01-01');
    expect(report.to, '2025-12-31');
    expect(report.rows, hasLength(2));
    expect(report.rows.first.serviceDate, '2025-01-06');
    expect(report.rows.first.routeName, 'สายเหนือ');
    expect(report.rows.first.attendanceRate, 91.67);

    // KPI = ผลรวมจาก rows ไม่ใช่ค่าเฉลี่ยของ %
    expect(report.totalTrips, 7);
    expect(report.totalPassengers, 21);
    expect(report.totalCompleted, 20);
    expect(report.totalNoShow, 1);
    // ถ่วงน้ำหนัก: 20 ÷ (20+1) × 100 = 95.238…%
    expect(report.overallAttendanceRate, closeTo(95.24, 0.01));

    // shortDate สำหรับแกนกราฟ
    expect(report.rows.first.shortDate, '6 ม.ค.');
  });

  test('parse ReportR1 guard หารศูนย์: ไม่มี completed/noShow → อัตราเป็น 0',
      () {
    final report = parseReportR1(report1(
      rows: [
        reportRow(
          totalPassengers: 5,
          completed: 0,
          noShow: 0,
          attendanceRate: 0,
        ),
      ],
    ));
    expect(report.overallAttendanceRate, 0);
  });

  test('parse ReportR1 รูปแบบผิด (rows ไม่ใช่ list) → ApiException', () {
    expect(
      () =>
          parseReportR1({'from': '2025-01-01', 'to': '2025-12-31', 'rows': 7}),
      throwsA(isA<ApiException>()),
    );
    expect(() => parseReportR1('not-a-map'), throwsA(isA<ApiException>()));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T-058 — โหลดอัตโนมัติ + ตาราง + กราฟ + KPI
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets(
      'เปิดหน้ารายงาน: GET /reports/r1 ปี 2568 (2025-01-01..2025-12-31) '
      '+ Bearer · แสดง KPI + กราฟ + ตาราง + ป้ายวันที่ พ.ศ.', (tester) async {
    final harness = await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1()));
    });

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r1');
    expect(calls, hasLength(1));
    final query = calls.single.query;
    expect(query['from'], '2025-01-01');
    expect(query['to'], '2025-12-31');
    expect(query.containsKey('routeId'), isFalse);
    expect(harness.storage.token, 'jwt-sprint12');

    // ป้ายช่วงวันที่แสดงเป็น พ.ศ.
    expect(find.textContaining('01/01/2568'), findsOneWidget);
    expect(find.textContaining('31/12/2568'), findsOneWidget);

    // KPI สรุป
    expect(find.byKey(const Key('r1-kpi-trips')), findsOneWidget);
    expect(find.text('7'), findsOneWidget); // รวมรอบ 4+3
    expect(find.text('21'), findsOneWidget); // ผู้โดยสาร 12+9
    expect(find.byKey(const Key('r1-kpi-rate')), findsOneWidget);
    expect(find.textContaining('95.24%'), findsOneWidget);

    // กราฟ + ตาราง
    expect(find.byKey(const Key('r1-chart')), findsOneWidget);
    expect(find.byKey(const Key('r1-table')), findsOneWidget);
    expect(find.byKey(const Key('r1-date-2025-01-06')), findsOneWidget);
    expect(find.byKey(const Key('r1-date-2025-01-07')), findsOneWidget);
    expect(find.text('91.67%'), findsOneWidget);
    expect(find.text('100.00%'), findsOneWidget);
  });

  testWidgets('สถานะกำลังโหลด: ยังไม่ตอบ → list-loading · ตอบแล้วหาย',
      (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/api/v1/routes',
        (request) => jsonResponse(200, routesFixture()));
    backend.on('GET', '/api/v1/reports/r1', (request) {
      return Future<ResponseBody>.delayed(
        const Duration(milliseconds: 300),
        () => jsonResponse(200, report1()),
      );
    });
    final storage = FakeTokenStorage(token: 'jwt-sprint12');
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
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byKey(const Key('list-loading')), findsOneWidget);
    expect(find.byKey(const Key('r1-content')), findsNothing);

    await tester.pump(const Duration(milliseconds: 400));
    await pumpFrames(tester, count: 6);
    expect(find.byKey(const Key('list-loading')), findsNothing);
    expect(find.byKey(const Key('r1-content')), findsOneWidget);
  });

  testWidgets('สถานะว่าง: rows ว่าง → list-empty ข้อความไม่มีข้อมูล',
      (tester) async {
    await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1(rows: [])));
    });

    expect(find.byKey(const Key('list-empty')), findsOneWidget);
    expect(
      find.text('ไม่มีข้อมูลการเดินรถในช่วงวันที่เลือก'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('r1-content')), findsNothing);
  });

  testWidgets(
      'สถานะผิดพลาด + ลองอีกครั้ง: 500 → ข้อความ · GET ซ้ำแล้วได้ข้อมูล',
      (tester) async {
    var calls = 0;
    final harness = await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1', (request) {
        calls++;
        if (calls == 1) {
          return errorJson(500, 'INTERNAL', 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่');
        }
        return jsonResponse(200, report1());
      });
    });

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'ลองอีกครั้ง'));
    await pumpFrames(tester, count: 10);

    expect(calls, 2);
    expect(find.byKey(const Key('list-error-message')), findsNothing);
    expect(find.byKey(const Key('r1-content')), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/reports/r1'), hasLength(2));
  });

  testWidgets('403 จากเซิร์ฟเวอร์: แสดงข้อความเซิร์ฟเวอร์', (tester) async {
    await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on(
        'GET',
        '/api/v1/reports/r1',
        (request) => errorJson(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดูรายงาน R1'),
      );
    });

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('ไม่มีสิทธิ์ดูรายงาน R1'), findsOneWidget);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ตัวกรอง: ปี / ช่วงวันที่ / เส้นทาง
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets('เปลี่ยนปี 2568 → 2567: GET ใหม่ด้วย from/to ของปี 2024',
      (tester) async {
    final harness = await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1()));
    });

    // เปลี่ยนปีผ่าน controller (dropdown UI มีเทสต์แยก)
    harness.container.read(reportR1QueryProvider.notifier).setYear(2567);
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r1');
    expect(calls, hasLength(2));
    expect(calls.last.query['from'], '2024-01-01');
    expect(calls.last.query['to'], '2024-12-31');
  });

  testWidgets(
      'เลือกช่วงวันที่เอง: GET ใหม่ด้วย from/to ที่กำหนด · ป้ายเปลี่ยนเป็นปีนั้น',
      (tester) async {
    final harness = await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1()));
    });

    harness.container
        .read(reportR1QueryProvider.notifier)
        .setDateRange(DateTime(2025, 3, 1), DateTime(2025, 3, 31));
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r1');
    expect(calls, hasLength(2));
    expect(calls.last.query['from'], '2025-03-01');
    expect(calls.last.query['to'], '2025-03-31');
    expect(find.textContaining('01/03/2568'), findsOneWidget);
    expect(find.textContaining('31/03/2568'), findsOneWidget);
  });

  testWidgets('กรองตามเส้นทาง: เลือกเส้นทาง 2 → GET มี routeId=2',
      (tester) async {
    final harness = await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1()));
    });

    harness.container.read(reportR1QueryProvider.notifier).setRouteId(2);
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r1');
    expect(calls, hasLength(2));
    expect(calls.last.query['routeId'], '2');
  });

  testWidgets('เปลี่ยนปีผ่าน DropdownMenu ใน UI → GET ใหม่', (tester) async {
    final harness = await pumpReport(tester, routes: (backend) {
      backend.on('GET', '/api/v1/routes',
          (request) => jsonResponse(200, routesFixture()));
      backend.on('GET', '/api/v1/reports/r1',
          (request) => jsonResponse(200, report1()));
    });

    expect(find.byKey(const Key('report-year')), findsOneWidget);
    await tester.tap(find.byKey(const Key('report-year')));
    await pumpFrames(tester, count: 6);
    // DropdownMenu สร้างข้อความรายการซ้ำใน overlay — เลือกตัวท้าย (ในเมนู)
    await tester.tap(find.text('2567').last);
    await pumpFrames(tester, count: 10);

    final calls = harness.backend.requestsFor('GET', '/api/v1/reports/r1');
    expect(calls, hasLength(2));
    expect(calls.last.query['from'], '2024-01-01');
    expect(calls.last.query['to'], '2024-12-31');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // สิทธิ์ + แท็บ
  // ─────────────────────────────────────────────────────────────────────────

  testWidgets(
      'ไม่มีสิทธิ์ RPT.R1 (ไคลเอน): แสดงข้อความไม่มีสิทธิ์ · ไม่ยิง API',
      (tester) async {
    final harness = await pumpReport(
      tester,
      authPermissions: reportPermissions(r1: false),
      routes: (backend) {
        backend.on('GET', '/api/v1/routes',
            (request) => jsonResponse(200, routesFixture()));
        backend.on('GET', '/api/v1/reports/r1',
            (request) => jsonResponse(200, report1()));
      },
    );

    expect(find.byKey(const Key('report-no-permission')), findsOneWidget);
    expect(
      find.text('ไม่มีสิทธิ์ดูรายงาน R1 (ต้องมีสิทธิ์ RPT.R1)'),
      findsOneWidget,
    );
    expect(harness.backend.requestsFor('GET', '/api/v1/reports/r1'), isEmpty);
  });

  testWidgets(
      'แท็บ R4/R6 (Sprint 13 ทำเสร็จ): R1-only ไม่มีสิทธิ์ R4/R6 → '
      'ข้อความไม่มีสิทธิ์ · ไม่ยิง API ของแท็บนั้น', (tester) async {
    final harness = await pumpReport(
      tester,
      authPermissions: reportPermissions(), // มีแค่ RPT.R1
      routes: (backend) {
        backend.on('GET', '/api/v1/routes',
            (request) => jsonResponse(200, routesFixture()));
        backend.on('GET', '/api/v1/reports/r1',
            (request) => jsonResponse(200, report1()));
        backend.on('GET', '/api/v1/reports/r4',
            (request) => jsonResponse(200, <String, dynamic>{}));
        backend.on('GET', '/api/v1/reports/r6',
            (request) => jsonResponse(200, <String, dynamic>{}));
      },
    );

    // แท็บ R1 เป็นค่าเริ่มต้น — เห็นเนื้อหา R1
    expect(find.byKey(const Key('r1-content')), findsOneWidget);

    // ไปแท็บ R4 — ไม่มี RPT.R4 → ข้อความ ไม่ยิง API
    await tester.tap(find.byKey(const Key('report-tab-r4')));
    await pumpFrames(tester, count: 8);
    expect(find.byKey(const Key('report-no-permission')), findsOneWidget);
    expect(
      find.text('ไม่มีสิทธิ์ดูรายงาน R4 (ต้องมีสิทธิ์ RPT.R4)'),
      findsOneWidget,
    );
    expect(harness.backend.requestsFor('GET', '/api/v1/reports/r4'), isEmpty);
    expect(find.byKey(const Key('r1-content')), findsNothing);

    // ไปแท็บ R6 — ไม่มี RPT.R6 → ข้อความ ไม่ยิง API
    await tester.tap(find.byKey(const Key('report-tab-r6')));
    await pumpFrames(tester, count: 8);
    expect(find.byKey(const Key('report-no-permission')), findsOneWidget);
    expect(
      find.text('ไม่มีสิทธิ์ดูรายงาน R6 (ต้องมีสิทธิ์ RPT.R6)'),
      findsOneWidget,
    );
    expect(harness.backend.requestsFor('GET', '/api/v1/reports/r6'), isEmpty);
    expect(find.byKey(const Key('r1-content')), findsNothing);
  });
}

/// AuthController stub — คืน state สำเร็จรูป ไม่เรียก restoreSession
/// (กัน microtask GET /auth/me ชนกับ pump เมื่อ mount ReportPage ตรง ๆ)
class _StubAuthController extends AuthController {
  _StubAuthController(this._state);

  final AuthState _state;

  @override
  AuthState build() => _state;
}
