# แผนภาพ ER — ระบบ SHUTTLE BUS (T-005)

> **เจ้าของเอกสาร:** นางสาวสุขสรร มาณีศรี
> **AI Agent:** `@agent-architect` (Prompt Library P-03 `requirement-to-er`)
> **Task:** T-005 · **Sprint:** 1 · **เวลาที่ประมาณการ:** 4 ชม. · **คะแนน:** ER + Mapping 10 คะแนน
> **แหล่งที่มา:** `docs/chapter-17-fullstack.md` ข้อ 17.4.1 / 17.4.2 / 17.4.3 / 17.4.4 / 17.4.5

---

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | ระดับ | เนื้อหา |
|---|---|---|
| [`er-01-conceptual.puml`](./er-01-conceptual.puml) | **Conceptual** | 13 Entity + ความสัมพันธ์ 1:1 / 1:N / M:N (ยังไม่มีคอลัมน์) |
| [`er-02-logical.puml`](./er-02-logical.puml) | **Logical** | 20 ตาราง + PK / FK / UK + แอตทริบิวต์สำคัญ |
| [`er-03-physical-master.puml`](./er-03-physical-master.puml) | **Physical** | MASTER 8 ตาราง — ชนิดข้อมูล Oracle + Constraint |
| [`er-04-physical-front.puml`](./er-04-physical-front.puml) | **Physical** | FRONT 9 ตาราง — ชนิดข้อมูล Oracle + Constraint + BR |
| [`er-05-physical-booking-trip.puml`](./er-05-physical-booking-trip.puml) | **Physical** | BOOKING + TRIP 3 ตาราง + Sequence + เส้นทางสถานะ |
| [`er-mapping.md`](./er-mapping.md) | **Mapping** | ⭐ Conceptual→Logical→Physical + ย้อนกลับมา Requirement / BR |

> ✅ **ผลการตรวจสอบ:** `plantuml -checkonly` ผ่าน 5/5 ไฟล์ 0 error และสคริปต์ตรวจยืนยันว่าชื่อตาราง/คอลัมน์ใน ER ตรงกับ DDL ในข้อ 17.4.3 ครบทุกตัว (20 ตาราง / 102 คอลัมน์)

> 📄 **PNG สำหรับส่งอาจารย์** → `docs/diagrams/er/png/` (สร้างใน T-061)

---

## โครงสร้าง 20 ตาราง (4 กลุ่ม)

| Group | ตาราง | จำนวน |
|---|---|---|
| **Master** — บุคคล / สิทธิ์ | `department`, `job_position`, `employee`, `app_role`, `permission`, `role_permission`, `employee_role`, `token_blacklist` | 8 |
| **Front** — เส้นทาง / รอบ / ยานพาหนะ | `stop`, `route`, `route_stop`, `vehicle_type`, `vehicle`, `schedule`, `schedule_stop`, `driver_assign`, `vehicle_assign` | 9 |
| **Booking** — การจอง | `booking` | 1 |
| **Trip** — เดินรถจริง / สถิติ | `trip`, `trip_passenger` | 2 |
| | **รวม** | **20** |

---

## 3 จุดที่ต้องอธิบายอาจารย์ (ทำไมถึงต้องเป็นแบบนี้)

| # | ประเด็น | คำตอบ |
|---|---|---|
| 1 | ทำไมต้องมี **4 ตารางเชื่อม** | เพราะเป็นความสัมพันธ์ **M:N** ทั้งหมด — ดูตารางใน [`er-mapping.md` ข้อ 1](./er-mapping.md) |
| 2 | ทำไมตารางชื่อ `app_role` / `job_position` / `employee` | ⛔ `ROLE` `POSITION` `USER` เป็น**คำสงวนของ Oracle** (17.4.1) |
| 3 | ทำไม `depart_at` เป็น `TIMESTAMP` ไม่ใช่ `TIME` | ⛔ Oracle ไม่มีชนิด `TIME` → เก็บวัน+เวลาเต็มเพื่อบวกนาทีได้ตรง (17.4.3 ข้อ 1) |
| 4 | ทำไม `trip_passenger` **ห้ามตัดออก** | เพราะ R1 (ที่ทำจริง) ต้องนับคนที่**ขึ้นรถจริง** ไม่ใช่แค่คนที่จอง |

---

## Index ที่ต้องสร้าง (9 ตัว)

สร้างใน `01_schema.sql` (T-007) หรือคำสั่ง Index Tuning (T-057)
→ ดูตารางเต็มใน [`er-mapping.md` ข้อ 4](./er-mapping.md)

> 🎯 เป้าหมาย: รายงานทุกตัวต้องรันได้ **< 3 วินาที** ที่ข้อมูล **50,000 แถว**

---

## วิธีสร้างภาพ PNG

เหมือนกับ [`../usecase/README.md`](../usecase/README.md) — ใช้ VS Code Extension `jebbs.plantuml` แล้วกด `Alt + D`
หรือวางโค้ดใน <https://www.plantuml.com/plantuml/umlviewer>

---

## ⚠️ ข้อควรระวัง

| ข้อ | เหตุผล |
|---|---|
| ⛔ **ห้ามแก้ `database/`** | เป็นของนายเก่งกาญ (T-007 ทำ `01_schema.sql`) — เราส่งเป็นเอกสาร/SQL appendix เท่านั้น |
| ⛔ **ห้ามใช้ `role` / `position` / `user` เป็นชื่อตาราง** | คำสงวน Oracle → รันไม่ผ่าน |
| ⛔ **ห้ามใส่ `Web` / `React` ใน ER** | อยู่นอกขอบเขต (17.0 ข้อ 1) |
| ✅ ตารางต้อง **ตรงกับ PDF** | ชื่อตาราง/คอลัมน์ต้องตรงตามตัวอย่าง ห้ามตั้งชื่อเอง (ASM-01) |
| ✅ ต้องมี `COMMENT ON` ครบ | เพราะ Data Dictionary (T-006) อ้างอิงจากตรงนี้ |
