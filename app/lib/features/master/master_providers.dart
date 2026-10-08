import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'master_models.dart';
import 'master_repository.dart';

final masterRepositoryProvider = Provider<MasterRepository>(
  (ref) => MasterRepository(ref.watch(apiClientProvider)),
);

class EmployeeQuery {
  const EmployeeQuery({
    this.page = 1,
    this.pageSize = 10,
    this.search = '',
  });

  final int page;
  final int pageSize;
  final String search;

  EmployeeQuery copyWith({int? page, int? pageSize, String? search}) =>
      EmployeeQuery(
        page: page ?? this.page,
        pageSize: pageSize ?? this.pageSize,
        search: search ?? this.search,
      );

  @override
  bool operator ==(Object other) =>
      other is EmployeeQuery &&
      other.page == page &&
      other.pageSize == pageSize &&
      other.search == search;

  @override
  int get hashCode => Object.hash(page, pageSize, search);
}

class EmployeeQueryController extends Notifier<EmployeeQuery> {
  @override
  EmployeeQuery build() => const EmployeeQuery();

  void search(String value) {
    state = state.copyWith(search: value.trim(), page: 1);
  }

  void goToPage(int page) {
    state = state.copyWith(page: page < 1 ? 1 : page);
  }

  void reset() {
    state = const EmployeeQuery();
  }
}

final employeeQueryProvider =
    NotifierProvider<EmployeeQueryController, EmployeeQuery>(
  EmployeeQueryController.new,
);

final employeesProvider =
    FutureProvider.autoDispose.family<PagedEmployees, EmployeeQuery>(
  (ref, query) => ref.watch(masterRepositoryProvider).fetchEmployees(
        page: query.page,
        pageSize: query.pageSize,
        search: query.search.isEmpty ? null : query.search,
      ),
  name: 'employees',
);

final departmentsProvider = FutureProvider.autoDispose<List<Department>>(
  (ref) => ref.watch(masterRepositoryProvider).fetchDepartments(),
  name: 'departments',
);

final positionsProvider = FutureProvider.autoDispose<List<JobPosition>>(
  (ref) => ref.watch(masterRepositoryProvider).fetchPositions(),
  name: 'positions',
);

final rolesProvider = FutureProvider.autoDispose<List<Role>>(
  (ref) => ref.watch(masterRepositoryProvider).fetchRoles(),
  name: 'roles',
);

final permissionsProvider = FutureProvider.autoDispose<List<Permission>>(
  (ref) => ref.watch(masterRepositoryProvider).fetchPermissions(),
  name: 'permissions',
);

void refreshEmployees(WidgetRef ref) {
  ref.invalidate(employeesProvider(ref.read(employeeQueryProvider)));
}

void refreshDepartmentOptions(WidgetRef ref) {
  ref.invalidate(departmentsProvider);
  ref.invalidate(positionsProvider);
}

void refreshAllMasterLists(WidgetRef ref) {
  refreshEmployees(ref);
  refreshDepartmentOptions(ref);
  ref.invalidate(rolesProvider);
}
