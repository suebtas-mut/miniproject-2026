import 'dart:convert';

import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_error.dart';
import 'report_models.dart';

class ReportRepository {
  ReportRepository(this._client);

  final ApiClient _client;

  /// `GET /api/v1/reports/r1` (OpenAPI `reportR1`, x-permission `RPT.R1`)
  ///
  /// พารามิเตอร์ `from`/`to` เป็นวันที่คริสต์ศักราช `yyyy-MM-dd` (บังคับ) ·
  /// `routeId` ไม่บังคับ (กรองตามเส้นทาง)
  Future<ReportR1> fetchReportR1({
    required String from,
    required String to,
    int? routeId,
  }) async {
    final res = await _client.dio.get<dynamic>('/reports/r1', queryParameters: {
      'from': from,
      'to': to,
      if (routeId != null) 'routeId': routeId,
    });
    return parseReportR1(res.data);
  }

  /// `GET /api/v1/reports/r4` (OpenAPI `reportR4`, x-permission `RPT.R4`)
  ///
  /// `from`/`to` บังคับ — ไม่มี `routeId` (OpenAPI ไม่ระบุ)
  Future<ReportR4> fetchReportR4({
    required String from,
    required String to,
  }) async {
    final res = await _client.dio.get<dynamic>('/reports/r4', queryParameters: {
      'from': from,
      'to': to,
    });
    return parseReportR4(res.data);
  }

  /// `GET /api/v1/reports/r6` (OpenAPI `reportR6`, x-permission `RPT.R6`)
  ///
  /// `from`/`to` บังคับ — ไม่มี `routeId`
  Future<ReportR6> fetchReportR6({
    required String from,
    required String to,
  }) async {
    final res = await _client.dio.get<dynamic>('/reports/r6', queryParameters: {
      'from': from,
      'to': to,
    });
    return parseReportR6(res.data);
  }

  /// `GET /api/v1/reports/{reportId}/export?format=csv|xlsx` (UC-30)
  ///
  /// ใช้สิทธิ์ของรายงานเดียวกัน (`RPT.R{n}`) ตามสเปก ·
  /// คืน bytes ของไฟล์ + ชื่อจาก `Content-Disposition` (ถ้ามี)
  Future<ReportExportFile> exportReport(
    String reportId, {
    String format = 'csv',
  }) async {
    try {
      final res = await _client.dio.get<List<int>>(
        '/reports/$reportId/export',
        queryParameters: {'format': format},
        options: Options(responseType: ResponseType.bytes),
      );
      final disposition = res.headers.value('content-disposition') ?? '';
      final match = RegExp('filename="([^"]+)"').firstMatch(disposition);
      final fallbackName = switch (format) {
        'xlsx' => '${reportId.toUpperCase()}.xlsx',
        _ => '${reportId.toUpperCase()}.csv',
      };
      return ReportExportFile(
        format: format,
        fileName: match?.group(1) ?? fallbackName,
        bytes: res.data ?? const <int>[],
      );
    } on DioException catch (error) {
      // ResponseType.bytes ทำให้ error body ยังเป็น bytes — ถอดเป็น JSON
      // เพื่อดึง `message` ของเซิร์ฟเวอร์ (ถ้ามี) ก่อน rethrow
      final data = error.response?.data;
      if (data is List<int>) {
        try {
          final decoded = jsonDecode(utf8.decode(data));
          if (decoded is Map && decoded['message'] is String) {
            throw ApiException(decoded['message'] as String);
          }
        } on FormatException {
          // ไม่ใช่ JSON — fall through เป็น rethrow ด้านล่าง
        }
      }
      rethrow;
    }
  }
}
