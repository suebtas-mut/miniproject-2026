import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../master/widgets/list_states.dart';
import 'report_export.dart';
import 'report_models.dart';
import 'report_providers.dart';

/// เนื้อหาของรายงาน R6 (UC-29) — สถิติการใช้งานรถแต่ละคัน
///
/// โหลดอัตโนมัติตาม [reportR1QueryProvider] ปัจจุบัน (ปี/ช่วงวันที่ร่วมกัน
/// ทุกแท็บ) · สถานะ: โหลด · ผิดพลาด+ลองอีกครั้ง · ว่าง · มีข้อมูล
class ReportR6View extends ConsumerWidget {
  const ReportR6View({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(reportR1QueryProvider);
    final async = ref.watch(reportR6Provider(query));

    return async.when(
      loading: () => const LoadingState(label: 'กำลังโหลดรายงาน R6...'),
      error: (error, stackTrace) => ErrorState(
        message: describeFailure(error),
        onRetry: () => ref.invalidate(reportR6Provider(query)),
      ),
      data: (report) {
        if (report.rows.isEmpty) {
          return const EmptyState(
            message: 'ไม่มีข้อมูลการใช้งานรถในช่วงวันที่เลือก',
          );
        }
        return _R6Content(report: report);
      },
    );
  }
}

class _R6Content extends StatelessWidget {
  const _R6Content({required this.report});

  final ReportR6 report;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      key: const Key('r6-content'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Align(
            alignment: Alignment.centerRight,
            child: ReportExportButton(
              reportId: 'r6',
              buttonKey: Key('r6-export'),
            ),
          ),
          _R6Summary(
            totalTrips: report.totalTrips,
            totalPassengers: report.totalPassengers,
            totalMinutes: report.totalMinutes,
            busiest: report.busiestVehicle,
          ),
          const SizedBox(height: 16),
          Text(
            'ผู้โดยสารแยกตามรถ',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _R6Chart(
            key: const Key('r6-chart'),
            labels: [for (final row in report.rows) row.plateNo],
            passengers: [for (final row in report.rows) row.totalPassengers],
          ),
          const SizedBox(height: 16),
          Text(
            'ตารางรายละเอียดรายคัน',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _R6Table(key: const Key('r6-table'), rows: report.rows),
        ],
      ),
    );
  }
}

class _R6Summary extends StatelessWidget {
  const _R6Summary({
    required this.totalTrips,
    required this.totalPassengers,
    required this.totalMinutes,
    required this.busiest,
  });

  final int totalTrips;
  final int totalPassengers;
  final int totalMinutes;
  final ReportR6Row? busiest;

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
      key: const Key('r6-summary'),
      spacing: 8,
      runSpacing: 8,
      children: [
        SizedBox(
          width: 140,
          child: card('r6-kpi-trips', 'รวมรอบ', '$totalTrips'),
        ),
        SizedBox(
          width: 160,
          child: card('r6-kpi-passengers', 'ผู้โดยสารรวม', '$totalPassengers'),
        ),
        SizedBox(
          width: 150,
          child: card('r6-kpi-minutes', 'รวมนาที', '$totalMinutes'),
        ),
        SizedBox(
          width: 170,
          child: card(
            'r6-kpi-busiest',
            'รถที่คนเยอะสุด',
            busiest?.plateNo ?? '-',
          ),
        ),
      ],
    );
  }
}

class _R6Chart extends StatelessWidget {
  const _R6Chart({
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
    final chartWidth = (labels.length * 80.0).clamp(300.0, 2400.0);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: chartWidth,
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
                      width: 24,
                      color: scheme.secondary,
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
                  reservedSize: 36,
                  getTitlesWidget: (value, meta) {
                    final index = value.toInt();
                    if (index < 0 || index >= labels.length) {
                      return const SizedBox.shrink();
                    }
                    return Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        labels[index],
                        key: Key('r6-chart-x-$index'),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _R6Table extends StatelessWidget {
  const _R6Table({super.key, required this.rows});

  final List<ReportR6Row> rows;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: const [
          DataColumn(label: Text('ทะเบียนรถ')),
          DataColumn(label: Text('รอบ'), numeric: true),
          DataColumn(label: Text('ผู้โดยสาร'), numeric: true),
          DataColumn(label: Text('นาที'), numeric: true),
        ],
        rows: [
          for (final row in rows)
            DataRow(
              cells: [
                DataCell(Text(
                  row.plateNo,
                  key: Key('r6-plate-${row.vehId}'),
                )),
                DataCell(Text('${row.totalTrips}')),
                DataCell(Text('${row.totalPassengers}')),
                DataCell(Text('${row.totalMinutes}')),
              ],
            ),
        ],
      ),
    );
  }
}
