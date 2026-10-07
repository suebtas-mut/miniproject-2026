import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/login_page.dart';
import '../../features/booking/booking_page.dart';
import '../../features/dashboard/home_page.dart';
import '../../features/driver/driver_page.dart';
import '../../features/front/front_page.dart';
import '../../features/master/master_page.dart';
import '../../features/report/report_page.dart';
import '../../layout/adaptive_shell.dart';

/// T-013 — GoRouter: StatefulShellRoute 6 branches + /login
///
/// ยังไม่มี auth guard ในขั้นนี้ — Sprint 4 (T-015/T-017) จะเพิ่ม redirect
/// เมื่อมี JWT จริง
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AdaptiveShell(shell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const HomePage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/master',
              builder: (context, state) => const MasterPage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/front',
              builder: (context, state) => const FrontPage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/booking',
              builder: (context, state) => const BookingPage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/driver',
              builder: (context, state) => const DriverPage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/report',
              builder: (context, state) => const ReportPage(),
            ),
          ]),
        ],
      ),
    ],
    errorBuilder: (context, state) {
      return Scaffold(
        appBar: AppBar(title: const Text('ไม่พบหน้านี้')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('ไม่พบเส้นทาง: ${state.uri}'),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => context.go('/'),
                child: const Text('กลับหน้าแรก'),
              ),
            ],
          ),
        ),
      );
    },
  );
});
