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
