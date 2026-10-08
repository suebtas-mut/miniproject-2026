import '../../core/network/api_client.dart';
import '../../core/network/api_error.dart';
import 'master_models.dart';

class MasterRepository {
  MasterRepository(this._client);

  final ApiClient _client;

  Future<PagedEmployees> fetchEmployees({
    required int page,
    required int pageSize,
    String? search,
    int? deptId,
    int? positionId,
    int? roleId,
    bool activeOnly = true,
  }) async {
    final res = await _client.dio.get<dynamic>('/employees', queryParameters: {
      'page': page,
      'pageSize': pageSize,
      'activeOnly': activeOnly,
      if (search != null && search.isNotEmpty) 'search': search,
      if (deptId != null) 'deptId': deptId,
      if (positionId != null) 'positionId': positionId,
      if (roleId != null) 'roleId': roleId,
    });
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบรายชื่อพนักงานจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return PagedEmployees.fromJson(data);
  }

  Future<Employee> createEmployee(Map<String, dynamic> body) async {
    final res = await _client.dio.post<dynamic>('/employees', data: body);
    return _employee(res.data);
  }

  Future<Employee> updateEmployee(int empId, Map<String, dynamic> body) async {
    final res = await _client.dio.put<dynamic>('/employees/$empId', data: body);
    return _employee(res.data);
  }

  Future<void> deactivateEmployee(int empId) =>
      _client.dio.delete<void>('/employees/$empId');

  Future<List<Department>> fetchDepartments({bool activeOnly = true}) async {
    final res = await _client.dio.get<dynamic>('/departments',
        queryParameters: {'activeOnly': activeOnly});
    return parseDepartments(res.data);
  }

  Future<Department> createDepartment({required String deptName}) async {
    final res = await _client.dio
        .post<dynamic>('/departments', data: {'deptName': deptName});
    return _department(res.data);
  }

  Future<Department> updateDepartment(
    int deptId, {
    required String deptName,
  }) async {
    final res = await _client.dio
        .put<dynamic>('/departments/$deptId', data: {'deptName': deptName});
    return _department(res.data);
  }

  Future<void> deactivateDepartment(int deptId) =>
      _client.dio.delete<void>('/departments/$deptId');

  Future<List<JobPosition>> fetchPositions({int? deptId}) async {
    final res = await _client.dio.get<dynamic>('/positions',
        queryParameters: {if (deptId != null) 'deptId': deptId});
    return parsePositions(res.data);
  }

  Future<JobPosition> createPosition({
    required String positionName,
    required int deptId,
  }) async {
    final res = await _client.dio.post<dynamic>('/positions', data: {
      'positionName': positionName,
      'deptId': deptId,
    });
    return _position(res.data);
  }

  Future<JobPosition> updatePosition(
    int positionId, {
    required String positionName,
    required int deptId,
  }) async {
    final res = await _client.dio.put<dynamic>('/positions/$positionId', data: {
      'positionName': positionName,
      'deptId': deptId,
    });
    return _position(res.data);
  }

  Future<void> deactivatePosition(int positionId) =>
      _client.dio.delete<void>('/positions/$positionId');

  Future<List<Role>> fetchRoles() async {
    final res = await _client.dio.get<dynamic>('/roles');
    return parseRoles(res.data);
  }

  /// GET /permissions — 21 สิทธิ์ 5 โมดูล ใช้สร้างตารางติ๊ก (UC-09)
  Future<List<Permission>> fetchPermissions() async {
    final res = await _client.dio
        .get<dynamic>('/permissions', queryParameters: {'pageSize': 200});
    return parsePermissions(res.data);
  }

  /// GET /roles/{roleId}/permissions — สิทธิ์ปัจจุบันของบทบาท
  Future<RolePermissions> fetchRolePermissions(int roleId) async {
    final res = await _client.dio.get<dynamic>('/roles/$roleId/permissions');
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบสิทธิ์ของบทบาทจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return RolePermissions.fromJson(data);
  }

  /// PUT /roles/{roleId}/permissions — เขียนทั้งตาราง role_permission (UC-09)
  Future<int> saveRolePermissions(int roleId, List<int> permIds) async {
    final res =
        await _client.dio.put<dynamic>('/roles/$roleId/permissions', data: {
      'permIds': permIds,
    });
    final data = res.data;
    if (data is Map<String, dynamic> && data['permCount'] is num) {
      return (data['permCount'] as num).toInt();
    }
    return permIds.length;
  }

  Employee _employee(dynamic data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลพนักงานจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return Employee.fromJson(data);
  }

  Department _department(dynamic data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลแผนกจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return Department.fromJson(data);
  }

  JobPosition _position(dynamic data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลตำแหน่งจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return JobPosition.fromJson(data);
  }
}
