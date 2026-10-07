import 'package:flutter/material.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('ระบบรถรับส่ง — สำนักงานเขตหนองจอก')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('ยินดีต้อนรับ', style: theme.textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text(
                    'แอปเดียวสำหรับทุกบทบาท: ผู้ดูแลระบบ พนักงาน คนขับ และผู้ใช้บริการ '
                    '— เริ่มที่เมนูด้านล่าง',
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          const _ModuleCard(
            icon: Icons.badge_outlined,
            title: 'ข้อมูลหลัก',
            subtitle: 'พนักงาน · แผนก · ตำแหน่ง · บทบาท · สิทธิ์',
          ),
          const _ModuleCard(
            icon: Icons.route_outlined,
            title: 'เส้นทางและรอบเวลา',
            subtitle: 'จุดจอด · เส้นทาง · รถ · ตารางเดินรถ',
          ),
          const _ModuleCard(
            icon: Icons.event_seat_outlined,
            title: 'จองรถ',
            subtitle: 'เลือกจุดขึ้น–ลง · เลือกเวลา · QR ตั๋ว',
          ),
          const _ModuleCard(
            icon: Icons.drive_eta_outlined,
            title: 'งานคนขับ',
            subtitle: 'ตารางงาน · เริ่ม/ปิดรอบ · สแกน QR',
          ),
          const _ModuleCard(
            icon: Icons.bar_chart_outlined,
            title: 'รายงาน',
            subtitle: 'R1 จำนวนคนขึ้น–ลง · R4 ยอดรายวัน · R6 สถิติคนขับ',
          ),
        ],
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({required this.icon, required this.title, required this.subtitle});

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: ListTile(
        leading: Icon(icon, color: theme.colorScheme.primary),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {}, // การนำทางทำผ่าน bottom nav / rail ของ AdaptiveShell
      ),
    );
  }
}
