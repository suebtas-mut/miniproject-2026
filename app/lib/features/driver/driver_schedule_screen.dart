import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../front/schedule_providers.dart';
import '../master/widgets/list_states.dart';
import 'driver_models.dart';
import 'driver_providers.dart';
import 'manifest_screen.dart';
import 'trip_summary_screen.dart';

/// T-048 (UC-22/23 · จอ D1) — ตารางงานรายวันของคนขับ
///
/// - เห็นเฉพาะรอบของตัวเอง (เซิร์ฟเวอร์กรองด้วย empId ของ token)
/// - เริ่มรอบด้วย `POST /driver/trips` (x-permission `TRIP.START`):
///   ดึง `vehicle.vehId` จาก `GET /schedules/{schedId}` แล้วส่ง `{schedId, vehId}`
/// - ตรวจ conflict BR-04 ฝั่งไคลเอนต์ก่อน POST — ถ้ามีรอบ `running` ของคนขับ
///   คนเดียวกันค้างอยู่ → แจ้งเตือนพร้อมทางเลือก "ปิดรอบเก่าก่อน"
///   (ต้องมีสิทธิ์ `TRIP.END` และทราบรอบ `tripId` จาก `startedTripsProvider`)
///   หรือ "ออก" — ไม่ส่ง POST ทั้งคู่
/// - เริ่มสำเร็จ → เก็บ `tripId` จากผล 201 แล้วเปิด Manifest (UC-24)
/// - ข้อจำกัดสัญญา: `DriverTripBrief` ไม่มี `tripId` จึงเปิด Manifest ซ้ำได้
///   เฉพาะรอบที่เริ่มจากเครื่องนี้ในรอบใช้งานนี้
class DriverScheduleScreen extends ConsumerStatefulWidget {
  const DriverScheduleScreen({super.key});

  @override
  ConsumerState<DriverScheduleScreen> createState() =>
      _DriverScheduleScreenState();
}

class _DriverScheduleScreenState extends ConsumerState<DriverScheduleScreen> {
  /// วันที่ขอจากเซิร์ฟเวอร์ — วันนี้ตามเครื่อง (รูปแบบ yyyy-MM-dd)
  final String _serviceDate = _todayIso();

  int? _selectedSchedId;
  int? _filterRouteId;
  bool _submitting = false;

  static String _todayIso() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-'
        '${now.month.toString().padLeft(2, '0')}-'
        '${now.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final dayAsync = ref.watch(driverTodayProvider(_serviceDate));
    final canStart = ref.watch(
        authControllerProvider.select((state) => state.can('TRIP.START')));
    final day = dayAsync.valueOrNull;
    final selected = day == null ? null : _pickSelected(day.trips);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('ตารางงานวันนี้'),
            Text(
              day == null ? 'คนขับ' : 'คนขับ · ${day.serviceDate}',
              key: const Key('drv-appbar-date'),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
      body: AsyncSection<DriverDay>(
        value: dayAsync,
        onRetry: () => ref.invalidate(driverTodayProvider(_serviceDate)),
        builder: (data) => _buildDay(context, data, selected: selected),
      ),
      bottomNavigationBar: selected == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: FilledButton(
                  key: const Key('drv-start'),
                  onPressed: canStart && !_submitting
                      ? () => _startTrip(selected)
                      : null,
                  child: Text(_submitting
                      ? 'กำลังเริ่มเดินทาง...'
                      : 'เริ่มเดินทางรอบ ${selected.departTime}'),
                ),
              ),
            ),
    );
  }

  /// รอบที่เลือก — ค่าเริ่มต้น = รอบ "upcoming" แรกตามลำดับที่เซิร์ฟเวอร์ส่ง
  DriverTripBrief? _pickSelected(List<DriverTripBrief> trips) {
    DriverTripBrief? firstUpcoming;
    DriverTripBrief? chosen;
    for (final trip in trips) {
      if (!trip.isUpcoming) continue;
      firstUpcoming ??= trip;
      if (trip.schedId == _selectedSchedId) chosen = trip;
    }
    return chosen ?? firstUpcoming;
  }

  Future<void> _startTrip(DriverTripBrief trip) async {
    final day = ref.read(driverTodayProvider(_serviceDate)).valueOrNull;
    if (day != null) {
      DriverTripBrief? other;
      for (final running in day.runningTrips) {
        if (running.schedId != trip.schedId) {
          other = running;
          break;
        }
      }
      if (other != null) {
        final proceed = await _showConflictDialog(other);
        if (!proceed) return;
      }
    }
    setState(() => _submitting = true);
    try {
      final schedule = await ref
          .read(scheduleRepositoryProvider)
          .fetchSchedule(trip.schedId);
      final vehId = schedule.vehicle?.vehId;
      if (vehId == null) {
        throw const ApiException('ไม่พบรถที่จัดไว้สำหรับรอบนี้');
      }
      final started = await ref
          .read(driverRepositoryProvider)
          .startTrip(schedId: trip.schedId, vehId: vehId);
      ref
          .read(startedTripsProvider.notifier)
          .update((all) => {...all, trip.schedId: started.tripId});
      ref.invalidate(driverTodayProvider(_serviceDate));
      if (!mounted) return;
      setState(() => _submitting = false);
      unawaited(Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => ManifestScreen(tripId: started.tripId),
      )));
    } catch (error) {
      ref.invalidate(driverTodayProvider(_serviceDate));
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(describeFailure(error))),
      );
    }
  }

  /// Conflict Alert (UC-23 · BR-04) — แสดงเมื่อมีรอบ `running` อื่นค้างอยู่
  /// คืนค่า `true` = "ปิดรอบเก่าก่อน" สำเร็จ → เริ่มรอบต่อได้
  Future<bool> _showConflictDialog(DriverTripBrief other) async {
    final canEnd = ref.read(authControllerProvider).can('TRIP.END');
    final cachedTripId = ref.read(startedTripsProvider)[other.schedId];
    final showEnd = canEnd && cachedTripId != null;
    var errorText = '';
    var submitting = false;

    final proceed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: !submitting,
        child: StatefulBuilder(
          builder: (dialogContext, setDialogState) => AlertDialog(
            key: const Key('drv-conflict-dialog'),
            title: const Text('มีรอบเดินทางค้างอยู่'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'รอบ ${other.departTime} · ${other.routeName} · รถ ${other.plateNo}',
                  key: const Key('drv-conflict-detail'),
                ),
                const SizedBox(height: 8),
                const Text('ต้องปิดรอบเดิมก่อนจึงจะเริ่มรอบใหม่ได้'),
                if (canEnd && cachedTripId == null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'ไม่ทราบรอบเดินทาง (trip) ของรอบค้างนี้ — '
                    'ปิดรอบได้เฉพาะรอบที่เริ่มจากอุปกรณ์นี้',
                    key: const Key('drv-conflict-gap'),
                    style: Theme.of(dialogContext).textTheme.bodySmall,
                  ),
                ],
                if (errorText.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    errorText,
                    key: const Key('drv-conflict-error'),
                    style: TextStyle(
                      color: Theme.of(dialogContext).colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              if (showEnd)
                TextButton(
                  key: const Key('drv-conflict-end'),
                  onPressed: submitting
                      ? null
                      : () async {
                          setDialogState(() => submitting = true);
                          try {
                            await ref
                                .read(driverRepositoryProvider)
                                .endTrip(tripId: cachedTripId);
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
                  child: const Text('ปิดรอบเก่าก่อน'),
                ),
              FilledButton(
                key: const Key('drv-conflict-cancel'),
                onPressed: submitting
                    ? null
                    : () => Navigator.of(dialogContext).pop(false),
                child: const Text('ออก'),
              ),
            ],
          ),
        ),
      ),
    );
    return proceed ?? false;
  }

  /// แตะการ์ดรอบที่ยังเดิน/เดินเสร็จ — เปิด Manifest (running) หรือ
  /// หน้าสรุป (completed) — ต้องทราบรอบ `tripId` จาก `startedTripsProvider`
  /// (ข้อจำกัด: DriverTripBrief ไม่มี tripId)
  void _openTripDetail(DriverTripBrief trip) {
    final tripId = ref.read(startedTripsProvider)[trip.schedId];
    if (tripId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text(
          'ไม่ทราบรอบเดินทาง (trip) ของรอบนี้ — '
          'เปิดได้เฉพาะรอบที่เริ่มจากอุปกรณ์นี้',
        ),
      ));
      return;
    }
    unawaited(Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => trip.isRunning
          ? ManifestScreen(tripId: tripId)
          : TripSummaryScreen(tripId: tripId),
    )));
  }

  Widget _buildDay(
    BuildContext context,
    DriverDay day, {
    required DriverTripBrief? selected,
  }) {
    if (day.trips.isEmpty) {
      return const EmptyState(message: 'ยังไม่มีรอบเดินทางในวันนี้');
    }
    final theme = Theme.of(context);
    final running = day.runningTrips;
    final routes = <int, String>{};
    for (final trip in day.trips) {
      routes.putIfAbsent(trip.routeId, () => trip.routeName);
    }
    final visible = _filterRouteId == null
        ? day.trips
        : [
            for (final trip in day.trips)
              if (trip.routeId == _filterRouteId) trip,
          ];
    int? nextSchedId;
    for (final trip in day.trips) {
      if (trip.isUpcoming) {
        nextSchedId = trip.schedId;
        break;
      }
    }

    return ListView(
      key: const Key('drv-day-list'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        if (running.isNotEmpty) ...[
          Container(
            key: const Key('drv-conflict-banner'),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: theme.colorScheme.errorContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.warning_amber_rounded,
                  color: theme.colorScheme.onErrorContainer,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'มีรอบกำลังเดิน: ${running.first.departTime} · '
                    '${running.first.routeName}',
                    style: TextStyle(
                      color: theme.colorScheme.onErrorContainer,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: _statCard(
                context,
                label: 'รอบวันนี้',
                value: '${day.trips.length}',
                valueKey: const Key('drv-stat-rounds'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _statCard(
                context,
                label: 'ผู้โดยสาร',
                value: '${day.totalPassengers}',
                valueKey: const Key('drv-stat-passengers'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilterChip(
              key: const Key('drv-filter-all'),
              label: const Text('ทั้งหมด'),
              selected: _filterRouteId == null,
              onSelected: (_) => setState(() => _filterRouteId = null),
            ),
            for (final entry in routes.entries)
              FilterChip(
                key: Key('drv-filter-${entry.key}'),
                label: Text(entry.value),
                selected: _filterRouteId == entry.key,
                onSelected: (_) => setState(() => _filterRouteId = entry.key),
              ),
          ],
        ),
        const SizedBox(height: 12),
        for (final trip in visible)
          _tripCard(
            context,
            trip,
            selected: selected,
            nextSchedId: nextSchedId,
          ),
        const SizedBox(height: 4),
        Text(
          'BR-04 หนึ่งคนขับหนึ่งรอบเดินรถ — ปิดรอบเดิมก่อนเริ่มรอบใหม่',
          key: const Key('drv-br04-note'),
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.outline),
        ),
      ],
    );
  }

  Widget _statCard(
    BuildContext context, {
    required String label,
    required String value,
    required Key valueKey,
  }) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: theme.textTheme.bodySmall),
          const SizedBox(height: 2),
          Text(
            value,
            key: valueKey,
            style: theme.textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _tripCard(
    BuildContext context,
    DriverTripBrief trip, {
    required DriverTripBrief? selected,
    required int? nextSchedId,
  }) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isSelected = selected?.schedId == trip.schedId;
    final String statusLabel;
    final Color chipBg;
    final Color chipFg;
    if (trip.isRunning) {
      statusLabel = 'กำลังเดิน';
      chipBg = scheme.primaryContainer;
      chipFg = scheme.onPrimary;
    } else if (trip.status == 'completed') {
      statusLabel = 'เสร็จแล้ว';
      chipBg = scheme.surfaceContainerHighest;
      chipFg = scheme.outline;
    } else if (trip.schedId == nextSchedId) {
      statusLabel = 'ถัดไป';
      chipBg = scheme.tertiaryContainer;
      chipFg = scheme.onTertiaryContainer;
    } else {
      statusLabel = 'รอ';
      chipBg = scheme.secondaryContainer;
      chipFg = scheme.onSecondaryContainer;
    }
    final String stateHint;
    if (trip.isRunning) {
      stateHint = 'แตะเพื่อดู Manifest';
    } else if (trip.status == 'completed') {
      stateHint = 'แตะเพื่อดูสรุปรอบ';
    } else {
      stateHint = isSelected
          ? 'เลือกแล้ว · กด "เริ่มเดินทาง" ด้านล่าง'
          : 'แตะเพื่อเลือกรอบนี้';
    }

    return Card(
      key: Key('drv-card-${trip.schedId}'),
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: trip.isUpcoming
            ? () => setState(() => _selectedSchedId = trip.schedId)
            : () => _openTripDetail(trip),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${trip.departTime} · ${trip.routeName}',
                      key: Key('drv-title-${trip.schedId}'),
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  Container(
                    key: Key('drv-status-${trip.schedId}'),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: chipBg,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      statusLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: chipFg,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${trip.totalMinutes} นาที · ${trip.stopCount} จุดจอด · '
                'รถ ${trip.plateNo}',
                key: Key('drv-meta-${trip.schedId}'),
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 2),
              Text(
                'ผู้โดยสาร ${trip.passengerCount} คน',
                key: Key('drv-pax-${trip.schedId}'),
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 6),
              Text(
                stateHint,
                key: Key('drv-state-${trip.schedId}'),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: isSelected ? scheme.primary : scheme.outline,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
