import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/layout/adaptive_shell.dart';

import 'support/fake_backend.dart';

void main() {
  // T-023: Dynamic Menu กรองตามสิทธิ์จากเซิร์ฟเวอร์ — ผู้ใช้เต็มสิทธิ์ (5 โมดูล)
  // จึงต้องมี permissions/modules ครบเพื่อให้เมนูครบ 6 รายการตามเดิม
  Map<String, dynamic> authMe() => {
        'user': {
          'empId': 1,
          'empCode': 'E001',
          'firstName': '?????',
          'lastName': '????',
          'username': 'somchai',
          'isActive': 1,
        },
        'roles': ['USER'],
        'permissions': [
          for (final (index, module, code) in [
            (1, 'master', 'EMP.VIEW'),
            (2, 'front', 'ROUTE.VIEW'),
            (3, 'booking', 'BK.VIEW'),
            (4, 'driver', 'QR.SCAN'),
            (5, 'report', 'RPT.R1'),
          ])
            {
              'permId': index,
              'permCode': code,
              'permName': code,
              'module': module,
              'sortNo': index,
            },
        ],
        'modules': ['master', 'front', 'booking', 'driver', 'report'],
      };

  Future<void> pumpApp(WidgetTester tester) {
    return pumpShuttle(
      tester,
      token: 'jwt-token',
      routes: (backend) {
        backend.on('GET', '/api/v1/auth/me', (request) {
          return jsonResponse(200, authMe());
        });
      },
    );
  }

  testWidgets('ความกว้างมือถือ (390dp) ใช้ NavigationBar ไม่ใช่ NavigationRail',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await pumpApp(tester);

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
    expect(AdaptiveShell.tabletBreakpoint, 600);
  });

  testWidgets(
      'ความกว้างแท็บเล็ต (800dp) ใช้ NavigationRail ไม่ใช่ NavigationBar',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1280);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await pumpApp(tester);

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('แท็บเล็ตจอแคบ (600dp) เริ่มเปลี่ยนเป็น NavigationRail',
      (tester) async {
    tester.view.physicalSize = const Size(600, 960);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await pumpApp(tester);

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('หน้าจอ 599dp ยังเป็นมือถือ (Boundary)', (tester) async {
    tester.view.physicalSize = const Size(599, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await pumpApp(tester);

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
  });

  testWidgets('แท็บเล็ตความกว้าง >= 1024 ใช้ NavigationRail แบบ extended',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await pumpApp(tester);

    final rail = tester.widget<NavigationRail>(find.byType(NavigationRail));
    expect(rail.extended, isTrue);
    expect(rail.destinations.length, kShellDestinations.length);
  });

  testWidgets('เมนูครบ 6 รายการตาม kShellDestinations', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await pumpApp(tester);

    final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(navBar.destinations.length, kShellDestinations.length);
    expect(navBar.destinations.length, 6);
  });
}
