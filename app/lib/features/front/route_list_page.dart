import 'package:flutter/material.dart' hide Route;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import 'front_models.dart';
import 'front_providers.dart';
import 'route_editor_page.dart';
import '../master/widgets/list_states.dart';

/// UC-12 — รายการเส้นทาง (`/routes?includeStops=true`)
/// กดแถวเพื่อดู/แก้ไขลำดับจุดจอด (เปิด `RouteEditorPage`)
class RouteListPage extends ConsumerWidget {
  const RouteListPage({super.key});

  Future<void> _openEditor(
    BuildContext context,
    WidgetRef ref, {
    Route? route,
  }) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (context) => RouteEditorPage(route: route),
      ),
    );
    if (!context.mounted) return;
    if (saved == true) {
      refreshRoutes(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกเส้นทางแล้ว')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routes = ref.watch(routesProvider);
    // T-023/T-028 — ซ่อนปุ่มเพิ่มเส้นทางที่ไม่มีสิทธิ์ ROUTE.EDIT
    final canEdit = ref.watch(
        authControllerProvider.select((state) => state.can('ROUTE.EDIT')));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'เส้นทางทั้งหมด',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (canEdit)
                FilledButton.icon(
                  key: const Key('route-create'),
                  onPressed: () => _openEditor(context, ref),
                  icon: const Icon(Icons.add),
                  label: const Text('เพิ่มเส้นทาง'),
                ),
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<List<Route>>(
            value: routes,
            onRetry: () => ref.invalidate(routesProvider),
            builder: (items) {
              if (items.isEmpty) {
                return const EmptyState(message: 'ยังไม่มีเส้นทางในระบบ');
              }
              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final route = items[index];
                  return ListTile(
                    key: Key('route-${route.routeId}'),
                    leading: const Icon(Icons.route_outlined),
                    title: Text(route.routeName),
                    subtitle: Text(
                      '${route.resolvedStopCount} จุดจอด · '
                      '${route.totalMinutes} นาที',
                      key: Key('route-summary-${route.routeId}'),
                    ),
                    trailing: canEdit
                        ? IconButton(
                            tooltip: 'แก้ไข',
                            icon: const Icon(Icons.edit_outlined),
                            onPressed: () =>
                                _openEditor(context, ref, route: route),
                          )
                        : const Icon(Icons.chevron_right),
                    onTap: () => _openEditor(context, ref, route: route),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
