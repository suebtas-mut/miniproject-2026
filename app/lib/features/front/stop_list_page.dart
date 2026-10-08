import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../front/front_models.dart';
import '../front/front_providers.dart';
import '../master/widgets/list_states.dart';

/// UC-11 — จัดการจุดจอด (`/stops`) · ดู: ROUTE.VIEW · เพิ่ม/แก้/ปิดใช้งาน: ROUTE.EDIT
class StopListPage extends ConsumerStatefulWidget {
  const StopListPage({super.key});

  @override
  ConsumerState<StopListPage> createState() => _StopListPageState();
}

class _StopListPageState extends ConsumerState<StopListPage> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _search = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() => _search = value.trim());
    });
  }

  Future<void> _create() async {
    final saved = await StopFormDialog.show(context);
    if (saved == true && mounted) {
      setState(() {
        _search = '';
        _searchCtrl.clear();
      });
      refreshStops(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกจุดจอดแล้ว')),
      );
    }
  }

  Future<void> _edit(Stop stop) async {
    final saved = await StopFormDialog.show(context, stop: stop);
    if (saved == true && mounted) {
      refreshStops(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('บันทึกจุดจอดแล้ว')),
      );
    }
  }

  Future<void> _deactivate(Stop stop) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ปิดใช้งานจุดจอด'),
        content: Text(
          'ต้องการปิดใช้งานจุดจอด "${stop.stopName}" ใช่หรือไม่? '
          'จุดจอดที่ยังถูกอ้างอิงโดยเส้นทางหรือรอบเวลาจะปิดไม่ได้',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('ยกเลิก'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('ปิดใช้งาน'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(frontRepositoryProvider).deactivateStop(stop.stopId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(describeFailure(e))),
      );
      return;
    }
    if (!mounted) return;
    refreshStops(ref, search: _search);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ปิดใช้งานจุดจอดแล้ว')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stops = ref.watch(stopsProvider(_search));
    // T-023/T-028 — ซ่อนปุ่ม/รายการที่ไม่มีสิทธิ์ ROUTE.EDIT (OpenAPI x-permission)
    final canEdit = ref.watch(
        authControllerProvider.select((state) => state.can('ROUTE.EDIT')));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('stop-search'),
                  controller: _searchCtrl,
                  onChanged: _onSearchChanged,
                  decoration: const InputDecoration(
                    hintText: 'ค้นหาจุดจอด (ชื่อ/ที่อยู่)',
                    prefixIcon: Icon(Icons.search),
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              if (canEdit) ...[
                const SizedBox(width: 8),
                FilledButton.icon(
                  key: const Key('stop-create'),
                  onPressed: _create,
                  icon: const Icon(Icons.add),
                  label: const Text('เพิ่มจุดจอด'),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: AsyncSection<List<Stop>>(
            value: stops,
            onRetry: () => ref.invalidate(stopsProvider(_search)),
            builder: (items) {
              if (items.isEmpty) {
                return EmptyState(
                  message: _search.isEmpty
                      ? 'ยังไม่มีจุดจอดในระบบ'
                      : 'ไม่พบจุดจอดที่ค้นหา',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final stop = items[index];
                  return ListTile(
                    key: Key('stop-${stop.stopId}'),
                    leading: const Icon(Icons.place_outlined),
                    title: Text(stop.stopName),
                    subtitle: stop.address == null || stop.address!.isEmpty
                        ? null
                        : Text(stop.address!),
                    trailing: canEdit
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                tooltip: 'แก้ไข',
                                icon: const Icon(Icons.edit_outlined),
                                onPressed: () => _edit(stop),
                              ),
                              IconButton(
                                tooltip: 'ปิดใช้งาน',
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () => _deactivate(stop),
                              ),
                            ],
                          )
                        : null,
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

/// ฟอร์มเพิ่ม/แก้จุดจอด — StopInput (stopName จำเป็น ≤100, address ≤300, พิกัด nullable)
class StopFormDialog extends ConsumerStatefulWidget {
  const StopFormDialog({super.key, this.stop});

  final Stop? stop;

  static Future<bool?> show(BuildContext context, {Stop? stop}) {
    return showDialog<bool>(
      context: context,
      builder: (context) => StopFormDialog(stop: stop),
    );
  }

  @override
  ConsumerState<StopFormDialog> createState() => _StopFormDialogState();
}

class _StopFormDialogState extends ConsumerState<StopFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();
  bool _saving = false;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = widget.stop?.stopName ?? '';
    _addressCtrl.text = widget.stop?.address ?? '';
    _latCtrl.text = widget.stop?.latitude?.toString() ?? '';
    _lngCtrl.text = widget.stop?.longitude?.toString() ?? '';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _addressCtrl.dispose();
    _latCtrl.dispose();
    _lngCtrl.dispose();
    super.dispose();
  }

  String? _numberValidator(String? value, String label) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null; // พิกัด nullable ตาม OpenAPI
    if (double.tryParse(text) == null) return '$label ต้องเป็นตัวเลข';
    return null;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    final address = _addressCtrl.text.trim();
    final latText = _latCtrl.text.trim();
    final lngText = _lngCtrl.text.trim();
    final body = <String, dynamic>{
      'stopName': _nameCtrl.text.trim(),
      if (address.isNotEmpty) 'address': address,
      if (latText.isNotEmpty) 'latitude': double.parse(latText),
      if (lngText.isNotEmpty) 'longitude': double.parse(lngText),
    };
    final repository = ref.read(frontRepositoryProvider);
    try {
      if (widget.stop == null) {
        await repository.createStop(body);
      } else {
        await repository.updateStop(widget.stop!.stopId, body);
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: Text(widget.stop == null ? 'เพิ่มจุดจอด' : 'แก้ไขจุดจอด'),
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
                    key: const Key('stop-save-error'),
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
                  key: const Key('stop-name'),
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'ชื่อจุดจอด *'),
                  maxLength: 100,
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'กรุณากรอกชื่อจุดจอด';
                    if (text.length > 100) return 'ต้องไม่เกิน 100 ตัวอักษร';
                    return null;
                  },
                ),
                TextFormField(
                  key: const Key('stop-address'),
                  controller: _addressCtrl,
                  decoration: const InputDecoration(labelText: 'ที่อยู่'),
                  maxLength: 300,
                ),
                TextFormField(
                  key: const Key('stop-latitude'),
                  controller: _latCtrl,
                  decoration: const InputDecoration(labelText: 'ละติจูด'),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  validator: (value) => _numberValidator(value, 'ละติจูด'),
                ),
                TextFormField(
                  key: const Key('stop-longitude'),
                  controller: _lngCtrl,
                  decoration: const InputDecoration(labelText: 'ลองจิจูด'),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  validator: (value) => _numberValidator(value, 'ลองจิจูด'),
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
          key: const Key('stop-save'),
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
