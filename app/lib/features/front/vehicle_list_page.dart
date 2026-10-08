import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../master/widgets/list_states.dart';
import 'schedule_models.dart';
import 'schedule_providers.dart';

/// T-033 (UC-13) — รายการรถ (`GET /vehicles`)
/// ดู: ผู้ใช้โมดูลหน้า · เพิ่มรถ/ประเภทรถ: VEH.EDIT (OpenAPI `x-permission`)
/// OpenAPI ไม่มี PUT/PATCH /vehicles — จึงไม่มีฟอร์มแก้ไขรถ
class VehicleListPage extends ConsumerWidget {
  const VehicleListPage({super.key});

  Future<void> _createVehicle(BuildContext context, WidgetRef ref) async {
    final saved = await VehicleFormDialog.show(context);
    if (saved == true && context.mounted) {
      refreshVehicles(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('เพิ่มรถแล้ว')),
      );
    }
  }

  Future<void> _createVehicleType(BuildContext context, WidgetRef ref) async {
    final saved = await VehicleTypeFormDialog.show(context);
    if (saved == true && context.mounted) {
      refreshVehicleTypes(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('เพิ่มประเภทรถแล้ว')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicles = ref.watch(vehiclesProvider);
    // T-033 — ซ่อนปุ่มเพิ่มที่ไม่มีสิทธิ์ VEH.EDIT (OpenAPI x-permission)
    final canEdit = ref
        .watch(authControllerProvider.select((state) => state.can('VEH.EDIT')));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'รถทั้งหมด',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (canEdit) ...[
                TextButton.icon(
                  key: const Key('vtype-create'),
                  onPressed: () => _createVehicleType(context, ref),
                  icon: const Icon(Icons.add),
                  label: const Text('ประเภทรถ'),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  key: const Key('veh-create'),
                  onPressed: () => _createVehicle(context, ref),
                  icon: const Icon(Icons.add),
                  label: const Text('เพิ่มรถ'),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<List<Vehicle>>(
            value: vehicles,
            onRetry: () => ref.invalidate(vehiclesProvider),
            builder: (items) {
              if (items.isEmpty) {
                return const EmptyState(message: 'ยังไม่มีรถในระบบ');
              }
              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final vehicle = items[index];
                  return ListTile(
                    key: Key('veh-${vehicle.vehId}'),
                    leading: const Icon(Icons.directions_bus_outlined),
                    title: Text(vehicle.plateNo),
                    subtitle: Text(
                      '${vehicle.typeName} · ${vehicle.capacity} ที่นั่ง',
                      key: Key('veh-info-${vehicle.vehId}'),
                    ),
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

/// ฟอร์มเพิ่มรถ — VehicleInput (plateNo จำเป็น ≤20, vtypeId จำเป็น) · 409 ทะเบียนซ้ำ
class VehicleFormDialog extends ConsumerStatefulWidget {
  const VehicleFormDialog({super.key});

  static Future<bool?> show(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (context) => const VehicleFormDialog(),
    );
  }

  @override
  ConsumerState<VehicleFormDialog> createState() => _VehicleFormDialogState();
}

class _VehicleFormDialogState extends ConsumerState<VehicleFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _plateCtrl = TextEditingController();
  int? _vtypeId;
  bool _saving = false;
  String? _saveError;

  @override
  void dispose() {
    _plateCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_vtypeId == null) return;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    final body = <String, dynamic>{
      'plateNo': _plateCtrl.text.trim(),
      'vtypeId': _vtypeId,
    };
    try {
      await ref.read(scheduleRepositoryProvider).createVehicle(body);
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
    final types =
        ref.watch(vehicleTypesProvider).valueOrNull ?? const <VehicleType>[];
    return AlertDialog(
      title: const Text('เพิ่มรถ'),
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
                    key: const Key('veh-form-save-error'),
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
                TextFormField(
                  key: const Key('veh-form-plate'),
                  controller: _plateCtrl,
                  decoration: const InputDecoration(labelText: 'ทะเบียนรถ *'),
                  maxLength: 20,
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'กรุณากรอกทะเบียนรถ';
                    if (text.length > 20) return 'ต้องไม่เกิน 20 ตัวอักษร';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  key: const Key('veh-form-type'),
                  initialValue: _vtypeId,
                  hint: const Text('เลือกประเภทรถ *'),
                  isExpanded: true,
                  items: [
                    for (final type in types)
                      DropdownMenuItem<int>(
                        value: type.vtypeId,
                        child: Text(
                          '${type.typeName} · ${type.capacity} ที่นั่ง',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) => setState(() => _vtypeId = value),
                  validator: (value) =>
                      value == null ? 'กรุณาเลือกประเภทรถ' : null,
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
          key: const Key('veh-form-save'),
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

/// ฟอร์มเพิ่มประเภทรถ — VehicleTypeInput (typeName ≤50, capacity ≥1)
class VehicleTypeFormDialog extends ConsumerStatefulWidget {
  const VehicleTypeFormDialog({super.key});

  static Future<bool?> show(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (context) => const VehicleTypeFormDialog(),
    );
  }

  @override
  ConsumerState<VehicleTypeFormDialog> createState() =>
      _VehicleTypeFormDialogState();
}

class _VehicleTypeFormDialogState extends ConsumerState<VehicleTypeFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  bool _saving = false;
  String? _saveError;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _capacityCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    final body = <String, dynamic>{
      'typeName': _nameCtrl.text.trim(),
      'capacity': int.parse(_capacityCtrl.text.trim()),
    };
    try {
      await ref.read(scheduleRepositoryProvider).createVehicleType(body);
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
    return AlertDialog(
      title: const Text('เพิ่มประเภทรถ'),
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
                    key: const Key('vtype-form-save-error'),
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
                TextFormField(
                  key: const Key('vtype-form-name'),
                  controller: _nameCtrl,
                  decoration:
                      const InputDecoration(labelText: 'ชื่อประเภทรถ *'),
                  maxLength: 50,
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'กรุณากรอกชื่อประเภทรถ';
                    if (text.length > 50) return 'ต้องไม่เกิน 50 ตัวอักษร';
                    return null;
                  },
                ),
                TextFormField(
                  key: const Key('vtype-form-capacity'),
                  controller: _capacityCtrl,
                  decoration:
                      const InputDecoration(labelText: 'จำนวนที่นั่ง *'),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'กรุณากรอกจำนวนที่นั่ง';
                    final capacity = int.tryParse(text);
                    if (capacity == null) return 'ต้องเป็นตัวเลขจำนวนเต็ม';
                    if (capacity < 1) return 'ต้องมากกว่า 0';
                    return null;
                  },
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
          key: const Key('vtype-form-save'),
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
