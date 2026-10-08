import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_error.dart';
import '../master/widgets/list_states.dart';
import 'report_export.dart';
import 'report_models.dart';
import 'report_providers.dart';

/// เนื้อหาของรายงาน R1 (UC-27) — ตารางรายวัน + กราฟ `fl_chart` + KPI สรุป
///
/// โหลดอัตโนมัติตาม [reportR1QueryProvider] ปัจจุบัน · สถานะ:
/// โหลด (`list-loading`) · ผิดพลาด (`list-error-message` + ลองอีกครั้ง) ·
/// ว่าง (`list-empty`) · มีข้อมูล (KPI + กราฟ + ตาราง)
class ReportR1View extends ConsumerWidget {
  const ReportR1View({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(reportR1QueryProvider);
    final async = ref.watch(reportR1Provider(query));

    return async.when(
      loading: () => const LoadingState(label: 'กำลังโหลดรายงาน R1...'),
      error: (error, stackTrace) => ErrorState(
        message: describeFailure(error),
        onRetry: () => ref.invalidate(reportR1Provider(query)),
      ),
      data: (report) {
        if (report.rows.isEmpty) {
          return const EmptyState(
            message: 'ไม่มีข้อมูลการเดินรถในช่วงวันที่เลือก',
          );
        }
        return _R1Content(report: report);
      },
    );
  }
}

class _R1Content extends StatelessWidget {
  const _R1Content({required this.report});

  final ReportR1 report;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      key: const Key('r1-content'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Align(
            alignment: Alignment.centerRight,
            child: ReportExportButton(
              reportId: 'r1',
              buttonKey: Key('r1-export'),
            ),
          ),
          _SummaryCards(
            totalTrips: report.totalTrips,
            totalPassengers: report.totalPassengers,
            totalCompleted: report.totalCompleted,
            totalNoShow: report.totalNoShow,
            overallRate: report.overallAttendanceRate,
          ),
          const SizedBox(height: 16),
          Text(
            'จำนวนผู้โดยสารรายวัน',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _PassengersChart(
            key: const Key('r1-chart'),
            labels: [for (final row in report.rows) row.shortDate],
            passengers: [for (final row in report.rows) row.totalPassengers],
            completed: [for (final row in report.rows) row.completed],
          ),
          const SizedBox(height: 16),
          Text(
            'ตารางรายละเอียดรายวัน',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _R1Table(key: const Key('r1-table'), rows: report.rows),
        ],
      ),
    );
  }
}

class _SummaryCards extends StatelessWidget {
  const _SummaryCards({
    required this.totalTrips,
    required this.totalPassengers,
    required this.totalCompleted,
    required this.totalNoShow,
    required this.overallRate,
  });

  final int totalTrips;
  final int totalPassengers;
  final int totalCompleted;
  final int totalNoShow;
  final double overallRate;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    Widget card(String key, String label, String value, {Color? color}) => Card(
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
                        color: color ?? scheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        );

    return Wrap(
      key: const Key('r1-summary'),
      spacing: 8,
      runSpacing: 8,
      children: [
        SizedBox(
          width: 150,
          child: card('r1-kpi-trips', 'รวมรอบ', '$totalTrips'),
        ),
        SizedBox(
          width: 150,
          child: card('r1-kpi-passengers', 'ผู้โดยสาร', '$totalPassengers'),
        ),
        SizedBox(
          width: 150,
          child: card(
            'r1-kpi-completed',
            'ขึ้นรถจริง',
            '$totalCompleted',
            color: scheme.tertiary,
          ),
        ),
        SizedBox(
          width: 150,
          child: card(
            'r1-kpi-noshow',
            'ไม่มา',
            '$totalNoShow',
            color: scheme.error,
          ),
        ),
        SizedBox(
          width: 170,
          child: card(
            'r1-kpi-rate',
            'อัตราการมาเฉลี่ย',
            '${overallRate.toStringAsFixed(2)}%',
          ),
        ),
      ],
    );
  }
}

class _PassengersChart extends StatelessWidget {
  const _PassengersChart({
    super.key,
    required this.labels,
    required this.passengers,
    required this.completed,
  });

  final List<String> labels;
  final List<int> passengers;
  final List<int> completed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final maxYValue = [
      ...passengers,
      ...completed,
    ].fold<double>(0, (max, value) => value > max ? value.toDouble() : max);
    final chartWidth = (labels.length * 56.0).clamp(300.0, 2400.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: chartWidth,
            height: 240,
            child: BarChart(
              BarChartData(
                maxY: maxYValue <= 0 ? 10 : maxYValue * 1.2,
                barGroups: [
                  for (var i = 0; i < labels.length; i++)
                    BarChartGroupData(
                      x: i,
                      barsSpace: 4,
                      barRods: [
                        BarChartRodData(
                          toY: passengers[i].toDouble(),
                          width: 10,
                          color: scheme.primary,
                        ),
                        BarChartRodData(
                          toY: completed[i].toDouble(),
                          width: 10,
                          color: scheme.tertiary,
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
                            key: Key('r1-chart-x-$index'),
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
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 16,
          children: [
            _legend(context, scheme.primary, 'ผู้โดยสารทั้งหมด'),
            _legend(context, scheme.tertiary, 'ขึ้นรถจริง (completed)'),
          ],
        ),
      ],
    );
  }

  Widget _legend(BuildContext context, Color color, String label) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 12, height: 12, color: color),
          const SizedBox(width: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      );
}

class _R1Table extends StatelessWidget {
  const _R1Table({super.key, required this.rows});

  final List<ReportR1Row> rows;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: const [
          DataColumn(label: Text('วันที่')),
          DataColumn(label: Text('เส้นทาง')),
          DataColumn(label: Text('รอบ'), numeric: true),
          DataColumn(label: Text('ผู้โดยสาร'), numeric: true),
          DataColumn(label: Text('ขึ้นจริง'), numeric: true),
          DataColumn(label: Text('ไม่มา'), numeric: true),
          DataColumn(label: Text('อัตราการมา'), numeric: true),
        ],
        rows: [
          for (final row in rows)
            DataRow(
              cells: [
                DataCell(Text(
                  row.serviceDate,
                  key: Key('r1-date-${row.serviceDate}'),
                )),
                DataCell(Text(row.routeName)),
                DataCell(Text('${row.totalTrips}')),
                DataCell(Text('${row.totalPassengers}')),
                DataCell(Text('${row.completed}')),
                DataCell(Text('${row.noShow}')),
                DataCell(Text('${row.attendanceRate.toStringAsFixed(2)}%')),
              ],
            ),
        ],
      ),
    );
  }
}
