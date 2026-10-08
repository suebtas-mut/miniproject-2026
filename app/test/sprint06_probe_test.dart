import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_backend.dart';

void main() {
  Map<String, dynamic> perm(int permId, String permCode, String module) => {
        'permId': permId,
        'permCode': permCode,
        'permName': permCode,
        'module': module,
        'screenKey': null,
        'sortNo': permId,
      };

  Map<String, dynamic> authMe() => {
        'user': {
          'empId': 7,
          'username': 'ada',
          'isActive': 1,
          'roles': ['STAFF'],
        },
        'roles': ['STAFF'],
        'permissions': [
          perm(6, 'ROUTE.VIEW', 'front'),
          perm(7, 'ROUTE.EDIT', 'front'),
        ],
        'modules': ['front'],
      };

  List<Map<String, dynamic>> stopFixture() => [
        {'stopId': 1, 'stopName': 'คลองเตย', 'isActive': 1},
        {'stopId': 2, 'stopName': 'เอราวัณ', 'isActive': 1},
        {'stopId': 3, 'stopName': 'หมอชิต', 'isActive': 1},
      ];

  Map<String, dynamic> routeFixture() => {
        'routeId': 1,
        'routeName': 'สายเหนือ',
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

  Future<ShuttleHarness> pump(WidgetTester tester) {
    return pumpShuttle(
      tester,
      token: 'jwt-probe',
      initialLocation: '/front',
      size: const Size(390, 844),
      routes: (backend) {
        backend.on(
            'GET', '/api/v1/auth/me', (r) => jsonResponse(200, authMe()));
        backend.on(
            'GET', '/api/v1/stops', (r) => jsonResponse(200, stopFixture()));
        backend.on('GET', '/api/v1/routes',
            (r) => jsonResponse(200, [routeFixture()]));
      },
    );
  }

  Future<void> tapKey(WidgetTester tester, Key key) async {
    final finder = find.byKey(key);
    await tester.ensureVisible(finder);
    await pumpFrames(tester, count: 4);
    await tester.tap(finder);
    await pumpFrames(tester, count: 8);
  }

  testWidgets('probeA: route-create + enterText name + 4 pumps',
      (tester) async {
    await pump(tester);
    await pumpFrames(tester, count: 20);
    await tapKey(tester, const Key('route-create'));
    expect(find.byKey(const Key('route-name')), findsOneWidget);
    await tester.enterText(find.byKey(const Key('route-name')), 'สายทดสอบ');
    await pumpFrames(tester, count: 4);
    expect(find.byKey(const Key('route-name')), findsOneWidget);
  });

  testWidgets('probeB: route-create + 4 pumps, no enterText', (tester) async {
    await pump(tester);
    await pumpFrames(tester, count: 20);
    await tapKey(tester, const Key('route-create'));
    expect(find.byKey(const Key('route-name')), findsOneWidget);
    await pumpFrames(tester, count: 4);
    expect(find.byKey(const Key('route-name')), findsOneWidget);
  });

  testWidgets('probeC: route-create + 20 pumps + enterText name + 4 pumps',
      (tester) async {
    await pump(tester);
    await pumpFrames(tester, count: 20);
    await tapKey(tester, const Key('route-create'));
    await pumpFrames(tester, count: 20);
    await tester.enterText(find.byKey(const Key('route-name')), 'สายทดสอบ');
    await pumpFrames(tester, count: 4);
    expect(find.byKey(const Key('route-name')), findsOneWidget);
  });

  testWidgets('probeD: openRoute1 + enterText name + 4 pumps', (tester) async {
    await pump(tester);
    await pumpFrames(tester, count: 20);
    final tile = find.byKey(const Key('route-1'));
    await tester.ensureVisible(tile);
    await pumpFrames(tester, count: 4);
    await tester.tap(tile);
    await pumpFrames(tester, count: 20);
    expect(find.byKey(const Key('route-name')), findsOneWidget);
    await tester.enterText(find.byKey(const Key('route-name')), 'สายเหนือใหม่');
    await pumpFrames(tester, count: 4);
    expect(find.byKey(const Key('route-name')), findsOneWidget);
  });
}
