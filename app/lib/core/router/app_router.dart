import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/change_password_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/auth/session_restoring_page.dart';
import '../../features/booking/booking_page.dart';
import '../../features/dashboard/home_page.dart';
import '../../features/driver/driver_page.dart';
import '../../features/front/front_page.dart';
import '../../features/master/master_page.dart';
import '../../features/report/report_page.dart';
import '../../layout/adaptive_shell.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_models.dart';

/// คีย์ที่เปลี่ยนเฉพาะเมื่อสถานะเซสชัน/สิทธิ์เปลี่ยน — ใช้ให้ router สร้างใหม่
/// เพื่อให้สาขา (branches) ตรงกับ Dynamic Menu โดยไม่ rebuild ตอนข้อความ snackbar เปลี่ยน
String _sessionMenuKey(AuthState state) => [
      state.status.name,
      state.modules.join(','),
      (state.permissions.map((p) => p.permCode).toList()..sort()).join(','),
    ].join('|');

Widget _pageFor(String path) {
  switch (path) {
    case '/':
      return const HomePage();
    case '/master':
      return const MasterPage();
    case '/front':
      return const FrontPage();
    case '/booking':
      return const BookingPage();
    case '/driver':
      return const DriverPage();
    case '/report':
      return const ReportPage();
    default:
      return const HomePage();
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final status =
      ref.watch(authControllerProvider.select((state) => state.status));
  // ทริกเกอร์ให้สร้าง router ใหม่เมื่อสิทธิ์/โมดูลเปลี่ยน (ไม่ใช่ตอนข้อความ snackbar เปลี่ยน)
  ref.watch(authControllerProvider.select(_sessionMenuKey));
  final auth = ref.read(authControllerProvider);
  final destinations = shellDestinationsFor(auth);
  final allowedModulePaths = {
    for (final destination in destinations)
      if (destination.path != '/') destination.path,
  };
  final modulePaths = {
    for (final destination in kShellDestinations)
      if (destination.path != '/') destination.path,
  };

  String? redirect(BuildContext context, GoRouterState state) {
    final location = state.matchedLocation;
    switch (status) {
      case AuthStatus.restoring:
        return location == '/splash' ? null : '/splash';
      case AuthStatus.unauthenticated:
        return location == '/login' ? null : '/login';
      case AuthStatus.authenticated:
        if (location == '/login' || location == '/splash') return '/';
        // กันเข้าโมดูลที่ไม่มีสิทธิ์โดยตรง (deep link) — ซ่อนเมนูอย่างเดียวไม่พอ
        final modulePath = '/${location.split('/').elementAt(1)}';
        if (modulePaths.contains(modulePath) &&
            !allowedModulePaths.contains(modulePath)) {
          return '/';
        }
        return null;
    }
  }

  return GoRouter(
    initialLocation: '/',
    redirect: redirect,
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SessionRestoringPage(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/account/change-password',
        builder: (context, state) => const ChangePasswordPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AdaptiveShell(shell: navigationShell),
        branches: [
          for (final destination in destinations)
            StatefulShellBranch(routes: [
              GoRoute(
                path: destination.path,
                builder: (context, state) => _pageFor(destination.path),
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
