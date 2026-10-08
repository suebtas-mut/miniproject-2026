import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../master/widgets/list_states.dart';
import 'report_export.dart';
import 'report_models.dart';
import 'report_providers.dart';

/// เนื้อหาของรายงาน R4 (UC-28) — ผู้โดยสารแยกช่วงเวลา (เช้า/บ่าย/เย็น)
///
/// โหลดอัตโนมัติตาม [reportR1QueryProvider] ปัจจุบัน (ปี/ช่วงวันที่ร่วมกัน
/// ทุกแท็บ) · สถานะ: โหลด · ผิดพลาด+ลองอีกครั้ง · ว่าง · มีข้อมูล
class ReportR4View extends ConsumerWidget {
  const ReportR4View({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(reportR1QueryProvider);
    final async = ref.watch(reportR4Provider(query));

    return async.when(
      loading: () => const LoadingState(label: 'กำลังโหลดรายงาน R4...'),
      error: (error, stackTrace) => ErrorState(
        message: describeFailure(error),
        onRetry: () => ref.invalidate(reportR4Provider(query)),
      ),
      data: (report) {
        if (report.rows.isEmpty) {
          return const EmptyState(
            message: 'ไม่มีข้อมูลผู้โดยสารในช่วงวันที่เลือก',
          );
        }
        return _R4Content(report: report);
      },
    );
  }
}

class _R4Content extends StatelessWidget {
  const _R4Content({required this.report});

  final ReportR4 report;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      key: const Key('r4-content'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Align(
            alignment: Alignment.centerRight,
            child: ReportExportButton(
              reportId: 'r4',
              buttonKey: Key('r4-export'),
            ),
          ),
          _R4Summary(
            totalPassengers: report.totalPassengers,
            busiest: report.busiestPeriod,
          ),
          const SizedBox(height: 16),
          Text(
            'ผู้โดยสารแยกตามช่วงเวลา',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _R4Chart(
            key: const Key('r4-chart'),
            labels: [for (final row in report.rows) row.periodLabel],
            passengers: [for (final row in report.rows) row.totalPassengers],
          ),
          const SizedBox(height: 16),
          Text(
            'ตารางรายละเอียดรายช่วงเวลา',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _R4Table(key: const Key('r4-table'), rows: report.rows),
        ],
      ),
    );
  }
}

class _R4Summary extends StatelessWidget {
  const _R4Summary({required this.totalPassengers, required this.busiest});

  final int totalPassengers;
  final ReportR4Row? busiest;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    Widget card(String key, String label, String value) => Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Text(
                  value,
                  key: Key(key),
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: scheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        );

    return Wrap(
      key: const Key('r4-summary'),
      spacing: 8,
      runSpacing: 8,
      children: [
        SizedBox(
          width: 160,
          child: card('r4-kpi-passengers', 'ผู้โดยสารรวม', '$totalPassengers'),
        ),
        SizedBox(
          width: 180,
          child: card(
            'r4-kpi-busiest',
            'ช่วงที่คนเยอะสุด',
            busiest?.periodLabel ?? '-',
          ),
        ),
      ],
    );
  }
}

class _R4Chart extends StatelessWidget {
  const _R4Chart({
    super.key,
    required this.labels,
    required this.passengers,
  });

  final List<String> labels;
  final List<int> passengers;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final maxYValue =
        passengers.fold<double>(0, (max, v) => v > max ? v.toDouble() : max);

    return SizedBox(
      width: double.infinity,
      height: 220,
      child: BarChart(
        BarChartData(
          maxY: maxYValue <= 0 ? 10 : maxYValue * 1.2,
          barGroups: [
            for (var i = 0; i < labels.length; i++)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: passengers[i].toDouble(),
                    width: 28,
                    color: scheme.primary,
                  ),
                ],
              ),
          ],
          gridData: const FlGridData(show: true),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            leftTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: true, reservedSize: 40),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 32,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index < 0 || index >= labels.length) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      labels[index],
                      key: Key('r4-chart-x-$index'),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _R4Table extends StatelessWidget {
  const _R4Table({super.key, required this.rows});

  final List<ReportR4Row> rows;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: const [
          DataColumn(label: Text('ช่วงเวลา')),
          DataColumn(label: Text('ผู้โดยสาร'), numeric: true),
          DataColumn(label: Text('เฉลี่ย/รอบ'), numeric: true),
        ],
        rows: [
          for (final row in rows)
            DataRow(
              cells: [
                DataCell(Text(
                  row.periodLabel,
                  key: Key('r4-period-${row.period}'),
                )),
                DataCell(Text('${row.totalPassengers}')),
                DataCell(Text(row.avgPerTrip.toStringAsFixed(2))),
              ],
            ),
        ],
      ),
    );
  }
}
