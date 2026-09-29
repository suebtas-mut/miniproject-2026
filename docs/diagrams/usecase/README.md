# แผนภาพ Use Case — ระบบ SHUTTLE BUS (T-004)

> **เจ้าของเอกสาร:** นางสาวสุขสรร มาณีศรี
> **AI Agent:** `@agent-architect` (Prompt Library P-01 `requirement-to-usecase`)
> **แหล่งที่มา:** `MINI PROJECT SHUTTLE BUS.pdf` → `docs/requirement-review-checklist.md` → `docs/chapter-17-fullstack.md` → `docs/chapter-18-development-plan.md`
> **Task:** T-004 · **Sprint:** 0 · **เวลาที่ประมาณการ:** 5 ชม.

---

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | ระดับ / เนื้อหา | ส่งครบทุก Requirement |
|---|---|---|
| [`usecase-00-overview.puml`](./usecase-00-overview.puml) | ภาพรวมทั้งระบบ + Dynamic RBAC | M1 M2 M3 F1 F2 B1 B2 B3 D1 D2 D3 D4 R1 R4 R6 |
| [`usecase-01-auth-master.puml`](./usecase-01-auth-master.puml) | M1 / M2 / M3 | M1, M2, M3 |
| [`usecase-02-front.puml`](./usecase-02-front.puml) | F1 / F2 | F1, F2 |
| [`usecase-03-booking.puml`](./usecase-03-booking.puml) | B1 / B2 / B3 | B1, B2, B3 |
| [`usecase-04-driver.puml`](./usecase-04-driver.puml) | D1 / D2 / D3 / D4 | D1, D2, D3, D4 |
| [`usecase-05-report.puml`](./usecase-05-report.puml) | ระบบรายงาน | R1, R4, R6 |
| [`usecase-06-actor-relation.puml`](./usecase-06-actor-relation.puml) | Actor ↔ Use Case (อธิบาย R-03) | M2 |
| [`usecase-spec.md`](./usecase-spec.md) | **Use Case Specification** UC-01 … UC-30 | ทุกข้อ + Traceability |

> 📄 **Diagram ในรูปแบบที่ส่งอาจารย์ (PNG) จะสร้างใน T-061** — เก็บไว้ที่ `docs/diagrams/usecase/png/`

---

## จำนวน Use Case ทั้งหมด = 30

| กลุ่ก | Requirement | UC |
|---|---|---|
| Master | M1 | UC-04, UC-05, UC-06 |
| Master | M2 | UC-07, UC-08, UC-09, UC-10 |
| Master | M3 | UC-01, UC-02, UC-03 |
| Front | F1 | UC-11, UC-12 |
| Front | F2 | UC-13, UC-14, UC-15, UC-16 |
| Booking | B1 | UC-17, UC-18 |
| Booking | B2 | UC-19, UC-20 |
| Booking | B3 | UC-21 |
| Driver | D1 | UC-22 |
| Driver | D2 | UC-23, UC-24 |
| Driver | D3 | UC-25 |
| Driver | D4 | UC-26 |
| Report | R1 | UC-27 |
| Report | R4 | UC-28 |
| Report | R6 | UC-29 |
| ร่วม | Export + เลือกช่วงวันที่ | UC-30 |

---

## วิธีสร้างภาพ (Export เป็น PNG)

### วิธีที่ 1 — VS Code (แนะนำ)

1. ติดตั้ง Extension **`jebbs.plantuml`**
2. เปิดไฟล์ `.puml`
3. กด `Alt + D` → ได้ไฟล์ PNG ข้างไฟล์เดิม
4. ต้องมี Java (JRE) ติดตั้งด้วย

### วิธีที่ 2 — เว็บ (ไม่ต้องติดตั้งอะไร)

1. เปิด <https://www.plantuml.com/plantuml/umlviewer>
2. คัดลอกข้อความในไฟล์ `.puml` ทั้งหมดไปวาง
3. คลิก **"Show Diagram"**
4. ดาวน์โหลด PNG ไปเก็บที่ `docs/diagrams/usecase/png/`

### วิธีที่ 3 — PlantUML Server (คำสั่งเดียว)

```powershell
$base = "https://www.plantuml.com/plantuml/svg/"
# เข้ารหัสไฟล์ด้วย deflate + plantuml encoding ก่อน (ต้องมี node)
npx --yes plantuml-encoder -i usecase-00-overview.puml
```

> 💡 **คำแนะนำ:** ใช้ VS Code เร็วที่สุด เพราะต้องแก้ Diagram หลายรอบตอนอาจารย์ขอแก้

---

## เช็กลิสต์ตรวจก่อนส่ง (DoD ของ T-004)

- [x] มี Actor ครบ 4 บทบาท — Admin / Staff / Driver / Customer
- [x] มี Use Case ครบ 30 ตัว พร้อม ID ต่อเนื่อง UC-01 … UC-30
- [x] ทุก Requirement (M1 M2 M3 F1 F2 B1 B2 B3 D1 D2 D3 D4 R1 R4 R6) มี Use Case ครอบคลุม
- [x] เขียน Use Case Specification ครบทุกตัว (Main Flow + Alternative + Business Rule + API + ตาราง)
- [x] ระบุ Business Rule BR-01 … BR-12 พร้อมสูตร Oracle จริง
- [x] ระบุ `«include»` / `«extend»` ครบ
- [x] มีตาราง Traceability : Requirement → Use Case → Task
- [x] บันทึกสมมติฐาน ASM-07 ที่ใช้ (5 ข้อ — ASM-07-1 … ASM-07-5)
- [x] บันทึกใน `docs/agile/ai-prompts/prompt-log.md`
- [x] โหลด PlantUML ไม่มี Error — ตรวจด้วย `plantuml -checkonly` ทั้ง 7 ไฟล์ ผ่าน **0 error** (PlantUML 1.2026.8)
- [ ] Export เป็น PNG สำหรับส่งอาจารย์ — ทำใน **T-061**
- [ ] Code Review 1 เสียง โดย **นายเก่งกาญ** (AR-02)  — ⬜ ยังไม่เสร็จ

### ผลการตรวจสอบ Syntax

| รายการ | ผล |
|---|---|
| จำนวน Use Case | `UC-01` … `UC-30` ครบ 30 ตัว ไม่มีเลขกำะดับ ไม่มีเลขเกิน 30 |
| Use Case Specification | มีหัวข้อ `UC-01` … `UC-30` ครบ 30 หัวข้อ ตรงกับ Diagram |
| PlantUML `-checkonly` | ผ่าน 7/7 ไฟล์ 0 error |
| PlantUML render PNG | ผ่าน 7/7 ไฟล์ (ทดสอบแล้ว ไม่ได้เก็บไฟล์ใน repo) |
| ข้อผิดพลาดที่พบและแก้แล้ว | 1) `skinparam usecase { A; B }` แบบบรรทัดเดียวทำให้เกิด Syntax Error → เปลี่ยนเป็นแบบหลายบรรทัด 2) มีบรรทัด `..> "ข้อความ" as N1` ซึ่งเป็น Syntax Error → ลบออก (เนื้อหาความหมายอยู่ใน `note` แล้ว) |

---

## ⚠️ ข้อควรระวัง

| ข้อ | เหตุผล |
|---|---|
| ⛔ **ไม่มีหน้าจอ Web / React** ในทุก Diagram | อยู่นอกขอบเขต (17.0 ข้อ 1) → AR-11 ห้ามเสนอโค้ดเว็บ |
| ⛔ **ไม่ hardcode สิทธิ์ตามบทบาท** | M2/R-03 → สิทธิ์ต้องมาจาก `role_permission` |
| ⛔ **R1 ห้ามนับ `COUNT(DISTINCT alight_time)`** | จะนับ "จำนวนเวลาที่ไม่ซ้ำ" ไม่ใช่ "จำนวนคน" |
| ⛔ **ห้ามรวมรายงานชนกลุ่ม** | PDF บังคับเลือก 1 ข้อจากแต่ละกลุ่ม → R1(R1/R2) + R4(R3/R4/R5) + R6(R6/R7) |
| ✅ รายงานที่เลือก = **R1 + R4 + R6 (24 คะแนน)** | ตามเงื่อนไขตารางคะแนนใน PDF |
| ✅ ทุกหน้าจอเป็น **Flutter + Adaptive UI** | แท็บเล็ตแนวนอน = `DataTable` + `Master–Detail` (17.0.1) |
