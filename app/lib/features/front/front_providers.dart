import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'front_models.dart';
import 'front_repository.dart';

final frontRepositoryProvider = Provider<FrontRepository>(
  (ref) => FrontRepository(ref.watch(apiClientProvider)),
);

/// รายชื่อจุดจอด — คีย์เป็นข้อความค้นหา (ค่าว่าง = ทั้งหมด)
final stopsProvider = FutureProvider.autoDispose.family<List<Stop>, String>(
  (ref, search) =>
      ref.watch(frontRepositoryProvider).fetchStops(search: search),
  name: 'stops',
);

/// รายชื่อเส้นทางพร้อมจุดจอด (`includeStops=true`)
final routesProvider = FutureProvider.autoDispose<List<Route>>(
  (ref) => ref.watch(frontRepositoryProvider).fetchRoutes(),
  name: 'routes',
);

void refreshStops(WidgetRef ref, {String search = ''}) {
  ref.invalidate(stopsProvider(search));
}

void refreshRoutes(WidgetRef ref) {
  ref.invalidate(routesProvider);
}
