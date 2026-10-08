import 'package:flutter/material.dart' hide Route;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../front/front_models.dart';
import '../front/front_providers.dart';

/// ผลลัพธ์จาก dialog เพิ่มจุดจอดเข้าเส้นทาง
class AddStopResult {
  const AddStopResult({
    required this.stopId,
    required this.stopName,
    required this.minutesText,
  });

  final int stopId;
  final String stopName;
  final String minutesText;
}

class _StopRow {
  _StopRow({required this.stopId, required this.stopName, required minutes})
      : minutes = TextEditingController(text: minutes);

  final int stopId;
  final String stopName;
  final TextEditingController minutes;

  void dispose() => minutes.dispose();
}

/// UC-12 (12.1–12.4) — ฟอร์มเพิ่ม/แก้เส้นทาง + ตัวเรียงลำดับจุดจอด
///
/// - BR-01: `totalMinutes` คำนวณจากผลรวม `travelMinutes` ผู้ใช้ไม่พิมพ์เอง
///   แสดง "เวลารวมทั้งเส้นทาง: XX นาที" แบบสด และส่งค่าที่คำนวณไปให้ API ตรวจซ้ำ (422 ถ้าไม่ตรง)
/// - BR-03: ห้ามมีจุดจอดซ้ำในเส้นทางเดียวกัน (dialog ไม่เสนอจุดที่มีแล้ว + 409 จากเซิร์ฟเวอร์)
/// - ดูอย่างเดียวเมื่อไม่มีสิทธิ์ ROUTE.EDIT
class RouteEditorPage extends ConsumerStatefulWidget {
  const RouteEditorPage({super.key, this.route});

  final Route? route;

  @override
  ConsumerState<RouteEditorPage> createState() => _RouteEditorPageState();
}

class _RouteEditorPageState extends ConsumerState<RouteEditorPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final List<_StopRow> _rows = [];
  bool _saving = false;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = widget.route?.routeName ?? '';
    _descCtrl.text = widget.route?.description ?? '';
    for (final stop in widget.route?.stops ?? const <RouteStop>[]) {
      _appendRow(
        stopId: stop.stopId,
        stopName: stop.stopName,
        minutesText: stop.travelMinutes.toString(),
      );
    }
    _nameCtrl.addListener(_rebuild);
    _descCtrl.addListener(_rebuild);
  }

  @override
  void dispose() {
    _nameCtrl.removeListener(_rebuild);
    _descCtrl.removeListener(_rebuild);
    _nameCtrl.dispose();
    _descCtrl.dispose();
    for (final row in _rows) {
      row.minutes.removeListener(_rebuild);
      row.dispose();
    }
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  void _appendRow({
    required int stopId,
    required String stopName,
    required String minutesText,
  }) {
    final row = _StopRow(
      stopId: stopId,
      stopName: stopName,
      minutes: minutesText,
    );
    row.minutes.addListener(_rebuild);
    _rows.add(row);
  }

  /// BR-01 — ผลรวมสดจากแถวทั้งหมด (ค่าที่แปลงไม่ได้นับเป็น 0 และถูกบล็อกโดย validator)
  int get _totalMinutes => [
        for (final row in _rows) int.tryParse(row.minutes.text.trim()) ?? 0,
      ].fold<int>(0, (sum, minutes) => sum + minutes);

  bool get _canEdit => ref
      .watch(authControllerProvider.select((state) => state.can('ROUTE.EDIT')));

  void _move(int index, int offset) {
    final target = index + offset;
    if (target < 0 || target >= _rows.length) return;
    setState(() {
      final row = _rows.removeAt(index);
      _rows.insert(target, row);
    });
  }

  void _remove(int index) {
    setState(() {
      _rows.removeAt(index).minutes
        ..removeListener(_rebuild)
        ..dispose();
    });
  }

  Future<void> _addStop() async {
    final taken = {for (final row in _rows) row.stopId};
    final result = await showDialog<AddStopResult>(
      context: context,
      builder: (context) => AddRouteStopDialog(takenStopIds: taken),
    );
    if (result == null || !mounted) return;
    setState(() {
      _appendRow(
        stopId: result.stopId,
        stopName: result.stopName,
        minutesText: result.minutesText,
      );
    });
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_rows.length < 2) return; // ข้อความ `route-min-stops` แสดงอยู่แล้ว
    setState(() {
      _saving = true;
      _saveError = null;
    });
    final description = _descCtrl.text.trim();
    final body = <String, dynamic>{
      'routeName': _nameCtrl.text.trim(),
      if (description.isNotEmpty) 'description': description,
      'totalMinutes': _totalMinutes, // BR-01 — คำนวณฝั่ง client ส่งให้ API ตรวจ
      'stops': [
        for (final row in _rows)
          {
            'stopId': row.stopId,
            'travelMinutes': int.parse(row.minutes.text.trim()),
          },
      ],
    };
    final repository = ref.read(frontRepositoryProvider);
    try {
      if (widget.route == null) {
        await repository.createRoute(body);
      } else {
        await repository.updateRoute(widget.route!.routeId, body);
      }
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

  String? _minutesValidator(String? value) {
    final text = value?.trim() ?? '';
    final minutes = int.tryParse(text);
    if (minutes == null || minutes < 0) {
      return 'นาทีต้องเป็นจำนวนเต็มไม่น้อยกว่า 0';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canEdit = _canEdit;
    final minStopsShown = _rows.length < 2;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.route == null ? 'เพิ่มเส้นทาง' : 'แก้ไขเส้นทาง'),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_saveError != null)
            Container(
              key: const Key('route-save-error'),
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
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
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                children: [
                  TextFormField(
                    key: const Key('route-name'),
                    controller: _nameCtrl,
                    enabled: canEdit && !_saving,
                    decoration:
                        const InputDecoration(labelText: 'ชื่อเส้นทาง *'),
                    maxLength: 100,
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.isEmpty) return 'กรุณากรอกชื่อเส้นทาง';
                      if (text.length > 100) return 'ต้องไม่เกิน 100 ตัวอักษร';
                      return null;
                    },
                  ),
                  TextFormField(
                    key: const Key('route-description'),
                    controller: _descCtrl,
                    enabled: canEdit && !_saving,
                    decoration: const InputDecoration(labelText: 'รายละเอียด'),
                    maxLength: 300,
                  ),
                  const SizedBox(height: 8),
                  // BR-01 — ผู้ใช้ห้ามพิมพ์เอง แสดงผลอย่างเดียว
                  Container(
                    key: const Key('route-total'),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'เวลารวมทั้งเส้นทาง: $_totalMinutes นาที',
                      style: TextStyle(
                        color: theme.colorScheme.onSecondaryContainer,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (minStopsShown)
                    Padding(
                      key: const Key('route-min-stops'),
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'ต้องมีจุดจอดอย่างน้อย 2 จุด',
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'ลำดับจุดจอด',
                          style: theme.textTheme.titleSmall,
                        ),
                      ),
                      if (canEdit)
                        FilledButton.tonalIcon(
                          key: const Key('add-stop'),
                          onPressed: _saving ? null : _addStop,
                          icon: const Icon(Icons.add),
                          label: const Text('เพิ่มจุดจอด'),
                        ),
                    ],
                  ),
                  if (_rows.isEmpty)
                    Padding(
                      key: const Key('route-stops-empty'),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'ยังไม่มีจุดจอดในเส้นทางนี้',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                  for (var index = 0; index < _rows.length; index++)
                    _buildRow(index, canEdit),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
          if (canEdit)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: FilledButton(
                  key: const Key('route-save'),
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('บันทึกเส้นทาง'),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRow(int index, bool canEdit) {
    final row = _rows[index];
    final editable = canEdit && !_saving;
    return Container(
      key: Key('route-stop-row-$index'),
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            child: Text(
              '${index + 1}',
              key: Key('route-stop-seq-$index'),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.stopName,
                  key: Key('route-stop-name-$index'),
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(
                  width: 130,
                  child: TextFormField(
                    key: Key('travel-minutes-$index'),
                    controller: row.minutes,
                    enabled: editable,
                    decoration: const InputDecoration(
                      labelText: 'นาทีจากจุดก่อน',
                      isDense: true,
                    ),
                    keyboardType: TextInputType.number,
                    validator: _minutesValidator,
                  ),
                ),
              ],
            ),
          ),
          if (canEdit)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  key: Key('move-up-$index'),
                  tooltip: 'เลื่อนขึ้น',
                  icon: const Icon(Icons.arrow_upward),
                  onPressed:
                      !_saving && index > 0 ? () => _move(index, -1) : null,
                ),
                IconButton(
                  key: Key('move-down-$index'),
                  tooltip: 'เลื่อนลง',
                  icon: const Icon(Icons.arrow_downward),
                  onPressed: !_saving && index < _rows.length - 1
                      ? () => _move(index, 1)
                      : null,
                ),
                IconButton(
                  key: Key('remove-stop-$index'),
                  tooltip: 'ลบออกจากเส้นทาง',
                  icon: const Icon(Icons.delete_outline),
                  onPressed: !_saving ? () => _remove(index) : null,
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Dialog เลือกจุดจอด (ที่ยังไม่อยู่ในเส้นทาง) + นาทีจากจุดก่อนหน้า
class AddRouteStopDialog extends ConsumerStatefulWidget {
  const AddRouteStopDialog({super.key, required this.takenStopIds});

  final Set<int> takenStopIds;

  @override
  ConsumerState<AddRouteStopDialog> createState() => _AddRouteStopDialogState();
}

class _AddRouteStopDialogState extends ConsumerState<AddRouteStopDialog> {
  final _formKey = GlobalKey<FormState>();
  final _minutesCtrl = TextEditingController(text: '0');
  Stop? _selected;

  @override
  void dispose() {
    _minutesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stops = ref.watch(stopsProvider(''));
    // BR-03 — ไม่เสนอจุดที่อยู่ในเส้นทางนี้แล้ว (กันซ้ำฝั่ง UI)
    final available = stops.valueOrNull?.where(
          (stop) => !widget.takenStopIds.contains(stop.stopId),
        ) ??
        const <Stop>[];

    return AlertDialog(
      title: const Text('เพิ่มจุดจอดเข้าเส้นทาง'),
      content: SizedBox(
        width: 420,
        child: stops.isLoading && stops.valueOrNull == null
            ? const SizedBox(
                height: 80,
                child: Center(child: CircularProgressIndicator()),
              )
            : Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (available.isEmpty)
                      const Text(
                        'ไม่มีจุดจอดที่เพิ่มได้',
                        key: Key('add-stop-empty'),
                      )
                    else ...[
                      DropdownButtonFormField<Stop>(
                        key: const Key('add-stop-select'),
                        isExpanded: true,
                        initialValue: _selected,
                        decoration:
                            const InputDecoration(labelText: 'จุดจอด *'),
                        items: [
                          for (final stop in available)
                            DropdownMenuItem<Stop>(
                              value: stop,
                              child: Text(stop.stopName),
                            ),
                        ],
                        onChanged: (value) => setState(() => _selected = value),
                        validator: (value) =>
                            value == null ? 'กรุณาเลือกจุดจอด' : null,
                      ),
                      TextFormField(
                        key: const Key('add-stop-minutes'),
                        controller: _minutesCtrl,
                        decoration: const InputDecoration(
                          labelText: 'นาทีจากจุดก่อนหน้า *',
                        ),
                        keyboardType: TextInputType.number,
                        validator: (value) {
                          final minutes = int.tryParse(
                            value?.trim() ?? '',
                          );
                          if (minutes == null || minutes < 0) {
                            return 'นาทีต้องเป็นจำนวนเต็มไม่น้อยกว่า 0';
                          }
                          return null;
                        },
                      ),
                    ],
                  ],
                ),
              ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('ยกเลิก'),
        ),
        FilledButton(
          key: const Key('add-stop-confirm'),
          onPressed: available.isEmpty
              ? null
              : () {
                  if (!(_formKey.currentState?.validate() ?? false)) return;
                  final stop = _selected;
                  if (stop == null) return;
                  Navigator.of(context).pop(AddStopResult(
                    stopId: stop.stopId,
                    stopName: stop.stopName,
                    minutesText: _minutesCtrl.text.trim(),
                  ));
                },
          child: const Text('เพิ่ม'),
        ),
      ],
    );
  }
}
