import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/router/app_router.dart';
import 'package:shuttle_app/features/booking/booking_page.dart';
import 'package:shuttle_app/main.dart';

void main() {
  void setScreen(WidgetTester tester, Size size) {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
  }

  Future<ProviderContainer> pumpApp(WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: ShuttleApp()));
    await tester.pumpAndSettle();
    final element = tester.element(find.byType(MaterialApp));
    return ProviderScope.containerOf(element);
  }

  testWidgets('แอปโหลดขึ้นด้วย Material 3 และเห็นหน้าแรก', (tester) async {
    setScreen(tester, const Size(390, 844));
    final container = await pumpApp(tester);

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.theme?.useMaterial3, isTrue);
    expect(find.text('ยินดีต้อนรับ'), findsOneWidget);

    container.dispose();
  });

  testWidgets('แตะแท็บ "จองรถ" ใน NavigationBar ไปหน้าจองได้', (tester) async {
    setScreen(tester, const Size(390, 844));
    final container = await pumpApp(tester);

    final bookingTab = find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text('จองรถ'),
    );
    await tester.tap(bookingTab);
    await tester.pumpAndSettle();

    expect(find.byType(BookingPage), findsOneWidget);
    expect(container.read(routerProvider).routerDelegate.currentConfiguration.uri.path,
        '/booking');

    container.dispose();
  });

  testWidgets('เส้นทาง /login เปิดฟอร์มเข้าสู่ระบบได้', (tester) async {
    setScreen(tester, const Size(390, 844));
    final container = await pumpApp(tester);

    container.read(routerProvider).go('/login');
    await tester.pumpAndSettle();

    expect(find.text('เข้าสู่ระบบ'), findsWidgets);
    expect(find.byType(TextFormField), findsNWidgets(2));

    container.dispose();
  });
}
