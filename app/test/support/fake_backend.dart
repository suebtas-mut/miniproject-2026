import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app/core/network/api_client.dart';
import 'package:shuttle_app/core/providers.dart';
import 'package:shuttle_app/core/storage/token_storage.dart';
import 'package:shuttle_app/core/router/app_router.dart';
import 'package:shuttle_app/main.dart';

class FakeTokenStorage extends TokenStorage {
  FakeTokenStorage({this.token});

  String? token;

  @override
  Future<String?> readToken() async => token;

  @override
  Future<void> saveToken(String value) async {
    token = value;
  }

  @override
  Future<void> clearToken() async {
    token = null;
  }
}

class RecordedRequest {
  RecordedRequest({
    required this.method,
    required this.uri,
    required this.headers,
    required this.body,
  });

  final String method;
  final Uri uri;
  final Map<String, String> headers;
  final Object? body;

  Map<String, String> get query => uri.queryParameters;

  bool matches(String method, String path) =>
      this.method == method.toUpperCase() && uri.path == path;
}

typedef FakeRouteHandler = FutureOr<ResponseBody> Function(
  RecordedRequest request,
);

class FakeBackend implements HttpClientAdapter {
  final List<RecordedRequest> requests = [];
  final Map<String, FakeRouteHandler> _routes = {};

  void on(String method, String path, FakeRouteHandler handler) {
    _routes['${method.toUpperCase()} $path'] = handler;
  }

  List<RecordedRequest> requestsFor(String method, String path) =>
      requests.where((request) => request.matches(method, path)).toList();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    Object? body;
    if (requestStream != null) {
      final bytes = <int>[];
      await for (final chunk in requestStream) {
        bytes.addAll(chunk);
      }
      if (bytes.isNotEmpty) {
        final text = utf8.decode(bytes);
        try {
          body = jsonDecode(text);
        } on FormatException {
          body = text;
        }
      }
    }
    final request = RecordedRequest(
      method: options.method.toUpperCase(),
      uri: options.uri,
      headers: {
        for (final entry in options.headers.entries)
          entry.key.toLowerCase(): '${entry.value}',
      },
      body: body,
    );
    requests.add(request);
    final handler = _routes['${request.method} ${request.uri.path}'];
    if (handler == null) {
      return jsonResponse(404, {
        'code': 'NO_FAKE_ROUTE',
        'message': 'ไม่มีการจำลอง ${request.method} ${request.uri.path}',
      });
    }
    return handler(request);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(int status, Object? body) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

ResponseBody emptyResponse(int status) => ResponseBody.fromString('', status);

class ShuttleHarness {
  ShuttleHarness({
    required this.container,
    required this.backend,
    required this.storage,
  });

  final ProviderContainer container;
  final FakeBackend backend;
  final FakeTokenStorage storage;

  String get location => container
      .read(routerProvider)
      .routerDelegate
      .currentConfiguration
      .uri
      .path;
}

Future<void> pumpFrames(
  WidgetTester tester, {
  int count = 10,
  Duration step = const Duration(milliseconds: 50),
}) async {
  for (var i = 0; i < count; i++) {
    await tester.pump(step);
  }
}

Future<ShuttleHarness> pumpShuttle(
  WidgetTester tester, {
  String? token,
  String initialLocation = '/',
  Size? size,
  void Function(FakeBackend backend)? routes,
}) async {
  if (size != null) {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
  }
  final backend = FakeBackend();
  routes?.call(backend);
  final storage = FakeTokenStorage(token: token);
  final client = ApiClient(
    tokenStorage: storage,
    baseUrl: 'http://shuttle.test/api/v1',
  );
  client.dio.httpClientAdapter = backend;
  final container = ProviderContainer(
    overrides: [
      tokenStorageProvider.overrideWithValue(storage),
      apiClientProvider.overrideWithValue(client),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const ShuttleApp(),
    ),
  );
  await pumpFrames(tester);
  if (initialLocation != '/') {
    container.read(routerProvider).go(initialLocation);
    await pumpFrames(tester);
  }
  return ShuttleHarness(
    container: container,
    backend: backend,
    storage: storage,
  );
}
