import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/network/api_error.dart';
import 'driver_models.dart';
import 'driver_providers.dart';

/// debounce ตาม UC-25 — กันอ่าน QR ซ้ำจากกล้องภายใน 2 วินาที
/// (ชั้นแรก: `MobileScannerController(detectionTimeoutMs: 2000)`
/// ชั้นสอง: ตรวจสอบเวลาเองใน `_onCameraToken` ด้วย `clock` ที่ inject ได้)
const Duration kScanDebounce = Duration(seconds: 2);

/// กล้องจำลองสำหรับเทสต์เต็มเส้นทาง (override ด้วย ProviderContainer) —
/// ค่าเริ่มต้น `null` = ใช้ `MobileScanner` จริง
final scanQrCameraBuilderProvider =
    Provider<ScanQrCameraBuilder?>((ref) => null);

typedef ScanQrTokenCallback = void Function(String token);
typedef ScanQrCameraErrorCallback = void Function(MobileScannerException error);
typedef ScanQrCameraBuilder = Widget Function(
  BuildContext context,
  ScanQrTokenCallback onToken,
  ScanQrCameraErrorCallback onCameraError,
);

/// T-050 (UC-25 · จอ D3) — สแกน QR เช็คอินขึ้นรถ (BR-09)
///
/// - กล้องจริงด้วย `mobile_scanner` (debounce 2 วินาที) — ส่ง
///   `POST /driver/bookings/scan` `{qrToken, tripId}` (x-permission `QR.SCAN`)
/// - ผลแสดงด้วยข้อความของเซิร์ฟเวอร์: สำเร็จ (ชื่อ + จุดลง) ·
///   409 สแกนซ้ำ/ผิดรอบ · 404 ไม่พบ token · 403 ไม่มีสิทธิ์
/// - สถานะกล้อง: กำลังเปิด / ไม่ได้รับอนุญาต (permission denied) /
///   ไม่รองรับ (ไม่มีกล้อง) / เปิดไม่สำเร็จ — พร้อมปุ่มลองอีกครั้ง
/// - ทางสำรอง R5 (Emulator/กล้องเสีย): "กรอก Token เอง"
/// - [scannerBuilder]/[clock] inject ได้สำหรับเทสต์ (จำลองกล้อง/เวลา
///   โดยไม่พึ่งแพลตฟอร์มจริง — การทดสอบกล้องบนเครื่อง Android จริง
///   เป็นงานแยกต่างหาก)
class ScanQrScreen extends ConsumerStatefulWidget {
  const ScanQrScreen({
    super.key,
    required this.tripId,
    this.scannerBuilder,
    this.clock = DateTime.now,
  });

  final int tripId;

  /// จำลองกล้องในเทสต์ — ค่าเริ่มต้นสร้าง `MobileScanner` จริง
  final ScanQrCameraBuilder? scannerBuilder;

  /// นาฬิกาสำหรับ debounce — ค่าเริ่มต้นเวลาจริง, เทสต์ inject ได้
  final DateTime Function() clock;

  @override
  ConsumerState<ScanQrScreen> createState() => _ScanQrScreenState();
}

enum _CameraUiState { starting, denied, unavailable, failed }

class _ScanOutcome {
  const _ScanOutcome.success(this.result) : error = null;
  const _ScanOutcome.failure(this.error) : result = null;

  final CheckinResult? result;
  final String? error;

  bool get isOk => result != null;
}

class _ScanQrScreenState extends ConsumerState<ScanQrScreen> {
  MobileScannerController? _msController;
  _CameraUiState _cameraState = _CameraUiState.starting;
  String? _cameraMessage;
  bool _sending = false;
  _ScanOutcome? _result;
  DateTime? _lastCameraTokenAt;

  @override
  void dispose() {
    unawaited(_msController?.dispose());
    super.dispose();
  }

  Widget _defaultCamera(
    BuildContext context,
    ScanQrTokenCallback onToken,
    ScanQrCameraErrorCallback onCameraError,
  ) {
    final controller =
        _msController ??= MobileScannerController(detectionTimeoutMs: 2000);
    return MobileScanner(
      controller: controller,
      onDetect: (capture) {
        if (capture.barcodes.isEmpty) return;
        final raw = capture.barcodes.first.rawValue;
        if (raw != null && raw.isNotEmpty) onToken(raw);
      },
      errorBuilder: (context, error) {
        // แจ้งสถานะกล้องหลังจบเฟรม (กัน setState ระหว่าง build)
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) onCameraError(error);
        });
        return const SizedBox.shrink();
      },
    );
  }

  void _onCameraError(MobileScannerException error) {
    if (!mounted) return;
    setState(() {
      switch (error.errorCode) {
        case MobileScannerErrorCode.permissionDenied:
          _cameraState = _CameraUiState.denied;
        case MobileScannerErrorCode.unsupported:
          _cameraState = _CameraUiState.unavailable;
        default:
          _cameraState = _CameraUiState.failed;
      }
      _cameraMessage = error.errorDetails?.message;
    });
  }

  Future<void> _retryCamera() async {
    final old = _msController;
    _msController = null;
    if (old != null) {
      try {
        await old.dispose();
      } catch (_) {
        // เพิกเฉย — สร้าง controller ใหม่ในการ build ถัดไป
      }
    }
    if (!mounted) return;
    setState(() {
      _cameraState = _CameraUiState.starting;
      _cameraMessage = null;
    });
  }

  /// เส้นทางจากกล้อง — debounce 2 วินาที + กันซ้ำระหว่างส่ง
  void _onCameraToken(String raw) {
    final token = raw.trim();
    if (token.isEmpty || _sending) return;
    final now = widget.clock();
    final last = _lastCameraTokenAt;
    if (last != null && now.difference(last) < kScanDebounce) return;
    _lastCameraTokenAt = now;
    unawaited(_submitToken(token));
  }

  Future<void> _submitToken(String raw) async {
    final token = raw.trim();
    if (token.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final result = await ref.read(driverRepositoryProvider).scanCheckin(
            qrToken: token,
            tripId: widget.tripId,
          );
      if (!mounted) return;
      setState(() {
        _sending = false;
        _result = _ScanOutcome.success(result);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _result = _ScanOutcome.failure(describeFailure(error));
      });
    }
  }

  Future<void> _openManualEntry() async {
    final token = await showDialog<String>(
      context: context,
      builder: (dialogContext) => const _ManualEntryDialog(),
    );
    if (token == null || token.trim().isEmpty) return;
    unawaited(_submitToken(token));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final cameraBuilder = widget.scannerBuilder ??
        ref.watch(scanQrCameraBuilderProvider) ??
        _defaultCamera;
    final outcome = _result;

    return Scaffold(
      appBar: AppBar(title: const Text('สแกน QR ขึ้นรถ')),
      body: ListView(
        key: const Key('scan-body'),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              key: const Key('scan-camera-area'),
              height: 260,
              width: double.infinity,
              child: _buildCameraArea(context, cameraBuilder),
            ),
          ),
          if (_sending) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(key: Key('scan-sending')),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonal(
                  key: const Key('scan-manual-open'),
                  onPressed: _sending ? null : _openManualEntry,
                  child: const Text('กรอก Token เอง'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'R-05: กล้องไม่ทำงานบน Emulator? ใช้ "กรอก Token เอง" เป็นทางสำรอง',
            key: const Key('scan-r5-note'),
            style: theme.textTheme.bodySmall?.copyWith(color: scheme.outline),
          ),
          const SizedBox(height: 12),
          if (outcome != null) _resultBanner(context, outcome),
        ],
      ),
    );
  }

  Widget _buildCameraArea(
    BuildContext context,
    ScanQrCameraBuilder cameraBuilder,
  ) {
    switch (_cameraState) {
      case _CameraUiState.denied:
        return _cameraProblemPanel(
          context,
          icon: Icons.no_photography_outlined,
          title: 'ไม่ได้รับอนุญาตให้ใช้กล้อง',
          detail:
              'เปิดการตั้งค่าแอปเพื่ออนุญาตให้ใช้กล้อง หรือใช้ "กรอก Token เอง" '
              'เป็นทางสำรอง',
          retryKey: const Key('scan-cam-retry'),
        );
      case _CameraUiState.unavailable:
        return _cameraProblemPanel(
          context,
          icon: Icons.videocam_off_outlined,
          title: 'อุปกรณ์นี้ไม่สามารถสแกนด้วยกล้องได้',
          detail: 'ไม่พบกล้องหรือไม่รองรับการสแกน — ใช้ "กรอก Token เอง" แทน',
          retryKey: const Key('scan-cam-retry'),
        );
      case _CameraUiState.failed:
        return _cameraProblemPanel(
          context,
          icon: Icons.error_outline,
          title: 'เปิดกล้องไม่สำเร็จ',
          detail: _cameraMessage ?? 'กรุณาลองใหม่ หรือใช้ "กรอก Token เอง"',
          retryKey: const Key('scan-cam-retry'),
        );
      case _CameraUiState.starting:
        return cameraBuilder(context, _onCameraToken, _onCameraError);
    }
  }

  Widget _cameraProblemPanel(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String detail,
    required Key retryKey,
  }) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      key: const Key('scan-camera-problem'),
      color: scheme.surfaceContainerHighest,
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 40, color: scheme.outline),
          const SizedBox(height: 8),
          Text(
            title,
            key: const Key('scan-cam-title'),
            textAlign: TextAlign.center,
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            detail,
            key: const Key('scan-cam-detail'),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          FilledButton.tonalIcon(
            key: retryKey,
            onPressed: () => unawaited(_retryCamera()),
            icon: const Icon(Icons.refresh),
            label: const Text('ลองอีกครั้ง'),
          ),
        ],
      ),
    );
  }

  Widget _resultBanner(BuildContext context, _ScanOutcome outcome) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final success = outcome.isOk;
    final result = outcome.result;
    return Container(
      key: const Key('scan-banner'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: success ? scheme.primaryContainer : scheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            success ? Icons.check_circle_outline : Icons.error_outline,
            color: success ? scheme.primary : scheme.onErrorContainer,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  success
                      ? '${result!.message} — ${result.bookingCode} · '
                          '${result.customerName} · จุดลง ${result.boardStopName}'
                      : outcome.error!,
                  key: Key(success ? 'scan-banner-ok' : 'scan-banner-error'),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: success ? scheme.primary : scheme.onErrorContainer,
                  ),
                ),
                if (success && result!.checkinTime.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      'เวลา ${result.checkinTime} · ลำดับขึ้นรถ ${result.boardSeq}',
                      key: const Key('scan-banner-time'),
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ManualEntryDialog extends StatefulWidget {
  const _ManualEntryDialog();

  @override
  State<_ManualEntryDialog> createState() => _ManualEntryDialogState();
}

class _ManualEntryDialogState extends State<_ManualEntryDialog> {
  final _controller = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      key: const Key('scan-manual-dialog'),
      title: const Text('กรอก QR Token เอง'),
      content: Form(
        key: _formKey,
        child: TextFormField(
          key: const Key('scan-manual-field'),
          controller: _controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'QR Token',
            hintText: 'พิมพ์ค่าจาก QR ของผู้โดยสาร',
          ),
          validator: (value) => (value == null || value.trim().isEmpty)
              ? 'กรุณากรอก Token'
              : null,
        ),
      ),
      actions: [
        TextButton(
          key: const Key('scan-manual-cancel'),
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('ยกเลิก'),
        ),
        FilledButton(
          key: const Key('scan-manual-submit'),
          onPressed: () {
            if (!(_formKey.currentState?.validate() ?? false)) return;
            Navigator.of(context).pop(_controller.text);
          },
          child: const Text('ยืนยัน'),
        ),
      ],
    );
  }
}
