enum AuthStatus { restoring, unauthenticated, authenticated }

/// โมดูลตาม `PermissionModule` enum ใน OpenAPI (5 โมดูล)
/// ลำดับนี้คือลำดับเมนูคงที่ของ Dynamic Menu (T-023)
const kPermissionModules = ['master', 'front', 'booking', 'driver', 'report'];

class SessionUser {
  const SessionUser({
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
    this.roles = const [],
  });

  factory SessionUser.fromJson(Map<String, dynamic> json) => SessionUser(
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
  final List<String> roles;

  String get fullName {
    final name = '$firstName $lastName'.trim();
    return name.isEmpty ? username : name;
  }
}

class SessionPermission {
  const SessionPermission({
    required this.permCode,
    required this.permName,
    required this.module,
    this.screenKey,
    this.sortNo = 0,
  });

  factory SessionPermission.fromJson(Map<String, dynamic> json) =>
      SessionPermission(
        permCode: json['permCode'] as String? ?? '',
        permName: json['permName'] as String? ?? '',
        module: json['module'] as String? ?? '',
        screenKey: json['screenKey'] as String?,
        sortNo: (json['sortNo'] as num?)?.toInt() ?? 0,
      );

  final String permCode;
  final String permName;
  final String module;
  final String? screenKey;
  final int sortNo;
}

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.token,
    this.roles = const [],
    this.permissions = const [],
    this.modules = const [],
    this.message,
  });

  factory AuthState.authenticatedFrom(String token, Map<String, dynamic> json) {
    final userJson = json['user'];
    return AuthState(
      status: AuthStatus.authenticated,
      token: token,
      user: userJson is Map<String, dynamic>
          ? SessionUser.fromJson(userJson)
          : null,
      roles: [
        for (final role in (json['roles'] as List<dynamic>?) ?? const [])
          role.toString(),
      ],
      permissions: [
        for (final permission
            in (json['permissions'] as List<dynamic>?) ?? const [])
          if (permission is Map<String, dynamic>)
            SessionPermission.fromJson(permission),
      ],
      modules: [
        for (final module in (json['modules'] as List<dynamic>?) ?? const [])
          module.toString(),
      ],
    );
  }

  final AuthStatus status;
  final SessionUser? user;
  final String? token;
  final List<String> roles;
  final List<SessionPermission> permissions;
  final List<String> modules;
  final String? message;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({String? message, bool clearMessage = false}) => AuthState(
        status: status,
        user: user,
        token: token,
        roles: roles,
        permissions: permissions,
        modules: modules,
        message: clearMessage ? null : (message ?? this.message),
      );
}

/// สิทธิ์จากเซิร์ฟเวอร์ (T-023) — ห้ามตัดสินใจจากชื่อบทบาท (ไม่มี if role == 'admin')
extension AuthStatePermissions on AuthState {
  /// `permCode` ทั้งหมดของเซสชันนี้ เช่น `EMP.VIEW`
  Set<String> get permCodes =>
      {for (final permission in permissions) permission.permCode};

  /// มีสิทธิ์นี้หรือไม่ — ใช้ซ่อนปุ่ม/เมนูที่ผู้ใช้ไม่มีสิทธิ์
  bool can(String permCode) => permCodes.contains(permCode);

  /// โมดูลที่ผู้ใช้เข้าถึงได้ = `modules` จากเซิร์ฟเวอร์ ∪ โมดูลของสิทธิ์ที่มี
  /// คืนค่าเป็นลำดับตาม [kPermissionModules] เสมอ
  Set<String> get accessibleModules {
    final granted = <String>{
      ...modules,
      for (final permission in permissions) permission.module,
    };
    return {
      for (final module in kPermissionModules)
        if (granted.contains(module)) module,
    };
  }
}
