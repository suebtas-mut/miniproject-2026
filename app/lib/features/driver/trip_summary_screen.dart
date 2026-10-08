import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../master/widgets/list_states.dart';
import 'driver_models.dart';
import 'driver_providers.dart';

/// T-051 (UC-26 · จอ D4) — สรุปหลังปิดรอบการเดินทาง
///
/// - ข้อมูลจาก `GET /driver/trips/{tripId}/manifest` หลัง `POST .../end`
///   (BR-10: เซิร์ฟเวอร์เปลี่ยน `reserved → no_show`, `checked_in → completed`)
/// - KPI: ผู้โดยสารทั้งหมด / ขึ้นรถจริง / ลงรถจริง / No Show
///   (นับจาก `status`/`checkedIn` ที่เซิร์ฟเวอร์ส่งกลับ)
/// - รายชื่อ No Show + ทางเลือก 5a "ไม่มีผู้โดยสาร No Show"
/// - เปิดซ้ำได้จาก D1 (การ์ด "เสร็จแล้ว") เฉพาะรอบที่ทราบรอบ `tripId`
///   จาก `startedTripsProvider` (DriverTripBrief ไม่มี tripId — ข้อจำกัดสัญญา)
class TripSummaryScreen extends ConsumerWidget {
  const TripSummaryScreen({super.key, required this.tripId});

  final int tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final manifestAsync = ref.watch(driverManifestProvider(tripId));
    final theme = Theme.of(context);
    final manifest = manifestAsync.valueOrNull;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              manifest == null
                  ? 'สรุปรอบการเดินทาง'
                  : 'สรุปรอบ ${manifest.departTime}',
              key: const Key('drv-sum-title'),
            ),
            Text(
              manifest == null
                  ? 'หลังปิดรอบ'
                  : '${manifest.routeName} · ${manifest.serviceDate}',
              key: const Key('drv-sum-subtitle'),
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
      body: AsyncSection<DriverManifest>(
        value: manifestAsync,
        onRetry: () => ref.invalidate(driverManifestProvider(tripId)),
        builder: (data) => _buildSummary(context, data),
      ),
    );
  }

  Widget _buildSummary(BuildContext context, DriverManifest manifest) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final noShows = manifest.noShowPassengers;

    return ListView(
      key: const Key('drv-sum-list'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.6,
          children: [
            _kpiCard(
              context,
              label: 'ผู้โดยสารทั้งหมด',
              value: manifest.totalPassengers,
              valueKey: const Key('drv-sum-total'),
            ),
            _kpiCard(
              context,
              label: 'ขึ้นรถจริง',
              value: manifest.boardedCount,
              valueKey: const Key('drv-sum-boarded'),
              emphasized: true,
            ),
            _kpiCard(
              context,
              label: 'ลงรถจริง',
              value: manifest.alightedCount,
              valueKey: const Key('drv-sum-alighted'),
            ),
            _kpiCard(
              context,
              label: 'No Show',
              value: manifest.noShowCount,
              valueKey: const Key('drv-sum-noshow'),
            ),
          ],
        ),
        if (manifest.cancelledCount > 0)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              'ยกเลิกแล้ว ${manifest.cancelledCount} คน',
              key: const Key('drv-sum-cancelled'),
              style: theme.textTheme.bodySmall?.copyWith(color: scheme.outline),
            ),
          ),
        const SizedBox(height: 16),
        Text(
          'ผู้โดยสารที่ไม่ได้มาใช้บริการ (No Show)',
          key: const Key('drv-sum-noshow-heading'),
          style:
              theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        if (noShows.isEmpty)
          Container(
            key: const Key('drv-sum-noshow-empty'),
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text('ไม่มีผู้โดยสาร No Show'),
          )
        else
          Container(
            key: const Key('drv-sum-noshow-list'),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                for (final passenger in noShows)
                  Padding(
                    key: Key('drv-sum-noshow-${passenger.bookingCode}'),
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            passenger.customerName,
                            style: theme.textTheme.bodySmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          passenger.bookingCode,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: scheme.outline),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          passenger.alightStopName,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: scheme.outline),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 16),
        Text(
          'BR-10: เมื่อปิดรอบ เซิร์ฟเวอร์เปลี่ยนการจองที่ยังรออยู่ '
          '(reserved) เป็น No Show อัตโนมัติ',
          key: const Key('drv-sum-br10-note'),
          style: theme.textTheme.bodySmall?.copyWith(color: scheme.outline),
        ),
      ],
    );
  }

  Widget _kpiCard(
    BuildContext context, {
    required String label,
    required int value,
    required Key valueKey,
    bool emphasized = false,
  }) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: emphasized
            ? scheme.primaryContainer
            : scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: theme.textTheme.bodySmall),
          const SizedBox(height: 2),
          Text(
            '$value',
            key: valueKey,
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
