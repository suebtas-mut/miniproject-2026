import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_client.dart';
import 'package:shuttle_app/core/router/app_router.dart';
import 'package:shuttle_app/core/storage/token_storage.dart';
import 'package:shuttle_app/features/auth/auth_controller.dart';
import 'package:shuttle_app/features/auth/auth_models.dart';
import 'package:shuttle_app/features/auth/change_password_page.dart';
import 'package:shuttle_app/features/auth/login_page.dart';
import 'package:shuttle_app/features/master/department_list_page.dart';
import 'package:shuttle_app/features/master/employee_form_dialog.dart';
import 'package:shuttle_app/features/master/employee_list_page.dart';
import 'package:shuttle_app/features/master/master_models.dart';
import 'package:shuttle_app/features/master/master_providers.dart';
import 'package:shuttle_app/features/master/master_repository.dart';
import 'package:shuttle_app/features/master/position_list_page.dart';

import 'support/fake_backend.dart';

/// เซสชันจำลองสำหรับเทสต์หน้า EmployeeListPage ตรง ๆ —
/// หน้าถูก gate ด้วย EMP.VIEW ตั้งแต่ T-023 จึงต้องมีสิทธิ์นี้
class _EmployeeViewerAuth extends AuthController {
  @override
  AuthState build() => const AuthState(
        status: AuthStatus.authenticated,
        permissions: [
          SessionPermission(
            permCode: 'EMP.VIEW',
            permName: 'EMP.VIEW',
            module: 'master',
          ),
        ],
      );
}

void main() {
  const loginResponse = <String, dynamic>{
    'token': 'jwt-value',
    'tokenType': 'Bearer',
    'expiresIn': 3600,
    'user': {
      'empId': 7,
      'empCode': 'E007',
      'firstName': 'Ada',
      'lastName': 'Lovelace',
      'username': 'ada',
      'isActive': 1,
      'roles': ['ADMIN'],
    },
    'roles': ['ADMIN'],
    'permissions': [
      {
        'permId': 1,
        'permCode': 'EMP.VIEW',
        'permName': 'Employee view',
        'module': 'master',
        'screenKey': 'employee',
        'sortNo': 1,
      },
    ],
    'modules': ['master'],
  };

  // T-023: เมนู/ปุ่มกรองตามสิทธิ์จริง — authMeResponse จึงให้สิทธิ์แก้ไขของหน้า Master
  // (ไม่มี ROLE.EDIT เพื่อคงจำนวนแท็บเดิมของ MasterPage ไว้ 3 แท็บ)
  const authMeResponse = <String, dynamic>{
    'user': {
      'empId': 7,
      'empCode': 'E007',
      'firstName': 'Ada',
      'lastName': 'Lovelace',
      'username': 'ada',
      'isActive': 1,
      'roles': ['ADMIN'],
    },
    'roles': ['ADMIN'],
    'permissions': [
      {
        'permId': 1,
        'permCode': 'EMP.VIEW',
        'permName': 'Employee view',
        'module': 'master',
        'screenKey': 'employee',
        'sortNo': 1,
      },
      {
        'permId': 2,
        'permCode': 'EMP.EDIT',
        'permName': 'Employee edit',
        'module': 'master',
        'sortNo': 2,
      },
      {
        'permId': 3,
        'permCode': 'DEPT.EDIT',
        'permName': 'Department edit',
        'module': 'master',
        'sortNo': 3,
      },
      {
        'permId': 4,
        'permCode': 'POS.EDIT',
        'permName': 'Position edit',
        'module': 'master',
        'sortNo': 4,
      },
    ],
    'modules': ['master'],
  };

  Map<String, dynamic> employeeJson(int empId) => {
        'empId': empId,
        'empCode': 'E${empId.toString().padLeft(3, '0')}',
        'firstName': 'พนักงาน',
        'lastName': '$empId',
        'username': 'emp$empId',
        'deptId': 1,
        'deptName': 'แผนกบัญชี',
        'positionId': 5,
        'positionName': 'พนักงานบัญชี',
        'isActive': 1,
      };

  Map<String, dynamic> employeesPage({
    required int page,
    int total = 21,
    int pageSize = 10,
  }) {
    final start = (page - 1) * pageSize;
    final remaining = total - start;
    final count = remaining < pageSize ? remaining : pageSize;
    return {
      'items': [
        for (var i = 0; i < count; i++) employeeJson(start + i + 1),
      ],
      'total': total,
      'page': page,
      'pageSize': pageSize,
    };
  }

  Future<ShuttleHarness> pumpApp(
    WidgetTester tester, {
    String? token,
    String? initialLocation,
    void Function(FakeBackend backend)? routes,
  }) {
    return pumpShuttle(
      tester,
      token: token,
      initialLocation: initialLocation ?? '/',
      routes: (backend) {
        backend.on('GET', '/api/v1/auth/me', (request) {
          return jsonResponse(200, authMeResponse);
        });
        routes?.call(backend);
      },
    );
  }

  void masterListRoutes(FakeBackend backend) {
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
    backend.on('GET', '/api/v1/roles', (request) {
      return jsonResponse(200, [
        {'roleId': 1, 'roleName': 'แอดมิน', 'isActive': 1},
      ]);
    });
    backend.on('POST', '/api/v1/departments', (request) {
      final body = request.body! as Map<String, dynamic>;
      return jsonResponse(201, {
        'deptId': 2,
        'deptName': body['deptName'],
      });
    });
    backend.on('POST', '/api/v1/positions', (request) {
      final body = request.body! as Map<String, dynamic>;
      return jsonResponse(201, {
        'positionId': 6,
        'positionName': body['positionName'],
        'deptId': body['deptId'],
      });
    });
    backend.on('POST', '/api/v1/employees', (request) {
      final body = request.body! as Map<String, dynamic>;
      return jsonResponse(201, {
        'empId': 900,
        'empCode': body['empCode'],
        'firstName': body['firstName'],
        'lastName': body['lastName'],
        'username': body['username'],
        'deptId': body['deptId'],
        'positionId': body['positionId'],
        'isActive': 1,
      });
    });
  }

  Future<ShuttleHarness> pumpMaster(
    WidgetTester tester, {
    void Function(FakeBackend backend)? routes,
  }) async {
    final harness = await pumpApp(
      tester,
      token: 'jwt-token',
      routes: (backend) {
        backend.on('GET', '/api/v1/employees', (request) {
          final page = int.tryParse(request.query['page'] ?? '') ?? 1;
          return jsonResponse(200, employeesPage(page: page));
        });
        routes?.call(backend);
      },
    );
    harness.container.read(routerProvider).go('/master');
    await pumpFrames(tester);
    return harness;
  }

  Future<void> fillEmployeeForm(WidgetTester tester) async {
    final dialog = find.byType(EmployeeFormDialog);
    Finder field(int index) => find
        .descendant(of: dialog, matching: find.byType(TextFormField))
        .at(index);
    Finder dropdown(int index) => find
        .descendant(
          of: dialog,
          matching: find.byType(DropdownButtonFormField<int>),
        )
        .at(index);

    Future<void> enter(int index, String text) async {
      await tester.ensureVisible(field(index));
      await pumpFrames(tester, count: 3);
      await tester.enterText(field(index), text);
    }

    await enter(0, 'E900');
    await enter(1, 'แอนนา');
    await enter(2, 'ทดสอบ');
    await enter(5, 'anna');
    await enter(6, 'password1');
    await tester.ensureVisible(dropdown(0));
    await pumpFrames(tester, count: 4);
    await tester.tap(dropdown(0));
    await pumpFrames(tester, count: 10);
    await tester.tap(find.text('แผนกบัญชี').last);
    await pumpFrames(tester, count: 10);
    await tester.ensureVisible(dropdown(1));
    await pumpFrames(tester, count: 4);
    await tester.tap(dropdown(1));
    await pumpFrames(tester, count: 10);
    await tester.tap(find.text('พนักงานบัญชี').last);
    await pumpFrames(tester, count: 10);
    final chip = find.descendant(
      of: dialog,
      matching: find.widgetWithText(FilterChip, 'แอดมิน'),
    );
    await tester.ensureVisible(chip);
    await pumpFrames(tester, count: 4);
    await tester.tap(chip);
    await pumpFrames(tester, count: 4);
  }

  Future<void> tapSubmit(WidgetTester tester, Type dialogType, String label) {
    return tester.tap(
      find.descendant(
        of: find.byType(dialogType),
        matching: find.widgetWithText(FilledButton, label),
      ),
    );
  }

  test('OpenAPI login/me response maps user, roles and permissions', () {
    final state = AuthState.authenticatedFrom('jwt-value', loginResponse);

    expect(state.isAuthenticated, isTrue);
    expect(state.token, 'jwt-value');
    expect(state.user?.empId, 7);
    expect(state.user?.username, 'ada');
    expect(state.permissions.single.permCode, 'EMP.VIEW');
    expect(state.permissions.single.screenKey, 'employee');
    expect(state.modules, ['master']);
  });

  test('employee page model preserves OpenAPI pagination metadata', () {
    final page = PagedEmployees.fromJson({
      'items': [
        {
          'empId': 2,
          'empCode': 'E002',
          'firstName': 'Grace',
          'lastName': 'Hopper',
          'username': 'grace',
          'isActive': 1,
        },
      ],
      'total': 21,
      'page': 2,
      'pageSize': 10,
    });

    expect(page.items.single.fullName, 'Grace Hopper');
    expect(page.page, 2);
    expect(page.pageSize, 10);
    expect(page.total, 21);
    expect(page.totalPages, 3);
  });

  test('API client uses the configured v1 prefix for endpoint paths', () {
    final client = ApiClient(
      tokenStorage: TokenStorage(),
      baseUrl: 'http://localhost:3000/api/v1',
    );

    expect(client.dio.options.baseUrl, 'http://localhost:3000/api/v1');
    expect(
      '${client.dio.options.baseUrl}/auth/login',
      'http://localhost:3000/api/v1/auth/login',
    );
    expect(
      '${client.dio.options.baseUrl}/employees?page=2&pageSize=10',
      'http://localhost:3000/api/v1/employees?page=2&pageSize=10',
    );
  });

  testWidgets('login form shows required-field validation', (tester) async {
    await tester.pumpWidget(const ProviderScope(
      child: MaterialApp(home: LoginPage()),
    ));
    await tester.tap(find.byType(FilledButton));
    await tester.pump();

    expect(find.text('กรุณากรอกชื่อผู้ใช้'), findsOneWidget);
    expect(find.text('กรุณากรอกรหัสผ่าน'), findsOneWidget);
  });

  testWidgets('change-password form rejects mismatch and short password',
      (tester) async {
    await tester.pumpWidget(const ProviderScope(
      child: MaterialApp(home: ChangePasswordPage()),
    ));
    await tester.enterText(find.byType(TextFormField).at(0), 'old-password');
    await tester.enterText(find.byType(TextFormField).at(1), 'short');
    await tester.enterText(find.byType(TextFormField).at(2), 'different');
    await tester.tap(find.byType(FilledButton));
    await tester.pump();

    expect(find.text('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'), findsOneWidget);
    expect(find.text('รหัสผ่านใหม่ไม่ตรงกัน'), findsOneWidget);
  });

  testWidgets('employee list renders loading state while paged request waits',
      (tester) async {
    final container = ProviderContainer(overrides: [
      masterRepositoryProvider.overrideWithValue(_WaitingMasterRepository()),
      authControllerProvider.overrideWith(_EmployeeViewerAuth.new),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: EmployeeListPage())),
    ));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byKey(const Key('employee-search')), findsOneWidget);
  });

  testWidgets('department list exposes retryable API error state',
      (tester) async {
    final container = ProviderContainer(overrides: [
      masterRepositoryProvider.overrideWithValue(_FailingMasterRepository()),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: DepartmentListPage())),
    ));
    await tester.pump();

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.byIcon(Icons.refresh), findsOneWidget);
  });

  testWidgets('ไม่มี token ในเครื่อง → ไป /login และไม่เรียกเซสชัน',
      (tester) async {
    final harness = await pumpApp(tester);

    expect(harness.location, '/login');
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(harness.backend.requests, isEmpty);
    expect(harness.storage.token, isNull);
  });

  testWidgets('มี token → เรียก /auth/me พร้อม Bearer และกลับหน้าแรก',
      (tester) async {
    final harness = await pumpApp(tester, token: 'jwt-token');

    expect(harness.location, '/');
    expect(find.text('ยินดีต้อนรับ'), findsOneWidget);
    final sessionRequests =
        harness.backend.requestsFor('GET', '/api/v1/auth/me');
    expect(sessionRequests, hasLength(1));
    expect(sessionRequests.single.headers['authorization'], 'Bearer jwt-token');
  });

  testWidgets('ล็อกอินสำเร็จ: POST /auth/login เก็บ token และเข้าหน้าแรก',
      (tester) async {
    final harness = await pumpApp(tester, routes: (backend) {
      backend.on('POST', '/api/v1/auth/login', (request) {
        return jsonResponse(200, loginResponse);
      });
    });

    await tester.enterText(find.byType(TextFormField).at(0), 'somchai');
    await tester.enterText(find.byType(TextFormField).at(1), 'secret123');
    await tester.tap(find.widgetWithText(FilledButton, 'เข้าสู่ระบบ'));
    await pumpFrames(tester, count: 15);

    expect(harness.location, '/');
    expect(find.text('ยินดีต้อนรับ'), findsOneWidget);
    final loginRequests =
        harness.backend.requestsFor('POST', '/api/v1/auth/login');
    expect(loginRequests, hasLength(1));
    expect(loginRequests.single.body, {
      'username': 'somchai',
      'password': 'secret123',
    });
    expect(harness.storage.token, 'jwt-value');
  });

  testWidgets('ล็อกอินไม่ถูกต้อง: ข้อความ error จาก OpenAPI แสดงที่หน้า login',
      (tester) async {
    final harness = await pumpApp(tester, routes: (backend) {
      backend.on('POST', '/api/v1/auth/login', (request) {
        return jsonResponse(401, {
          'code': 'INVALID_CREDENTIALS',
          'message': 'รหัสผ่านไม่ถูกต้องสำหรับบัญชีนี้',
        });
      });
    });

    await tester.enterText(find.byType(TextFormField).at(0), 'somchai');
    await tester.enterText(find.byType(TextFormField).at(1), 'wrong-pass');
    await tester.tap(find.widgetWithText(FilledButton, 'เข้าสู่ระบบ'));
    await pumpFrames(tester);

    expect(harness.location, '/login');
    expect(find.byKey(const Key('login-message')), findsOneWidget);
    expect(find.text('รหัสผ่านไม่ถูกต้องสำหรับบัญชีนี้'), findsOneWidget);
    expect(harness.storage.token, isNull);
    expect(harness.backend.requestsFor('GET', '/api/v1/auth/me'), isEmpty);
  });

  testWidgets('เซสชันหมดอายุ: /auth/me ตอบ 401 → ล้าง token และแจ้งเตือน',
      (tester) async {
    final harness = await pumpApp(
      tester,
      token: 'jwt-token',
      routes: (backend) {
        backend.on('GET', '/api/v1/auth/me', (request) {
          return jsonResponse(401, {
            'code': 'UNAUTHORIZED',
            'message': 'token หมดอายุ',
          });
        });
      },
    );

    expect(harness.location, '/login');
    expect(
      find.text('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'),
      findsOneWidget,
    );
    expect(harness.storage.token, isNull);
  });

  testWidgets('ออกจากระบบ: POST /auth/logout ล้าง token และกลับหน้า login',
      (tester) async {
    final harness =
        await pumpApp(tester, token: 'jwt-token', routes: (backend) {
      backend.on('POST', '/api/v1/auth/logout', (request) {
        return emptyResponse(204);
      });
    });

    await tester.tap(find.byKey(const Key('account-menu')).first);
    await pumpFrames(tester, count: 8);
    await tester.tap(find.text('ออกจากระบบ'));
    await pumpFrames(tester, count: 20);

    final logoutRequests =
        harness.backend.requestsFor('POST', '/api/v1/auth/logout');
    expect(logoutRequests, hasLength(1));
    expect(
      logoutRequests.single.headers['authorization'],
      'Bearer jwt-token',
    );
    expect(harness.storage.token, isNull);
    expect(harness.location, '/login');
  });

  testWidgets('เปลี่ยนรหัสผ่านสำเร็จ: บังคับล็อกอินใหม่พร้อมข้อความยืนยัน',
      (tester) async {
    final harness = await pumpApp(
      tester,
      token: 'jwt-token',
      initialLocation: '/account/change-password',
      routes: (backend) {
        backend.on('POST', '/api/v1/auth/change-password', (request) {
          return emptyResponse(204);
        });
      },
    );

    await tester.enterText(find.byType(TextFormField).at(0), 'old-secret-1');
    await tester.enterText(find.byType(TextFormField).at(1), 'brand-new-pass');
    await tester.enterText(find.byType(TextFormField).at(2), 'brand-new-pass');
    await tester.tap(find.widgetWithText(FilledButton, 'บันทึกรหัสผ่านใหม่'));
    await pumpFrames(tester, count: 15);

    final requests =
        harness.backend.requestsFor('POST', '/api/v1/auth/change-password');
    expect(requests, hasLength(1));
    expect(requests.single.body, {
      'oldPassword': 'old-secret-1',
      'newPassword': 'brand-new-pass',
    });
    expect(harness.storage.token, isNull);
    expect(harness.location, '/login');
    expect(
      find.text('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่'),
      findsOneWidget,
    );
  });

  testWidgets('เปลี่ยนรหัสผ่านไม่ถูกต้อง: แสดง error และยังล็อกอินอยู่',
      (tester) async {
    final harness = await pumpApp(
      tester,
      token: 'jwt-token',
      initialLocation: '/account/change-password',
      routes: (backend) {
        backend.on('POST', '/api/v1/auth/change-password', (request) {
          return jsonResponse(400, {
            'code': 'INVALID_OLD_PASSWORD',
            'message': 'รหัสผ่านเดิมไม่ถูกต้อง',
          });
        });
      },
    );

    await tester.enterText(find.byType(TextFormField).at(0), 'wrong-old-1');
    await tester.enterText(find.byType(TextFormField).at(1), 'brand-new-pass');
    await tester.enterText(find.byType(TextFormField).at(2), 'brand-new-pass');
    await tester.tap(find.widgetWithText(FilledButton, 'บันทึกรหัสผ่านใหม่'));
    await pumpFrames(tester);

    expect(find.byKey(const Key('change-password-error')), findsOneWidget);
    expect(find.text('รหัสผ่านเดิมไม่ถูกต้อง'), findsOneWidget);
    expect(harness.location, '/account/change-password');
    expect(harness.storage.token, 'jwt-token');
  });

  testWidgets('เส้นทาง /master ถูกป้องกัน: ไม่มี session → กลับหน้า login',
      (tester) async {
    final harness = await pumpApp(tester);

    harness.container.read(routerProvider).go('/master');
    await pumpFrames(tester);

    expect(harness.location, '/login');
    expect(harness.backend.requestsFor('GET', '/api/v1/employees'), isEmpty);
  });

  testWidgets('รายชื่อพนักงานเรียก /employees ด้วย page/pageSize และ Bearer',
      (tester) async {
    final harness = await pumpMaster(tester);

    final requests = harness.backend.requestsFor('GET', '/api/v1/employees');
    expect(requests, hasLength(1));
    expect(requests.single.uri.path, '/api/v1/employees');
    expect(requests.single.query['page'], '1');
    expect(requests.single.query['pageSize'], '10');
    expect(requests.single.query['activeOnly'], 'true');
    expect(requests.single.headers['authorization'], 'Bearer jwt-token');
    expect(find.text('E001'), findsOneWidget);
    expect(find.text('หน้า 1 / 3 · ทั้งหมด 21 คน'), findsOneWidget);
  });

  testWidgets('เปลี่ยนหน้ารายชื่อพนักงานส่ง page=2 ไปยัง API', (tester) async {
    final harness = await pumpMaster(tester);

    await tester.tap(find.byTooltip('ถัดไป'));
    await pumpFrames(tester);

    final requests = harness.backend.requestsFor('GET', '/api/v1/employees');
    expect(requests, hasLength(2));
    expect(requests.last.query['page'], '2');
    expect(find.text('หน้า 2 / 3 · ทั้งหมด 21 คน'), findsOneWidget);
    expect(find.text('E011'), findsOneWidget);
  });

  testWidgets('รายชื่อพนักงาน error → แสดงข้อความ และกดลองใหม่ได้',
      (tester) async {
    var calls = 0;
    final harness = await pumpMaster(tester, routes: (backend) {
      backend.on('GET', '/api/v1/employees', (request) {
        calls += 1;
        if (calls == 1) {
          return jsonResponse(500, {
            'code': 'SERVER_ERROR',
            'message': 'เซิร์ฟเวอร์ขัดข้อง (จำลอง)',
          });
        }
        return jsonResponse(200, employeesPage(page: 1));
      });
    });

    expect(find.byKey(const Key('list-error-message')), findsOneWidget);
    expect(find.text('เซิร์ฟเวอร์ขัดข้อง (จำลอง)'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'ลองอีกครั้ง'));
    await pumpFrames(tester);

    expect(calls, 2);
    expect(find.text('E001'), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/employees'), hasLength(2));
  });

  testWidgets('ฟอร์มเพิ่มพนักงาน: validate ครบถ้วนโดยไม่ส่ง POST',
      (tester) async {
    final harness = await pumpMaster(tester, routes: masterListRoutes);

    await tester.tap(find.byKey(const Key('employee-create')));
    await pumpFrames(tester, count: 12);
    await tapSubmit(tester, EmployeeFormDialog, 'บันทึก');
    await pumpFrames(tester);

    expect(find.text('กรุณากรอกรหัสพนักงาน'), findsOneWidget);
    expect(find.text('กรุณากรอกชื่อ'), findsOneWidget);
    expect(find.text('กรุณาเลือกแผนก'), findsOneWidget);
    expect(find.text('กรุณาเลือกตำแหน่ง'), findsOneWidget);
    expect(find.byKey(const Key('employee-role-error')), findsOneWidget);
    expect(harness.backend.requestsFor('POST', '/api/v1/employees'), isEmpty);
  });

  testWidgets('เพิ่มพนักงานสำเร็จ: POST body ตรง OpenAPI และรีเฟรชรายการ',
      (tester) async {
    final harness = await pumpMaster(tester, routes: masterListRoutes);

    await tester.tap(find.byKey(const Key('employee-create')));
    await pumpFrames(tester, count: 12);
    await fillEmployeeForm(tester);
    await tapSubmit(tester, EmployeeFormDialog, 'บันทึก');
    await pumpFrames(tester, count: 15);

    final posts = harness.backend.requestsFor('POST', '/api/v1/employees');
    expect(posts, hasLength(1));
    final body = posts.single.body! as Map<String, dynamic>;
    expect(body['empCode'], 'E900');
    expect(body['firstName'], 'แอนนา');
    expect(body['lastName'], 'ทดสอบ');
    expect(body['username'], 'anna');
    expect(body['password'], 'password1');
    expect(body['deptId'], 1);
    expect(body['positionId'], 5);
    expect(body['roleIds'], [1]);
    expect(find.byType(EmployeeFormDialog), findsNothing);
    expect(
      harness.backend.requestsFor('GET', '/api/v1/employees'),
      hasLength(2),
    );
  });

  testWidgets('รหัสพนักงานซ้ำ (409): แสดงข้อความและเปิดฟอร์มค้างไว้',
      (tester) async {
    final harness = await pumpMaster(tester, routes: (backend) {
      masterListRoutes(backend);
      backend.on('POST', '/api/v1/employees', (request) {
        return jsonResponse(409, {
          'code': 'DUPLICATE_EMP_CODE',
          'message': 'รหัสพนักงานนี้มีอยู่ในระบบแล้ว',
        });
      });
    });

    await tester.tap(find.byKey(const Key('employee-create')));
    await pumpFrames(tester, count: 12);
    await fillEmployeeForm(tester);
    await tapSubmit(tester, EmployeeFormDialog, 'บันทึก');
    await pumpFrames(tester, count: 15);

    expect(find.byKey(const Key('employee-save-error')), findsOneWidget);
    expect(find.text('รหัสพนักงานนี้มีอยู่ในระบบแล้ว'), findsOneWidget);
    expect(find.byType(EmployeeFormDialog), findsOneWidget);
    expect(
        harness.backend.requestsFor('GET', '/api/v1/employees'), hasLength(1));
  });

  testWidgets('เพิ่มแผนก: POST /departments ด้วย deptName ที่กรอก',
      (tester) async {
    final harness = await pumpMaster(tester, routes: masterListRoutes);

    await tester.tap(find.byType(Tab).at(1));
    await pumpFrames(tester);
    expect(find.text('แผนกทั้งหมด'), findsOneWidget);

    await tester.tap(find.byKey(const Key('department-create')));
    await pumpFrames(tester, count: 12);
    await tester.enterText(
      find.descendant(
        of: find.byType(DepartmentFormDialog),
        matching: find.byType(TextFormField),
      ),
      'แผนกทดสอบ',
    );
    await tapSubmit(tester, DepartmentFormDialog, 'บันทึก');
    await pumpFrames(tester, count: 12);

    final posts = harness.backend.requestsFor('POST', '/api/v1/departments');
    expect(posts, hasLength(1));
    expect(posts.single.body, {'deptName': 'แผนกทดสอบ'});
    expect(find.byType(DepartmentFormDialog), findsNothing);
  });

  testWidgets('เพิ่มตำแหน่ง: POST /positions พร้อม positionName และ deptId',
      (tester) async {
    final harness = await pumpMaster(tester, routes: masterListRoutes);

    await tester.tap(find.byType(Tab).at(2));
    await pumpFrames(tester);
    expect(find.text('ตำแหน่งทั้งหมด'), findsOneWidget);

    await tester.tap(find.byKey(const Key('position-create')));
    await pumpFrames(tester, count: 12);
    final dialog = find.byType(PositionFormDialog);
    await tester.enterText(
      find.descendant(of: dialog, matching: find.byType(TextFormField)),
      'พนักงานทดสอบ',
    );
    await tester.tap(
      find.descendant(
        of: dialog,
        matching: find.byType(DropdownButtonFormField<int>),
      ),
    );
    await pumpFrames(tester, count: 10);
    await tester.tap(find.text('แผนกบัญชี').last);
    await pumpFrames(tester, count: 10);
    await tapSubmit(tester, PositionFormDialog, 'บันทึก');
    await pumpFrames(tester, count: 12);

    final posts = harness.backend.requestsFor('POST', '/api/v1/positions');
    expect(posts, hasLength(1));
    expect(posts.single.body, {'positionName': 'พนักงานทดสอบ', 'deptId': 1});
    expect(find.byType(PositionFormDialog), findsNothing);
  });
}

class _WaitingMasterRepository extends MasterRepository {
  _WaitingMasterRepository() : super(ApiClient(tokenStorage: TokenStorage()));

  @override
  Future<PagedEmployees> fetchEmployees({
    required int page,
    required int pageSize,
    String? search,
    int? deptId,
    int? positionId,
    int? roleId,
    bool activeOnly = true,
  }) =>
      Completer<PagedEmployees>().future;
}

class _FailingMasterRepository extends MasterRepository {
  _FailingMasterRepository() : super(ApiClient(tokenStorage: TokenStorage()));

  @override
  Future<List<Department>> fetchDepartments({bool activeOnly = true}) =>
      Future.error(StateError('department request failed'));
}
