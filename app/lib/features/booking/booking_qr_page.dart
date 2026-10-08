import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../master/widgets/list_states.dart';
import 'booking_models.dart';
import 'booking_providers.dart';

/// T-041 (UC-20 · B2) — แสดง QR Code สำหรับเช็คอิน
///
/// - `GET /bookings/{bookingCode}` → `Booking.qrToken` วาดด้วย `qr_flutter`
///   (OpenAPI ไม่มี endpoint `/qr` แยก — usecase-spec `GET /booking/:id/qr`
///   เป็นสเปกเก่า ใช้ OpenAPI ตาม CONTRACT-DRIFT-01)
/// - **UC-20 2a**: `status = cancelled` → ไม่แสดง QR
/// - **UC-20 2b**: `status = checked_in` → แสดงว่า "เช็คอินแล้ว"
/// - 403 (จองของผู้อื่น) / 404 / รูปแบบผิด → แสดง message ตามที่มา + ลองใหม่
class BookingQrPage extends ConsumerWidget {
  const BookingQrPage({super.key, required this.bookingCode});

  final String bookingCode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(bookingDetailProvider(bookingCode));
    return Scaffold(
      appBar: AppBar(title: const Text('QR เช็คอิน')),
      body: SafeArea(
        child: AsyncSection<BookingRecord>(
          value: detailAsync,
          onRetry: () => ref.invalidate(bookingDetailProvider(bookingCode)),
          builder: (booking) => _BookingQrView(booking: booking),
        ),
      ),
    );
  }
}

class _BookingQrView extends StatelessWidget {
  const _BookingQrView({required this.booking});

  final BookingRecord booking;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'การจอง ${booking.bookingCode}',
            key: const Key('qr-booking-code'),
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          _qrSection(theme),
          const SizedBox(height: 8),
          Text(
            'แสดง QR ที่จุดขึ้นรถตามเวลาเดินทาง',
            key: const Key('qr-hint'),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.outline),
          ),
          const SizedBox(height: 16),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('รายละเอียดการจอง', style: theme.textTheme.titleSmall),
                  const SizedBox(height: 8),
                  _detailRow('เส้นทาง / รอบ',
                      '${booking.routeName} · รอบ ${booking.departTime}'),
                  _detailRow('วันที่', booking.serviceDate),
                  _detailRow('จุดขึ้น', booking.boardStopName),
                  _detailRow('จุดลง', booking.alightStopName),
                  _detailRow('ที่นั่ง', '${booking.seats}'),
                  _detailRow('สถานะ', _statusLabel(booking.status)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _infoBox('กรุณาแสดง QR ให้คนขับสแกนก่อนขึ้นรถ'),
        ],
      ),
    );
  }

  Widget _qrSection(ThemeData theme) {
    // UC-20 2a — ยกเลิกแล้ว = ไม่แสดง QR
    if (booking.status == 'cancelled') {
      return _noticeBox(
        key: const Key('qr-cancelled'),
        text: 'การจองนี้ถูกยกเลิกแล้ว',
        color: theme.colorScheme.outline,
      );
    }
    // UC-20 เงื่อนไขตั้งต้น — QR มีเฉพาะ reserved / checked_in
    if (booking.status == 'completed' || booking.status == 'no_show') {
      return _noticeBox(
        key: const Key('qr-not-available'),
        text: booking.status == 'completed'
            ? 'เดินทางเสร็จสิ้นแล้ว'
            : 'ไม่มาแสดง',
        color: theme.colorScheme.outline,
      );
    }
    final token = booking.qrToken;
    if (token == null || token.isEmpty) {
      return _noticeBox(
        key: const Key('qr-missing'),
        text: 'ไม่พบ QR สำหรับรายการนี้',
        color: theme.colorScheme.error,
      );
    }
    return Column(
      children: [
        // UC-20 2b — เช็คอินแล้ว แสดงสถานะกำกับ
        // (การใช้ QR ซ้ำ/หมดอายุ = Q7 ยังไม่ยืนยัน → ไม่แสดงข้อความดังกล่าว)
        if (booking.status == 'checked_in')
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Chip(
              key: Key('qr-checked-in'),
              avatar: Icon(Icons.check_circle, size: 18),
              label: Text('เช็คอินแล้ว'),
            ),
          ),
        Container(
          key: const Key('qr-code'),
          color: Colors.white,
          padding: const EdgeInsets.all(8),
          child: QrImageView(
            data: token,
            size: 220,
            backgroundColor: Colors.white,
          ),
        ),
      ],
    );
  }

  Widget _noticeBox({
    required Key key,
    required String text,
    required Color color,
  }) {
    return Container(
      key: key,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, textAlign: TextAlign.center),
    );
  }

  Widget _infoBox(String text) {
    return Row(
      key: const Key('qr-info'),
      children: [
        const Icon(Icons.info_outline, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 12))),
      ],
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: Color(0xFF6B7A99)),
            ),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }

  static String _statusLabel(String status) {
    switch (status) {
      case 'reserved':
        return 'กำลังจะถึง';
      case 'checked_in':
        return 'เช็คอินแล้ว';
      case 'completed':
        return 'เดินทางแล้ว';
      case 'cancelled':
        return 'ยกเลิกแล้ว';
      case 'no_show':
        return 'ไม่มาแสดง';
      default:
        return status;
    }
  }
}
