import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../master/widgets/list_states.dart';
import 'booking_models.dart';
import 'booking_providers.dart';
import 'booking_qr_page.dart';

/// T-041 (UC-19/UC-21 · B2/B3) — การเดินทางของฉัน
///
/// แท็บกรองตาม `GET /bookings?status=` (chapter-18:523 · UC-19 ขั้นตอน 2):
/// - `กำลังจะถึง` → `status=reserved`
/// - `เดินทางแล้ว` → `status=completed`
/// - `ยกเลิก` → `status=cancelled`
/// (`checked_in`/`no_show` ไม่มีแท็บใดระบุ — จดบันทึกใน handoff)
///
/// - **UC-20**: ปุ่ม "ดู QR" → `GET /bookings/{code}` (ทุกสถานะ — หน้า QR
///   ตัดสินเองว่าสถานะนั้นแสดง QR ได้หรือไม่)
/// - **UC-21**: ปุ่ม "ยกเลิก" เฉพาะ `status = reserved` และมีสิทธิ์
///   **BK.CANCEL** (OpenAPI `x-permission`) · ยืนยันด้วย dialog · 204 →
///   snackbar + โหลดรายการใหม่ · ผิดพลาด → แสดง message ใน dialog ตามที่มา
///   เงื่อนไขเวลายกเลิก (Q6) ฝั่งเซิร์ฟเวอร์ตรวจ — ไม่กรองเวลาฝั่ง UI
class MyBookingsPage extends ConsumerWidget {
  const MyBookingsPage({super.key});

  static const List<({String label, String status})> tabs = [
    (label: 'กำลังจะถึง', status: 'reserved'),
    (label: 'เดินทางแล้ว', status: 'completed'),
    (label: 'ยกเลิก', status: 'cancelled'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('การเดินทางของฉัน'),
          bottom: TabBar(
            labelStyle:
                const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            unselectedLabelStyle: const TextStyle(fontSize: 12),
            tabs: [
              for (var i = 0; i < tabs.length; i++)
                Tab(key: Key('mybk-tab-$i'), text: tabs[i].label),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            for (final tab in tabs) _BookingsTab(status: tab.status),
          ],
        ),
      ),
    );
  }
}

class _BookingsTab extends ConsumerWidget {
  const _BookingsTab({required this.status});

  final String status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(myBookingsProvider(status));
    return AsyncSection<List<BookingRecord>>(
      value: bookingsAsync,
      onRetry: () => ref.invalidate(myBookingsProvider(status)),
      builder: (bookings) => bookings.isEmpty
          ? const EmptyState(message: 'ยังไม่มีรายการในแท็บนี้')
          : ListView.separated(
              key: const Key('mybk-list'),
              padding: const EdgeInsets.all(16),
              itemCount: bookings.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) =>
                  _BookingCard(booking: bookings[index]),
            ),
    );
  }
}

class _BookingCard extends ConsumerWidget {
  const _BookingCard({required this.booking});

  final BookingRecord booking;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    // UC-21 เงื่อนไขตั้งต้น: ยกเลิกได้เฉพาะ `reserved` + สิทธิ์ BK.CANCEL
    final canCancel = booking.status == 'reserved' &&
        ref.watch(
            authControllerProvider.select((state) => state.can('BK.CANCEL')));
    return Card(
      key: Key('mybk-card-${booking.bookingCode}'),
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${booking.routeName} · รอบ ${booking.departTime}',
                    key: Key('mybk-title-${booking.bookingCode}'),
                    style: theme.textTheme.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                _statusChip(booking.status),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${booking.serviceDate} · ที่นั่ง ${booking.seats}',
              key: Key('mybk-meta-${booking.bookingCode}'),
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
            Text(
              '${booking.boardStopName} → ${booking.alightStopName}',
              key: Key('mybk-stops-${booking.bookingCode}'),
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                OutlinedButton(
                  key: Key('mybk-qr-${booking.bookingCode}'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) =>
                          BookingQrPage(bookingCode: booking.bookingCode),
                    ),
                  ),
                  child: const Text('ดู QR'),
                ),
                if (canCancel) ...[
                  const SizedBox(width: 8),
                  OutlinedButton(
                    key: Key('mybk-cancel-${booking.bookingCode}'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: theme.colorScheme.error,
                    ),
                    onPressed: () => _confirmCancel(context, ref),
                    child: const Text('ยกเลิก'),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    return Chip(
      key: Key('mybk-status-${booking.bookingCode}'),
      visualDensity: VisualDensity.compact,
      label: Text(
        switch (status) {
          'reserved' => 'กำลังจะถึง',
          'checked_in' => 'เช็คอินแล้ว',
          'completed' => 'เดินทางแล้ว',
          'cancelled' => 'ยกเลิกแล้ว',
          'no_show' => 'ไม่มาแสดง',
          _ => status,
        },
        style: const TextStyle(fontSize: 11),
      ),
    );
  }

  /// UC-21 ขั้นตอน 3 — dialog ยืนยัน → `POST /bookings/{code}/cancel`
  /// ล้มเหลว → message ใน dialog (เปิดค้าง) · สำเร็จ (204) → ปิด dialog +
  /// snackbar + โหลดรายการใหม่ (รายการย้ายไปแท็บ "ยกเลิก")
  ///
  /// ระหว่าง POST: `barrierDismissible: false` + `PopScope(canPop: false)`
  /// กันปิด dialog ด้วยการแตะพื้นหลัง/ปุ่ม Back (ถ้าปิดก่อน 204 รายการจะ
  /// ค้างแม้การจองถูกยกเลิกแล้ว — การโหลดใหม่จึงผูกกับ "สำเร็จ 204"
  /// ไม่ผูกกับผลการปิด dialog)
  Future<void> _confirmCancel(BuildContext context, WidgetRef ref) async {
    var errorText = '';
    var submitting = false;
    var cancelSucceeded = false;
    await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => PopScope(
          canPop: !submitting,
          child: AlertDialog(
            key: const Key('mybk-cancel-dialog'),
            title: const Text('ยกเลิกการจอง'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ต้องการยกเลิกการจอง ${booking.bookingCode} ใช่หรือไม่?'),
                if (errorText.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    errorText,
                    key: const Key('mybk-cancel-error'),
                    style: TextStyle(
                      color: Theme.of(dialogContext).colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                key: const Key('mybk-cancel-back'),
                onPressed: submitting
                    ? null
                    : () => Navigator.of(dialogContext).pop(false),
                child: const Text('กลับ'),
              ),
              FilledButton(
                key: const Key('mybk-cancel-confirm'),
                onPressed: submitting
                    ? null
                    : () async {
                        setDialogState(() => submitting = true);
                        try {
                          await ref
                              .read(bookingRepositoryProvider)
                              .cancelBooking(bookingCode: booking.bookingCode);
                          cancelSucceeded = true;
                          if (dialogContext.mounted) {
                            Navigator.of(dialogContext).pop(true);
                          }
                        } catch (e) {
                          if (dialogContext.mounted) {
                            setDialogState(() {
                              submitting = false;
                              errorText = describeFailure(e);
                            });
                          }
                        }
                      },
                child: const Text('ยืนยันยกเลิก'),
              ),
            ],
          ),
        ),
      ),
    );
    if (cancelSucceeded && context.mounted) {
      ref.invalidate(myBookingsProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ยกเลิกการจองแล้ว')),
      );
    }
  }
}
