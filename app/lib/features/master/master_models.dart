import '../../core/network/api_error.dart';

class Department {
  const Department({
    required this.deptId,
    required this.deptName,
    this.createdAt,
  });

  factory Department.fromJson(Map<String, dynamic> json) => Department(
        deptId: (json['deptId'] as num?)?.toInt() ?? 0,
        deptName: json['deptName'] as String? ?? '',
        createdAt: json['createdAt'] as String?,
      );

  final int deptId;
  final String deptName;
  final String? createdAt;
}

class JobPosition {
  const JobPosition({
    required this.positionId,
    required this.positionName,
    this.deptId,
    this.deptName,
    this.isActive = 1,
  });

  factory JobPosition.fromJson(Map<String, dynamic> json) => JobPosition(
        positionId: (json['positionId'] as num?)?.toInt() ?? 0,
        positionName: json['positionName'] as String? ?? '',
        deptId: (json['deptId'] as num?)?.toInt(),
        deptName: json['deptName'] as String?,
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
      );

  final int positionId;
  final String positionName;
  final int? deptId;
  final String? deptName;
  final int isActive;
}

class Employee {
  const Employee({
    required this.empId,
    required this.empCode,
    required this.firstName,
    required this.lastName,
    required this.username,
    this.phone,
    this.email,
    this.deptId,
    this.deptName,
    this.positionId,
    this.positionName,
    this.isActive = 1,
    this.createdAt,
    this.roles = const [],
  });

  factory Employee.fromJson(Map<String, dynamic> json) => Employee(
        empId: (json['empId'] as num?)?.toInt() ?? 0,
        empCode: json['empCode'] as String? ?? '',
        firstName: json['firstName'] as String? ?? '',
        lastName: json['lastName'] as String? ?? '',
        username: json['username'] as String? ?? '',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        deptId: (json['deptId'] as num?)?.toInt(),
        deptName: json['deptName'] as String?,
        positionId: (json['positionId'] as num?)?.toInt(),
        positionName: json['positionName'] as String?,
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
        createdAt: json['createdAt'] as String?,
        roles: [
          for (final role in (json['roles'] as List<dynamic>?) ?? const [])
            role.toString(),
        ],
      );

  final int empId;
  final String empCode;
  final String firstName;
  final String lastName;
  final String username;
  final String? phone;
  final String? email;
  final int? deptId;
  final String? deptName;
  final int? positionId;
  final String? positionName;
  final int isActive;
  final String? createdAt;
  final List<String> roles;

  String get fullName => '$firstName $lastName'.trim();
}

class PagedEmployees {
  const PagedEmployees({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  factory PagedEmployees.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    if (rawItems is! List) {
      throw const ApiException('รูปแบบรายชื่อพนักงานจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return PagedEmployees(
      items: [
        for (final item in rawItems)
          if (item is Map<String, dynamic>) Employee.fromJson(item),
      ],
      total: (json['total'] as num?)?.toInt() ?? rawItems.length,
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: (json['pageSize'] as num?)?.toInt() ?? rawItems.length,
    );
  }

  final List<Employee> items;
  final int total;
  final int page;
  final int pageSize;

  int get totalPages {
    if (pageSize <= 0) return 1;
    final pages = (total / pageSize).ceil();
    return pages < 1 ? 1 : pages;
  }
}

class Role {
  const Role({
    required this.roleId,
    required this.roleName,
    this.description,
    this.isActive = 1,
    this.permCount = 0,
    this.empCount = 0,
  });

  factory Role.fromJson(Map<String, dynamic> json) => Role(
        roleId: (json['roleId'] as num?)?.toInt() ?? 0,
        roleName: json['roleName'] as String? ?? '',
        description: json['description'] as String?,
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
        permCount: (json['permCount'] as num?)?.toInt() ?? 0,
        empCount: (json['empCount'] as num?)?.toInt() ?? 0,
      );

  final int roleId;
  final String roleName;
  final String? description;
  final int isActive;
  final int permCount;
  final int empCount;
}

List<dynamic> _expectList(dynamic data, String label) {
  if (data is List) return data;
  throw ApiException('รูปแบบ$labelจากเซิร์ฟเวอร์ไม่ถูกต้อง');
}

/// ตาราง `permission` — 21 สิทธิ์จริง 5 โมดูล (OpenAPI `Permission`)
class Permission {
  const Permission({
    required this.permId,
    required this.permCode,
    required this.permName,
    required this.module,
    this.screenKey,
    this.sortNo = 0,
  });

  factory Permission.fromJson(Map<String, dynamic> json) => Permission(
        permId: (json['permId'] as num?)?.toInt() ?? 0,
        permCode: json['permCode'] as String? ?? '',
        permName: json['permName'] as String? ?? '',
        module: json['module'] as String? ?? '',
        screenKey: json['screenKey'] as String?,
        sortNo: (json['sortNo'] as num?)?.toInt() ?? 0,
      );

  final int permId;
  final String permCode;
  final String permName;
  final String module;
  final String? screenKey;
  final int sortNo;
}

/// ผลลัพธ์ `GET /roles/{roleId}/permissions` (OpenAPI: roleId, roleName, permIds)
class RolePermissions {
  const RolePermissions({
    required this.roleId,
    required this.roleName,
    required this.permIds,
  });

  factory RolePermissions.fromJson(Map<String, dynamic> json) =>
      RolePermissions(
        roleId: (json['roleId'] as num?)?.toInt() ?? 0,
        roleName: json['roleName'] as String? ?? '',
        permIds: [
          for (final id in (json['permIds'] as List<dynamic>?) ?? const [])
            if (id is num) id.toInt(),
        ],
      );

  final int roleId;
  final String roleName;
  final List<int> permIds;
}

List<Department> parseDepartments(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อแผนก'))
        if (item is Map<String, dynamic>) Department.fromJson(item),
    ];

List<JobPosition> parsePositions(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อตำแหน่ง'))
        if (item is Map<String, dynamic>) JobPosition.fromJson(item),
    ];

List<Role> parseRoles(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อบทบาท'))
        if (item is Map<String, dynamic>) Role.fromJson(item),
    ];

List<Permission> parsePermissions(dynamic data) => [
      for (final item in _expectList(data, 'รายการสิทธิ์'))
        if (item is Map<String, dynamic>) Permission.fromJson(item),
    ];
