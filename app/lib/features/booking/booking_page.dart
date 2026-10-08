import 'package:flutter/material.dart' hide Route;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../front/front_models.dart';
import '../front/front_providers.dart';
import '../front/schedule_models.dart';
import '../master/widgets/list_states.dart';
import 'booking_models.dart';
import 'booking_providers.dart';
import 'booking_qr_page.dart';
import 'my_bookings_page.dart';

const _thaiMonths = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

String _serviceDateOf(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

String _dateLabel(DateTime date) =>
    '${date.day} ${_thaiMonths[date.month - 1]} ${date.year}';

const _stepLabels = ['จุดขึ้น–ลง', 'รอบเวลา', 'จำนวนที่นั่ง', 'ยืนยัน'];

/// T-040 (UC-17/UC-18 · B1) — จองรถ: จุดขึ้น–ลง → รอบเวลา → จำนวนที่นั่ง → ยืนยัน
///
/// - ดูรอบ/กรอง: ฝั่ง UI ตรวจ **BR-11/BR-12** และ `seatsAvailable`
///   (ดู `boardableTrips`) · **BR-05** ฝั่งเซิร์ฟเวอร์ตรวจตอน `POST`
/// - จอง: x-permission **BK.CREATE** — ไม่มีสิทธิ์ = ไม่แสดงปุ่มยืนยัน
/// - ข้อผิดพลาดจากเซิร์ฟเวอร์ (`SEATS_FULL` / `BR06_SEATS_RANGE` /
///   `BR07_STOP_ORDER` / BR-05 / 403) แสดงตามที่มาใน `book-confirm-error`
class BookingPage extends ConsumerStatefulWidget {
  const BookingPage({super.key});

  @override
  ConsumerState<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends ConsumerState<BookingPage> {
  DateTime _date = DateTime.now();
  int? _boardStopId;
  int? _alightStopId;
  int _step = 0;
  Schedule? _trip;
  int _seats = 1;
  bool _submitting = false;
  String? _stopsError;
  String? _confirmError;
  BookingRecord? _confirmed;

  String get _serviceDate => _serviceDateOf(_date);

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2024),
      lastDate: DateTime(2100),
    );
    if (picked != null && mounted) {
      setState(() => _date = picked);
    }
  }

  void _searchTrips() {
    if (_boardStopId == null || _alightStopId == null) {
      setState(() => _stopsError = 'กรุณาเลือกจุดจอดขึ้นและจุดจอดลงรถ');
      return;
    }
    if (_boardStopId == _alightStopId) {
      // BR-11 — จุดลงต้องอยู่หลังจุดขึ้น (จุดเดียวกัน = ไม่ผ่าน)
      setState(() => _stopsError = 'จุดจอดลงต้องอยู่หลังจุดจอดขึ้น');
      return;
    }
    setState(() {
      _stopsError = null;
      _step = 1;
    });
  }

  void _selectTrip(Schedule trip) {
    setState(() {
      _trip = trip;
      _seats = 1;
      _confirmed = null;
      _confirmError = null;
      _step = 2;
    });
  }

  void _goToConfirm(int maxSeats) {
    setState(() {
      if (maxSeats >= 1 && _seats > maxSeats) _seats = maxSeats;
      _confirmError = null;
      _step = 3;
    });
  }

  Future<void> _submit() async {
    final trip = _trip;
    final board = _boardStopId;
    final alight = _alightStopId;
    if (trip == null || board == null || alight == null || _submitting) {
      return;
    }
    setState(() {
      _submitting = true;
      _confirmError = null;
    });
    try {
      final booking = await ref.read(bookingRepositoryProvider).createBooking(
            schedId: trip.schedId,
            boardStopId: board,
            alightStopId: alight,
            seats: _seats,
          );
      if (!mounted) return;
      setState(() {
        _confirmed = booking;
        _submitting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('จองที่นั่งสำเร็จ')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _confirmError = describeFailure(e);
        _submitting = false;
      });
    }
  }

  void _restart() {
    setState(() {
      _step = 0;
      _trip = null;
      _seats = 1;
      _confirmed = null;
      _confirmError = null;
      _stopsError = null;
    });
  }

  /// จำนวนที่นั่งสูงสุดที่เลือกได้: min(4 ตาม BR-06, ที่นั่งว่างที่ทราบ)
  /// ไม่ทราบค่า (null) → จำกัดด้วย BR-06 (4) และให้เซิร์ฟเวอร์ตรวจ BR-07 ตอนยืนยัน
  int _maxBookableSeats(int? available) {
    if (available == null) return 4;
    if (available < 0) return 0;
    return available > 4 ? 4 : available;
  }

  /// ชื่อจุดจอดจาก `stops` ของรอบนั้นก่อน (ข้อมูลของรอบโดยตรง)
  /// แล้วค่อยลองจากรายชื่อจุดจอดทั่วไป
  String _stopNameFor(int? stopId, Schedule trip, List<Stop> stops) {
    if (stopId == null) return '—';
    for (final stop in trip.stops) {
      if (stop.stopId == stopId) return stop.stopName;
    }
    return _stopLabel(stopId, stops);
  }

  String _stopLabel(int? stopId, List<Stop> stops) {
    if (stopId == null) return '—';
    for (final stop in stops) {
      if (stop.stopId == stopId) return stop.stopName;
    }
    return 'จุดจอด #$stopId';
  }

  String _tripStopName(int stopId, Schedule trip) {
    for (final stop in trip.stops) {
      if (stop.stopId == stopId) return stop.stopName;
    }
    return '—';
  }

  @override
  Widget build(BuildContext context) {
    final stopsAsync = ref.watch(stopsProvider(''));
    final canCreate = ref.watch(
        authControllerProvider.select((state) => state.can('BK.CREATE')));

    return Scaffold(
      appBar: AppBar(
        title: const Text('จองรถ'),
        // T-041 — ทางเข้า "การเดินทางของฉัน" (UC-19) อยู่ในโมดูล booking
        // (mockup C5 วางเป็นแท็บล่าง "รายการ" แยกโมดูล แต่ไม่มี module
        // `trips` ในตาราง permission → เข้าได้จากหน้าจองเท่านั้น)
        actions: [
          IconButton(
            key: const Key('book-my-trips'),
            tooltip: 'การเดินทางของฉัน',
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MyBookingsPage()),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(),
            Expanded(child: _buildStep(stopsAsync, canCreate)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      key: const Key('book-stepper'),
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          for (var i = 0; i < _stepLabels.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: i <= _step
                    ? theme.colorScheme.primaryContainer
                    : theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                '${i + 1} ${_stepLabels[i]}',
                key: Key('book-step-label-$i'),
                style: theme.textTheme.labelMedium?.copyWith(
                  color: i <= _step
                      ? theme.colorScheme.onPrimaryContainer
                      : theme.colorScheme.onSurfaceVariant,
                  fontWeight: i == _step ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStep(AsyncValue<List<Stop>> stopsAsync, bool canCreate) {
    switch (_step) {
      case 0:
        // โหลดจุดจอดไม่สำเร็จต้องแจ้ง + ลองใหม่ได้ (ไม่ใช่ dropdown ว่างเปล่า)
        return AsyncSection<List<Stop>>(
          value: stopsAsync,
          onRetry: () => ref.invalidate(stopsProvider('')),
          builder: _stepStops,
        );
      case 1:
        return _stepTrips();
      case 2:
        return _stepSeats(stopsAsync.valueOrNull ?? const <Stop>[]);
      default:
        return _stepConfirm(
            stopsAsync.valueOrNull ?? const <Stop>[], canCreate);
    }
  }

  // ---------- ขั้นที่ 1: เลือกจุดขึ้น–ลง ----------

  Widget _stepStops(List<Stop> stops) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            key: const Key('book-date'),
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              decoration: BoxDecoration(
                border: Border.all(color: theme.colorScheme.outlineVariant),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'วันที่ให้บริการ: ${_dateLabel(_date)}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('จุดจอดขึ้นรถ', style: theme.textTheme.titleSmall),
          const SizedBox(height: 4),
          DropdownButtonFormField<int>(
            key: const Key('book-board-stop'),
            initialValue: _boardStopId,
            hint: const Text('เลือกจุดจอดขึ้นรถ'),
            isExpanded: true,
            items: [
              for (final stop in stops)
                DropdownMenuItem<int>(
                  value: stop.stopId,
                  child: Text(stop.stopName, overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (value) => setState(() => _boardStopId = value),
          ),
          const SizedBox(height: 16),
          Text('จุดจอดลงรถ', style: theme.textTheme.titleSmall),
          const SizedBox(height: 4),
          DropdownButtonFormField<int>(
            key: const Key('book-alight-stop'),
            initialValue: _alightStopId,
            hint: const Text('เลือกจุดจอดลงรถ'),
            isExpanded: true,
            items: [
              for (final stop in stops)
                DropdownMenuItem<int>(
                  value: stop.stopId,
                  child: Text(stop.stopName, overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (value) => setState(() => _alightStopId = value),
          ),
          if (_stopsError != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _stopsError!,
                key: const Key('book-stops-error'),
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
          const SizedBox(height: 20),
          FilledButton(
            key: const Key('book-next'),
            onPressed: _searchTrips,
            child: const Text('ค้นหารอบเวลา'),
          ),
        ],
      ),
    );
  }

  // ---------- ขั้นที่ 2: เลือกรอบเวลา ----------

  Widget _stepTrips() {
    final board = _boardStopId;
    final alight = _alightStopId;
    if (board == null || alight == null) {
      // ไปถึงขั้นนี้ได้ผ่าน _searchTrips เท่านั้น (บังคับเลือกทั้งสองจุดแล้ว)
      return const SizedBox.shrink();
    }
    final serviceDate = _serviceDate;
    return Column(
      children: [
        Expanded(
          child: AsyncSection<List<Schedule>>(
            value: ref.watch(availableTripsProvider(serviceDate)),
            onRetry: () => ref.invalidate(availableTripsProvider(serviceDate)),
            builder: (items) {
              final trips = boardableTrips(
                items,
                boardStopId: board,
                alightStopId: alight,
              );
              if (trips.isEmpty) {
                return const EmptyState(message: 'ไม่มีรอบที่จองได้ในวันนี้');
              }
              return ListView.separated(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: trips.length,
                separatorBuilder: (context, index) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final trip = trips[index];
                  return Card(
                    margin: EdgeInsets.zero,
                    child: InkWell(
                      key: Key('book-trip-${trip.schedId}'),
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => _selectTrip(trip),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${trip.departTime} น. · ${trip.routeName}',
                              key: Key('book-trip-time-${trip.schedId}'),
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_tripStopName(board, trip)} → '
                              '${_tripStopName(alight, trip)}',
                              key: Key('book-trip-stops-${trip.schedId}'),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'เหลือ ${trip.seatsAvailable ?? '-'} ที่นั่ง',
                              key: Key('book-trip-seats-${trip.schedId}'),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color:
                                        Theme.of(context).colorScheme.primary,
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              key: const Key('book-back'),
              onPressed: () => setState(() => _step = 0),
              child: const Text('ย้อนกลับ'),
            ),
          ),
        ),
      ],
    );
  }

  // ---------- ขั้นที่ 3: เลือกจำนวนที่นั่ง ----------

  Widget _stepSeats(List<Stop> stops) {
    final trip = _trip;
    if (trip == null) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final seatMapKey = '${trip.schedId}|${trip.serviceDate}';
    final seatMapAsync = ref.watch(seatMapProvider(seatMapKey));
    final available =
        seatMapAsync.valueOrNull?.availableSeats ?? trip.seatsAvailable;
    final maxSeats = _maxBookableSeats(available);
    final boardName = _stopNameFor(_boardStopId, trip, stops);
    final alightName = _stopNameFor(_alightStopId, trip, stops);

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${trip.departTime} น. · ${trip.routeName}',
                          key: const Key('book-seats-title'),
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text('$boardName → $alightName'),
                        Text('วันที่ ${_dateLabel(_date)}'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text('แผนผังที่นั่ง', style: theme.textTheme.titleSmall),
                const SizedBox(height: 8),
                AsyncSection<SeatMap>(
                  value: seatMapAsync,
                  onRetry: () => ref.invalidate(seatMapProvider(seatMapKey)),
                  builder: (map) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ที่นั่งว่าง ${map.availableSeats} จาก '
                        '${map.totalSeats} ที่นั่ง',
                        key: const Key('book-seat-info'),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'จองครั้งละไม่เกิน ${map.maxSeatsPerBooking} ที่นั่ง',
                        style: theme.textTheme.bodySmall,
                      ),
                      if (map.seats.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              for (final seat in map.seats)
                                Container(
                                  width: 32,
                                  height: 32,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: seat.status == 'available'
                                        ? theme.colorScheme.primaryContainer
                                        : theme.colorScheme
                                            .surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    '${seat.seatNo}',
                                    style: theme.textTheme.labelSmall,
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (maxSeats < 1)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      'ที่นั่งเต็มแล้ว',
                      key: const Key('book-seat-full'),
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Text('จำนวนที่นั่ง', style: theme.textTheme.titleSmall),
                  const SizedBox(width: 8),
                  IconButton(
                    key: const Key('book-seat-minus'),
                    tooltip: 'ลดจำนวนที่นั่ง',
                    onPressed:
                        _seats > 1 ? () => setState(() => _seats--) : null,
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text(
                    '$_seats',
                    key: const Key('book-count'),
                    style: theme.textTheme.titleMedium,
                  ),
                  IconButton(
                    key: const Key('book-seat-plus'),
                    tooltip: 'เพิ่มจำนวนที่นั่ง',
                    onPressed: _seats < maxSeats
                        ? () => setState(() => _seats++)
                        : null,
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  TextButton(
                    key: const Key('book-back'),
                    onPressed: () => setState(() => _step = 1),
                    child: const Text('ย้อนกลับ'),
                  ),
                  const Spacer(),
                  FilledButton(
                    key: const Key('book-next'),
                    onPressed:
                        maxSeats < 1 ? null : () => _goToConfirm(maxSeats),
                    child: const Text('ถัดไป'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ---------- ขั้นที่ 4: ยืนยันการจอง ----------

  Widget _stepConfirm(List<Stop> stops, bool canCreate) {
    final trip = _trip;
    if (trip == null) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final confirmed = _confirmed;

    final Widget body;
    final Widget footer;
    if (confirmed != null) {
      body = _successView(confirmed, trip, stops);
      footer = FilledButton(
        key: const Key('book-again'),
        onPressed: _restart,
        child: const Text('จองรอบอื่น'),
      );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            key: const Key('book-summary'),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _summaryRow('เส้นทาง', trip.routeName),
                _summaryRow('วันที่', _serviceDate),
                _summaryRow('เวลาออกเดินทาง', '${trip.departTime} น.'),
                _summaryRow(
                  'จุดขึ้น',
                  _stopNameFor(_boardStopId, trip, stops),
                ),
                _summaryRow(
                  'จุดลง',
                  _stopNameFor(_alightStopId, trip, stops),
                ),
                _summaryRow('จำนวนที่นั่ง', '$_seats'),
              ],
            ),
          ),
          if (_confirmError != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _confirmError!,
                key: const Key('book-confirm-error'),
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
        ],
      );
      footer = Row(
        children: [
          Expanded(
            child: TextButton(
              key: const Key('book-back'),
              onPressed: _submitting
                  ? null
                  : () => setState(() {
                        _step = 2;
                        _confirmError = null;
                      }),
              child: const Text('ย้อนกลับ'),
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            key: const Key('book-confirm'),
            // x-permission BK.CREATE — ไม่มีสิทธิ์ = ไม่แสดงปุ่มยืนยัน
            onPressed: canCreate && !_submitting ? _submit : null,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('ยืนยันการจอง'),
          ),
        ],
      );
    }

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: body,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: footer,
        ),
      ],
    );
  }

  Widget _successView(BookingRecord booking, Schedule trip, List<Stop> stops) {
    final theme = Theme.of(context);
    return Column(
      key: const Key('booking-success'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          Icons.check_circle_outline,
          size: 48,
          color: theme.colorScheme.primary,
        ),
        const SizedBox(height: 8),
        Text(
          'จองที่นั่งสำเร็จ',
          textAlign: TextAlign.center,
          style: theme.textTheme.titleLarge,
        ),
        const SizedBox(height: 4),
        Text(
          'รหัสการจอง: ${booking.bookingCode}',
          key: const Key('booking-code'),
          textAlign: TextAlign.center,
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        // UC-20 เงื่อนไขเริ่มต้น — "จองสำเร็จ → แสดง QR"
        FilledButton.tonalIcon(
          key: const Key('book-view-qr'),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => BookingQrPage(bookingCode: booking.bookingCode),
            ),
          ),
          icon: const Icon(Icons.qr_code_2),
          label: const Text('ดู QR เช็คอิน'),
        ),
        const SizedBox(height: 16),
        _summaryRow(
          'เส้นทาง',
          booking.routeName.isNotEmpty ? booking.routeName : trip.routeName,
        ),
        _summaryRow(
          'วันที่',
          booking.serviceDate.isNotEmpty
              ? booking.serviceDate
              : trip.serviceDate,
        ),
        _summaryRow('เวลาออกเดินทาง', '${trip.departTime} น.'),
        _summaryRow(
          'จุดขึ้น',
          booking.boardStopName.isNotEmpty
              ? booking.boardStopName
              : _stopNameFor(_boardStopId, trip, stops),
        ),
        _summaryRow(
          'จุดลง',
          booking.alightStopName.isNotEmpty
              ? booking.alightStopName
              : _stopNameFor(_alightStopId, trip, stops),
        ),
        _summaryRow('จำนวนที่นั่ง', '${booking.seats}'),
        _summaryRow('สถานะ', booking.status),
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
