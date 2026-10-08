import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/account_menu.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import 'route_list_page.dart';
import 'schedule_list_page.dart';
import 'stop_list_page.dart';
import 'vehicle_list_page.dart';

/// หน้าแรกโมดูลหน้า (front) — ต้องมีสิทธิ์ ROUTE.VIEW (OpenAPI `x-permission`)
///
/// แท็บ: เส้นทาง (UC-12) / จุดจอด (UC-11) / รอบเวลา (UC-14/15/16) / รถ (UC-13)
/// — สลับแท็บด้วย state ของหน้าเอง และแสดงผลด้วย IndexedStack
/// เพื่อเก็บสถานะทุกแท็บไว้ (กัน build-phase exception ของ TabBarView)
class FrontPage extends ConsumerStatefulWidget {
  const FrontPage({super.key});

  @override
  ConsumerState<FrontPage> createState() => _FrontPageState();
}

class _FrontPageState extends ConsumerState<FrontPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 4, vsync: this);
  int _tabIndex = 0;

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canView = ref.watch(
        authControllerProvider.select((state) => state.can('ROUTE.VIEW')));
    if (!canView) {
      return const Center(
        child: Text('ไม่มีสิทธิ์เข้าถึงส่วนนี้', key: Key('front-forbidden')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('เส้นทางและจุดจอด'),
        actions: const [AccountMenu()],
        bottom: TabBar(
          controller: _tabController,
          onTap: (index) => setState(() => _tabIndex = index),
          tabs: const [
            Tab(text: 'เส้นทาง', key: Key('front-tab-routes')),
            Tab(text: 'จุดจอด', key: Key('front-tab-stops')),
            Tab(text: 'รอบเวลา', key: Key('front-tab-schedule')),
            Tab(text: 'รถ', key: Key('front-tab-vehicles')),
          ],
        ),
      ),
      body: IndexedStack(
        index: _tabIndex,
        children: const [
          SizedBox.expand(child: RouteListPage()),
          SizedBox.expand(child: StopListPage()),
          SizedBox.expand(child: ScheduleListPage()),
          SizedBox.expand(child: VehicleListPage()),
        ],
      ),
    );
  }
}
