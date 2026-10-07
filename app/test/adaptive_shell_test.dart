import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/layout/adaptive_shell.dart';
import 'package:shuttle_app/main.dart';

void main() {
  void setScreen(WidgetTester tester, Size size) {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
  }

  Future<void> pumpApp(WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: ShuttleApp()));
    await tester.pumpAndSettle();
  }

  testWidgets('ความกว้างมือถือ (390dp) ใช้ NavigationBar ไม่ใช่ NavigationRail',
      (tester) async {
    setScreen(tester, const Size(390, 844));
    await pumpApp(tester);

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
    expect(AdaptiveShell.tabletBreakpoint, 600);
  });

  testWidgets('ความกว้างแท็บเล็ต (800dp) ใช้ NavigationRail ไม่ใช่ NavigationBar',
      (tester) async {
    setScreen(tester, const Size(800, 1280));
    await pumpApp(tester);

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('แท็บเล็ตจอแคบ (600dp) เริ่มเปลี่ยนเป็น NavigationRail',
      (tester) async {
    setScreen(tester, const Size(600, 960));
    await pumpApp(tester);

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('หน้าจอ 599dp ยังเป็นมือถือ (Boundary)', (tester) async {
    setScreen(tester, const Size(599, 900));
    await pumpApp(tester);

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
  });

  testWidgets('แท็บเล็ตความกว้าง >= 1024 ใช้ NavigationRail แบบ extended',
      (tester) async {
    setScreen(tester, const Size(1280, 800));
    await pumpApp(tester);

    final rail = tester.widget<NavigationRail>(find.byType(NavigationRail));
    expect(rail.extended, isTrue);
    expect(rail.destinations.length, kShellDestinations.length);
  });

  testWidgets('เมนูครบ 6 รายการตาม kShellDestinations', (tester) async {
    setScreen(tester, const Size(390, 844));
    await pumpApp(tester);

    final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(navBar.destinations.length, kShellDestinations.length);
    expect(navBar.destinations.length, 6);
  });
}
