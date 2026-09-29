# AR-02 Peer Review — T-007 `database/01_schema.sql`

| รายการ | ค่า |
|---|---|
| **งานที่รีวิว** | T-007 เขียน `01_schema.sql` + `99_drop_schema.sql` (เก่งกาญ) |
| **ผู้รีวิว** | Sukhsorn Maneesri (สุขสรร) |
| **Commit** | `5fffd27` (merge เข้า `develop` ที่ `8f29713`) |
| **วันที่รีวิว** | 2026-09-30 |
| **สถานะ** | ✅ ผ่าน 1 รอบแก้เอกสาร (doc fix) / ไม่พบข้อบกพร่องใน DDL |
| **วิธีตรวจ** | ตรวจ DDL บนดิสก์ + รันจริงบน Oracle XE 21c (`shuttle-oracle-xe`, XEPDB1) แล้ว query `user_tables` / `user_tab_columns` / `user_constraints` / `user_indexes` / `user_col_comments` |

---

## 1. ผลตรวจจำนวนวัตถุจริงเทียบกับเอกสาร

| หมวด | เอกสารกำหนด | DDL ประกาศ | จริงบน XE | ผล |
|---|---|---|---|---|
| Tables | 20 | 20 | 20 | ✅ |
| Columns | — | — | 102 | ✅ |
| PRIMARY KEY | 20 | 20 | 20 | ✅ |
| UNIQUE (business) | 18 | 18 | 18 | ✅ |
| FOREIGN KEY | 27 | 27 | 27 | ✅ |
| CHECK (business) | 12 | 12 | 12 | ✅ |
| Custom Index | 8 (DDL header) / 9 (ER mapping) | 8 | 8 | ⚠️ doc drift — ดูข้อ 2 |
| Sequence | 1 | 1 | 1 | ✅ |
| TABLE COMMENT | 20 | 20 | 20 | ✅ |
| COLUMN COMMENT | 102 | 102 | 102 | ✅ |

> หมายเหตุ: `user_constraints` รายงาน `CHECK` รวม 95 รายการ เพราะ Oracle แสดง `NOT NULL` เป็นชนิด `C` ด้วย — กรองออกแล้วเหลือ business CHECK จริง 12 ตัว

---

## 2. ข้อค้นพบเดียว: ER mapping นับ Index ไม่ตรงกับ DDL

`docs/diagrams/er/er-mapping.md` หัวข้อที่ 4 เขียนว่า **"Index ที่ต้องสร้าง (9 ตัว)"** และลิสต์ `ix_schedstop_sched_seq` ไว้ แต่ `01_schema.sql` สร้างแค่ **8 ตัว** เพราะ:

- `schedule_stop(sched_id, stop_seq)` ถูกครอบคลุมแล้วด้วย **`uq_sched_seq UNIQUE (sched_id, stop_seq)`**
- UNIQUE constraint บน Oracle สร้าง index ชื่อ `uq_sched_seq` ให้อัตโนมัติ → สร้าง `ix_schedstop_sched_seq` ซ้ำจึงไม่จำเป็น (เป็น **redundant index**)
- ตัว DDL เองก็ระบุเหตุผลไว้ที่หัวไฟล์: *"Index 8 (ดัชนีที่ 9 ตาม 8.8 ถูกตัดเพราะซ้ำ)"*

**ข้อสรุป:** DDL ถูกต้องกว่าเอกสาร — การตัดเป็นการตัดสินใจที่ดี (ลด index ซ้ำซ้อนและลด write overhead) แต่เอกสารยังไม่ได้สะท้อน

**การแก้ไข:** ผู้รีวิวแก้ `docs/diagrams/er/er-mapping.md` เอง เพราะไฟล์นั้นเป็นงานของสุขสรร ไม่ใช่ของเก่งกาญ — เพื่อไม่ให้เป็นการเขียนทับงานเพื่อน และให้ PR เดียวจบ

---

## 3. รายการที่ตรวจแล้วถูกต้อง (13 ข้อ)

| # | หัวข้อ | ผล | หลักฐาน |
|---|---|---|---|
| 1 | จำนวนตาราง 20 ตาราง | ✅ | `SELECT COUNT(*) FROM user_tables` = 20 |
| 2 | Naming convention snake_case ทั้งหมด | ✅ | `emp_code`, `service_date`, `depart_at` |
| 3 | PK ใช้ `GENERATED ALWAYS AS IDENTITY` | ✅ | ทุก PK 20 ตาราง ไม่มี manual sequence |
| 4 | UNIQUE business 18 ตัว | ✅ | `uq_employee_code`, `uq_stop_name`, `uq_route_depart`, `uq_sched_seq` |
| 5 | FK 27 ตัว พร้อม `ON DELETE` ที่ตั้งใจ | ✅ | `employee_role`, `role_permission`, `token_blacklist` ใช้ CASCADE; `route_stop` → `stop` ไม่ CASCADE |
| 6 | CHECK รวม 12 business rule | ✅ | `ck_booking_seats` (1–4), `ck_booking_status`, `ck_trip_status`, `ck_vtype_cap`, `ck_route_min` |
| 7 | BR-01 `total_minutes >= 0` | ✅ | `ck_route_min` |
| 8 | BR-03 จุดจอดซ้ำในเส้นทางเดียวกันไม่ได้ | ✅ | `uq_route_stop_uk UNIQUE (route_id, stop_id)` |
| 9 | BR-05 กันจองซ้ำรอบเดิม | ✅ | `uq_route_depart UNIQUE (route_id, depart_at)` |
| 10 | `password_hash` เก็บ bcrypt | ✅ | `VARCHAR2(200 CHAR)` + comment ระบุ bcrypt |
| 11 | `token_blacklist` มี `revoked_at` + `expires_at` | ✅ | รองรับ Logout (UC-02) และ token lifetime |
| 12 | `COMMENT ON TABLE` / `COMMENT ON COLUMN` ครบ | ✅ | 20 + 102 = 122 comment |
| 13 | `99_drop_schema.sql` ใช้ล้างได้ครบทุกตาราง | ✅ | ครอบคลุม 20/20 ตาราง ปลอดภัยเรียงจาก FK child → parent |

---

## 4. ประเด็นที่ยัง **ไม่** ผ่าน (เป็นข้อจำกัดของ Sprint 2 ไม่ใช่ข้อบกพร่อง T-007)

| # | ประเด็น | ผลกระทบ | การจัดการ |
|---|---|---|---|
| 1 | `01_schema.sql` ไม่ idempotent | รันซ้ำได้ `ORA-00955` (name is already used) | ไม่ผิด DoD เพราะ T-007 ระบุ "รันบน schema ว่าง" — แต่ต้องรัน `99_drop_schema.sql` ก่อนเสมอเมื่อต้อง reset |
| 2 | รันบน Oracle XE **21c** ส่วน spec เขียน 19c | ยังไม่พิสูจน์บน 19c จริง | รออาจารย์ตอบ Q14; DDL ที่ใช้เป็น feature ขั้นต่ำ (IDENTITY, `VARCHAR2(n CHAR)`, `SYSTIMESTAMP`) รองรับทั้งสองเวอร์ชัน |
| 3 | ไม่มี seed data | ยังทดสอบ R1/R4/R6 ไม่ได้ | T-008 (เก่งกาญ) — ปลดล็อกแล้วเพราะ T-007 เสร็จ |
| 4 | ยังไม่มี `EXPLAIN PLAN` ที่ 50,000 แถว | พิสูจน์เงื่อนไข "< 3 วินาที" ยังไม่ได้ | ตาม ER mapping ผูกกับ **T-057 (Index Tuning)** ไม่ใช่ T-007 |
| 5 | ผู้รีวิวกับผู้เขียนใช้ GitHub noreply email เดียวกัน | ลดความน่าเชื่อถือของหลักฐาน AR-02 | แก้ `git config user.email` ให้เป็น email ของแต่ละบัญชี — แจ้งเก่งกาญแล้ว |

---

## 5. ข้อสรุป

- **T-007 ผ่าน** — DDL ถูกต้องตามเอกสาร ER และข้อกำหนด BR-01…BR-11 ที่ตรวจได้
- เอกสาร `er-mapping.md` ต้องแก้จำนวน Index 9 → 8 (รายการ 2 ด้านบน)
- T-008 (seed) ปลดล็อกแล้ว ให้เก่งกาญดำเนินการต่อได้ทันที

> คำเตือนที่ส่งต่อ: **ห้ามแก้ `database/01_schema.sql` โดยไม่แจ้งล่วงหน้า** เพราะเป็นงานของเก่งกาญและตารางทั้ง 20 ถูกผูกกับ seed data ของ T-008 แล้ว

---
---

# AR-02 Peer Review — T-008 Seed Data (`02_seed_master.sql` + `03_seed_front.sql`)

| รายการ | ค่า |
|---|---|
| **งานที่รีวิว** | T-008 Seed Data (นายเก่งกาญ เชี่ยวชาญ) |
| **ผู้รีวิว** | Sukhsorn Maneesri (สุขสรร) — ผู้เขียน T-007 review แต่**ไม่ได้**เขียน seed |
| **Commit** | `32911c8` (push ขึ้น `develop` โดยตรง) |
| **วันที่รีวิว** | 2026-09-30 |
| **สถานะ** | ✅ ผ่าน 21/22 ข้อ · ⚠️ **1 ข้อต้องแก้ก่อน Sprint 3** (T-011) |
| **วิธีตรวจ** | ตรวจ read-only บน `shuttle-oracle-xe` ตัวเดียวกับที่ผู้เขียนใช้ เทียบทุกตัวเลขที่อ้างใน commit message |

> ⚠️ **ไม่ได้รัน `99_drop` ซ้ำ** เพราะเป็นฐานข้อมูลใช้ร่วมของทีม (ข้อตกลงข้อ 3) และตอนรีวิวมี seed ของเก่งกาญอยู่แล้ว
> → ตรวจแบบไม่ทำลายข้อมูล (read-only) ซึ่งเพียงพอสำหรับยืนยันตัวเลขทุกตัวที่อ้าง

---

## 1. ยืนยันตัวเลขที่อ้างใน commit message — ตรงทุกตัว

### `02_seed_master.sql`

| ตาราง | อ้างว่า | วัดจริง | ผล |
|---|---|---|---|
| `department` | 3 | 3 | ✅ |
| `job_position` | 4 | 4 | ✅ |
| `employee` | 15 | 15 | ✅ |
| `app_role` | 4 (ADMIN/STAFF/CUSTOMER/DRIVER) | 4 | ✅ |
| `permission` | 21 | 21 | ✅ |
| `role_permission` | — | 48 | ✅ |
| `employee_role` | — | 15 | ✅ |

### `03_seed_front.sql`

| ตาราง | อ้างว่า | วัดจริง | ผล |
|---|---|---|---|
| `stop` | 6 | 6 | ✅ |
| `vehicle_type` | 3 | 3 | ✅ |
| `vehicle` | 7 | 7 | ✅ |
| `route` | 2 (ข้ามเส้นทาง 1 ตาม Q20) | 2 | ✅ |
| `route_stop` | 9 | 9 | ✅ |
| `schedule` | 8 (4 รอบ × 2 เส้นทาง) | 8 | ✅ |
| `schedule_stop` | 36 | 36 | ✅ |
| `driver_assign` | 8 | 8 | ✅ |
| `vehicle_assign` | 8 | 8 | ✅ |

---

## 2. Business Rule ที่พิสูจน์ด้วย query — ผ่านทั้งหมด

| BR | ข้อ | ผลจริง | ผลตรวจ |
|---|---|---|---|
| **BR-01** | `route.total_minutes` = `SUM(route_stop.travel_minutes)` | เส้นทางที่ 2 = 13, เส้นทางที่ 3 = 15 | ✅ PASS |
| **BR-02** | `arrive_at` จุดสุดท้าย = `depart_at + total_minutes` | ตรงทั้ง 8 รอบ (09:30→09:43/09:45 … 15:00→15:13/15:15) | ✅ PASS |
| **BR-04** | คนขับ/รถชนกัน = 0 | driver 0 · vehicle 0 | ✅ PASS |
| **BR-06** | ที่นั่ง 1–4 | `booking` = 0 ยังไม่ seed (T-008 ครอบคลุมเฉพาะ master + front) | ⏭️ N/A |

> การคำนวณใช้ correlated subquery ไม่ hardcode `total_minutes` / `arrive_at` → แก้นาทีทีเดียวทุกจุดขยับตามจริง ✅

---

## 3. ตรวจเพิ่มที่ผู้เขียนยังไม่ได้ตรวจ (ผู้รีวิวเพิ่มเอง)

| # | หัวข้อ | ผล | หมายเหตุ |
|---|---|---|---|
| 1 | ไม่มี object `INVALID` | ✅ 0 | ไม่มี PL/SQL object พัง |
| 2 | พนักงานทุกคนมีบทบาท | ✅ 0 คนไม่มี role | ไม่มี user ค้างนอกระบบ RBAC |
| 3 | คนขับใน `driver_assign` มี role DRIVER จริง | ✅ 0 ข้อผิดพลาด | เชื่อม role กับงานจริงถูกต้อง |
| 4 | Permission ครบ 5 โมดูล | ✅ master 5 · front 4 · booking 3 · driver 3 · report 6 = 21 | ตรงกับ Dynamic Menu |
| 5 | สิทธิ์รวมตรงกับ `role_permission` | ✅ 21+4+5+18 = **48** | ADMIN 21 · STAFF 18 · DRIVER 5 · CUSTOMER 4 — ลำดับถูก (ขวางมาก → น้อย) |
| 6 | ไม่มี password เป็นข้อความธรรมดา | ✅ 0 รายการ | ทุกตัวขึ้นต้น `$2b$` |
| 7 | `token_blacklist` ว่าง | ✅ 0 | ถูกต้องสำหรับระบบที่ยังไม่มีการ login |
| 8 | `is_active` ทุกตาราง | ⚠️ **0 รายการที่ `is_active = 0`** | ดูข้อ 5 |

---

## 4. ⚠️ ข้อค้นพบเดียว: `password_hash` เป็น bcrypt ที่ **ยาวไม่ถูกต้อง**

| หัวข้อ | ค่า |
|---|---|
| bcrypt ที่ถูกต้องยาวเท่าไร | **60 ตัวอักษรเสมอ** (`$2b$10$` + 53 ตัว) |
| ใน seed ยาวเท่าไร | **52 / 53 / 54 ตัว** → ไม่มีตัวไหนครบ 60 |
| ค่า unique | มีแค่ **4 ค่า** สำหรับ 15 พนักงาน (แยกตาม 4 บทบาท) |

**ผลกระทบ:** ค่าเหล่านี้เป็น placeholder ที่ **ตั้งใจให้ login ไม่ได้** ซึ่งถูกต้องด้านความปลอดภัย (ดีกว่าใส่รหัสจริงลง Git)
แต่มี 2 ประเด็นที่ต้องระวัง:

1. **เป็น bcrypt ที่ผิดรูปแบบ ไม่ใช่แค่ค่าสมมติ** — library ภาษาเอาบางตัวจะ `throw` เมื่อยาวไม่ครบ 60 ไม่ใช่แค่คืน `false`
   → ต้องเขียน **try/catch ตอน verify password** ไว้ด้วย ไม่งั้น API login จะ 500 แทน 401
2. **15 พนักงานใช้แค่ 4 ค่าเดียวกัน** → ถ้า T-011 ลืมสร้างใหม่ เจ้าหน้าที่ทุกคนจะมีรหัสผ่านเดียวกันทั้งหมด

**ข้อเสนอแนะ (สำหรับ T-011 ใน Sprint 3) — ไม่ต้องแก้ตอนนี้:**
- สร้าง `bcrypt.hash()` จริง **ครั้งละ 1 ค่าต่อ 1 พนักงาน** (15 ค่า ไม่ซ้ำกันเลย)
- ยืนยันด้วย `select count(distinct password_hash) from employee` = **15**
- เพิ่ม query ลงท้าย `03_seed_front.sql`:
  ```sql
  select count(*) as USERS, count(distinct password_hash) as DISTINCT_HASH from employee;
  -- ผ่านเมื่อ USERS = DISTINCT_HASH
  ```

---

## 5. ข้อสังเกตเพิ่มเติม (ไม่ผิด DoD แต่ควรรู้)

| # | เรื่อง | รายละเอียด |
|---|---|---|
| 1 | **`stop` จุดที่ 3 (โรงพยาบาลหนองจอก) ไม่ถูกใช้ในเส้นทางใดเลย** | เหลือเป็น dead data จนกว่าเส้นทาง 1 จะถูก seed · ถ้า Q20 ตอบว่าไม่ต้องมีเส้นทาง 1 ต้องพิจารณาลบหรือทำเครื่องหมาย |
| 2 | **ไม่มีพนักงานสถานะ `is_active = 0`** | UC-04.3 (ปิดใช้งาน) และ Mockup หน้า A1 มีกรณี "ปิดใช้งาน" → แนะนำเพิ่ม 1 คน เพื่อทดสอบ branch นี้ · ถ้าตั้งใจไม่ใส่ให้บอกในเอกสาร |
| 3 | **ชื่อแผนกเป็นสมมติฐาน** | PDF ไม่ได้ระบุแผนก · เขียนไว้ให้ M1/M2 ทดสอบได้เท่านั้น · ควรขึดเส้น "สมมติ" ไว้ในไฟล์ SQL (ตอนนี้มี comment แล้ว ✅) |
| 4 | **วันที่ seed คือ 2026-10-01** | เป็นวันที่ตัวอย่าง · ระบบจริงต้องสร้างรอบตามวันที่ใช้บริการ |
| 5 | **`booking` / `trip` / `trip_passenger` = 0** | ถูกต้องตามขอบเขต T-008 (master + front) · แต่ BR-06 (ที่นั่ง 1–4) และ BR-07/BR-09/BR-10 จะยังพิสูจน์ไม่ได้จนกว่าจะมี booking seed |
| 6 | **Q20 — เส้นทาง 1 ยังไม่ seed** | ข้อสังเกตที่ถูกต้อง · แต่ข้อเสนอ (ข) "เส้นทาง 1 เป็นไป–กลับ" **กระทบ ER diagram (T-005) ที่ปิดไปแล้ว** → ต้องแจ้งอาจารย์ก่อนแก้ ER |

---

## 6. ข้อสรุป

- **T-008 ผ่าน DoD ข้อ 1 (peer review)** — ตัวเลขทุกตัวตรงกับที่อ้างจริงบนฐานข้อมูล
- **BR-01 / BR-02 / BR-04 ผ่านจากการรันจริง** ไม่ใช่การอ่านโค้ด
- **การตัดสินใจข้ามเส้นทาง 1 เหมาะสม** — ข้อมูลขัดแย้งกันเองและหลัก AR-08 (ห้ามให้ AI เดาข้อมูล) สนับสนุนการไม่ฝืน
- **การตัดสินใจใช้ค่า 15 นาที พร้อม `TODO(Q-B)`** ถูกต้อง เพราะเส้นทาง 1 (30) และ 2 (13) ตรงกับ PDF พิสูจน์ว่าเป็น typo ใน PDF
- **เหตุผลที่ตัดดัชนีซ้ำใน T-007 ได้รับการยืนยัน** — การคำนวณ BR-01/BR-02 ที่ทำได้สำเร็จพิสูจน์ว่าไม่จำเป็นต้องมี `ix_schedstop_sched_seq` เพิ่ม
- **ข้อที่ต้องแก้ก่อน Sprint 3: เพียงเรื่องเดียว** — `password_hash` ต้องสร้าง bcrypt จริง 15 ค่าใน T-011 + เพิ่ม try/catch ตอน verify
- **คำแนะนำถึงเก่งกาญ:** อย่าแก้ `02`/`03_seed` เอง ให้สุขสรรเป็นคนแก้ `password_hash` ใน T-011 เพื่อไม่ให้ชนกัน

