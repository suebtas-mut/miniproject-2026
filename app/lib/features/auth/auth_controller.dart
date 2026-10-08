import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_error.dart';
import '../../core/providers.dart';
import 'auth_models.dart';

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  ApiClient get _api => ref.read(apiClientProvider);

  @override
  AuthState build() {
    _api.onUnauthorized = _handleUnauthorized;
    Future.microtask(restoreSession);
    return const AuthState(status: AuthStatus.restoring);
  }

  Future<void> restoreSession() async {
    final storage = ref.read(tokenStorageProvider);
    String? token;
    try {
      token = await storage.readToken();
    } catch (_) {
      token = null;
    }
    if (token == null || token.isEmpty) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final res = await _api.dio.get<dynamic>('/auth/me');
      final data = res.data;
      state = data is Map<String, dynamic> &&
              data['user'] is Map<String, dynamic> &&
              data['permissions'] is List
          ? AuthState.authenticatedFrom(token, data)
          : const AuthState(
              status: AuthStatus.unauthenticated,
              message: 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
            );
      if (!state.isAuthenticated) {
        await storage.clearToken();
      }
    } on DioException catch (e) {
      final statusCode = e.response?.statusCode;
      if (statusCode == 401 || statusCode == 403) {
        await storage.clearToken();
        state = const AuthState(
          status: AuthStatus.unauthenticated,
          message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
        );
      } else {
        state = AuthState(
          status: AuthStatus.unauthenticated,
          message: describeFailure(e),
        );
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<String?> login({
    required String username,
    required String password,
  }) async {
    try {
      final res = await _api.dio.post<dynamic>('/auth/login', data: {
        'username': username,
        'password': password,
      });
      final data = res.data;
      if (data is! Map<String, dynamic> ||
          data['user'] is! Map<String, dynamic> ||
          data['permissions'] is! List) {
        return 'รูปแบบคำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง';
      }
      final token = data['token'];
      if (token is! String || token.isEmpty) {
        return 'ไม่ได้รับ token จากเซิร์ฟเวอร์';
      }
      await ref.read(tokenStorageProvider).saveToken(token);
      state = AuthState.authenticatedFrom(token, data);
      return null;
    } on DioException catch (e) {
      final message = messageFromDio(
        e,
        unauthorizedMessage: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      );
      state = state.copyWith(message: message);
      return message;
    } catch (_) {
      const message = 'รูปแบบคำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง';
      state = state.copyWith(message: message);
      return message;
    }
  }

  Future<String?> logout() async {
    String? warning;
    try {
      await _api.dio.post<void>('/auth/logout');
    } on DioException catch (e) {
      if (e.response?.statusCode != 401) {
        warning =
            'ยกเลิก token ฝั่งเซิร์ฟเวอร์ไม่สำเร็จ: ${describeFailure(e)}';
      }
    }
    await ref.read(tokenStorageProvider).clearToken();
    state = AuthState(status: AuthStatus.unauthenticated, message: warning);
    return warning;
  }

  Future<String?> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    try {
      await _api.dio.post<void>('/auth/change-password', data: {
        'oldPassword': oldPassword,
        'newPassword': newPassword,
      });
      await ref.read(tokenStorageProvider).clearToken();
      state = const AuthState(
        status: AuthStatus.unauthenticated,
        message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่',
      );
      return null;
    } on DioException catch (e) {
      return describeFailure(e);
    }
  }

  void clearMessage() {
    if (state.message != null) {
      state = state.copyWith(clearMessage: true);
    }
  }

  void _handleUnauthorized() {
    if (state.status == AuthStatus.authenticated) {
      state = const AuthState(
        status: AuthStatus.unauthenticated,
        message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
      );
    }
  }
}
