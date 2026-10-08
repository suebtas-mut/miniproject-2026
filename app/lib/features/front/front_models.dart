import '../../core/network/api_error.dart';

/// จุดจอด (`stop`) — OpenAPI `Stop`
class Stop {
  const Stop({
    required this.stopId,
    required this.stopName,
    this.address,
    this.latitude,
    this.longitude,
    this.isActive = 1,
  });

  factory Stop.fromJson(Map<String, dynamic> json) => Stop(
        stopId: (json['stopId'] as num?)?.toInt() ?? 0,
        stopName: json['stopName'] as String? ?? '',
        address: json['address'] as String?,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
      );

  final int stopId;
  final String stopName;
  final String? address;
  final double? latitude;
  final double? longitude;
  final int isActive;
}

/// จุดจุดของเส้นทาง (`route_stop`) — OpenAPI `RouteStop`
class RouteStop {
  const RouteStop({
    required this.stopSeq,
    required this.stopId,
    required this.stopName,
    required this.travelMinutes,
  });

  factory RouteStop.fromJson(Map<String, dynamic> json) => RouteStop(
        stopSeq: (json['stopSeq'] as num?)?.toInt() ?? 0,
        stopId: (json['stopId'] as num?)?.toInt() ?? 0,
        stopName: json['stopName'] as String? ?? '',
        travelMinutes: (json['travelMinutes'] as num?)?.toInt() ?? 0,
      );

  final int stopSeq;
  final int stopId;
  final String stopName;
  final int travelMinutes;
}

/// เส้นทาง (`route`) — OpenAPI `Route` = `RouteInput` + routeId/isActive/stops/stopCount
class Route {
  const Route({
    required this.routeId,
    required this.routeName,
    this.description,
    required this.totalMinutes,
    this.isActive = 1,
    this.stopCount,
    this.stops = const [],
  });

  factory Route.fromJson(Map<String, dynamic> json) => Route(
        routeId: (json['routeId'] as num?)?.toInt() ?? 0,
        routeName: json['routeName'] as String? ?? '',
        description: json['description'] as String?,
        totalMinutes: (json['totalMinutes'] as num?)?.toInt() ?? 0,
        isActive: (json['isActive'] as num?)?.toInt() ?? 1,
        stopCount: (json['stopCount'] as num?)?.toInt(),
        stops: [
          for (final item in (json['stops'] as List<dynamic>?) ?? const [])
            if (item is Map<String, dynamic>) RouteStop.fromJson(item),
        ],
      );

  final int routeId;
  final String routeName;
  final String? description;
  final int totalMinutes;
  final int isActive;
  final int? stopCount;
  final List<RouteStop> stops;

  int get resolvedStopCount => stopCount ?? stops.length;
}

List<Stop> parseStops(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อจุดจอด'))
        if (item is Map<String, dynamic>) Stop.fromJson(item),
    ];

List<Route> parseRoutes(dynamic data) => [
      for (final item in _expectList(data, 'รายชื่อเส้นทาง'))
        if (item is Map<String, dynamic>) Route.fromJson(item),
    ];

List<dynamic> _expectList(dynamic data, String label) {
  if (data is List) return data;
  throw ApiException('รูปแบบ$labelจากเซิร์ฟเวอร์ไม่ถูกต้อง');
}
