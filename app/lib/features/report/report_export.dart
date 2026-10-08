import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import 'report_providers.dart';

/// ปุ่มส่งออกรายงาน (UC-30) — เป็น dialog เลือกรูปแบบ CSV / Excel (.xlsx)
///
/// เรียก `GET /api/v1/reports/{reportId}/export?format=...` (สิทธิ์ของรายงาน
/// เดียวกัน) · ไม่มี deps บันทึกไฟล์ — แสดงตัวอย่างเนื้อหา CSV (สูงสุด ~15 บรรทัด)
/// หรือจำนวนไบต์สำหรับ xlsx · error แสดงข้อความใน dialog เดียวกัน
class ReportExportButton extends ConsumerWidget {
  const ReportExportButton({
    super.key,
    required this.reportId,
    required this.buttonKey,
  });

  /// `r1` | `r4` | `r6` — ตรงกับ enum `reportId` ของ OpenAPI export
  final String reportId;

  /// key ของปุ่ม กันชนกันเมื่อมีหลายแท็บใน tree เดียวกัน
  final Key buttonKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OutlinedButton.icon(
      key: buttonKey,
      onPressed: () => _showFormatDialog(context, ref),
      icon: const Icon(Icons.download),
      label: const Text('ส่งออก'),
    );
  }

  Future<void> _showFormatDialog(BuildContext context, WidgetRef ref) async {
    final format = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('ส่งออกรายงาน ${reportId.toUpperCase()}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FilledButton(
              key: Key('export-$reportId-csv'),
              onPressed: () => Navigator.of(dialogContext).pop('csv'),
              child: const Text('CSV'),
            ),
            const SizedBox(height: 8),
            FilledButton.tonal(
              key: Key('export-$reportId-xlsx'),
              onPressed: () => Navigator.of(dialogContext).pop('xlsx'),
              child: const Text('Excel (.xlsx)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('ยกเลิก'),
          ),
        ],
      ),
    );
    if (format == null || !context.mounted) return;
    await _runExport(context, ref, format);
  }

  Future<void> _runExport(
    BuildContext context,
    WidgetRef ref,
    String format,
  ) async {
    final scaffold = ScaffoldMessenger.of(context);
    try {
      final file = await ref
          .read(reportRepositoryProvider)
          .exportReport(reportId, format: format);
      if (!context.mounted) return;
      final preview = file.format == 'csv'
          ? _previewLines(file.text)
          : 'ไฟล์ไบนารี ${file.bytes.length} ไบต์ (บันทึกไฟล์จริงทำได้บนอุปกรณ์ '
              '— ไม่มีในเวอร์ชันทดสอบ)';
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          key: Key('export-$reportId-result'),
          title: Text('ส่งออกสำเร็จ: ${file.fileName}'),
          content: SingleChildScrollView(
            child: SelectableText(
              preview,
              key: Key('export-$reportId-preview'),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('ปิด'),
            ),
          ],
        ),
      );
    } on Exception catch (error) {
      scaffold.showSnackBar(
        SnackBar(content: Text(describeFailure(error))),
      );
    }
  }

  /// ตัวอย่าง CSV — สูงสุด 15 บรรทัดแรก
  static String _previewLines(String csv) {
    final lines = const LineSplitter().convert(csv);
    if (lines.length <= 15) return csv;
    return '${lines.take(15).join('\n')}\n… (${lines.length} บรรทัดทั้งหมด)';
  }
}
