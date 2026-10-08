import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/router/app_router.dart';
import 'package:shuttle_app/features/booking/booking_page.dart';

import 'support/fake_backend.dart';

void main() {
  Map<String, dynamic> authMe() => {
        'user': {
          'empId': 1,
          'empCode': 'E001',
          'firstName': 'สมชาย',
          'lastName': 'ใจดี',
          'username': 'somchai',
          'isActive': 1,
        },
        'roles': ['USER'],
        'permissions': [
          {
            'permId': 1,
            'permCode': 'BOOKING.VIEW',
            'permName': 'ดูการจอง',
            'module': 'booking',
            'screenKey': 'booking',
            'sortNo': 1,
          },
        ],
        'modules': ['booking'],
      };

  Future<ShuttleHarness> pumpApp(WidgetTester tester) {
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

  testWidgets('แอปโหลดขึ้นด้วย Material 3 และเห็นหน้าแรก', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final harness = await pumpApp(tester);

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.theme?.useMaterial3, isTrue);
    expect(find.text('ยินดีต้อนรับ'), findsOneWidget);
    expect(harness.location, '/');
  });

  testWidgets('แตะแท็บ "จองรถ" ใน NavigationBar ไปหน้าจองได้', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final harness = await pumpApp(tester);

    final bookingTab = find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text('จองรถ'),
    );
    await tester.tap(bookingTab);
    await pumpFrames(tester);

    expect(find.byType(BookingPage), findsOneWidget);
    expect(harness.location, '/booking');
  });

  testWidgets('เส้นทาง /login เปิดฟอร์มเข้าสู่ระบบได้', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final harness = await pumpShuttle(tester);

    harness.container.read(routerProvider).go('/login');
    await pumpFrames(tester);

    expect(find.text('เข้าสู่ระบบ'), findsWidgets);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(harness.location, '/login');
  });
}
