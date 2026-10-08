import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../front/schedule_models.dart';
import '../master/widgets/list_states.dart';
import 'driver_models.dart';
import 'driver_providers.dart';
import 'scan_qr_screen.dart';
import 'trip_summary_screen.dart';

/// T-049/T-050/T-051 (UC-24/25/26 · จอ D2/D3/D4) — Manifest ผู้โดยสาร
/// ของรอบที่คนขับกำลังขับ + จุดเข้าสแกน QR + ปิดรอบ
///
/// - จัดกลุ่มผู้โดยสารตามจุดจอด (`boardSeq`/`alightSeq` = `stopSeq`) เรียงตาม
///   `stopSeq` — แสดง "ขุน/ลง กี่คน" รายจุดจอดพร้อมรายชื่อ (ตาม usecase UC-24)
/// - จุดจอดที่ผ่านแล้ว (ถึงเวลาแล้ว) → แสดงเครื่องหมาย ✓ `(ผ่านแล้ว)`
/// - จุดสุดท้าย → `(ปลายทาง)` · หัวข้อรวม `ผู้โดยสารขึ้นรถ n / m` (เช็คอินแล้ว/ทั้งหมด)
/// - `tripId` มาจากผล 201 `POST /driver/trips` (DriverTripBrief ไม่มี tripId)
/// - AppBar: `สแกน QR` (`QR.SCAN`) → จอ D3 · `ปิดรอบ` (`TRIP.END`) →
///   ยืนยัน BR-10 → `POST .../end` → หน้าสรุป D4 (UC-25/26)
class ManifestScreen extends ConsumerWidget {
  const ManifestScreen({super.key, required this.tripId});

  final int tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final manifestAsync = ref.watch(driverManifestProvider(tripId));
    final canScan = ref
        .watch(authControllerProvider.select((state) => state.can('QR.SCAN')));
    final canEnd = ref
        .watch(authControllerProvider.select((state) => state.can('TRIP.END')));
    final theme = Theme.of(context);
    final manifest = manifestAsync.valueOrNull;
    final isRunning = manifest?.tripStatus == 'running';
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              manifest == null
                  ? 'Manifest'
                  : 'รอบ ${manifest.departTime} · ${manifest.routeName}',
              key: const Key('drv-manifest-title'),
            ),
            Text('Manifest', style: theme.textTheme.bodySmall),
          ],
        ),
        actions: [
          if (isRunning && canScan)
            IconButton(
              key: const Key('drv-scan'),
              tooltip: 'สแกน QR ขึ้นรถ',
              icon: const Icon(Icons.qr_code_scanner),
              onPressed: () => unawaited(
                Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => ScanQrScreen(tripId: tripId),
                )),
              ),
            ),
          if (isRunning && canEnd)
            IconButton(
              key: const Key('drv-end-open'),
              tooltip: 'ปิดรอบการเดินทาง',
              icon: const Icon(Icons.task_alt),
              onPressed: () => unawaited(_confirmEnd(context, ref)),
            ),
        ],
      ),
      body: AsyncSection<DriverManifest>(
        value: manifestAsync,
        onRetry: () => ref.invalidate(driverManifestProvider(tripId)),
        builder: (data) => _buildManifest(context, data),
      ),
    );
  }

  /// UC-26 — ยืนยันปิดรอบ → `POST /driver/trips/{tripId}/end` (BR-10)
  /// สำเร็จ → invalidate + เปิดหน้าสรุป (D4) แทน Manifest
  Future<void> _confirmEnd(BuildContext context, WidgetRef ref) async {
    var submitting = false;
    var errorText = '';

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: !submitting,
        child: StatefulBuilder(
          builder: (dialogContext, setDialogState) => AlertDialog(
            key: const Key('drv-end-dialog'),
            title: const Text('ยืนยันการปิดรอบ?'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ปิดรอบการเดินทางนี้เมื่อถึงจุดปลายทางแล้ว '
                  'ไม่สามารถแก้ไขได้',
                ),
                const SizedBox(height: 8),
                const Text(
                  'การจองที่ยังรออยู่ (reserved) จะถูกเปลี่ยนเป็น '
                  'No Show ทันที (BR-10)',
                  key: Key('drv-end-br10-note'),
                ),
                if (errorText.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    errorText,
                    key: const Key('drv-end-error'),
                    style: TextStyle(
                      color: Theme.of(dialogContext).colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                key: const Key('drv-end-cancel'),
                onPressed: submitting
                    ? null
                    : () => Navigator.of(dialogContext).pop(false),
                child: const Text('ยกเลิก'),
              ),
              FilledButton(
                key: const Key('drv-end-confirm'),
                onPressed: submitting
                    ? null
                    : () async {
                        setDialogState(() => submitting = true);
                        try {
                          await ref
                              .read(driverRepositoryProvider)
                              .endTrip(tripId: tripId);
                          if (dialogContext.mounted) {
                            Navigator.of(dialogContext).pop(true);
                          }
                        } catch (error) {
                          if (dialogContext.mounted) {
                            setDialogState(() {
                              submitting = false;
                              errorText = describeFailure(error);
                            });
                          }
                        }
                      },
                child: const Text('ปิดรอบการเดินทาง'),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true || !context.mounted) return;
    final manifest = ref.read(driverManifestProvider(tripId)).valueOrNull;
    final serviceDate = manifest?.serviceDate;
    if (serviceDate != null && serviceDate.isNotEmpty) {
      ref.invalidate(driverTodayProvider(serviceDate));
    }
    ref.invalidate(driverManifestProvider(tripId));
    Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
      builder: (_) => TripSummaryScreen(tripId: tripId),
    ));
  }

  Widget _buildManifest(BuildContext context, DriverManifest manifest) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final now = DateTime.now();
    final stops = [...manifest.stops]
      ..sort((a, b) => a.stopSeq.compareTo(b.stopSeq));

    bool passed(ScheduleStop stop) {
      final arrive = DateTime.tryParse(stop.arriveAt);
      return arrive != null && !arrive.isAfter(now);
    }

    ScheduleStop? nextStop;
    for (final stop in stops) {
      if (!passed(stop)) {
        nextStop = stop;
        break;
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ผู้โดยสารขึ้นรถ '
                '${manifest.checkedInCount} / ${manifest.totalPassengers}',
                key: const Key('drv-manifest-boarded'),
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                key: const Key('drv-manifest-progress'),
                value: manifest.totalPassengers == 0
                    ? 0
                    : manifest.checkedInCount / manifest.totalPassengers,
              ),
              const SizedBox(height: 8),
              Text(
                nextStop == null
                    ? 'ถึงปลายทางแล้ว'
                    : 'ถัดไป: ${nextStop.stopName}',
                key: const Key('drv-manifest-next'),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            key: const Key('drv-manifest-list'),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              for (var index = 0; index < stops.length; index++)
                _stopSection(
                  context,
                  manifest,
                  stops[index],
                  isLast: index == stops.length - 1,
                  isPassed: passed(stops[index]),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _stopSection(
    BuildContext context,
    DriverManifest manifest,
    ScheduleStop stop, {
    required bool isLast,
    required bool isPassed,
  }) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final boards = [
      for (final passenger in manifest.passengers)
        if (passenger.boardSeq == stop.stopSeq) passenger,
    ];
    final alights = [
      for (final passenger in manifest.passengers)
        if (passenger.alightSeq == stop.stopSeq) passenger,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 16, bottom: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Flexible(
                child: Wrap(
                  spacing: 6,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      'จุดที่ ${stop.stopSeq} · ${stop.stopName}  '
                      '${stop.arriveTime}',
                      key: Key('drv-stop-${stop.stopSeq}-header'),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: scheme.primary,
                      ),
                    ),
                    if (isPassed) ...[
                      Icon(Icons.check, size: 14, color: scheme.primary),
                      Text(
                        '(ผ่านแล้ว)',
                        key: Key('drv-stop-${stop.stopSeq}-passed'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: scheme.primary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'ขึ้น ${boards.length} คน',
                    key: Key('drv-stop-${stop.stopSeq}-board'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: boards.isEmpty ? scheme.outline : scheme.primary,
                    ),
                  ),
                  Text(
                    'ลง ${alights.length} คน',
                    key: Key('drv-stop-${stop.stopSeq}-alight'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: scheme.outline,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (isLast)
          Text(
            '(ปลายทาง)',
            key: Key('drv-stop-${stop.stopSeq}-terminal'),
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.outline,
            ),
          ),
        if (boards.isNotEmpty)
          _passengerTable(
            context,
            boards,
            stopSeq: stop.stopSeq,
            isBoard: true,
          ),
        if (alights.isNotEmpty)
          _passengerTable(
            context,
            alights,
            stopSeq: stop.stopSeq,
            isBoard: false,
          ),
        const SizedBox(height: 4),
      ],
    );
  }

  Widget _passengerTable(
    BuildContext context,
    List<ManifestPassenger> passengers, {
    required int stopSeq,
    required bool isBoard,
  }) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                flex: 5,
                child: Text(
                  'ชื่อ',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: scheme.outline,
                  ),
                ),
              ),
              Expanded(
                flex: 2,
                child: Text(
                  'ที่นั่ง',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: scheme.outline,
                  ),
                ),
              ),
              Expanded(
                flex: 3,
                child: Text(
                  'สถานะ',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: scheme.outline,
                  ),
                ),
              ),
            ],
          ),
          for (final passenger in passengers)
            Builder(
              builder: (context) {
                final String statusText;
                final bool emphasize;
                if (isBoard) {
                  statusText =
                      passenger.checkedIn ? 'เช็คอินแล้ว' : 'รอเช็คอิน';
                  emphasize = passenger.checkedIn;
                } else {
                  statusText = 'รอลง';
                  emphasize = false;
                }
                return Padding(
                  key: Key(
                    'drv-stop-$stopSeq-${isBoard ? 'board' : 'alight'}'
                    '-${passenger.bookingCode}',
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 5,
                        child: Text(
                          passenger.customerName,
                          style: theme.textTheme.bodySmall,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          '${passenger.seats}',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          statusText,
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: emphasize ? scheme.primary : scheme.outline,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
