import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// T-013 — เก็บ/อ่าน JWT ใน flutter_secure_storage (ห้ามเก็บใน prefs ธรรมดา)
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const String accessTokenKey = 'access_token';

  Future<void> saveToken(String token) =>
      _storage.write(key: accessTokenKey, value: token);

  Future<String?> readToken() => _storage.read(key: accessTokenKey);

  Future<void> clearToken() => _storage.delete(key: accessTokenKey);
}
