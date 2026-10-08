import 'package:dio/dio.dart';

class ApiException implements Exception {
  const ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

String describeFailure(Object error) {
  if (error is DioException) return messageFromDio(error);
  if (error is ApiException) return error.message;
  if (error is FormatException) return error.message;
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

String messageFromDio(DioException error, {String? unauthorizedMessage}) {
  final data = error.response?.data;
  if (data is Map && data['message'] is String) {
    final message = (data['message'] as String).trim();
    if (message.isNotEmpty) return message;
  }
  switch (error.response?.statusCode) {
    case 400:
      return 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่';
    case 401:
      return unauthorizedMessage ?? 'กรุณาเข้าสู่ระบบ';
    case 403:
      return 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';
    case 404:
      return 'ไม่พบข้อมูลที่ระบุ';
    case 409:
      return 'ข้อมูลซ้ำกับที่มีอยู่ในระบบ';
    case 423:
      return 'บัญชีถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล';
    case 429:
      return 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
    default:
      if ((error.response?.statusCode ?? 0) >= 500) {
        return 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่';
      }
  }
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.connectionError:
    case DioExceptionType.unknown:
      return 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้';
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.sendTimeout:
      return 'เซิร์ฟเวอร์ใช้เวลาตอบสนองนานเกินไป';
    case DioExceptionType.badResponse:
      return 'เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง';
    case DioExceptionType.cancel:
      return 'คำขอถูกยกเลิก';
    case DioExceptionType.badCertificate:
      return 'การเชื่อมต่อไม่ปลอดภัย';
    case DioExceptionType.transformTimeout:
      return 'ข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง';
  }
}
