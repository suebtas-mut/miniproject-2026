import 'package:dio/dio.dart';

import '../storage/token_storage.dart';

class ApiClient {
  ApiClient({required TokenStorage tokenStorage, String? baseUrl})
      : dio = Dio(
          BaseOptions(
            baseUrl: baseUrl ??
                const String.fromEnvironment(
                  'API_URL',
                  defaultValue: String.fromEnvironment(
                    'API_BASE_URL',
                    defaultValue: 'http://10.0.2.2:3000/api/v1',
                  ),
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
          if (error.response?.statusCode == 401) {
            await tokenStorage.clearToken();
            onUnauthorized?.call();
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio dio;

  void Function()? onUnauthorized;
}
