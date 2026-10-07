import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// รายการเมนูหลักของแอป — ข้อมูลเดียวกับ module ในตาราง `permission`
/// (หน้าจริงจะถูกกรองสิทธิ์อีกชั้นตอนทำ Dynamic Menu — T-023)
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

const List<ShellDestination> kShellDestinations = [
  ShellDestination(path: '/', label: 'หน้าแรก', icon: Icons.home_outlined),
  ShellDestination(path: '/master', label: 'ข้อมูลหลัก', icon: Icons.badge_outlined),
  ShellDestination(path: '/front', label: 'เส้นทาง', icon: Icons.route_outlined),
  ShellDestination(path: '/booking', label: 'จองรถ', icon: Icons.event_seat_outlined),
  ShellDestination(path: '/driver', label: 'คนขับ', icon: Icons.drive_eta_outlined),
  ShellDestination(path: '/report', label: 'รายงาน', icon: Icons.bar_chart_outlined),
];

/// T-013 — Adaptive Shell: มือถือใช้ NavigationBar · แท็บเล็ตใช้ NavigationRail
///
/// ความกว้าง >= 600dp ถือเป็นแท็บเล็ต (Material 3 medium breakpoint)
class AdaptiveShell extends StatelessWidget {
  const AdaptiveShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  static const double tabletBreakpoint = 600;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isTablet = constraints.maxWidth >= tabletBreakpoint;
        if (isTablet) {
          return _buildTablet(context, constraints.maxWidth);
        }
        return _buildPhone(context);
      },
    );
  }

  Widget _buildPhone(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex.clamp(0, kShellDestinations.length - 1),
        onDestinationSelected: _go,
        destinations: [
          for (final d in kShellDestinations)
            NavigationDestination(
              icon: Icon(d.icon),
              label: d.label,
            ),
        ],
      ),
    );
  }

  Widget _buildTablet(BuildContext context, double width) {
    final extended = width >= 1024;
    return Scaffold(
      body: Row(
        children: [
          SafeArea(
            child: NavigationRail(
              selectedIndex: shell.currentIndex.clamp(0, kShellDestinations.length - 1),
              onDestinationSelected: _go,
              extended: extended,
              leading: const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Icon(Icons.directions_bus, size: 32),
              ),
              destinations: [
                for (final d in kShellDestinations)
                  NavigationRailDestination(
                    icon: Icon(d.icon),
                    selectedIcon: Icon(d.icon),
                    label: Text(d.label),
                  ),
              ],
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
