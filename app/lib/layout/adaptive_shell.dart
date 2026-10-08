import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/account_menu.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/auth_models.dart';

/// รายการเมนูหลักของแอป — ข้อมูลเดียวกับ module ในตาราง `permission`
class ShellDestination {
  const ShellDestination({
    required this.path,
    required this.label,
    required this.icon,
  });

  final String path;
  final String label;
  final IconData icon;
}

/// คลาต้าลอสเมนูทั้งหมด — Dynamic Menu (T-023) จะกรองด้วยสิทธิ์จากเซิร์ฟเวอร์
const List<ShellDestination> kShellDestinations = [
  ShellDestination(path: '/', label: 'หน้าแรก', icon: Icons.home_outlined),
  ShellDestination(
      path: '/master', label: 'ข้อมูลหลัก', icon: Icons.badge_outlined),
  ShellDestination(
      path: '/front', label: 'เส้นทาง', icon: Icons.route_outlined),
  ShellDestination(
      path: '/booking', label: 'จองรถ', icon: Icons.event_seat_outlined),
  ShellDestination(
      path: '/driver', label: 'คนขับ', icon: Icons.drive_eta_outlined),
  ShellDestination(
      path: '/report', label: 'รายงาน', icon: Icons.bar_chart_outlined),
];

/// T-023 — Dynamic Menu: กรองเมนูตามสิทธิ์ที่เซิร์ฟเวอร์ให้มา
///
/// - หน้าแรก (`/`) แสดงเสมอ
/// - โมดูลอื่นแสดงก็ต่อเมื่อผู้ใช้มีสิทธิ์ในโมดูลนั้น (permission.module / modules)
/// - ไม่มีการตัดสินใจจากชื่อบทบาท — ข้อมูลทั้งหมดมาจาก AuthState ที่ server ส่งมา
List<ShellDestination> shellDestinationsFor(AuthState auth) {
  final accessible = auth.accessibleModules;
  return [
    for (final destination in kShellDestinations)
      if (destination.path == '/' ||
          accessible.contains(destination.path.substring(1)))
        destination,
  ];
}

/// T-013 — Adaptive Shell: มือถือใช้ NavigationBar · แท็บเล็ตใช้ NavigationRail
///
/// ความกว้าง >= 600dp ถือเป็นแท็บเล็ต (Material 3 medium breakpoint)
class AdaptiveShell extends ConsumerWidget {
  const AdaptiveShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  static const double tabletBreakpoint = 600;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final destinations = ref.watch(
      authControllerProvider.select(shellDestinationsFor),
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        final isTablet = constraints.maxWidth >= tabletBreakpoint;
        if (isTablet) {
          return _buildTablet(context, constraints.maxWidth, destinations);
        }
        return _buildPhone(context, destinations);
      },
    );
  }

  Widget _buildPhone(
      BuildContext context, List<ShellDestination> destinations) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: destinations.length >= 2
          ? NavigationBar(
              selectedIndex:
                  shell.currentIndex.clamp(0, destinations.length - 1),
              onDestinationSelected: _go,
              destinations: [
                for (final d in destinations)
                  NavigationDestination(
                    icon: Icon(d.icon),
                    label: d.label,
                  ),
              ],
            )
          : null,
    );
  }

  Widget _buildTablet(
    BuildContext context,
    double width,
    List<ShellDestination> destinations,
  ) {
    final extended = width >= 1024;
    return Scaffold(
      body: Row(
        children: [
          SafeArea(
            child: NavigationRail(
              selectedIndex:
                  shell.currentIndex.clamp(0, destinations.length - 1),
              onDestinationSelected: _go,
              extended: extended,
              leading: const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Icon(Icons.directions_bus, size: 32),
              ),
              destinations: [
                for (final d in destinations)
                  NavigationRailDestination(
                    icon: Icon(d.icon),
                    selectedIcon: Icon(d.icon),
                    label: Text(d.label),
                  ),
              ],
              trailing: const Padding(
                padding: EdgeInsets.only(top: 8),
                child: AccountMenu(),
              ),
            ),
          ),
          const VerticalDivider(width: 1, thickness: 1),
          Expanded(child: shell),
        ],
      ),
    );
  }

  void _go(int index) {
    shell.goBranch(
      index,
      // แตะ destination เดิมอีกครั้ง = กลับรากของ branch นั้น
      initialLocation: index == shell.currentIndex,
    );
  }
}
