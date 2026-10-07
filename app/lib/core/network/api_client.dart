import 'package:dio/dio.dart';

import '../storage/token_storage.dart';

/// T-013 — dio HttpClient พร้อม interceptor แนบ JWT และจัดการ 401
///
/// base URL ของแอป Android emulator ชี้ไป `10.0.2.2` (host loopback)
/// กำหนดซ้ำด้วย `--dart-define=API_BASE_URL=http://<host>:<port>` ได้
class ApiClient {
  ApiClient({required TokenStorage tokenStorage, String? baseUrl})
      : dio = Dio(
          BaseOptions(
            baseUrl: baseUrl ??
                const String.fromEnvironment(
                  'API_BASE_URL',
                  defaultValue: 'http://10.0.2.2:3000',
                ),
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 15),
            headers: {'Content-Type': 'application/json'},
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStorage.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          // token หมดอายุ/ถูก blacklist → เก็บไว้ให้ auth flow จัดการต่อ (Sprint 4)
          if (error.response?.statusCode == 401) {
            await tokenStorage.clearToken();
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio dio;
}
