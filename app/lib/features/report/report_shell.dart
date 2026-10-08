import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';
import '../front/front_providers.dart';
import 'report_providers.dart';
import 'report_r1_view.dart';
import 'report_r4_view.dart';
import 'report_r6_view.dart';

/// ปี พ.ศ. ที่เมนูรายงานเสนอ (ปี 2568 = ปีที่มีข้อมูล seed ตามแผน T-052)
const List<int> kReportYears = [2568, 2567];

/// แปลงสตริง `yyyy-MM-dd` (คริสต์ศักราช) เป็นข้อความ `dd/MM/พ.ศ.` สำหรับแสดงผล
String buddhistDateLabel(String isoDate) {
  final parts = isoDate.split('-');
  if (parts.length != 3) return isoDate;
  final day = parts[2];
  final month = parts[1];
  final year = int.tryParse(parts[0]);
  if (year == null) return isoDate;
  return '$day/$month/${gregorianToBuddhist(year)}';
}

/// จอรายงาน (UC-30) — เลือกปี/ช่วงวันที่/เส้นทาง + แท็บ R1/R4/R6
///
/// - ตัวกรอง: ปีข้อมูล (พ.ศ. เริ่มต้น 2568) · ช่วงวันที่ (คริสต์ศักราชส่งให้ API) ·
///   เส้นทาง (ใช้กับ R1 เท่านั้น ตามสเปก) — เปลี่ยนเมื่อไหร่ทุกแท็บโหลดใหม่
/// - แท็บ R1 (T-058) · R4 (T-059) · R6 (T-059) — แต่ละแท็บตรวจสิทธิ์ของตัวเอง
///   (`RPT.R1` / `RPT.R4` / `RPT.R6`) · ไม่มีสิทธิ์ → ข้อความไม่มีสิทธิ์ (ไม่ยิง API)
class ReportShell extends ConsumerWidget {
  const ReportShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final query = ref.watch(reportR1QueryProvider);
    final canViewR1 = auth.can('RPT.R1');
    final canViewR4 = auth.can('RPT.R4');
    final canViewR6 = auth.can('RPT.R6');

    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          _FilterBar(
            query: query,
            anyReportVisible: canViewR1 || canViewR4 || canViewR6,
          ),
          const TabBar(
            tabs: [
              Tab(key: Key('report-tab-r1'), text: 'R1'),
              Tab(key: Key('report-tab-r4'), text: 'R4'),
              Tab(key: Key('report-tab-r6'), text: 'R6'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                canViewR1
                    ? const ReportR1View()
                    : const _NoReportPermission(permission: 'RPT.R1'),
                canViewR4
                    ? const ReportR4View()
                    : const _NoReportPermission(permission: 'RPT.R4'),
                canViewR6
                    ? const ReportR6View()
                    : const _NoReportPermission(permission: 'RPT.R6'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterBar extends ConsumerWidget {
  const _FilterBar({required this.query, required this.anyReportVisible});

  final ReportR1Query query;
  final bool anyReportVisible;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routes = ref.watch(routesProvider).valueOrNull ?? const [];
    final controller = ref.read(reportR1QueryProvider.notifier);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Wrap(
        spacing: 12,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          // ปีข้อมูล (พ.ศ.)
          DropdownMenu<int>(
            key: const Key('report-year'),
            initialSelection: query.year,
            label: const Text('ปีข้อมูล'),
            dropdownMenuEntries: [
              for (final year in kReportYears)
                DropdownMenuEntry(value: year, label: '$year'),
            ],
            onSelected: (year) {
              if (year != null) controller.setYear(year);
            },
          ),
          // ช่วงวันที่ (แสดงเป็น พ.ศ., ส่งเป็น คริสต์ศักราช)
          OutlinedButton.icon(
            key: const Key('report-date-range'),
            onPressed: anyReportVisible
                ? () => _pickDateRange(context, controller)
                : null,
            icon: const Icon(Icons.date_range),
            label: Text(
              '${buddhistDateLabel(query.from)} – ${buddhistDateLabel(query.to)}',
            ),
          ),
          // เส้นทาง (ใช้กับ R1 — ไม่บังคับ)
          DropdownMenu<int>(
            key: const Key('report-route'),
            initialSelection: query.routeId,
            label: const Text('เส้นทาง'),
            dropdownMenuEntries: [
              for (final route in routes)
                DropdownMenuEntry(
                  value: route.routeId,
                  label: route.routeName,
                ),
            ],
            onSelected: controller.setRouteId,
          ),
        ],
      ),
    );
  }

  Future<void> _pickDateRange(
    BuildContext context,
    ReportR1QueryController controller,
  ) async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(buddhistToGregorian(2560), 1, 1),
      lastDate: DateTime(buddhistToGregorian(2570), 12, 31),
    );
    if (picked == null) return;
    controller.setDateRange(picked.start, picked.end);
  }
}

class _NoReportPermission extends StatelessWidget {
  const _NoReportPermission({required this.permission});

  final String permission;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final reportName = permission.replaceFirst('RPT.', '');
    return Center(
      key: const Key('report-no-permission'),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.lock_outline, size: 48, color: scheme.outline),
          const SizedBox(height: 12),
          Text(
            'ไม่มีสิทธิ์ดูรายงาน $reportName (ต้องมีสิทธิ์ $permission)',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
