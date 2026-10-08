import '../../core/network/api_client.dart';
import '../../core/network/api_error.dart';
import 'front_models.dart';

/// F1 (UC-11/UC-12) — จุดจอด + เส้นทาง ตาม `docs/api/openapi.yaml`
class FrontRepository {
  FrontRepository(this._client);

  final ApiClient _client;

  /// GET /stops — ค้นจาก `stopName`/`address` ได้ (OpenAPI `search`)
  Future<List<Stop>> fetchStops({
    String? search,
    bool activeOnly = true,
  }) async {
    final res = await _client.dio.get<dynamic>('/stops', queryParameters: {
      'activeOnly': activeOnly,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return parseStops(res.data);
  }

  /// POST /stops — x-permission ROUTE.EDIT · 409 เมื่อ `stopName` ซ้ำ
  Future<Stop> createStop(Map<String, dynamic> body) async {
    final res = await _client.dio.post<dynamic>('/stops', data: body);
    return _stop(res.data);
  }

  /// PUT /stops/{stopId} — x-permission ROUTE.EDIT
  Future<Stop> updateStop(int stopId, Map<String, dynamic> body) async {
    final res = await _client.dio.put<dynamic>('/stops/$stopId', data: body);
    return _stop(res.data);
  }

  /// DELETE /stops/{stopId} — ปิดใช้งาน (204) · 409 เมื่อยังมีเส้นทาง/รอบอ้างอิง
  Future<void> deactivateStop(int stopId) =>
      _client.dio.delete<void>('/stops/$stopId');

  /// GET /routes — `includeStops=true` เพื่อใช้แสดง/แก้ลำดับจุดจอดในลิสต์เดียว
  Future<List<Route>> fetchRoutes({
    bool includeStops = true,
    bool activeOnly = true,
  }) async {
    final res = await _client.dio.get<dynamic>('/routes', queryParameters: {
      'activeOnly': activeOnly,
      'includeStops': includeStops,
    });
    return parseRoutes(res.data);
  }

  Future<Route> fetchRoute(int routeId) async {
    final res = await _client.dio.get<dynamic>('/routes/$routeId');
    return _route(res.data);
  }

  /// POST /routes — สร้างพร้อมจุดจอดในคำสั่งเดียว (BR-01: totalMinutes = SUM)
  Future<Route> createRoute(Map<String, dynamic> body) async {
    final res = await _client.dio.post<dynamic>('/routes', data: body);
    return _route(res.data);
  }

  /// PUT /routes/{routeId} — เขียนทั้งรายการจุดจอดตามลำดับอาร์เรย์ (BR-01/BR-03)
  Future<Route> updateRoute(int routeId, Map<String, dynamic> body) async {
    final res = await _client.dio.put<dynamic>('/routes/$routeId', data: body);
    return _route(res.data);
  }

  Stop _stop(dynamic data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลจุดจอดจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return Stop.fromJson(data);
  }

  Route _route(dynamic data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiException('รูปแบบข้อมูลเส้นทางจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return Route.fromJson(data);
  }
}
