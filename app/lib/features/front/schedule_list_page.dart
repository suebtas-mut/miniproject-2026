import 'package:flutter/material.dart' hide Route;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../front/front_models.dart';
import '../front/front_providers.dart';
import '../master/widgets/list_states.dart';
import 'schedule_models.dart';
import 'schedule_providers.dart';

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

/// T-033 (UC-14/15/16) — รอบเวลาเดินทาง + มัดจำคนขับ/รถ + Conflict Alert
///
/// ดู: ผู้ใช้โมดูลหน้า · เพิ่ม/ยกเลิก/มอบหมาย: SCHED.EDIT (OpenAPI `x-permission`)
/// ไม่มีการแก้เวลาออกของรอบ (Q23 — OpenAPI ไม่มี `PUT /schedules/{schedId}`)
class ScheduleListPage extends ConsumerStatefulWidget {
  const ScheduleListPage({super.key});

  @override
  ConsumerState<ScheduleListPage> createState() => _ScheduleListPageState();
}

class _ScheduleListPageState extends ConsumerState<ScheduleListPage> {
  DateTime _date = DateTime.now();
  int? _routeId;

  String get _serviceDate => _serviceDateOf(_date);

  String get _queryKey => scheduleQueryKey(_serviceDate, _routeId);

  void _shiftDay(int days) {
    setState(() => _date = _date.add(Duration(days: days)));
  }

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

  Future<void> _create() async {
    final created =
        await ScheduleCreateDialog.show(context, initialDate: _serviceDate);
    if (created == true && mounted) {
      refreshSchedules(ref, key: _queryKey);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('สร้างรอบเวลาแล้ว')),
      );
    }
  }

  Future<void> _cancel(Schedule schedule) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ยกเลิกรอบเวลา'),
        content: Text(
          'ต้องการยกเลิกรอบ ${schedule.departTime} น. '
          '(${schedule.routeName}) ใช่หรือไม่? '
          'หารอบนี้ยังมีการจองอยู่จะยกเลิกไม่ได้',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('กลับ'),
          ),
          FilledButton(
            key: const Key('sched-cancel-confirm'),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('ยกเลิกรอบ'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref
          .read(scheduleRepositoryProvider)
          .cancelSchedule(schedule.schedId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(describeFailure(e))),
      );
      return;
    }
    if (!mounted) return;
    refreshSchedules(ref, key: _queryKey);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ยกเลิกรอบเดินทางแล้ว')),
    );
  }

  Future<void> _assign(Schedule schedule) async {
    final saved = await AssignmentDialog.show(context, schedule: schedule);
    if (saved == true && mounted) {
      refreshSchedules(ref, key: _queryKey);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('กำหนดคนขับและรถแล้ว')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final schedules = ref.watch(schedulesProvider(_queryKey));
    final routes = ref.watch(routesProvider).valueOrNull ?? const [];
    // T-033 — ซ่อนปุ่มจัดการที่ไม่มีสิทธิ์ SCHED.EDIT (OpenAPI x-permission)
    final canEdit = ref.watch(
        authControllerProvider.select((state) => state.can('SCHED.EDIT')));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            children: [
              IconButton(
                key: const Key('sched-prev-day'),
                tooltip: 'วันก่อนหน้า',
                onPressed: () => _shiftDay(-1),
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Center(
                  child: InkWell(
                    key: const Key('sched-date'),
                    onTap: _pickDate,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      child: Text(
                        _dateLabel(_date),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ),
                ),
              ),
              IconButton(
                key: const Key('sched-next-day'),
                tooltip: 'วันถัดไป',
                onPressed: () => _shiftDay(1),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  key: const Key('sched-route-filter'),
                  initialValue: _routeId,
                  hint: const Text('ทุกเส้นทาง'),
                  isExpanded: true,
                  items: [
                    for (final route in routes)
                      DropdownMenuItem<int>(
                        value: route.routeId,
                        child: Text(
                          route.routeName,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) => setState(() => _routeId = value),
                ),
              ),
              if (canEdit) ...[
                const SizedBox(width: 8),
                FilledButton.icon(
                  key: const Key('sched-create'),
                  onPressed: _create,
                  icon: const Icon(Icons.add),
                  label: const Text('เพิ่มรอบเวลา'),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<List<Schedule>>(
            value: schedules,
            onRetry: () => ref.invalidate(schedulesProvider(_queryKey)),
            builder: (items) {
              if (items.isEmpty) {
                return const EmptyState(
                    message: 'ยังไม่มีรอบเวลาในวันที่เลือก');
              }
              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final schedule = items[index];
                  return ExpansionTile(
                    key: Key('sched-${schedule.schedId}'),
                    title: Text(
                      '${schedule.departTime} น. · ${schedule.routeName}',
                      key: Key('sched-time-${schedule.schedId}'),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'คนขับ: '
                          '${schedule.driver?.fullName ?? 'ยังไม่กำหนด'} · '
                          'รถ: ${schedule.vehicle?.plateNo ?? 'ยังไม่กำหนด'}',
                          key: Key('sched-assign-${schedule.schedId}'),
                        ),
                        if (schedule.seatsTotal != null)
                          Text(
                            'ที่นั่ง: ${schedule.seatsBooked ?? 0}/'
                            '${schedule.seatsTotal}',
                            key: Key('sched-seats-${schedule.schedId}'),
                          ),
                      ],
                    ),
                    trailing: canEdit
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                key:
                                    Key('sched-assign-btn-${schedule.schedId}'),
                                tooltip: 'มอบหมายคนขับ/รถ',
                                icon: const Icon(Icons.assignment_ind_outlined),
                                onPressed: () => _assign(schedule),
                              ),
                              IconButton(
                                key:
                                    Key('sched-cancel-btn-${schedule.schedId}'),
                                tooltip: 'ยกเลิกรอบ',
                                icon: const Icon(Icons.cancel_outlined),
                                onPressed: () => _cancel(schedule),
                              ),
                            ],
                          )
                        : null,
                    children: [
                      if (schedule.stops.isEmpty)
                        const Padding(
                          padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                          child: Text('ยังไม่มีข้อมูลจุดจอดในรอบนี้'),
                        )
                      else
                        for (final stop in schedule.stops)
                          ListTile(
                            key: Key(
                                'sched-stop-${schedule.schedId}-${stop.stopSeq}'),
                            dense: true,
                            contentPadding:
                                const EdgeInsets.symmetric(horizontal: 16),
                            title: Text('${stop.stopSeq}. ${stop.stopName}'),
                            trailing: Text(stop.arriveTime),
                          ),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

/// ฟอร์มเพิ่มรอบเวลา — ScheduleInput (routeId/serviceDate/departAt จำเป็น)
class ScheduleCreateDialog extends ConsumerStatefulWidget {
  const ScheduleCreateDialog({super.key, required this.initialDate});

  final String initialDate;

  static Future<bool?> show(BuildContext context,
      {required String initialDate}) {
    return showDialog<bool>(
      context: context,
      builder: (context) => ScheduleCreateDialog(initialDate: initialDate),
    );
  }

  @override
  ConsumerState<ScheduleCreateDialog> createState() =>
      _ScheduleCreateDialogState();
}

class _ScheduleCreateDialogState extends ConsumerState<ScheduleCreateDialog> {
  final _formKey = GlobalKey<FormState>();
  final _dateCtrl = TextEditingController();
  final _timeCtrl = TextEditingController();
  int? _routeId;
  bool _saving = false;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _dateCtrl.text = widget.initialDate;
  }

  @override
  void dispose() {
    _dateCtrl.dispose();
    _timeCtrl.dispose();
    super.dispose();
  }

  String? _dateValidator(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return 'กรุณากรอกวันที่';
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(text)) {
      return 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)';
    }
    if (DateTime.tryParse(text) == null) return 'วันที่ไม่ถูกต้อง';
    return null;
  }

  String? _timeValidator(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return 'กรุณากรอกเวลาออก';
    if (!RegExp(r'^(?:[01]\d|2[0-3]):[0-5]\d$').hasMatch(text)) {
      return 'รูปแบบเวลาไม่ถูกต้อง (HH:mm)';
    }
    return null;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_routeId == null) return;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    final dateText = _dateCtrl.text.trim();
    final timeText = _timeCtrl.text.trim();
    final body = <String, dynamic>{
      'routeId': _routeId,
      'serviceDate': dateText,
      'departAt': '${dateText}T$timeText:00',
    };
    try {
      await ref.read(scheduleRepositoryProvider).createSchedule(body);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saveError = describeFailure(e);
      });
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final routes = ref.watch(routesProvider).valueOrNull ?? const <Route>[];
    return AlertDialog(
      title: const Text('เพิ่มรอบเวลา'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_saveError != null) ...[
                  Container(
                    key: const Key('sched-form-save-error'),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _saveError!,
                      style:
                          TextStyle(color: theme.colorScheme.onErrorContainer),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                DropdownButtonFormField<int>(
                  key: const Key('sched-form-route'),
                  initialValue: _routeId,
                  hint: const Text('เลือกเส้นทาง *'),
                  isExpanded: true,
                  items: [
                    for (final route in routes)
                      DropdownMenuItem<int>(
                        value: route.routeId,
                        child: Text(
                          route.routeName,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) => setState(() => _routeId = value),
                  validator: (value) =>
                      value == null ? 'กรุณาเลือกเส้นทาง' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('sched-form-date'),
                  controller: _dateCtrl,
                  decoration: const InputDecoration(
                    labelText: 'วันที่ (YYYY-MM-DD) *',
                  ),
                  maxLength: 10,
                  validator: _dateValidator,
                ),
                TextFormField(
                  key: const Key('sched-form-time'),
                  controller: _timeCtrl,
                  decoration: const InputDecoration(
                    labelText: 'เวลาออก (HH:mm) *',
                    hintText: 'เช่น 09:30',
                  ),
                  maxLength: 5,
                  validator: _timeValidator,
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('ยกเลิก'),
        ),
        FilledButton(
          key: const Key('sched-form-save'),
          onPressed: _saving ? null : _submit,
          child: _saving
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('บันทึก'),
        ),
      ],
    );
  }
}

/// มอบหมายคนขับ/รถ — PUT /schedules/{schedId}/assignments
/// 409 BR04_DRIVER_CONFLICT แสดงเป็น Conflict Alert ใน dialog (เปิดค้างไว้)
class AssignmentDialog extends ConsumerStatefulWidget {
  const AssignmentDialog({super.key, required this.schedule});

  final Schedule schedule;

  static Future<bool?> show(BuildContext context,
      {required Schedule schedule}) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AssignmentDialog(schedule: schedule),
    );
  }

  @override
  ConsumerState<AssignmentDialog> createState() => _AssignmentDialogState();
}

class _AssignmentDialogState extends ConsumerState<AssignmentDialog> {
  int? _empId;
  int? _vehId;
  bool _saving = false;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _empId = widget.schedule.driver?.empId;
    _vehId = widget.schedule.vehicle?.vehId;
  }

  Future<void> _submit() async {
    final empId = _empId;
    final vehId = _vehId;
    if (empId == null || vehId == null) return;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    try {
      await ref.read(scheduleRepositoryProvider).setAssignments(
            widget.schedule.schedId,
            empId: empId,
            vehId: vehId,
          );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saveError = describeFailure(e);
      });
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final drivers = ref.watch(driversProvider);
    final vehicles = ref.watch(vehiclesProvider);
    final driverItems = drivers.valueOrNull ?? const <EmployeeBrief>[];
    final vehicleItems = vehicles.valueOrNull ?? const <Vehicle>[];
    final loading = drivers.isLoading || vehicles.isLoading;
    final loadFailed = drivers.hasError || vehicles.hasError;
    final driverValue =
        driverItems.any((driver) => driver.empId == _empId) ? _empId : null;
    final vehicleValue =
        vehicleItems.any((vehicle) => vehicle.vehId == _vehId) ? _vehId : null;

    return AlertDialog(
      title: Text('มอบหมายคนขับ/รถ · ${widget.schedule.departTime} น.'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_saveError != null) ...[
                Container(
                  key: const Key('assign-error'),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _saveError!,
                    style: TextStyle(color: theme.colorScheme.onErrorContainer),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (loadFailed) ...[
                Text(
                  describeFailure(
                      drivers.error ?? vehicles.error ?? 'เกิดข้อผิดพลาด'),
                  key: const Key('assign-load-error'),
                  textAlign: TextAlign.center,
                ),
                TextButton(
                  key: const Key('assign-retry'),
                  onPressed: () {
                    ref.invalidate(driversProvider);
                    ref.invalidate(vehiclesProvider);
                  },
                  child: const Text('ลองอีกครั้ง'),
                ),
              ] else if (loading) ...[
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator(),
                  ),
                ),
              ] else ...[
                DropdownButtonFormField<int>(
                  key: const Key('assign-driver-select'),
                  initialValue: driverValue,
                  hint: const Text('เลือกคนขับ'),
                  isExpanded: true,
                  items: [
                    for (final driver in driverItems)
                      DropdownMenuItem<int>(
                        value: driver.empId,
                        child: Text(
                          driver.empCode == null || driver.empCode!.isEmpty
                              ? driver.fullName
                              : '${driver.fullName} (${driver.empCode})',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: _saving
                      ? null
                      : (value) => setState(() => _empId = value),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  key: const Key('assign-vehicle-select'),
                  initialValue: vehicleValue,
                  hint: const Text('เลือกรถ'),
                  isExpanded: true,
                  items: [
                    for (final vehicle in vehicleItems)
                      DropdownMenuItem<int>(
                        value: vehicle.vehId,
                        child: Text(
                          '${vehicle.plateNo} · ${vehicle.typeName}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: _saving
                      ? null
                      : (value) => setState(() => _vehId = value),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('ยกเลิก'),
        ),
        FilledButton(
          key: const Key('assign-save'),
          onPressed: loading ||
                  loadFailed ||
                  _saving ||
                  _empId == null ||
                  _vehId == null
              ? null
              : _submit,
          child: _saving
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('บันทึก'),
        ),
      ],
    );
  }
}
