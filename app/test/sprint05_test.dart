import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_client.dart';
import 'package:shuttle_app/core/providers.dart';
import 'package:shuttle_app/core/router/app_router.dart';
import 'package:shuttle_app/features/auth/auth_models.dart';
import 'package:shuttle_app/features/master/department_list_page.dart';
import 'package:shuttle_app/features/master/employee_list_page.dart';
import 'package:shuttle_app/features/master/master_page.dart';
import 'package:shuttle_app/features/master/permission_matrix_page.dart';
import 'package:shuttle_app/features/master/position_list_page.dart';
import 'package:shuttle_app/layout/adaptive_shell.dart';

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

  List<String> derivedModules(List<Map<String, dynamic>> permissions) {
    final seen = <String>{};
    for (final permission in permissions) {
      seen.add(permission['module'] as String);
    }
    return seen.toList();
  }

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
        'modules': modules ?? derivedModules(permissions),
      };

  List<Map<String, dynamic>> masterPermissions({bool roleEdit = false}) => [
        perm(1, 'EMP.VIEW', 'master', sortNo: 1),
        perm(2, 'EMP.EDIT', 'master', sortNo: 2),
        perm(3, 'DEPT.EDIT', 'master', sortNo: 3),
        perm(4, 'POS.EDIT', 'master', sortNo: 4),
        if (roleEdit) perm(5, 'ROLE.EDIT', 'master', sortNo: 5),
      ];

  Future<ShuttleHarness> pumpSprint05(
    WidgetTester tester, {
    required Map<String, dynamic> me,
    String initialLocation = '/',
    void Function(FakeBackend backend)? routes,
  }) {
    return pumpShuttle(
      tester,
      token: 'jwt-sprint05',
      initialLocation: initialLocation,
      size: const Size(390, 844),
      routes: (backend) {
        backend.on('GET', '/api/v1/auth/me', (request) {
          return jsonResponse(200, me);
        });
        routes?.call(backend);
      },
    );
  }

  Set<String> navLabels(WidgetTester tester) {
    final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    return {
      for (final destination in navBar.destinations)
        (destination as NavigationDestination).label,
    };
  }

  // ---------- T-023 unit: session permission helpers ----------

  test('session helpers map OpenAPI permissions to codes and modules', () {
    final state = AuthState.authenticatedFrom('jwt', {
      'user': {'empId': 1, 'username': 'ada'},
      'roles': ['STAFF'],
      'permissions': [
        perm(1, 'EMP.VIEW', 'master'),
        perm(10, 'BK.CREATE', 'booking'),
      ],
      'modules': ['home', 'master'], // 'home' ไม่ใช่ PermissionModule จริง
    });

    expect(state.can('EMP.VIEW'), isTrue);
    expect(state.can('EMP.EDIT'), isFalse);
    expect(state.permCodes, {'EMP.VIEW', 'BK.CREATE'});
    expect(state.accessibleModules, {'master', 'booking'});
  });

  test('shellDestinationsFor builds menu only from granted modules', () {
    AuthState session(List<String> modules) => AuthState.authenticatedFrom(
          'jwt',
          {
            'user': {'empId': 1, 'username': 'ada'},
            'roles': ['STAFF'],
            'permissions': [],
            'modules': modules,
          },
        );

    final all = shellDestinationsFor(
      session(const ['master', 'front', 'booking', 'driver', 'report']),
    );
    expect(all.map((d) => d.path).toList(), [
      '/',
      '/master',
      '/front',
      '/booking',
      '/driver',
      '/report',
    ]);

    final bookingOnly = shellDestinationsFor(session(const ['booking']));
    expect(bookingOnly.map((d) => d.path).toList(), ['/', '/booking']);

    final none = shellDestinationsFor(session(const []));
    expect(none.map((d) => d.path).toList(), ['/']);
  });

  // ---------- T-023: Dynamic Menu ----------

  testWidgets('Dynamic Menu: booking-only session sees home + booking only',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: [
        perm(10, 'BK.VIEW', 'booking', sortNo: 10),
        perm(11, 'BK.CREATE', 'booking', sortNo: 11),
      ]),
    );
    await pumpFrames(tester, count: 20);

    expect(harness.location, '/');
    expect(navLabels(tester), {'หน้าแรก', 'จองรถ'});
    expect(find.text('ข้อมูลหลัก'), findsNothing); // เมนู + การ์ดหน้าแรก
    expect(find.text('งานคนขับ'), findsNothing); // การ์ดหน้าแรกถูกซ่อนด้วย
  });

  testWidgets(
      'ไม่มี hardcoded role shortcut: roles=[ADMIN] แต่ไม่มีสิทธิ์ = เห็นเฉพาะหน้าแรก',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: const [], modules: const [], roles: const [
        'ADMIN',
      ]),
    );
    await pumpFrames(tester, count: 20);

    expect(harness.location, '/');
    // มีเฉพาะหน้าแรก (destination เดียว) NavigationBar ต้องไม่ถูกสร้าง
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('ข้อมูลหลัก'), findsNothing);
    expect(find.text('จองรถ'), findsNothing);
    expect(find.text('ยินดีต้อนรับ'), findsOneWidget); // หน้าแรกยังใช้ได้
  });

  testWidgets('Dynamic Menu: full permissions keep the complete 6-item menu',
      (tester) async {
    await pumpSprint05(
      tester,
      me: authMe(
        permissions: [
          perm(1, 'EMP.VIEW', 'master', sortNo: 1),
          perm(2, 'ROUTE.VIEW', 'front', sortNo: 2),
          perm(3, 'BK.VIEW', 'booking', sortNo: 3),
          perm(4, 'QR.SCAN', 'driver', sortNo: 4),
          perm(5, 'RPT.R1', 'report', sortNo: 5),
        ],
      ),
    );
    await pumpFrames(tester, count: 20);

    final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(navBar.destinations.map((d) => (d as NavigationDestination).label),
        ['หน้าแรก', 'ข้อมูลหลัก', 'เส้นทาง', 'จองรถ', 'คนขับ', 'รายงาน']);
  });

  testWidgets('กัน deep link เข้าโมดูลที่ไม่มีสิทธิ์: go(/master) ถูกเด้งกลับ',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: [
        perm(10, 'BK.VIEW', 'booking', sortNo: 10),
      ]),
    );
    await pumpFrames(tester, count: 20);

    harness.container.read(routerProvider).go('/master');
    await pumpFrames(tester, count: 10);
    expect(harness.location, '/');
    expect(find.byType(MasterPage), findsNothing);

    harness.container.read(routerProvider).go('/booking');
    await pumpFrames(tester, count: 10);
    expect(harness.location, '/booking');
  });

  // ---------- T-023: ซ่อนปุ่ม/แท็บที่ไม่มีสิทธิ์ ----------

  testWidgets(
      'ซ่อนการกระทำที่ไม่มีสิทธิ์: ไม่มี DEPT.EDIT/POS.EDIT/ROLE.EDIT '
      '=> ไม่มีปุ่มสร้าง/แก้ไข/แท็บสิทธิ์', (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: [
        perm(1, 'EMP.VIEW', 'master', sortNo: 1),
        perm(2, 'EMP.EDIT', 'master', sortNo: 2),
      ]),
      routes: (backend) {
        backend.on('GET', '/api/v1/employees', (request) {
          return jsonResponse(200, {
            'items': [
              {
                'empId': 1,
                'empCode': 'E001',
                'firstName': 'สมชาย',
                'lastName': 'ใจดี',
                'username': 'somchai',
                'isActive': 1,
              },
            ],
            'total': 1,
            'page': 1,
            'pageSize': 10,
          });
        });
        backend.on('GET', '/api/v1/departments', (request) {
          return jsonResponse(200, [
            {'deptId': 1, 'deptName': 'แผนกบัญชี'},
          ]);
        });
        backend.on('GET', '/api/v1/positions', (request) {
          return jsonResponse(200, [
            {'positionId': 5, 'positionName': 'พนักงานบัญชี', 'deptId': 1},
          ]);
        });
      },
    );
    await pumpFrames(tester, count: 20);
    harness.container.read(routerProvider).go('/master');
    await pumpFrames(tester, count: 20);

    // แท็บสิทธิ์ (ROLE.EDIT) ไม่แสดง — คง 3 แท็บเดิม
    expect(find.byKey(const Key('master-tab-permissions')), findsNothing);
    expect(find.byType(Tab), findsNWidgets(3));

    // แท็บพนักงาน: มี EMP.EDIT => เห็นปุ่มเพิ่ม + คอลัมน์จัดการ
    expect(find.byKey(const Key('employee-create')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(EmployeeListPage),
        matching: find.byIcon(Icons.edit_outlined),
      ),
      findsOneWidget,
    );

    // แท็บแผนก: ไม่มี DEPT.EDIT => ไม่มีปุ่มเพิ่ม ไม่มีปุ่มแก้ไข/ปิดใช้งาน
    await tester.tap(find.widgetWithText(Tab, 'แผนก'));
    await pumpFrames(tester, count: 15);
    expect(find.byKey(const Key('department-create')), findsNothing);
    expect(
      find.descendant(
        of: find.byType(DepartmentListPage),
        matching: find.byIcon(Icons.edit_outlined),
      ),
      findsNothing,
    );
    expect(
      find.descendant(
        of: find.byType(DepartmentListPage),
        matching: find.byIcon(Icons.delete_outline),
      ),
      findsNothing,
    );

    // แท็บตำแหน่ง: ไม่มี POS.EDIT => ไม่มีปุ่มเพิ่ม ไม่มีปุ่มแก้ไขในแถว
    await tester.tap(find.widgetWithText(Tab, 'ตำแหน่ง'));
    await pumpFrames(tester, count: 15);
    expect(find.byKey(const Key('position-create')), findsNothing);
    expect(
      find.descendant(
        of: find.byType(PositionListPage),
        matching: find.byIcon(Icons.edit_outlined),
      ),
      findsNothing,
    );
  });

  // ---------- T-023: Permission Matrix ----------

  List<Map<String, dynamic>> matrixPermList() => [
        perm(1, 'EMP.VIEW', 'master', sortNo: 1),
        perm(2, 'EMP.EDIT', 'master', sortNo: 2),
        perm(3, 'DEPT.EDIT', 'master', sortNo: 3),
        perm(10, 'BK.CREATE', 'booking', sortNo: 10),
      ];

  List<Map<String, dynamic>> matrixRoles() => [
        {'roleId': 1, 'roleName': 'แอดมิน', 'permCount': 21, 'isActive': 1},
        {'roleId': 3, 'roleName': 'พนักงาน', 'permCount': 18, 'isActive': 1},
      ];

  void matrixRoutes(FakeBackend backend) {
    backend.on('GET', '/api/v1/permissions', (request) {
      return jsonResponse(200, matrixPermList());
    });
    backend.on('GET', '/api/v1/roles', (request) {
      return jsonResponse(200, matrixRoles());
    });
    backend.on('GET', '/api/v1/roles/3/permissions', (request) {
      return jsonResponse(200, {
        'roleId': 3,
        'roleName': 'พนักงาน',
        'permIds': [1, 3],
      });
    });
  }

  Future<void> openMatrixTab(WidgetTester tester, ShuttleHarness harness,
      {void Function(FakeBackend backend)? routes}) async {
    matrixRoutes(harness.backend);
    routes?.call(harness.backend);
    harness.container.read(routerProvider).go('/master');
    await pumpFrames(tester, count: 15);
    await tester.tap(find.widgetWithText(Tab, 'สิทธิ์'));
    await pumpFrames(tester, count: 15);
  }

  Future<void> selectRole(WidgetTester tester, String label) async {
    final dropdown = find.byKey(const Key('matrix-role'));
    await tester.ensureVisible(dropdown);
    await pumpFrames(tester, count: 4);
    await tester.tap(dropdown);
    await pumpFrames(tester, count: 10);
    await tester.tap(find.text(label).last);
    await pumpFrames(tester, count: 15);
  }

  testWidgets('แท็บสิทธิ์มีเฉพาะผู้มี ROLE.EDIT และโหลดสปป.ตามสเปก OpenAPI',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: masterPermissions(roleEdit: true)),
    );
    await pumpFrames(tester, count: 20);
    await openMatrixTab(tester, harness);

    expect(find.byKey(const Key('master-tab-permissions')), findsOneWidget);
    expect(find.byType(Tab), findsNWidgets(4));
    expect(find.byKey(const Key('matrix-role')), findsOneWidget);
    expect(find.byKey(const Key('matrix-save')), findsOneWidget);

    // สเปกที่เรียกจริง: Bearer + pageSize + path
    final permissionRequests =
        harness.backend.requestsFor('GET', '/api/v1/permissions');
    expect(permissionRequests, hasLength(1));
    expect(permissionRequests.single.headers['authorization'],
        'Bearer jwt-sprint05');
    expect(permissionRequests.single.query['pageSize'], '200');
    expect(harness.backend.requestsFor('GET', '/api/v1/roles'), hasLength(1));
    expect(harness.backend.requestsFor('GET', '/api/v1/roles/3/permissions'),
        isEmpty); // ยังไม่ได้เลือกบทบาท

    // Q24 (แก้/ลบสิทธิ์) ยังไม่มี endpoint — หน้านี้ต้องไม่มีปุ่มเพิ่ม/ลบสิทธิ์
    expect(find.text('เพิ่มสิทธิ์'), findsNothing);
    expect(find.text('ลบสิทธิ์'), findsNothing);

    // ยังไม่มีการเปลี่ยนแปลง => ปุ่มบันทึกปิดอยู่
    expect(
      tester.widget<FilledButton>(find.byKey(const Key('matrix-save'))),
      isA<FilledButton>().having((b) => b.onPressed, 'onPressed', isNull),
    );
  });

  testWidgets(
      'Permission Matrix: เลือกบทบาท ติ๊กสิทธิ์ บันทึกด้วย PUT ตามสเปก '
      'และรีเฟรชรายการบทบาท', (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: masterPermissions(roleEdit: true)),
    );
    await pumpFrames(tester, count: 20);
    await openMatrixTab(
      tester,
      harness,
      routes: (backend) {
        backend.on('PUT', '/api/v1/roles/3/permissions', (request) {
          return jsonResponse(200, {'roleId': 3, 'permCount': 19});
        });
      },
    );
    await selectRole(tester, 'พนักงาน (18 สิทธิ์)');

    final rolePermRequests =
        harness.backend.requestsFor('GET', '/api/v1/roles/3/permissions');
    expect(rolePermRequests, hasLength(1));
    expect(rolePermRequests.single.headers['authorization'],
        'Bearer jwt-sprint05');

    // สถานะเริ่มต้นจากเซิร์ฟเวอร์: permIds [1, 3]
    expect(
      tester
          .widget<CheckboxListTile>(
              find.byKey(const Key('matrix-perm-EMP.VIEW')))
          .value,
      isTrue,
    );
    expect(
      tester
          .widget<CheckboxListTile>(
              find.byKey(const Key('matrix-perm-EMP.EDIT')))
          .value,
      isFalse,
    );

    // ยังไม่แก้ไข => บันทึกยังปิดอยู่
    expect(
      tester.widget<FilledButton>(find.byKey(const Key('matrix-save'))),
      isA<FilledButton>().having((b) => b.onPressed, 'onPressed', isNull),
    );

    // ติ๊ก EMP.EDIT เพิ่ม
    final tile = find.byKey(const Key('matrix-perm-EMP.EDIT'));
    await tester.ensureVisible(tile);
    await pumpFrames(tester, count: 4);
    await tester.tap(tile);
    await pumpFrames(tester, count: 5);
    expect(
      tester.widget<CheckboxListTile>(tile).value,
      isTrue,
    );

    final saveButton = find.byKey(const Key('matrix-save'));
    expect(
      tester.widget<FilledButton>(saveButton),
      isA<FilledButton>().having((b) => b.onPressed, 'onPressed', isNotNull),
    );
    await tester.tap(saveButton);
    await pumpFrames(tester, count: 20);

    // PUT /roles/3/permissions ตามสเปก: เขียนทั้งตาราง (permIds เรียงใหม่)
    final puts =
        harness.backend.requestsFor('PUT', '/api/v1/roles/3/permissions');
    expect(puts, hasLength(1));
    expect(puts.single.headers['authorization'], 'Bearer jwt-sprint05');
    expect(puts.single.body, {
      'permIds': [1, 2, 3],
    });

    expect(find.byKey(const Key('matrix-save-success')), findsOneWidget);
    expect(find.byKey(const Key('matrix-save-error')), findsNothing);

    // บันทึกแล้ว => ปุ่มกลับปิด (ไม่มีการแก้ไขค้าง)
    expect(
      tester.widget<FilledButton>(saveButton),
      isA<FilledButton>().having((b) => b.onPressed, 'onPressed', isNull),
    );

    // รีเฟรช permCount ของบทบาทหลังบันทึก
    expect(
      harness.backend.requestsFor('GET', '/api/v1/roles'),
      hasLength(2),
    );
  });

  testWidgets('Permission Matrix: 403 แสดงข้อความจากเซิร์ฟเวอร์ หน้าไม่หาย',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: masterPermissions(roleEdit: true)),
    );
    await pumpFrames(tester, count: 20);
    await openMatrixTab(
      tester,
      harness,
      routes: (backend) {
        backend.on('PUT', '/api/v1/roles/3/permissions', (request) {
          return jsonResponse(403, {
            'code': 'FORBIDDEN',
            'message': 'ไม่มีสิทธิ์ดำเนินการนี้',
            'details': {'required': 'ROLE.EDIT'},
          });
        });
      },
    );
    await selectRole(tester, 'พนักงาน (18 สิทธิ์)');

    final tile = find.byKey(const Key('matrix-perm-EMP.EDIT'));
    await tester.ensureVisible(tile);
    await pumpFrames(tester, count: 4);
    await tester.tap(tile);
    await pumpFrames(tester, count: 5);
    await tester.tap(find.byKey(const Key('matrix-save')));
    await pumpFrames(tester, count: 20);

    expect(find.byKey(const Key('matrix-save-error')), findsOneWidget);
    expect(find.text('ไม่มีสิทธิ์ดำเนินการนี้'), findsOneWidget);
    expect(find.byKey(const Key('matrix-save-success')), findsNothing);
    // ยังอยู่หน้าเดิม ลองใหม่ได้
    expect(find.byKey(const Key('matrix-save')), findsOneWidget);
    expect(
      harness.backend.requestsFor('PUT', '/api/v1/roles/3/permissions'),
      hasLength(1),
    );
  });

  testWidgets('Permission Matrix: 400 ADMIN_PERM_INCOMPLETE แสดงข้อความผิดพลาด',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: masterPermissions(roleEdit: true)),
    );
    await pumpFrames(tester, count: 20);
    await openMatrixTab(
      tester,
      harness,
      routes: (backend) {
        backend.on('PUT', '/api/v1/roles/3/permissions', (request) {
          return jsonResponse(400, {
            'code': 'ADMIN_PERM_INCOMPLETE',
            'message': 'บทบาท ADMIN ต้องมีสิทธิ์ครบทุกรายการ',
          });
        });
      },
    );
    await selectRole(tester, 'พนักงาน (18 สิทธิ์)');

    final tile = find.byKey(const Key('matrix-perm-EMP.EDIT'));
    await tester.ensureVisible(tile);
    await pumpFrames(tester, count: 4);
    await tester.tap(tile);
    await pumpFrames(tester, count: 5);
    await tester.tap(find.byKey(const Key('matrix-save')));
    await pumpFrames(tester, count: 20);

    expect(
      find.text('บทบาท ADMIN ต้องมีสิทธิ์ครบทุกรายการ'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('matrix-save-error')), findsOneWidget);
    expect(find.byKey(const Key('matrix-save-success')), findsNothing);
  });

  testWidgets('หน้า Permission Matrix ปิดเองเมื่อไม่มี ROLE.EDIT',
      (tester) async {
    final storage = FakeTokenStorage(token: null);
    final client = ApiClient(
      tokenStorage: storage,
      baseUrl: 'http://shuttle.test/api/v1',
    );
    final container = ProviderContainer(overrides: [
      tokenStorageProvider.overrideWithValue(storage),
      apiClientProvider.overrideWithValue(client),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: PermissionMatrixPage()),
    ));
    await tester.pump();

    expect(find.byKey(const Key('matrix-forbidden')), findsOneWidget);
    expect(find.byKey(const Key('matrix-save')), findsNothing);
  });

  // ---------- 403 ในฟอร์มเดิม ----------

  testWidgets('เพิ่มแผนกได้สิทธิ์แต่เซิร์ฟเวอร์ตอบ 403 => แสดงข้อความในฟอร์ม',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: [
        perm(3, 'DEPT.EDIT', 'master', sortNo: 3),
      ]),
      routes: (backend) {
        backend.on('GET', '/api/v1/departments', (request) {
          return jsonResponse(200, <Object>[]);
        });
        backend.on('POST', '/api/v1/departments', (request) {
          return jsonResponse(403, {
            'code': 'FORBIDDEN',
            'message': 'ไม่มีสิทธิ์ดำเนินการนี้',
          });
        });
      },
    );
    await pumpFrames(tester, count: 20);
    harness.container.read(routerProvider).go('/master');
    await pumpFrames(tester, count: 15);
    await tester.tap(find.widgetWithText(Tab, 'แผนก'));
    await pumpFrames(tester, count: 15);

    expect(find.byKey(const Key('department-create')), findsOneWidget);
    await tester.tap(find.byKey(const Key('department-create')));
    await pumpFrames(tester, count: 10);

    await tester.enterText(
      find.descendant(
        of: find.byType(DepartmentFormDialog),
        matching: find.byType(TextFormField),
      ),
      'แผนกทดสอบ',
    );
    await tester.tap(find.descendant(
      of: find.byType(DepartmentFormDialog),
      matching: find.widgetWithText(FilledButton, 'บันทึก'),
    ));
    await pumpFrames(tester, count: 15);

    expect(find.byKey(const Key('department-save-error')), findsOneWidget);
    expect(find.text('ไม่มีสิทธิ์ดำเนินการนี้'), findsOneWidget);
    // ฟอร์มยังเปิดอยู่ ไม่ปิดเงียบ
    expect(find.byType(DepartmentFormDialog), findsOneWidget);
  });

  // ---------- Revise จาก Codex review: race ตอนบันทึก + TC-09-01 ----------

  testWidgets(
      'PUT ค้าง: ระหว่างบันทึกเปลี่ยนบทบาทไม่ได้ และผลสำเร็จใช้กับบทบาทเดิม',
      (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: masterPermissions(roleEdit: true)),
    );
    await pumpFrames(tester, count: 20);
    await openMatrixTab(
      tester,
      harness,
      routes: (backend) {
        backend.on('PUT', '/api/v1/roles/3/permissions', (request) async {
          await Future<void>.delayed(const Duration(milliseconds: 300));
          return jsonResponse(200, {'roleId': 3, 'permCount': 19});
        });
      },
    );
    await selectRole(tester, 'พนักงาน (18 สิทธิ์)');

    final tile = find.byKey(const Key('matrix-perm-EMP.EDIT'));
    await tester.ensureVisible(tile);
    await pumpFrames(tester, count: 4);
    await tester.tap(tile);
    await pumpFrames(tester, count: 5);

    await tester.tap(find.byKey(const Key('matrix-save')));
    // PUT ยังค้าง (~200ms ผ่านไป < 300ms ที่ handler หน่วง)
    await pumpFrames(tester, count: 4);

    final dropdown = tester.widget<DropdownButtonFormField<int>>(
      find.byKey(const Key('matrix-role')),
    );
    expect(dropdown.onChanged, isNull); // ล็อกไม่ให้เปลี่ยนบทบาทระหว่างบันทึก

    await pumpFrames(tester, count: 15); // รอให้ PUT เสร็จ
    final puts =
        harness.backend.requestsFor('PUT', '/api/v1/roles/3/permissions');
    expect(puts, hasLength(1));
    expect(puts.single.body, {
      'permIds': [1, 2, 3],
    });
    // ผลสำเร็จถูก apply กับบทบาทที่สั่งตอนเริ่ม (baseline = checked ของ role 3)
    expect(find.byKey(const Key('matrix-save-success')), findsOneWidget);
    expect(find.byKey(const Key('matrix-save-error')), findsNothing);
    expect(
      tester
          .widget<DropdownButtonFormField<int>>(
            find.byKey(const Key('matrix-role')),
          )
          .onChanged,
      isNotNull, // ปลดล็อกหลังบันทึกเสร็จ
    );
    expect(
      tester.widget<FilledButton>(find.byKey(const Key('matrix-save'))),
      isA<FilledButton>().having((b) => b.onPressed, 'onPressed', isNull),
    );
  });

  testWidgets(
      'TC-09-01: ถอน EMP.VIEW (ยังมี DEPT.EDIT) => ไม่มีแท็บพนักงาน '
      'และไม่โหลดรายชื่อพนักงาน', (tester) async {
    final harness = await pumpSprint05(
      tester,
      me: authMe(permissions: [
        perm(3, 'DEPT.EDIT', 'master', sortNo: 3),
        perm(4, 'POS.EDIT', 'master', sortNo: 4),
      ]),
      routes: (backend) {
        backend.on('GET', '/api/v1/departments', (request) {
          return jsonResponse(200, <Object>[]);
        });
        backend.on('GET', '/api/v1/positions', (request) {
          return jsonResponse(200, <Object>[]);
        });
      },
    );
    await pumpFrames(tester, count: 20);

    // โมดูล master ยังเข้าได้เพราะมีสิทธิ์ master อย่างน้อยหนึ่งรายการ
    harness.container.read(routerProvider).go('/master');
    await pumpFrames(tester, count: 15);

    expect(find.byType(Tab), findsNWidgets(2)); // แผนก + ตำแหน่ง
    expect(find.widgetWithText(Tab, 'พนักงาน'), findsNothing);
    expect(find.text('พนักงาน'), findsNothing);
    // ไม่มีการเรียก API รายชื่อพนักงานเลย
    expect(
      harness.backend.requestsFor('GET', '/api/v1/employees'),
      isEmpty,
    );
  });

  testWidgets('หน้า EmployeeListPage ปิดเองเมื่อไม่มี EMP.VIEW',
      (tester) async {
    final storage = FakeTokenStorage(token: null);
    final client = ApiClient(
      tokenStorage: storage,
      baseUrl: 'http://shuttle.test/api/v1',
    );
    final container = ProviderContainer(overrides: [
      tokenStorageProvider.overrideWithValue(storage),
      apiClientProvider.overrideWithValue(client),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: EmployeeListPage()),
    ));
    await tester.pump();

    expect(find.byKey(const Key('employee-forbidden')), findsOneWidget);
    expect(find.byKey(const Key('employee-create')), findsNothing);
  });
}
