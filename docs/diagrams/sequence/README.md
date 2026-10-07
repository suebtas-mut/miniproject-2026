# Sequence Diagrams — 5 เรื่อง (T-010 · Sprint 3)

> Checklist: A5 Sequence Diagram (5 เรื่อง)

| ไฟล์ | เรื่อง | Use Case | Business Rule ที่เกี่ยวข้อง |
|---|---|---|---|
| `sequence-01-login.puml` | เข้าสู่ระบบ | UC-01 | BR-SEC-1 (bcrypt + try/catch) · dynamic RBAC |
| `sequence-02-booking.puml` | ค้นรอบ + จองที่นั่ง | UC-17, UC-18 | BR-05 (≥ 20 นาที) · BR-06 (≤ 4 ที่นั่ง) · BR-07 (FOR UPDATE NOWAIT) |
| `sequence-03-cancel.puml` | ยกเลิกการจอง | UC-21 | BR-08 (คืนที่นั่ง) · ASM-07-2 (ยกเลิกก่อนถึง 20 นาที) |
| `sequence-04-scan-qr.puml` | สแกน QR ขึ้นรถ | UC-25 | BR-09 (ผิดรอบขึ้นไม่ได้) · ASM-07-3 (QR ใช้ 1 ครั้ง) |
| `sequence-05-complete-trip.puml` | ปิดรอบ + สรุปยอด | UC-26 | BR-10 (No Show) |

## วิธี render

```bash
plantuml -tpng docs/diagrams/sequence/*.puml   # ต้องมี PlantUML + Graphviz
```

## แหล่งอ้างอิง

- `docs/diagrams/usecase/usecase-spec.md` — Main/Alternative Flow ของแต่ละ UC
- `database/01_schema.sql` — ตารางและ constraint จริง
- `docs/api/openapi.yaml` — endpoint และ response schema จริง
