import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../master/master_providers.dart';
import 'schedule_models.dart';
import 'schedule_repository.dart';

final scheduleRepositoryProvider = Provider<ScheduleRepository>(
  (ref) => ScheduleRepository(ref.watch(apiClientProvider)),
);

/// คีย์รอบเวลา: `serviceDate|routeId` (routeId ว่าง = ทุกเส้นทาง)
String scheduleQueryKey(String serviceDate, int? routeId) =>
    '$serviceDate|${routeId ?? ''}';

/// รายชื่อรอบเวลา — กรองตามวัน (`serviceDate`) และเส้นทาง (`routeId`)
final schedulesProvider =
    FutureProvider.autoDispose.family<List<Schedule>, String>(
  (ref, key) {
    final separator = key.indexOf('|');
    final serviceDate = separator < 0 ? key : key.substring(0, separator);
    final routeIdText = separator < 0 ? '' : key.substring(separator + 1);
    return ref.watch(scheduleRepositoryProvider).fetchSchedules(
          serviceDate: serviceDate,
          routeId: int.tryParse(routeIdText),
        );
  },
  name: 'schedules',
);

/// รายชื่อรถ (`GET /vehicles`)
final vehiclesProvider = FutureProvider.autoDispose<List<Vehicle>>(
  (ref) => ref.watch(scheduleRepositoryProvider).fetchVehicles(),
  name: 'vehicles',
);

/// รายชื่อประเภทรถ (`GET /vehicle-types`)
final vehicleTypesProvider = FutureProvider.autoDispose<List<VehicleType>>(
  (ref) => ref.watch(scheduleRepositoryProvider).fetchVehicleTypes(),
  name: 'vehicleTypes',
);

/// รายชื่อคนขับ — หา roleId ของบทบาท `DRIVER` แล้วกรองพนักงานด้วย `roleId`
final driversProvider = FutureProvider.autoDispose<List<EmployeeBrief>>(
  (ref) async {
    final master = ref.watch(masterRepositoryProvider);
    final roles = await master.fetchRoles();
    int? driverRoleId;
    for (final role in roles) {
      if (role.roleName == 'DRIVER' && role.isActive == 1) {
        driverRoleId = role.roleId;
        break;
      }
    }
    if (driverRoleId == null) return const <EmployeeBrief>[];
    final page = await master.fetchEmployees(
      page: 1,
      pageSize: 200,
      roleId: driverRoleId,
    );
    return [
      for (final employee in page.items)
        EmployeeBrief(
          empId: employee.empId,
          empCode: employee.empCode,
          fullName: employee.fullName,
        ),
    ];
  },
  name: 'drivers',
);

void refreshSchedules(WidgetRef ref, {required String key}) {
  ref.invalidate(schedulesProvider(key));
}

void refreshVehicles(WidgetRef ref) {
  ref.invalidate(vehiclesProvider);
}

void refreshVehicleTypes(WidgetRef ref) {
  ref.invalidate(vehicleTypesProvider);
}
