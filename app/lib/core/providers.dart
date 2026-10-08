import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'network/api_client.dart';
import 'storage/token_storage.dart';

/// Riverpod providers ระดับแอป (singleton ต่อ ProviderScope หนึ่งชุด)
final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(tokenStorage: ref.watch(tokenStorageProvider)),
);
