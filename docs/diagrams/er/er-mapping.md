# ER Diagram Mapping — Conceptual → Logical → Physical (T-005)

> **เจ้าของเอกสาร:** นางสาวสุขสรร มาณีศรี
> **AI Agent:** `@agent-architect` (Prompt Library P-03 `requirement-to-er`)
> **แหล่งที่มา:** `MINI PROJECT SHUTTLE BUS.pdf` → `docs/requirement-review-checklist.md` → `docs/chapter-17-fullstack.md` ข้อ 17.4.1 / 17.4.2 / 17.4.3 → `docs/chapter-18-development-plan.md`
> **Task:** T-005 · **Sprint:** 1 · **เวลาที่ประมาณการ:** 4 ชม.
> **คะแนน:** ER + Mapping = 10 คะแนน

---

## 0. สรุปสั้น ๆ

| ระดับ | คำถามที่ตอบ | ไฟล์ |
|---|---|---|
| **Conceptual** | ระบบนี้ "มีอะไรบ้าง" และ "อะไรสัมพันธ์กับอะไร" | [`er-01-conceptual.puml`](./er-01-conceptual.puml) |
| **Logical** | "มี Entity อะไรบ้าง + Key คืออะไร" (ยังไม่ผูกชนิดข้อมูล) | [`er-02-logical.puml`](./er-02-logical.puml) |
| **Physical** | "เก็บใน Oracle 19c ยังไง" (ชนิดข้อมูล + Constraint + Index) | [`er-03-physical-master.puml`](./er-03-physical-master.puml) · [`er-04-physical-front.puml`](./er-04-physical-front.puml) · [`er-05-physical-booking-trip.puml`](./er-05-physical-booking-trip.puml) |

> **ลำดับการออกแบบ:** ออกแบบ Conceptual → normalize เป็น Logical → แปลงเป็น Physical ตามความสามารถของ Oracle 19c

---

## 1. Conceptual → Logical : ตารางแปลง Entity และ Relationship

> กฎที่ใช้แปลง:
> **1:1** → FK ที่ตารางฝั่ง "N" · **1:N** → FK ที่ตารางฝั่ง "N" · **M:N** → **ต้องแตกเป็นตารางเชื่อม** (บรรทัดที่ต้องอธิบายอาจารย์)

| # | Entity (Conceptual) | ความสัมพันธ์ | ผลลัพธ์ (Logical) | ตารางที่เกิด | เหตุผล |
|---|---|---|---|---|---|
| 1 | แผนก → พนักงาน | **1 : N** | FK `dept_id` ใน `employee` | `department`, `employee` | 1 พนักงานอยู่แผนกเดียว (M1) |
| 2 | ตำแหน่ง → พนักงาน | **1 : N** | FK `position_id` ใน `employee` | `job_position`, `employee` | 1 พนักงานมีตำแหน่งเดียว (M1) |
| 3 | พนักงาน ↔ บทบาท | **M : N** | ตารางเชื่อม | **`employee_role`** | พนักงาน 1 คนมีหลายบทบาทได้ · 1 บทบาทมีหลายคน |
| 4 | บทบาท ↔ สิทธิ์ | **M : N** | ตารางเชื่อม | **`role_permission`** | ⭐ หัวใจของ M2/R-03 — สิทธิ์เปลี่ยนได้ตลอดเวลา |
| 5 | จุดจอด ↔ เส้นทาง | **M : N** | ตารางเชื่อม | **`route_stop`** | ⭐ BR-03 — 1 จุดจอดอยู่ได้หลายเส้นทาง |
| 6 | เส้นทาง → รอบเวลา | **1 : N** | FK `route_id` ใน `schedule` | `route`, `schedule` | 1 เส้นทางมีหลายรอบเวลา (F2) |
| 7 | รอบเวลา ↔ จุดจอด | **M : N** | ตารางเชื่อม | **`schedule_stop`** | รอบเวลาผ่านจุดจอดตามเส้นทาง + ต้องเก็บเวลาถึง (BR-02) |
| 8 | รอบเวลา ↔ พนักงาน (คนขับ) | **M : N** | ตารางเชื่อม | **`driver_assign`** | BR-04 — ตรวจชนกัน |
| 9 | รอบเวลา ↔ รถ | **M : N** | ตารางเชื่อม | **`vehicle_assign`** | BR-04 — ตรวจชนกัน |
| 10 | ประเภทรถ → รถ | **1 : N** | FK `vtype_id` ใน `vehicle` | `vehicle_type`, `vehicle` | 1 รถมี 1 ประเภท |
| 11 | พนักงาน → การจอง | **1 : N** | FK `cust_id` ใน `booking` | `employee`, `booking` | ผู้จองต้องเป็นพนักงานในระบบ |
| 12 | รอบเวลา → การจอง | **1 : N** | FK `sched_id` ใน `booking` | `schedule`, `booking` | 1 รอบถูกจองหลายครั้งได้ |
| 13 | **จุดจอด → การจอง (จุดขึ้น)** | **1 : N** | FK `board_stop_id` | `stop`, `booking` | ⭐ แยก 2 คอลัมน์เพราะเป็นคนละความสัมพันธ์ |
| 14 | **จุดจอด → การจอง (จุดลง)** | **1 : N** | FK `alight_stop_id` | `stop`, `booking` | ⭐ ต้องแยกจากข้อ 13 (BR-11) |
| 15 | รอบเวลา → การเดินทางจริง | **1 : 0..1** | FK `sched_id` ใน `trip` + `UNIQUE` | `schedule`, `trip` | 1 รอบเดินรถจริงได้ **1 ครั้ง** (`uq_trip_sched`) |
| 16 | การเดินทาง → ผู้โดยสาร | **1 : N** | FK `trip_id` ใน `trip_passenger` | `trip`, `trip_passenger` | 1 รอบมีผู้โดยสารหลายคน |
| 17 | การจอง → ผู้โดยสาร | **1 : 0..1** | FK `booking_id` ใน `trip_passenger` | `booking`, `trip_passenger` | 1 การจองเช็คอินได้ครั้งเดียว |
| 18 | พนักงาน → Token ที่ถูก revoke | **1 : N** | FK `emp_id` ใน `token_blacklist` | `employee`, `token_blacklist` | 1 คนออกจากระบบหลายครั้งได้ |
| 19 | — (ไม่มีใน Conceptual) | — | ตารางเสริม | **`token_blacklist`** | เพิ่มเพื่อทำ UC-02 (Logout) ให้ JWT ถูกยกเลิกทันที |

### ⭐ คำถามที่อาจารย์มักถาม: "ทำไมต้องแตกเป็นตารางเชื่อม 4 ตาราง?"

| ตารางเชื่อม | ถ้าไม่แตกจะเกิดอะไร |
|---|---|
| `employee_role` | ถ้าเก็บ `role_id` ใน `employee` → พนักงานคนเดียวมีได้ **1 บทบาท** แต่ M2 ต้องรองรับหลายบทบาท |
| `role_permission` | ถ้าเก็บ `perm_code` ใน `app_role` → ต้องแก้โค้ดทุกครั้งที่เพิ่มสิทธิ์ → ผิด M2/R-03 |
| `route_stop` | ถ้าเก็บ `stop_id` ใน `route` → เส้นทางมีจุดจอดได้ **1 จุด** และจุดจอดซ้ำในเส้นทางเดียวกัน → ผิด F1/BR-03 |
| `schedule_stop` | ถ้าไม่มี → คำนวณ BR-02 (เวลาถึง) ไม่ได้ และ BR-05 (20 นาที) ตรวจไม่ได้ |

---

## 2. Logical → Physical : ตารางแปลงชนิดข้อมูล (MySQL → Oracle 19c)

> เป็นส่วนที่อาจารย์ชอบถามที่สุด เพราะโจทย์เดิมเขียนด้วย MySQL
> อ้างอิง: `docs/chapter-17-fullstack.md` ข้อ 17.4.4

| Logical (แนวคิด) | Physical (Oracle 19c ที่ใช้จริง) | เหตุผล |
|---|---|---|
| `emp_id INT AUTO_INCREMENT` | `emp_id NUMBER(10) GENERATED ALWAYS AS IDENTITY` | Oracle ไม่มี `AUTO_INCREMENT` (17.4.3 ข้อ 2) |
| `booking_code` เลขไทย/เลขเอกสาร | `CREATE SEQUENCE seq_booking_code START WITH 1 INCREMENT BY 1 NOCACHE` + `seq_booking_code.NEXTVAL` | เลขที่เอกสารแยกจากรหัส PK |
| `VARCHAR(120)` | `VARCHAR2(120 CHAR)` | Oracle แนะนำให้ระบุหน่วย `CHAR`/`BYTE` |
| `DECIMAL(10,7)` | `NUMBER(10,7)` | พิกัดละติจูด |
| `TIME` | `TIMESTAMP` เต็ม (วัน+เวลา) | ⛔ Oracle **ไม่มีชนิด `TIME`** → ต้องเก็บเต็มเพื่อบวกนาทีได้ตรง (17.4.3 ข้อ 1) |
| `DATETIME` | `TIMESTAMP` ค่าเริ่มต้น `SYSTIMESTAMP` | — |
| `ENUM('a','b')` | `VARCHAR2(20 CHAR) + CHECK (col IN ('a','b'))` | ⛔ Oracle ไม่มี `ENUM` (17.4.3 ข้อ 3) |
| `BOOLEAN` | `NUMBER(1) + CHECK (x IN (0,1))` | ⛔ Oracle ไม่มี `BOOLEAN` **ใน SQL** (17.4.4) |
| `TINYINT(1)` | `NUMBER(1)` | ใช้แทน Boolean |
| `UNIQUE KEY` แบบ inline | `ALTER TABLE ... ADD CONSTRAINT uq_xxx UNIQUE (...)` | 17.4.3 ข้อ 5 |
| `AUTO_INCREMENT` ในคีย์รอง | `GENERATED ALWAYS AS IDENTITY` | — |
| `CURRENT_TIMESTAMP` | `SYSTIMESTAMP` / `CURRENT_TIMESTAMP` | — |
| `CONCAT(a,b)` | `a \|\| b` | ตัวต่อสตริงของ Oracle |
| `IFNULL(a,b)` | `NVL(a,b)` หรือ `COALESCE(a,b)` | ⭐ ใช้ใน BR-07 (นับที่นั่งว่าง) |
| `GROUP_CONCAT` | `LISTAGG(name, ', ') WITHIN GROUP (ORDER BY name)` | ใช้ใน UC-24 (Manifest) |
| `LIMIT 10 OFFSET 20` | `OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY` | แบ่งหน้า |
| `START TRANSACTION` | ไม่มีคำสั่ง — เริ่มอัตโนมัติ · `conn.commit()` / `conn.rollback()` | 17.4.4 |
| `SELECT ... FOR UPDATE` | `SELECT ... FOR UPDATE NOWAIT` | กันจองที่นั่งสุดท้ายพร้อมกัน (BR-07) |
| ตาราง `role` | ตาราง **`app_role`** | ⛔ `ROLE` เป็นคำสงวน (`CREATE ROLE`) |
| ตาราง `position` | ตาราง **`job_position`** | ⛔ `POSITION` เป็นคำสงวน |
| ตาราง `user` | ตาราง **`employee`** | ⛔ `USER` เป็นคำสงวน/ฟังก์ชัน |
| ไม่มีคอมเมนต์ | `COMMENT ON TABLE` / `COMMENT ON COLUMN` | ⭐ บังคับใช้ทำ **Data Dictionary (T-006)** ให้ครบ |

---

## 3. Physical : ตาราง Constraint ทั้งหมด (20 ตาราง)

> ✅ = บังคับ · ⚠️ = ตั้งใจเพิ่มเพื่อป้องกันข้อผิดพลาด

| # | ตาราง | Group | PK | UK | CHECK | FK | Identity / Sequence |
|---|---|---|---|---|---|---|---|
| 1 | `department` | Master | `dept_id` | `dept_name` | — | — | Identity |
| 2 | `job_position` | Master | `position_id` | `position_name` | — | — | Identity |
| 3 | `employee` | Master | `emp_id` | `emp_code`, `username` | ✅ `is_active IN (0,1)` | `dept_id`, `position_id` | Identity |
| 4 | `app_role` | Master | `role_id` | `role_name` | ✅ `is_active IN (0,1)` | — | Identity |
| 5 | `permission` | Master | `perm_id` | `perm_code` | — | — | Identity |
| 6 | `role_permission` | Master | `(role_id, perm_id)` | — | — | `role_id`, `perm_id` (CASCADE) | — |
| 7 | `employee_role` | Master | `(emp_id, role_id)` | — | — | `emp_id`, `role_id` (CASCADE) | — |
| 8 | `token_blacklist` | Master | `jti` | — | — | `emp_id` (CASCADE) | — |
| 9 | `stop` | Front | `stop_id` | `stop_name` | ✅ `is_active IN (0,1)` | — | Identity |
| 10 | `route` | Front | `route_id` | — | ✅ `total_minutes >= 0`<br>✅ `is_active IN (0,1)` | — | Identity |
| 11 | `route_stop` | Front | `(route_id, stop_seq)` | ⚠️ `(route_id, stop_id)`<br>← BR-03 | ✅ `travel_minutes >= 0` | `route_id` (CASCADE), `stop_id` | — |
| 12 | `vehicle_type` | Front | `vtype_id` | `vtype_name` | ✅ `capacity > 0` | — | Identity |
| 13 | `vehicle` | Front | `veh_id` | `plate_no` | ✅ `is_active IN (0,1)` | `vtype_id` | Identity |
| 14 | `schedule` | Front | `sched_id` | ⚠️ `(route_id, depart_at)` | ✅ `is_active IN (0,1)` | `route_id` | Identity |
| 15 | `schedule_stop` | Front | `sched_stop_id` | `(sched_id, stop_seq)` | — | `sched_id` (CASCADE), `stop_id` | Identity |
| 16 | `driver_assign` | Front | `assign_id` | `(sched_id, emp_id)` | — | `sched_id` (CASCADE), `emp_id` | Identity |
| 17 | `vehicle_assign` | Front | `assign_id` | `(sched_id, veh_id)` | — | `sched_id` (CASCADE), `veh_id` | Identity |
| 18 | `booking` | Booking | `booking_id` | `booking_code`, `qr_token` | ✅ `seats BETWEEN 1 AND 4` ← BR-06<br>✅ `status IN (5 สถานะ)` | `cust_id`, `sched_id`, `board_stop_id`, `alight_stop_id` | Identity + **Sequence** |
| 19 | `trip` | Trip | `trip_id` | ⚠️ `sched_id`<br>← 1 รอบ = 1 trip | ✅ `status IN ('running','completed')` | `sched_id`, `driver_id`, `veh_id` | Identity |
| 20 | `trip_passenger` | Trip | `trip_passenger_id` | `(trip_id, booking_id)` | — | `trip_id` (CASCADE), `booking_id`, `checkin_stop_id` | Identity |

**รวม:** 20 ตาราง · 1 Sequence · 18 UK · 12 CHECK · 27 FK

---

## 4. Physical : Index ที่ต้องสร้าง (9 ตัว)

> สร้าง **หลัง Seed** เพื่อให้ `INSERT` เร็วขึ้น (17.4.3)
> Task ที่รับผิดชอบ: **T-057 (Index Tuning)** + **T-007 (`01_schema.sql`)**

| Index | ตาราง · คอลัมน์ | ใช้กับ Use Case / Query | รายงานที่ได้ประโยชน์ |
|---|---|---|---|
| `ix_booking_sched_status` | `booking(sched_id, status)` | UC-17 ตรวจที่นั่งว่าง (BR-07)<br>UC-26 ปิดรอบ → `no_show` (BR-10) | R4 |
| `ix_booking_book_time` | `booking(book_time)` | เรียงรายการตามเวลาจอง | R2 (สำรอง) |
| `ix_booking_cust` | `booking(cust_id, book_time)` | UC-19 รายการเดินทางของฉัน | — |
| `ix_sched_route_date` | `schedule(route_id, service_date)` | UC-17 ค้นรอบเวลาตามวัน + เส้นทาง | R4 |
| `ix_schedstop_sched_seq` | `schedule_stop(sched_id, stop_seq)` | UC-17 ตรวจ BR-11 (ลำดับจุดขึ้น–ลง) | R4 |
| `ix_tp_trip` | `trip_passenger(trip_id)` | UC-24 Manifest · R1 | **R1** |
| `ix_tp_booking` | `trip_passenger(booking_id)` | UC-25 เช็คอิน | R1 |
| `ix_da_emp` | `driver_assign(emp_id, sched_id)` | UC-22 ตารางงานคนขับ · UC-15 ตรวจชนกัน (BR-04) | R6 |
| `ix_va_veh` | `vehicle_assign(veh_id, sched_id)` | UC-16 ตรวจชนกันรถ (BR-04) | — |

> 🎯 **เงื่อนไขรายงาน: ต้องรันได้ < 3 วินาที ที่ข้อมูล 50,000 แถว** → Index 9 ตัวนี้คือเหตุผลหลัก

---

## 5. Mapping : Entity → Requirement → Use Case (ย้อนกลับ)

> ยืนยันว่า ER ครอบคลุม Requirement ครบ ไม่มีตารางเกิน และไม่มีตารางขาด

| Requirement | Entity / ตารางที่รองรับ | Use Case | ตรวจแล้ว |
|---|---|---|---|
| **M1** จัดการพนักงาน | `employee`, `department`, `job_position` | UC-04, UC-05, UC-06 | ✅ |
| **M2** สิทธิ์ Dynamic | `app_role`, `permission`, `role_permission`, `employee_role` | UC-07 … UC-10 | ✅ |
| **M3** Login/Logout | `employee`, `token_blacklist` | UC-01, UC-02, UC-03 | ✅ |
| **F1** เส้นทาง | `stop`, `route`, `route_stop` | UC-11, UC-12 | ✅ |
| **F2** รอบเวลา/รถ/คนขับ | `vehicle_type`, `vehicle`, `schedule`, `schedule_stop`, `driver_assign`, `vehicle_assign` | UC-13 … UC-16 | ✅ |
| **B1** เงื่อนไขการจอง | `booking`, `schedule`, `schedule_stop`, `stop`, `vehicle_type` | UC-17, UC-18 | ✅ |
| **B2** QR Code | `booking.qr_token` | UC-19, UC-20 | ✅ |
| **B3** ยกเลิกการจอง | `booking.status`, `booking.cancel_time` | UC-21 | ✅ |
| **D1** ตารางงานรายวัน | `driver_assign`, `schedule`, `route`, `vehicle` | UC-22 | ✅ |
| **D2** เริ่ม/Manifest | `trip`, `trip_passenger`, `schedule_stop` | UC-23, UC-24 | ✅ |
| **D3** สแกน QR | `booking`, `trip`, `trip_passenger` | UC-25 | ✅ |
| **D4** ปิดรอบ/No Show | `trip`, `booking`, `trip_passenger` | UC-26 | ✅ |
| **R1** คนขึ้น/ลง รายสัปดาห์ | `trip`, `trip_passenger`, `schedule` | UC-27 | ✅ |
| **R4** ยอดผู้ใช้ รายวัน/เส้นทาง | `booking`, `schedule` | UC-28 | ✅ |
| **R6** มอบหมายงานคนขับ | `driver_assign`, `schedule` | UC-29 | ✅ |
| **BR-01** เวลารวมเส้นทาง | `route.total_minutes` = `SUM(route_stop.travel_minutes)` | UC-12 | ✅ |
| **BR-02** เวลาถึงจุดจอด | `schedule_stop.arrive_at` | UC-14 | ✅ |
| **BR-03** จุดจอดใช้ซ้ำได้ | `route_stop` UNIQUE `(route_id, stop_id)` | UC-11, UC-12 | ✅ |
| **BR-04** ตรวจชนกัน | `driver_assign`, `vehicle_assign` | UC-15, UC-16, UC-23 | ✅ ตรวจที่ Service เพราะเป็นเงื่อนไขข้ามตาราง + คำนวณเวลา |
| **BR-05** 20 นาที | `schedule_stop.arrive_at` + `booking.book_time` | UC-17, UC-18 | ✅ |
| **BR-06** ไม่เกิน 4 ที่นั่ง | `CHECK (seats BETWEEN 1 AND 4)` | UC-18 | ✅ บังคับที่ DB |
| **BR-07** ที่นั่งว่างพอ | `vehicle_type.capacity` + `SUM(booking.seats)` | UC-17, UC-18 | ✅ ตรวจที่ Service + Transaction |
| **BR-08** คืนที่นั่งเมื่อยกเลิก | นับเฉพาะ `status='reserved'` | UC-21 | ✅ |
| **BR-09** ผิดรอบขึ้นไม่ได้ | `booking.sched_id` = `trip.sched_id` (ผ่าน `trip_id`) | UC-25 | ✅ |
| **BR-10** No Show | `booking.status` → `no_show` | UC-26 | ✅ |
| **BR-11** จุดขึ้นก่อนจุดลง | `board_stop_id` / `alight_stop_id` + `schedule_stop.stop_seq` | UC-17, UC-18 | ✅ ตรวจที่ Service (ข้าม 2 ตาราง) |
| **BR-12** จุดต้องอยู่ในเส้นทาง | `schedule_stop` ของรอบนั้น | UC-17, UC-18 | ✅ ตรวจที่ Service |

---

## 6. จุดที่ "ตรวจที่ Service ไม่ได้บังคับที่ DB" และเหตุผล

> ⚠️ คำถามที่อาจารย์มักถาม: "ทำไมบาง Business Rule ไม่ทำเป็น CHECK Constraint?"

| Business Rule | ทำเป็น Constraint ได้ไหม | เหตุผล |
|---|---|---|
| **BR-01** เวลารวมเส้นทาง | ❌ ไม่ได้ | ต้องรวมค่าจากอีกตาราง → Oracle ไม่รองรับ Subquery ใน `CHECK` · ใช้ **Trigger** หรือคำนวณใน Service แล้ว `UPDATE` |
| **BR-02** เวลาถึงจุดจอด | ❌ ไม่ได้ | เหตุผลเดียวกับ BR-01 · คำนวณตอนสร้างรอบเวลา |
| **BR-04** ตรวจชนกัน | ❌ ไม่ได้ | ต้องเทียบช่วงเวลา 2 ช่วงข้ามตาราง → คำนวณใน **Service** ก่อน `INSERT` · และใช้ Transaction กัน race condition |
| **BR-05** จองก่อน 20 นาที | ❌ ไม่ได้ | เทียบกับ `SYSTIMESTAMP` (เวลาปัจจุบัน) ซึ่งเปลี่ยนทุกวินาที → ตรวจที่ Service เท่านั้น |
| **BR-07** ที่นั่งว่างพอ | ❌ ไม่ได้ | ต้อง `SUM` ของอีกตาราง + ต้อง Lock → Service + `SELECT ... FOR UPDATE NOWAIT` |
| **BR-11** จุดขึ้นก่อนจุดลง | ❌ ไม่ได้ | เทียบ `stop_seq` ของ 2 แถวใน `schedule_stop` → Service |
| **BR-12** จุดอยู่ในเส้นทาง | ❌ ไม่ได้ | ต้องเช็คการมีอยู่ใน `schedule_stop` → Service |
| **BR-06** ไม่เกิน 4 ที่นั่ง | ✅ **ได้** | ค่าเดียวในคอลัมน์เดียว → `CHECK (seats BETWEEN 1 AND 4)` |
| **สถานะ 5 ค่า** | ✅ **ได้** | อยู่ในคอลัมน์เดียว → `CHECK (status IN (...))` |
| **`is_active` 0/1** | ✅ **ได้** | อยู่ในคอลัมน์เดียว → `CHECK (is_active IN (0,1))` |
| **`username` / `emp_code` ไม่ซ้ำ** | ✅ **ได้** | อยู่ในคอลัมน์เดียว → `UNIQUE` |

> 💡 **หลักการ:** Constraint ใช้กัน "ผิดโครงสร้าง" · Service ใช้กัน "ผิดกฎธุรกิจที่ต้องคำนวณ"
> และต้องทำ **ทั้งสองชั้น** เพื่อความปลอดภัย (Defense in Depth)

---

## 7. เช็กลิสต์ส่งมอบ T-005 (DoD)

- [x] Conceptual Diagram ครบ (13 Entity + ความสัมพันธ์ 1:1 / 1:N / M:N)
- [x] Logical Diagram ครบ (20 ตาราง + PK/FK/UK ครบทุกตัว)
- [x] Physical Diagram ครบ (ชนิดข้อมูล Oracle + Constraint + Index)
- [x] Mapping Conceptual → Logical อธิบายเหตุผลทุกแถว (ตารางที่ 19)
- [x] Mapping Logical → Physical อธิบาย MySQL → Oracle ครบ (17.4.4)
- [x] Mapping Physical → Constraint/Index ครบ (20 ตาราง / 9 Index)
- [x] Mapping ย้อนกลับ Entity → Requirement → Use Case ครบ M1–D4, R1/R4/R6, BR-01…BR-12
- [x] อธิบายเหตุผลที่ Rule ไหนทำที่ DB ไม่ได้
- [x] บันทึกใน `docs/agile/ai-prompts/prompt-log.md`
- [x] ผูกกับ Data Dictionary [`docs/report/chapter-08-data-dictionary.md`](../../report/chapter-08-data-dictionary.md) (T-006)
- [x] โหลด PlantUML ไม่มี Error — ตรวจด้วย `plantuml -checkonly` ทั้ง 5 ไฟล์ ผ่าน **0 error** (PlantUML 1.2026.8)
- [x] เทียบชื่อตาราง/คอลัมน์กับ DDL ในข้อ 17.4.3 ด้วยสคริปต์ — Logical 20 entity/102 คอลัมน์ และ Physical 20 ตาราง/102 คอลัมน์ **ตรงกันทุกคอลัมน์**
- [ ] Export เป็น PNG สำหรับส่งอาจารย์ — ทำใน **T-061**
- [ ] Code Review 1 เสียง โดย **นายเก่งกาญ** (AR-02) — ⬜ ยังไม่เสร็จ

---

## 8. สิ่งที่ยังไม่ครดและต้องทำต่อ

| รายการ | Task | หมายเหตุ |
|---|---|---|
| เขียน `01_schema.sql` จริง (DDL + Index + `COMMENT ON`) | T-007 (เก่งกาญ) | ⛔ ไม่อยู่ในไฟล์ที่เรามีสิทธิ์แก้ (`database/**`) |
| เขียน `COMMENT ON` ฉบับเต็มทุกคอลัมน์ | T-006 (เรา) | ส่งเป็นเอกสาร/SQL appendix ไม่แก้ `database/**` |
| View สำหรับรายงาน (R1/R4/R6) | T-053, T-054, T-055, T-056 | ลดความซับซ้อนในชั้น Service |
| `EXPLAIN PLAN` + ปรับ Index | T-057 | ต้องมีข้อมูล 50,000 แถว |
| Export เป็น PNG ใส่รายงาน | T-061 | — |
