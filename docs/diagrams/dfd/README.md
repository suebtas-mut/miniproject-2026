# DFD + State Diagram (T-010 · Sprint 3)

> Checklist: A2 Context Diagram · A3 DFD (Lv0/Lv1) · A6 State Diagram ของ Booking

| ไฟล์ | เนื้อหา |  Checklist |
|---|---|---|
| `dfd-00-context.puml` | Context Diagram — ระบบ + ผู้ใช้ 3 กลุ่ม + Oracle | A2 |
| `dfd-01-level0.puml` | DFD Level 0 — 6 _processes (P1–P6) + 4 data stores (รวม 20 ตารางจริงจาก `01_schema.sql`) | A3 |
| `dfd-02-level1.puml` | DFD Level 1 — แตก P1 (ยืนยันตัวตน) · P4 (จอง) · P5 (คนขับ) | A3 |
| `booking-state.puml` | State Diagram — `booking.status` 5 สถานะตาม `ck_booking_status` | A6 |

## วิธี render

```bash
plantuml -tpng docs/diagrams/dfd/*.puml   # ต้องมี PlantUML + Graphviz
```

## แหล่งอ้างอิง (ไม่มีการสมมติเอง)

- `database/01_schema.sql` — ชื่อตาราง 20 ตาราง + CHECK constraints
- `docs/diagrams/usecase/usecase-spec.md` — UC-01..UC-30 flows และ BR-01..BR-12
- `docs/api/openapi.yaml` — endpoint จริงที่ทีมตรวจแล้วผ่าน validator
