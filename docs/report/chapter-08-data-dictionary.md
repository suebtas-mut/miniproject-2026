# บทที่ 8 — Data Dictionary

**ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก**

| รายการ | ค่า |
|---|---|
| Task | T-006 |
| Owner | นางสาวสุขสรร มาณีศรี |
| Agent | `@agent-doc` |
| Database | Oracle Database 19c (XE 19c สำหรับนักศึกา) |
| DDL ต้นทาง | `docs/chapter-17-fullstack.md` ข้อ 17.4.3 (ส่วน `01_schema.sql`) |
| ER Mapping | `docs/diagrams/er/er-mapping.md` |
| Status | Draft — รอ T-007 สร้าง `01_schema.sql` จริง |

> **หมายเหตุ:** เอกสารนี้เป็นเอกสารประกอบการอธิบาย Schema เท่านั้น ไม่ใช่ไฟล์ DDL ที่นำไปรัน การส่งมอบ DDL จริงเป็นหน้าที่ของ T-007 (`database/01_schema.sql`) และ `database/**` อยู่นอกขอบเขตการแก้ไขของงานนี้

---

## 8.1 ขอบเขตและสรุปภาพรวม

### 8.1.1 จำนวนออบเจกต์ในสคีมา

| ประเภท | จำนวน | รายละเอียด |
|---|---|---|
| ตาราง | 20 | แบ่งเป็น 4 กลุ่ม: MASTER 8, FRONT 9, BOOKING 1, TRIP 2 |
| คอลัมน์ | 102 | นับจาก `CREATE TABLE` ใน 17.4.3 ทุกตาราง |
| Sequence | 1 | `seq_booking_code` |
| Index (ไม่รวม PK/UNIQUE) | 8 | สร้างหลัง Seed เพื่อความเร็วในการ Insert — ~~9~~ → ตัด `ix_schedstop_sched_seq` ที่ซ้ำกับ `uq_sched_seq` (AR-02 review 2026-09-30) |
| PRIMARY KEY | 20 | หนึ่งต่อหนึ่งตาราง (มี 3 ตารางที่ใช้ Composite PK) |
| UNIQUE Constraint | 18 | กันซ้ำเชิงคุณค่า/ตรรกะของข้อมูล |
| CHECK Constraint | 12 | บังคับ Business Rule ที่ฝังในฐานข้อมูล |
| FOREIGN KEY | 27 | รวม `ON DELETE CASCADE` 10 รายการ |
| Constraint รวม | 77 | 20 + 18 + 12 + 27 |

### 8.1.2 ตารางแยกตามกลุ่ม

| กลุ่ม | ตาราง | จำนวนคอลัมน์ | หน้าที่ |
|---|---|---|---|
| **MASTER** | `department`, `job_position`, `employee`, `app_role`, `permission`, `role_permission`, `employee_role`, `token_blacklist` | 35 | ข้อมูลบุคคล องค์กร และระบบสิทธิ์แบบ Dynamic RBAC |
| **FRONT** | `stop`, `route`, `route_stop`, `vehicle_type`, `vehicle`, `schedule`, `schedule_stop`, `driver_assign`, `vehicle_assign` | 41 | จุดจอด เส้นทาง รอบเวลา และการจัดคู่คนขับ/ยานพาหนะ |
| **BOOKING** | `booking` | 11 | การจองรถของผู้ใช้บริการ 5 สถานะ |
| **TRIP** | `trip`, `trip_passenger` | 15 | ข้อมูลการเดินรถจริงและผู้โดยสารรายคน สำหรับรายงาน 1/2/3/5 |
| **รวม** | **20 ตาราง** | **102** | — |

### 8.1.3 ตาราง Sequence

| ชื่อ | ค่าเริ่มต้น | การเพิ่ม | Cache | การใช้งาน |
|---|---|---|---|---|
| `seq_booking_code` | 1 | 1 | `NOCACHE` | สร้างเลขที่เอกสาร `booking.booking_code` เช่น `'BK68000001'` |

---

## 8.2 สัญลักษณ์ที่ใช้

| สัญลักษณ์ | ความหมาย |
|---|---|
| **PK** | Primary Key |
| **UK** | Unique Key (`UNIQUE Constraint`) |
| **FK** | Foreign Key |
| **CK** | Check Constraint |
| **ID** | `GENERATED ALWAYS AS IDENTITY` — ไม่ต้องใส่ค่าเอง |
| **REQ** | `NOT NULL` — บังคับต้องมีค่า |
| **AI** | Auto Increment จาก `SEQUENCE` |
| `NULL` | อนุญาตให้เป็นค่าว่างได้ |

### 8.2.1 Data Type ที่ใช้ในสคีมา

| Oracle Data Type | การใช้งาน | ตัวอย่างในสคีมา |
|---|---|---|
| `NUMBER(10)` | รหัส (PK/FK) และเวลาแบบจำนวนเต็ม | `emp_id`, `dept_id` |
| `NUMBER(10,7)` | พิกัดภูมิประเทศ (ทศนิยม 7 ตำแหน่ง) | `latitude`, `longitude` |
| `NUMBER(5)` | จำนวนเล็ก เช่น ลำดับ นาที ที่นั่ง | `stop_seq`, `travel_minutes`, `seats` |
| `NUMBER(3)` | จำนวนที่นั่งสูงสุด 4 ตาม BR-06 | `booking.seats` |
| `NUMBER(1)` | Boolean แทนค่า `0`/`1` เพราะ Oracle ไม่มี BOOLEAN ใน SQL | `is_active` |
| `VARCHAR2(n CHAR)` | ข้อความ นับความยาวตามอักขระ | `route_name VARCHAR2(120 CHAR)` |
| `DATE` | วันที่อย่างเดียว ไม่มีเวลา | `schedule.service_date` |
| `TIMESTAMP` | วันและเวลา รวมวินาที | `book_time`, `arrive_at` |

### 8.2.2 กฎที่ฝังในฐานข้อมูล

| # | Business Rule | ตำแหน่งที่บังคับ | สูตร Oracle |
|---|---|---|---|
| BR-01 | `route.total_minutes` = ผลรวมนาทีทุกจุดจอดของเส้นทาง | Service คำนวณใหม่ทุกครั้งที่แก้ `route_stop` | `SELECT SUM(travel_minutes) FROM route_stop WHERE route_id = :id` |
| BR-02 | `schedule_stop.arrive_at` = เวลาออก + ผลรวมนาทีถึงจุดนั้น | Service auto-generate เมื่อสร้าง Schedule | `depart_at + NUMTODSINTERVAL(:mins,'MINUTE')` |
| BR-03 | จุดจอด 1 จุด อยู่ได้หลายเส้นทาง | `UNIQUE(route_id, stop_id)` แต่ไม่ UNIQUE `stop_id` | — |
| BR-04 | คนขับ/รถ 1 คัน 1 ช่วงเวลา ห้ามชนกับตัวเอง | Service `checkConflict()` + Transaction | เทียบ `depart_at` ซ้อนทับกัน |
| BR-05 | จองก่อนเวลารถถึงจุดขึ้นอย่างน้อย 20 นาที | Service `checkLeadTime()` | `arrive_at - SYSTIMESTAMP >= INTERVAL '20' MINUTE` |
| BR-06 | ผู้ใช้ 1 คน จองได้ไม่เกิน 4 ที่นั่ง | `ck_booking_seats` + Service | `seats BETWEEN 1 AND 4` |
| BR-07 | ที่นั่งว่าง = `capacity` − ผลรวมที่นั่งที่ยัง `reserved` | Service + `SELECT ... FOR UPDATE NOWAIT` | `NVL(SUM(seats),0)` นับเฉพาะ `status='reserved'` |
| BR-08 | ยกเลิกแล้ว **ที่นั่งถูกคืนทันที** | Transaction → `status='cancelled'` | `SUM` เฉพาะ `status='reserved'` |
| BR-09 | สแกน QR ผิดรอบ → **ไม่อนุญาตให้ขึ้นรถ** | Service `validateQr()` | เทียบ `booking.sched_id` กับ `trip.sched_id` |
| BR-10 | ปิดรอบงาน → การจองที่ยัง `reserved` กลายเป็น `no_show` | Service `completeTrip()` | `UPDATE booking SET status='no_show' WHERE ...` |
| BR-11 | จุดขึ้นรถต้อง **อยู่ก่อน** จุดลงรถ | Service `checkStopOrder()` | `board_seq < alight_seq` |
| BR-12 | จุดขึ้นและจุดลงต้องอยู่ใน **เส้นทางของรอบที่เลือก** | Service `checkStopInRoute()` | JOIN `schedule_stop` |

> **หมายเหตุ:** ตารางนี้อ้างอิง `docs/chapter-17-fullstack.md` ข้อ 17.4.5 และ `docs/requirement-review-checklist.md` ข้อ ข.2 (BR-01…BR-12) โดยตรง
> `Booking.qr_token` มี `uq_booking_qr` เพื่อกัน Token ซ้ำ แต่ "QR ใช้ได้ 1 ครั้ง" เป็น **ASM-07-3 สมมติฐาน** (ยังไม่ใช่ BR) ส่วนการบังคับใช้จริงคือ **BR-09** ที่เทียบรอบเวลา

---

## 8.3 กลุ่ม MASTER — บุคคลและสิทธิ์

### 8.3.1 `department` — แผนก

**รายละเอียด:** ข้อมูลหน่วยงานของสำนักงาน ใช้จัดกลุ่มพนักงานและสรุปรายงานรายแผนก

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `dept_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_department` | รหัสแผนก เลขกำเนิดอัตโนมัติ |
| 2 | `dept_name` | `VARCHAR2(120 CHAR)` | NO | — | **UK** | `uq_department_name` | ชื่อแผนก ห้ามซ้ำ |
| 3 | `created_at` | `TIMESTAMP` | NO | `SYSTIMESTAMP` | — | — | วันเวลาที่สร้างแผนก |

**ความสัมพันธ์:** `employee.dept_id` → `department.dept_id` (`fk_employee_dept`)

---

### 8.3.2 `job_position` — ตำแหน่งงาน

**รายละเอียด:** ตำแหน่งงาน เช่น พนักงานขับรถ ผู้ดูแลระบบ ลูกค้า

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `position_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_job_position` | รหัสตำแหน่ง เลขกำเนิดอัตโนมัติ |
| 2 | `position_name` | `VARCHAR2(120 CHAR)` | NO | — | **UK** | `uq_position_name` | ชื่อตำแหน่ง ห้ามซ้ำ |

**ความสัมพันธ์:** `employee.position_id` → `job_position.position_id` (`fk_employee_position`)

---

### 8.3.3 `employee` — พนักงาน/ผู้ใช้งานระบบทุกบทบาท

**รายละเอียด:** ตารางหลักของบุคคล ใช้ร่วมกันทั้ง Admin, Staff, Driver และ Customer

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `emp_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_employee` | รหัสพนักงาน เลขกำเนิดอัตโนมัติ |
| 2 | `emp_code` | `VARCHAR2(20 CHAR)` | NO | — | **UK** | `uq_employee_code` | รหัสพนักงาน (เช่น `EMP-0001`) |
| 3 | `first_name` | `VARCHAR2(80 CHAR)` | NO | — | — | — | ชื่อ |
| 4 | `last_name` | `VARCHAR2(80 CHAR)` | NO | — | — | — | นามสกุล |
| 5 | `phone` | `VARCHAR2(20 CHAR)` | NULL | — | — | — | เบอร์โทรศัพท์ |
| 6 | `email` | `VARCHAR2(120 CHAR)` | NULL | — | — | — | อีเมล |
| 7 | `dept_id` | `NUMBER(10)` | NULL | — | **FK** | `fk_employee_dept` → `department(dept_id)` | แผนกที่สังกัด (NULL ได้ เช่น ลูกค้าภายนอก) |
| 8 | `position_id` | `NUMBER(10)` | NULL | — | **FK** | `fk_employee_position` → `job_position(position_id)` | ตำแหน่งงาน |
| 9 | `username` | `VARCHAR2(50 CHAR)` | NO | — | **UK** | `uq_employee_user` | ชื่อผู้ใช้สำหรับ Login ห้ามซ้ำ |
| 10 | `password_hash` | `VARCHAR2(200 CHAR)` | NO | — | — | — | รหัสผ่านแบบ hash (bcrypt) — **ห้ามเก็บ plaintext** |
| 11 | `is_active` | `NUMBER(1)` | NO | `1` | — | `ck_employee_active` | 1 = ใช้งานอยู่, 0 = ปิดใช้งาน |
| 12 | `created_at` | `TIMESTAMP` | NO | `SYSTIMESTAMP` | — | — | วันเวลาที่สร้างพนักงาน |

**ความสัมพันธ์:** ออกแบบเป็นตารางเดียวสำหรับทุกบทบาท (Single Table User) แยกสิทธิ์ด้วย `employee_role` แทนการสร้างตารางผู้ใช้แยกบทบาท

> **R-05:** `password_hash` เก็บเฉพาะ bcrypt hash เท่านั้น ห้ามเก็บรหัสผ่านดิบและห้าม Commit ค่าใด ๆ ใน `.env`

---

### 8.3.4 `app_role` — บทบาท/กลุ่มสิทธิ์

**รายละเอียด:** บทบาทของระบบ ได้แก่ Admin, Staff, Driver, Customer — ชื่อตารางใช้ `app_role` เพราะ `role` เป็นคำสงวนของ Oracle

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `role_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_app_role` | รหัสบทบาท |
| 2 | `role_name` | `VARCHAR2(50 CHAR)` | NO | — | **UK** | `uq_app_role` | ชื่อบทบาท เช่น `ADMIN`, `DRIVER` |
| 3 | `description` | `VARCHAR2(255 CHAR)` | NULL | — | — | — | คำอธิบายบทบาท |
| 4 | `is_active` | `NUMBER(1)` | NO | `1` | — | `ck_app_role_active` | 1 = เปิดใช้, 0 = ปิดใช้ |

> **R-07:** โค้ดห้าม hardcode สิทธิ์ตามชื่อบทบาท ให้ตรวจสิทธิ์จาก `role_permission` เสมอ เพื่อรองรับการเปลี่ยนแปลงสิทธิ์โดยไม่แก้โค้ด

---

### 8.3.5 `permission` — สิทธิ์รายหน้าจอ/ฟังก์ชัน

**รายละเอียด:** ทะเบียนสิทธิ์ทั้งหมด ใช้สร้าง Dynamic Menu และ Dynamic RBAC

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `perm_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_permission` | รหัสสิทธิ์ |
| 2 | `perm_code` | `VARCHAR2(80 CHAR)` | NO | — | **UK** | `uq_perm_code` | รหัสสิทธิ์ เช่น `ROUTE.EDIT` |
| 3 | `perm_name` | `VARCHAR2(120 CHAR)` | NO | — | — | — | ชื่อสิทธิ์ที่แสดงผล |
| 4 | `module` | `VARCHAR2(50 CHAR)` | NO | — | — | — | โมดูล: `master` \| `front` \| `booking` \| `driver` \| `report` |
| 5 | `screen_key` | `VARCHAR2(80 CHAR)` | NULL | — | — | — | รหัสหน้าจอ ใช้สร้าง Dynamic Menu |
| 6 | `sort_no` | `NUMBER(5)` | NO | `0` | — | — | ลำดับการแสดงผลเมนู (เลขยิ่งน้อยยิ่งขึ้นก่อน) |

---

### 8.3.6 `role_permission` — สิทธิ์ของแต่ละบทบาท

**รายละเอียด:** ตารางเชื่อม Many-to-Many ระหว่าง `app_role` กับ `permission`

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `role_id` | `NUMBER(10)` | NO | — | **PK, FK** | `pk_role_perm`, `fk_rp_role` → `app_role(role_id)` **ON DELETE CASCADE** | รหัสบทบาท |
| 2 | `perm_id` | `NUMBER(10)` | NO | — | **PK, FK** | `pk_role_perm`, `fk_rp_perm` → `permission(perm_id)` **ON DELETE CASCADE** | รหัสสิทธิ์ |

**Composite PK:** (`role_id`, `perm_id`) — กันบทบาทหนึ่งได้สิทธิ์หนึ่งครั้งเท่านั้น

---

### 8.3.7 `employee_role` — บทบาทของพนักงาน

**รายละเอียด:** ตารางเชื่อม Many-to-Many ระหว่าง `employee` กับ `app_role` รองรับพนักงานที่มีมากกว่าหนึ่งบทบาท

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `emp_id` | `NUMBER(10)` | NO | — | **PK, FK** | `pk_emp_role`, `fk_er_emp` → `employee(emp_id)` **ON DELETE CASCADE** | รหัสพนักงาน |
| 2 | `role_id` | `NUMBER(10)` | NO | — | **PK, FK** | `pk_emp_role`, `fk_er_role` → `app_role(role_id)` **ON DELETE CASCADE** | รหัสบทบาท |

**Composite PK:** (`emp_id`, `role_id`)

---

### 8.3.8 `token_blacklist` — รายการ JWT ที่ถูกเพิกถอน

**รายละเอียด:** เก็บ `jti` ของ Access Token ที่ถูก revoke เพื่อให้ Logout มีผลทันทีและรองรับการรีเฟรช Token

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `jti` | `VARCHAR2(64 CHAR)` | NO | — | **PK** | `fk_tb_emp` (FK อยู่คอลัมน์ `emp_id`) | JWT ID ของ Token ที่ถูกเพิกถอน |
| 2 | `emp_id` | `NUMBER(10)` | NO | — | **FK** | `fk_tb_emp` → `employee(emp_id)` **ON DELETE CASCADE** | เจ้าของ Token |
| 3 | `expires_at` | `TIMESTAMP` | NO | — | — | — | เวลาที่ Token หมดอายุ ใช้ตัดออกเมื่อหมดอายุ |
| 4 | `revoked_at` | `TIMESTAMP` | NO | `SYSTIMESTAMP` | — | — | เวลาที่เพิกถอน Token |

> **PK แบบ inline:** ตารางนี้ประกาศ `jti VARCHAR2(64 CHAR) PRIMARY KEY` ในบรรทัดคอลัมน์ ไม่ได้ใช้ `CONSTRAINT pk_...` แยก

---

## 8.4 กลุ่ม FRONT — เส้นทาง / รอบเวลา / ยานพาหนะ

### 8.4.1 `stop` — จุดจอด

**รายละเอียด:** ทะเบียนจุดจอดทั้งหมด ใช้ร่วมกันในหลายเส้นทางและหลายรอบเวลา

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `stop_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_stop` | รหัสจุดจอด |
| 2 | `stop_name` | `VARCHAR2(150 CHAR)` | NO | — | **UK** | `uq_stop_name` | ชื่อจุดจอด เช่น `มหาวิทยาลัยเทคโนโลยีมหานคร` |
| 3 | `address` | `VARCHAR2(255 CHAR)` | NULL | — | — | — | ที่อยู่เต็ม |
| 4 | `latitude` | `NUMBER(10,7)` | NULL | — | — | — | ละติจูด (ติดลบ = ตะวันตก/ใต้) |
| 5 | `longitude` | `NUMBER(10,7)` | NULL | — | — | — | ลองจิจูด (ติดลบ = ตะวันตก/ใต้) |
| 6 | `is_active` | `NUMBER(1)` | NO | `1` | — | `ck_stop_active` | 1 = เปิดใช้, 0 = ปิดใช้ |

**ความสัมพันธ์:** อ้างอิงจาก `route_stop`, `schedule_stop`, `booking` (2 คอลัมน์), `trip_passenger`

---

### 8.4.2 `route` — เส้นทาง

**รายละเอียด:** เส้นทางเดินรถ รวมจุดจอดและเวลาเดินทางรวม

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `route_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_route` | รหัสเส้นทาง |
| 2 | `route_name` | `VARCHAR2(120 CHAR)` | NO | — | — | — | ชื่อเส้นทาง |
| 3 | `total_minutes` | `NUMBER(5)` | NO | `0` | — | `ck_route_min` (`>= 0`) | นาทีรวมทั้งเส้นทาง (BR-01: คำนวณจาก `SUM(route_stop.travel_minutes)`) |
| 4 | `description` | `VARCHAR2(255 CHAR)` | NULL | — | — | — | คำอธิบายเส้นทาง |
| 5 | `is_active` | `NUMBER(1)` | NO | `1` | — | `ck_route_act` | 1 = เปิดใช้, 0 = ปิดใช้ |

> หมายเหตุ: `route_name` ไม่มี `UNIQUE` ตาม DDL ต้นทาง — ห้ามเพิ่มเองเพราะจะเปลี่ยนสัญญาของ ER Mapping

---

### 8.4.3 `route_stop` — จุดจอดในเส้นทาง

**รายละเอียด:** จุดจอดแต่ละจุดในแต่ละเส้นทาง พร้อมลำดับและนาทีที่ใช้เดินทางถึงจุดนั้น

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `route_id` | `NUMBER(10)` | NO | — | **PK, FK** | `pk_route_stop`, `fk_rs_route` → `route(route_id)` **ON DELETE CASCADE** | รหัสเส้นทาง |
| 2 | `stop_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_route_stop_uk`, `fk_rs_stop` → `stop(stop_id)` | รหัสจุดจอด (BR-03: ห้ามซ้ำในเส้นทางเดียวกัน) |
| 3 | `stop_seq` | `NUMBER(5)` | NO | — | **PK** | `pk_route_stop` | ลำดับจุดจอด 1..n |
| 4 | `travel_minutes` | `NUMBER(5)` | NO | — | — | `ck_rs_min` (`>= 0`) | นาทีจากจุดก่อนหน้าถึงจุดนี้ |

**Composite PK:** (`route_id`, `stop_seq`)
**UNIQUE:** (`route_id`, `stop_id`) — บังคับ BR-03

---

### 8.4.4 `vehicle_type` — ประเภทยานพาหนะ

**รายละเอียด:** ประเภทรถและจำนวนที่นั่ง ใช้ตรวจความจุก่อนเปิดจอง

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `vtype_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_vtype` | รหัสประเภทรถ |
| 2 | `vtype_name` | `VARCHAR2(80 CHAR)` | NO | — | **UK** | `uq_vtype` | ชื่อประเภทรถ เช่น `รถตู้ 9 ที่นั่ง` |
| 3 | `capacity` | `NUMBER(5)` | NO | — | — | `ck_vtype_cap` (`> 0`) | จำนวนที่นั่งรวม |

---

### 8.4.5 `vehicle` — ยานพาหนะ

**รายละเอียด:** ทะเบียนรถจริง เชื่อมกับประเภทรถเพื่อทราบความจุ

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `veh_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_vehicle` | รหัสยานพาหนะ |
| 2 | `plate_no` | `VARCHAR2(20 CHAR)` | NO | — | **UK** | `uq_vehicle_plate` | ทะเบียนรถ เช่น `สย 2591` |
| 3 | `vtype_id` | `NUMBER(10)` | NO | — | **FK** | `fk_vehicle_type` → `vehicle_type(vtype_id)` | ประเภทรถ |
| 4 | `is_active` | `NUMBER(1)` | NO | `1` | — | `ck_vehicle_act` | 1 = เปิดใช้, 0 = ปิดใช้ |

---

### 8.4.6 `schedule` — รอบเวลาการเดินรถ

**รายละเอียด:** รอบเวลาเดินรถของเส้นทางหนึ่งในวันหนึ่ง เก็บทั้ง `service_date` และ `depart_at` (TIMESTAMP เต็ม) เพื่อคำนวณเวลาได้ตรง

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `sched_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_schedule` | รหัสรอบเวลา |
| 2 | `route_id` | `NUMBER(10)` | NO | — | **FK** | `fk_schedule_route` → `route(route_id)` | เส้นทางของรอบนี้ |
| 3 | `service_date` | `DATE` | NO | — | — | — | วันที่ให้บริการ |
| 4 | `depart_at` | `TIMESTAMP` | NO | — | **UK** | `uq_route_depart` | วัน+เวลาออกจากจุดเริ่มต้น เช่น `2568-01-01 09:30` |
| 5 | `is_active` | `NUMBER(1)` | NO | `1` | — | `ck_schedule_act` | 1 = เปิดจอง, 0 = ปิดรอบ |

**UNIQUE:** (`route_id`, `depart_at`) — เส้นทางเดียวกันออกพร้อมกันครั้งเดียว

> **BR-04:** การตรวจช่วงเวลาชนกันของคนขับ/ยานพาหนะทำที่ Service Layer (`checkConflict()`) เพราะต้องเทียบเวลาทั้งเส้นทาง ไม่สามารถบังคับด้วย CHECK แบบตรงไปตรงมา

---

### 8.4.7 `schedule_stop` — เวลาที่ถึงแต่ละจุดจอด

**รายละเอียด:** เวลาที่รถถึงแต่ละจุดจอดของรอบเวลาหนึ่ง คำนวณอัตโนมัติตอนสร้าง Schedule

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `sched_stop_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_sched_stop` | รหัสเวลาที่ถึง |
| 2 | `sched_id` | `NUMBER(10)` | NO | — | **FK** | `fk_ss_sched` → `schedule(sched_id)` **ON DELETE CASCADE** | รอบเวลาที่เกี่ยวข้อง |
| 3 | `stop_id` | `NUMBER(10)` | NO | — | **FK** | `fk_ss_stop` → `stop(stop_id)` | จุดจอด |
| 4 | `stop_seq` | `NUMBER(5)` | NO | — | **UK** | `uq_sched_seq` | ลำดับจุดจอดในรอบนี้ |
| 5 | `arrive_at` | `TIMESTAMP` | NO | — | — | — | เวลาถึงจุดจอด (BR-02: `depart_at + NUMTODSINTERVAL(SUM(travel_minutes),'MINUTE')`) |
| 6 | `dwell_minutes` | `NUMBER(5)` | NO | `0` | — | — | นาทีที่รถหยุดรับ-ส่งที่จุดนี้ |

**UNIQUE:** (`sched_id`, `stop_seq`)
**Index:** `uq_sched_seq (sched_id, stop_seq)` — ใช้ UNIQUE constraint ที่ Oracle สร้าง index ให้อัตโนมัติ รองรับการดึงตามลำดับจุดจอด
> ~~`ix_schedstop_sched_seq`~~ ถูกตัดออกเมื่อ 2026-09-30 เพราะซ้ำกับ `uq_sched_seq` (redundant index) — ดู `docs/reviews/t-007-schema-peer-review-sukhsorn.md`

---

### 8.4.8 `driver_assign` — การจัดคู่คนขับกับรอบเวลา

**รายละเอียด:** ผูกคนขับกับรอบเวลา พนักงานที่อ้างอิงต้องมี `app_role` = `DRIVER`

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `assign_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_driver_assign` | รหัสการจัดคู่ |
| 2 | `sched_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_driver_sched`, `fk_da_sched` → `schedule(sched_id)` **ON DELETE CASCADE** | รอบเวลา |
| 3 | `emp_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_driver_sched`, `fk_da_emp` → `employee(emp_id)` | พนักงานคนขับ |
| 4 | `assign_at` | `TIMESTAMP` | NO | `SYSTIMESTAMP` | — | — | เวลาที่มอบหมาย |

**UNIQUE:** (`sched_id`, `emp_id`) — คนขับหนึ่งคนรับหนึ่งรอบได้ครั้งเดียว
**Index:** `ix_da_emp (emp_id, sched_id)` — ตรวจชนช่วงเวลาของคนขับ (BR-04)

---

### 8.4.9 `vehicle_assign` — การจัดคู่ยานพาหนะกับรอบเวลา

**รายละเอียด:** ผูกรถกับรอบเวลา

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `assign_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_vehicle_assign` | รหัสการจัดคู่ |
| 2 | `sched_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_vehicle_sched`, `fk_va_sched` → `schedule(sched_id)` **ON DELETE CASCADE** | รอบเวลา |
| 3 | `veh_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_vehicle_sched`, `fk_va_veh` → `vehicle(veh_id)` | ยานพาหนะ |
| 4 | `assign_at` | `TIMESTAMP` | NO | `SYSTIMESTAMP` | — | — | เวลาที่มอบหมาย |

**UNIQUE:** (`sched_id`, `veh_id`) — รถหนึ่งคันรับหนึ่งรอบได้ครั้งเดียว
**Index:** `ix_va_veh (veh_id, sched_id)` — ตรวจชนช่วงเวลาของรถ (BR-04)

---

## 8.5 กลุ่ม BOOKING — การจอง

### 8.5.1 `booking` — การจองรถ

**รายละเอียด:** การจองรถของผู้ใช้บริการ มี 5 สถานะ จ่ายเงินด้วย QR Code และยกเลิกได้ก่อนถึงจุดขึ้น 20 นาที

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `booking_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_booking` | รหัสการจอง |
| 2 | `booking_code` | `VARCHAR2(20 CHAR)` | NO | — | **UK** | `uq_booking_code` | เลขที่เอกสาร เช่น `BK68000001` (สร้างจาก `seq_booking_code.NEXTVAL`) |
| 3 | `cust_id` | `NUMBER(10)` | NO | — | **FK** | `fk_bk_cust` → `employee(emp_id)` | ผู้จอง (ลูกค้าทุกคนเป็น `employee` 1 รายการ) |
| 4 | `sched_id` | `NUMBER(10)` | NO | — | **FK** | `fk_bk_sched` → `schedule(sched_id)` | รอบเวลาที่จอง |
| 5 | `board_stop_id` | `NUMBER(10)` | NO | — | **FK** | `fk_bk_board` → `stop(stop_id)` | จุดขึ้นรถ |
| 6 | `alight_stop_id` | `NUMBER(10)` | NO | — | **FK** | `fk_bk_alight` → `stop(stop_id)` | จุดลงรถ |
| 7 | `seats` | `NUMBER(3)` | NO | `1` | — | `ck_booking_seats` (BETWEEN 1 AND 4) | จำนวนที่นั่งที่จอง (BR-06 สูงสุด 4) |
| 8 | `status` | `VARCHAR2(20 CHAR)` | NO | `'reserved'` | — | `ck_booking_status` | สถานะ: `reserved` \| `checked_in` \| `completed` \| `cancelled` \| `no_show` |
| 9 | `book_time` | `TIMESTAMP` | NO | `SYSTIMESTAMP` | — | — | เวลาที่จอง |
| 10 | `qr_token` | `VARCHAR2(64 CHAR)` | NO | — | **UK** | `uq_booking_qr` | Token ฝังใน QR Code (BR-09: ต้องตรงรอบเดินรถที่กำลังวิ่ง) |
| 11 | `cancel_time` | `TIMESTAMP` | NULL | — | — | — | เวลาที่ยกเลิก (NULL = ยังไม่ยกเลิก) |

**สถานะการจอง (5 สถานะ):**

| สถานะ | ความหมาย | ตั้งจาก | เป็น |
|---|---|---|---|
| `reserved` | จองแล้ว ยังไม่ถึงเวลายืนยัน | สร้างการจอง | คนขับกดขึ้นรถ → `checked_in` |
| `checked_in` | ยืนยันแล้วแต่ยังไม่ลงรถ | คนขับสแกน QR | คนขับกดลงรถ/ปิดรอบ → `completed` |
| `completed` | เดินทางเสร็จสิ้น | คนขับกดลงรถ | สถานะสุดท้าย |
| `cancelled` | ยกเลิกก่อนถึงจุดขึ้น 20 นาที | ผู้ใช้แตะปุ่มยกเลิก | สถานะสุดท้าย |
| `no_show` | ไม่มาขึ้นรถ | คนขับกดเมื่อปิดรอบ | สถานะสุดท้าย |

> **BR-05:** การยกเลิกก่อนถึงจุดขึ้น 20 นาที บังคับที่ Service Layer (`checkLeadTime()`) เนื่องจากต้องเทียบ `schedule_stop.arrive_at` ของจุดขึ้นกับเวลาปัจจุบัน

> **Index:** `ix_booking_sched_status (sched_id, status)`, `ix_booking_book_time (book_time)`, `ix_booking_cust (cust_id, book_time)` — รองรับรายงานและการตรวจที่นั่งคงเหลือ

---

## 8.6 กลุ่ม TRIP — ข้อมูลสำหรับรายงาน

### 8.6.1 `trip` — การเดินรถจริง

**รายละเอียด:** ข้อมูลการเดินรถจริงของหนึ่งรอบเวลา คนขับกดเริ่มและกดปิด

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `trip_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_trip` | รหัสการเดินรถ |
| 2 | `sched_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_trip_sched`, `fk_tr_sched` → `schedule(sched_id)` | รอบเวลา (1 รอบ = 1 trip) |
| 3 | `driver_id` | `NUMBER(10)` | NO | — | **FK** | `fk_tr_driver` → `employee(emp_id)` | คนขับที่เดินรถจริง |
| 4 | `veh_id` | `NUMBER(10)` | NO | — | **FK** | `fk_tr_veh` → `vehicle(veh_id)` | ยานพาหนะที่ใช้จริง |
| 5 | `start_time` | `TIMESTAMP` | NULL | — | — | — | เวลาออกจริง (NULL = ยังไม่ออก) |
| 6 | `end_time` | `TIMESTAMP` | NULL | — | — | — | เวลากลับถึงจุดปลายจริง |
| 7 | `status` | `VARCHAR2(20 CHAR)` | NO | `'running'` | — | `ck_trip_status` | สถานะ: `running` \| `completed` |

**UNIQUE:** (`sched_id`) — 1 รอบเวลา = 1 การเดินรถ ป้องกันการเดินรถซ้ำ
**ข้อมูลสำคัญ:** ตารางนี้เป็นหัวใจของรายงานทุกตัว (R1, R3, R4, R6) เพราะบอกได้ว่าใครขับ รถคันไหน ออก-กลับเมื่อไร และนับได้เท่าไร

---

### 8.6.2 `trip_passenger` — ผู้โดยสารรายคนต่อรอบ

**รายละเอียด:** รายละเอียดการขึ้น-ลงรถของผู้โดยสารแต่ละคน จำเป็นสำหรับรายงาน 1, 2, 3, 5

| # | คอลัมน์ | Data Type | Null | Default | Key | Constraint | คำอธิบาย |
|---|---|---|---|---|---|---|---|
| 1 | `trip_passenger_id` | `NUMBER(10)` | NO | IDENTITY(1,1) | **PK** | `pk_trip_passenger` | รหัสรายการผู้โดยสาร |
| 2 | `trip_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_trip_booking`, `fk_tp_trip` → `trip(trip_id)` **ON DELETE CASCADE** | การเดินรถ |
| 3 | `booking_id` | `NUMBER(10)` | NO | — | **UK, FK** | `uq_trip_booking`, `fk_tp_booking` → `booking(booking_id)` | การจอง |
| 4 | `checkin_time` | `TIMESTAMP` | NULL | — | — | — | เวลาที่ยืนยันตั๋ว (สแกน QR) |
| 5 | `checkin_stop_id` | `NUMBER(10)` | NULL | — | **FK** | `fk_tp_stop` → `stop(stop_id)` | จุดที่ขึ้นรถจริง |
| 6 | `board_seq` | `NUMBER(5)` | NULL | — | — | — | จุดจอดที่ขึ้นจริง (ใช้ทำรายงาน R1/R5) |
| 7 | `alight_seq` | `NUMBER(5)` | NULL | — | — | — | จุดจอดที่ลงจริง |
| 8 | `alight_time` | `TIMESTAMP` | NULL | — | — | — | เวลาที่ลงรถจริง |

**Composite UK:** (`trip_id`, `booking_id`) — ผู้โดยสารหนึ่งคนต่อหนึ่งการเดินรถมีได้หนึ่งรายการ
**Index:** `ix_tp_trip (trip_id)`, `ix_tp_booking (booking_id)` — รองรับรายงานและการค้นย้อนกลับจากการจอง

> **R-03:** ทุกคำสั่ง SQL ต้องใช้ Bind Variable (`:1`, `:2`) ห้ามต่อสตริงด้วยการ concat ค่าจากผู้ใช้โดยตรง รวมถึง `checkin_stop_id`, `board_seq`, `alight_seq` ที่รับค่าจากการสแกน QR

---

## 8.7 สรุปความสัมพันธ์ทั้งหมด (Foreign Key Map)

### 8.7.1 ตารางแม่ – ลูก

| ตารางแม่ | คอลัมน์ PK | ตารางลูก | คอลัมน์ FK | Constraint | ON DELETE |
|---|---|---|---|---|---|
| `department` | `dept_id` | `employee` | `dept_id` | `fk_employee_dept` | RESTRICT (ค่าเริ่มต้น) |
| `job_position` | `position_id` | `employee` | `position_id` | `fk_employee_position` | RESTRICT |
| `employee` | `emp_id` | `employee_role` | `emp_id` | `fk_er_emp` | **CASCADE** |
| `employee` | `emp_id` | `token_blacklist` | `emp_id` | `fk_tb_emp` | **CASCADE** |
| `employee` | `emp_id` | `booking` | `cust_id` | `fk_bk_cust` | RESTRICT |
| `employee` | `emp_id` | `driver_assign` | `emp_id` | `fk_da_emp` | RESTRICT |
| `employee` | `emp_id` | `trip` | `driver_id` | `fk_tr_driver` | RESTRICT |
| `app_role` | `role_id` | `role_permission` | `role_id` | `fk_rp_role` | **CASCADE** |
| `app_role` | `role_id` | `employee_role` | `role_id` | `fk_er_role` | **CASCADE** |
| `permission` | `perm_id` | `role_permission` | `perm_id` | `fk_rp_perm` | **CASCADE** |
| `stop` | `stop_id` | `route_stop` | `stop_id` | `fk_rs_stop` | RESTRICT |
| `stop` | `stop_id` | `schedule_stop` | `stop_id` | `fk_ss_stop` | RESTRICT |
| `stop` | `stop_id` | `booking` | `board_stop_id` | `fk_bk_board` | RESTRICT |
| `stop` | `stop_id` | `booking` | `alight_stop_id` | `fk_bk_alight` | RESTRICT |
| `stop` | `stop_id` | `trip_passenger` | `checkin_stop_id` | `fk_tp_stop` | RESTRICT (nullable FK) |
| `route` | `route_id` | `route_stop` | `route_id` | `fk_rs_route` | **CASCADE** |
| `route` | `route_id` | `schedule` | `route_id` | `fk_schedule_route` | RESTRICT |
| `vehicle_type` | `vtype_id` | `vehicle` | `vtype_id` | `fk_vehicle_type` | RESTRICT |
| `vehicle` | `veh_id` | `vehicle_assign` | `veh_id` | `fk_va_veh` | RESTRICT |
| `vehicle` | `veh_id` | `trip` | `veh_id` | `fk_tr_veh` | RESTRICT |
| `schedule` | `sched_id` | `schedule_stop` | `sched_id` | `fk_ss_sched` | **CASCADE** |
| `schedule` | `sched_id` | `driver_assign` | `sched_id` | `fk_da_sched` | **CASCADE** |
| `schedule` | `sched_id` | `vehicle_assign` | `sched_id` | `fk_va_sched` | **CASCADE** |
| `schedule` | `sched_id` | `booking` | `sched_id` | `fk_bk_sched` | RESTRICT |
| `schedule` | `sched_id` | `trip` | `sched_id` | `fk_tr_sched` | RESTRICT |
| `booking` | `booking_id` | `trip_passenger` | `booking_id` | `fk_tp_booking` | RESTRICT |
| `trip` | `trip_id` | `trip_passenger` | `trip_id` | `fk_tp_trip` | **CASCADE** |
| **รวม** | — | — | — | **27 FK** | **CASCADE 10 / RESTRICT 17** |

> ตารางนี้แสดงผลของ `ON DELETE CASCADE` ในระดับความสัมพันธ์ (ตารางแม่ → ตารางลูก) ส่วนจำนวน FK จริงในสคริปต์นับรายคอลัมน์ โดย `role_permission` และ `employee_role` มี 2 FK ต่อหนึ่งความสัมพันธ์

### 8.7.2 ผลกระทบของ `ON DELETE CASCADE`

| ถ้าลบ | จะถูกลบตามอัตโนมัติ | FK ที่เกี่ยวข้อง | เหตุผล |
|---|---|---|---|
| `employee` | `employee_role`, `token_blacklist` | `fk_er_emp`, `fk_tb_emp` | สิทธิ์และ Token ของคนที่ไม่มีอยู่แล้วไม่มีความหมาย |
| `app_role` | `role_permission`, `employee_role` | `fk_rp_role`, `fk_er_role` | บทบาทหาย = สิทธิ์ที่ผูกไว้หายตาม |
| `permission` | `role_permission` | `fk_rp_perm` | สิทธิ์หาย = การผูกสิทธิ์หายตาม |
| `route` | `route_stop` | `fk_rs_route` | เส้นทางหาย = จุดจอดในเส้นทางหายตาม |
| `schedule` | `schedule_stop`, `driver_assign`, `vehicle_assign` | `fk_ss_sched`, `fk_da_sched`, `fk_va_sched` | รอบเวลาหาย = รายละเอียดรอบหายตาม |
| `trip` | `trip_passenger` | `fk_tp_trip` | การเดินรถหาย = รายชื่อผู้โดยสารหายตาม |
| **รวม** | — | **10 FK** | — |

> `booking` ใช้ RESTRICT (ไม่ CASCADE) เพราะต้องเก็บประวัติการจองไว้สำหรับรายงานและการตรวจสอบย้อนหลัง
>
> **หมายเหตุการนับ:** ใน 27 FOREIGN KEY มี `ON DELETE CASCADE` จำนวน 10 รายการ และ RESTRICT (ค่าเริ่มต้น เมื่อไม่ระบุ `ON DELETE`) จำนวน 17 รายการ

---

## 8.8 ดัชนี (Index) สำหรับรายงานและการทำงานที่ถี่

| # | Index | ตาราง | คอลัมน์ | รองรับงาน |
|---|---|---|---|---|
| 1 | `ix_booking_sched_status` | `booking` | `sched_id, status` | นับที่นั่งคงเหลือ (BR-07) และสถานะต่อรอบ (UC-17, UC-18, UC-26 / BR-10) |
| 2 | `ix_booking_book_time` | `booking` | `book_time` | รายงานการจองตามช่วงเวลา (R1) |
| 3 | `ix_booking_cust` | `booking` | `cust_id, book_time` | ประวัติการจองของลูกค้าเรียงตามเวลา (UC-19) |
| 4 | `ix_sched_route_date` | `schedule` | `route_id, service_date` | ค้นหารอบเวลาตามเส้นทางและวัน (UC-14, UC-17) + รายงาน R4 |
| 5 | ~~`ix_schedstop_sched_seq`~~ | ~~`schedule_stop`~~ | ~~`sched_id, stop_seq`~~ | ⛔ **ตัดแล้ว 2026-09-30** — ซ้ำกับ `uq_sched_seq` · ใช้ `uq_sched_seq` แทน (UC-14, UC-24, BR-02) |
| 6 | `ix_tp_trip` | `trip_passenger` | `trip_id` | รายงานผู้โดยสารรายเที่ยว (R1) |
| 7 | `ix_tp_booking` | `trip_passenger` | `booking_id` | ค้นย้อนกลับจากการจอง (UC-19, UC-21) |
| 8 | `ix_da_emp` | `driver_assign` | `emp_id, sched_id` | ตรวจชนช่วงเวลาคนขับ (UC-15 / BR-04) + รายงาน R6 |
| 9 | `ix_va_veh` | `vehicle_assign` | `veh_id, sched_id` | ตรวจชนช่วงเวลายานพาหนะ (UC-16 / BR-04) |

> **หมายเหตุ:** ตารางนี้ลิสต์ตามเอกสารต้นฉบับ 9 รายการ แต่ DDL จริง (`01_schema.sql`) สร้าง **8 ตัว**
> รายการที่ 5 ถูกตัดออกเพราะเป็น redundant index · ตรวจสอบแล้วว่า query ที่ระบุไว้ยังใช้ `uq_sched_seq` ได้ครบ
> ดูหลักฐาน: [`docs/reviews/t-007-schema-peer-review-sukhsorn.md`](../reviews/t-007-schema-peer-review-sukhsorn.md)

> ดัชนีทั้ง 9 ถูกสร้าง **หลัง Seed** เพื่อให้การ Insert ข้อมูลตั้งต้นเร็วขึ้น ตามคอมเมนต์ใน DDL ต้นทาง

---

## 8.9 SQL Appendix — `COMMENT ON` ฉบับเต็ม (ข้อเสนอสำหรับ T-007)

> สคริปต์นี้เป็น **ข้อเสนอ** ให้ T-007 (`@agent-oracle`) นำไปรวมใน `database/01_schema.sql` งาน T-006 ไม่ได้แก้ไฟล์ใน `database/**`
> DDL ต้นทางใน 17.4.3 มี `COMMENT ON` เพียง 13 รายการ ซึ่งครอบคลุมเฉพาะตารางและคอลัมน์สำคัญ ส่วนคำอธิบายในหัวข้อ 8.3–8.6 คือฉบับเต็มที่ควรประกาศครบทุกตารางและทุกคอลัมน์ตาม DoD

```sql
-- ==================================================================
-- COMMENT ON TABLE  —  ครบ 20 ตาราง
-- ==================================================================
COMMENT ON TABLE  department          IS 'แผนก/หน่วยงานในสำนักงาน';
COMMENT ON TABLE  job_position        IS 'ตำแหน่งงานของพนักงาน';
COMMENT ON TABLE  employee            IS 'พนักงาน/ผู้ใช้งานระบบทุกบทบาท';
COMMENT ON TABLE  app_role            IS 'บทบาท/กลุ่มสิทธิ์ (Admin, Staff, Driver, Customer)';
COMMENT ON TABLE  permission          IS 'สิทธิ์รายหน้าจอ/ฟังก์ชัน เพื่อทำ Dynamic RBAC';
COMMENT ON TABLE  role_permission     IS 'สิทธิ์ที่แต่ละบทบาทได้รับ (Dynamic RBAC)';
COMMENT ON TABLE  employee_role       IS 'บทบาทที่พนักงานแต่ละคนได้รับ';
COMMENT ON TABLE  token_blacklist     IS 'รายการ JWT ที่ถูกเพิกถอนแล้ว';
COMMENT ON TABLE  stop                IS 'จุดจอดของระบบ';
COMMENT ON TABLE  route               IS 'เส้นทางเดินรถ';
COMMENT ON TABLE  route_stop          IS 'จุดจอดในแต่ละเส้นทาง + นาทีที่ใช้เดินทางถึงจุดนั้น';
COMMENT ON TABLE  vehicle_type        IS 'ประเภทยานพาหนะและจำนวนที่นั่ง';
COMMENT ON TABLE  vehicle             IS 'ทะเบียนยานพาหนะ';
COMMENT ON TABLE  schedule            IS 'รอบเวลาการเดินรถ (depart_at เก็บวัน+เวลาเต็ม)';
COMMENT ON TABLE  schedule_stop       IS 'เวลาที่รถถึงแต่ละจุดจอดในแต่ละรอบ (คำนวณอัตโนมัติ)';
COMMENT ON TABLE  driver_assign       IS 'การจัดคู่คนขับกับรอบเวลา';
COMMENT ON TABLE  vehicle_assign      IS 'การจัดคู่ยานพาหนะกับรอบเวลา';
COMMENT ON TABLE  booking             IS 'การจองรถของผู้ใช้บริการ มี 5 สถานะ';
COMMENT ON TABLE  trip                IS 'การเดินรถจริงในแต่ละรอบ (คนขับกดเริ่ม/ปิด)';
COMMENT ON TABLE  trip_passenger      IS 'รายละเอียดผู้โดยสารรายคนต่อรอบ — จำเป็นสำหรับรายงาน 1,2,3,5';

-- ==================================================================
-- COMMENT ON COLUMN  —  กลุ่ม MASTER
-- ==================================================================
COMMENT ON COLUMN department.dept_id       IS 'รหัสแผนก เลขกำเนิดอัตโนมัติ';
COMMENT ON COLUMN department.dept_name     IS 'ชื่อแผนก ห้ามซ้ำ';
COMMENT ON COLUMN department.created_at    IS 'วันเวลาที่สร้างแผนก';

COMMENT ON COLUMN job_position.position_id   IS 'รหัสตำแหน่งงาน เลขกำเนิดอัตโนมัติ';
COMMENT ON COLUMN job_position.position_name IS 'ชื่อตำแหน่งงาน ห้ามซ้ำ';

COMMENT ON COLUMN employee.emp_id        IS 'รหัสพนักงาน เลขกำเนิดอัตโนมัติ';
COMMENT ON COLUMN employee.emp_code      IS 'รหัสพนักงาน';
COMMENT ON COLUMN employee.first_name    IS 'ชื่อ';
COMMENT ON COLUMN employee.last_name     IS 'นามสกุล';
COMMENT ON COLUMN employee.phone         IS 'เบอร์โทรศัพท์';
COMMENT ON COLUMN employee.email         IS 'อีเมล';
COMMENT ON COLUMN employee.dept_id       IS 'รหัสแผนกที่สังกัด (NULL ได้สำหรับลูกค้าภายนอก)';
COMMENT ON COLUMN employee.position_id   IS 'รหัสตำแหน่งงาน';
COMMENT ON COLUMN employee.username      IS 'ชื่อผู้ใช้สำหรับ Login ห้ามซ้ำ';
COMMENT ON COLUMN employee.password_hash IS 'รหัสผ่านแบบ hash (bcrypt) — ห้ามเก็บ plaintext';
COMMENT ON COLUMN employee.is_active     IS '1 = ใช้งานอยู่, 0 = ปิดใช้งาน';
COMMENT ON COLUMN employee.created_at    IS 'วันเวลาที่สร้างพนักงาน';

COMMENT ON COLUMN app_role.role_id     IS 'รหัสบทบาท';
COMMENT ON COLUMN app_role.role_name   IS 'ชื่อบทบาท เช่น ADMIN, STAFF, DRIVER, CUSTOMER';
COMMENT ON COLUMN app_role.description IS 'คำอธิบายบทบาท';
COMMENT ON COLUMN app_role.is_active   IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN permission.perm_id     IS 'รหัสสิทธิ์';
COMMENT ON COLUMN permission.perm_code   IS 'รหัสสิทธิ์ เช่น ROUTE.EDIT';
COMMENT ON COLUMN permission.perm_name   IS 'ชื่อสิทธิ์ที่แสดงผล';
COMMENT ON COLUMN permission.module      IS 'โมดูล: master | front | booking | driver | report';
COMMENT ON COLUMN permission.screen_key  IS 'รหัสหน้าจอ ใช้สร้าง Dynamic Menu';
COMMENT ON COLUMN permission.sort_no     IS 'ลำดับการแสดงผลเมนู (เลขยิ่งน้อยยิ่งขึ้นก่อน)';

COMMENT ON COLUMN role_permission.role_id IS 'รหัสบทบาท (FK -> app_role.role_id)';
COMMENT ON COLUMN role_permission.perm_id IS 'รหัสสิทธิ์ (FK -> permission.perm_id)';

COMMENT ON COLUMN employee_role.emp_id  IS 'รหัสพนักงาน (FK -> employee.emp_id)';
COMMENT ON COLUMN employee_role.role_id IS 'รหัสบทบาท (FK -> app_role.role_id)';

COMMENT ON COLUMN token_blacklist.jti        IS 'JWT ID ของ Token ที่ถูกเพิกถอน';
COMMENT ON COLUMN token_blacklist.emp_id     IS 'รหัสเจ้าของ Token (FK -> employee.emp_id)';
COMMENT ON COLUMN token_blacklist.expires_at IS 'เวลาที่ Token หมดอายุ';
COMMENT ON COLUMN token_blacklist.revoked_at IS 'เวลาที่เพิกถอน Token';
```

```sql
-- ==================================================================
-- COMMENT ON COLUMN  —  กลุ่ม FRONT / BOOKING / TRIP
-- ==================================================================
COMMENT ON COLUMN stop.stop_id    IS 'รหัสจุดจอด';
COMMENT ON COLUMN stop.stop_name  IS 'ชื่อจุดจอด เช่น มหาวิทยาลัยเทคโนโลยีมหานคร';
COMMENT ON COLUMN stop.address    IS 'ที่อยู่เต็ม';
COMMENT ON COLUMN stop.latitude   IS 'ละติจูด (NUMBER(10,7))';
COMMENT ON COLUMN stop.longitude  IS 'ลองจิจูด (NUMBER(10,7))';
COMMENT ON COLUMN stop.is_active  IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN route.route_id      IS 'รหัสเส้นทาง';
COMMENT ON COLUMN route.route_name    IS 'ชื่อเส้นทาง';
COMMENT ON COLUMN route.total_minutes IS 'นาทีรวมทั้งเส้นทาง (BR-01: SUM ของ route_stop.travel_minutes)';
COMMENT ON COLUMN route.description   IS 'คำอธิบายเส้นทาง';
COMMENT ON COLUMN route.is_active     IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN route_stop.route_id       IS 'รหัสเส้นทาง (FK -> route.route_id)';
COMMENT ON COLUMN route_stop.stop_id        IS 'รหัสจุดจอด (FK -> stop.stop_id) — BR-03 ห้ามซ้ำในเส้นทางเดียวกัน';
COMMENT ON COLUMN route_stop.stop_seq       IS 'ลำดับจุดจอด 1..n';
COMMENT ON COLUMN route_stop.travel_minutes IS 'นาทีจากจุดก่อนหน้าถึงจุดนี้';

COMMENT ON COLUMN vehicle_type.vtype_id   IS 'รหัสประเภทรถ';
COMMENT ON COLUMN vehicle_type.vtype_name IS 'ชื่อประเภทรถ เช่น รถตู้ 9 ที่นั่ง';
COMMENT ON COLUMN vehicle_type.capacity   IS 'จำนวนที่นั่งรวม';

COMMENT ON COLUMN vehicle.veh_id    IS 'รหัสยานพาหนะ';
COMMENT ON COLUMN vehicle.plate_no  IS 'ทะเบียนรถ เช่น สย 2591';
COMMENT ON COLUMN vehicle.vtype_id  IS 'รหัสประเภทรถ (FK -> vehicle_type.vtype_id)';
COMMENT ON COLUMN vehicle.is_active IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN schedule.sched_id     IS 'รหัสรอบเวลา';
COMMENT ON COLUMN schedule.route_id     IS 'รหัสเส้นทาง (FK -> route.route_id)';
COMMENT ON COLUMN schedule.service_date IS 'วันที่ให้บริการ';
COMMENT ON COLUMN schedule.depart_at    IS 'วัน+เวลาออกจากจุดเริ่มต้น เช่น 2568-01-01 09:30';
COMMENT ON COLUMN schedule.is_active    IS '1 = เปิดจอง, 0 = ปิดรอบ';

COMMENT ON COLUMN schedule_stop.sched_stop_id IS 'รหัสเวลาที่ถึงจุดจอด';
COMMENT ON COLUMN schedule_stop.sched_id      IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN schedule_stop.stop_id       IS 'รหัสจุดจอด (FK -> stop.stop_id)';
COMMENT ON COLUMN schedule_stop.stop_seq      IS 'ลำดับจุดจอดในรอบนี้';
COMMENT ON COLUMN schedule_stop.arrive_at     IS 'เวลาถึงจุดจอด (BR-02: depart_at + SUM(travel_minutes))';
COMMENT ON COLUMN schedule_stop.dwell_minutes IS 'นาทีที่รถหยุดรับ-ส่งที่จุดนี้';

COMMENT ON COLUMN driver_assign.assign_id IS 'รหัสการจัดคู่คนขับ';
COMMENT ON COLUMN driver_assign.sched_id  IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN driver_assign.emp_id    IS 'รหัสพนักงานคนขับ (FK -> employee.emp_id) ต้องมี role = DRIVER';
COMMENT ON COLUMN driver_assign.assign_at IS 'เวลาที่มอบหมาย';

COMMENT ON COLUMN vehicle_assign.assign_id IS 'รหัสการจัดคู่ยานพาหนะ';
COMMENT ON COLUMN vehicle_assign.sched_id  IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN vehicle_assign.veh_id    IS 'รหัสยานพาหนะ (FK -> vehicle.veh_id)';
COMMENT ON COLUMN vehicle_assign.assign_at IS 'เวลาที่มอบหมาย';

COMMENT ON COLUMN booking.booking_id     IS 'รหัสการจอง';
COMMENT ON COLUMN booking.booking_code   IS 'เลขที่เอกสาร เช่น BK68000001 (จาก seq_booking_code.NEXTVAL)';
COMMENT ON COLUMN booking.cust_id        IS 'รหัสผู้จอง (FK -> employee.emp_id)';
COMMENT ON COLUMN booking.sched_id       IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN booking.board_stop_id  IS 'รหัสจุดขึ้นรถ (FK -> stop.stop_id)';
COMMENT ON COLUMN booking.alight_stop_id IS 'รหัสจุดลงรถ (FK -> stop.stop_id)';
COMMENT ON COLUMN booking.seats          IS 'จำนวนที่นั่งที่จอง (BR-06: 1-4 ที่นั่ง)';
COMMENT ON COLUMN booking.status         IS 'reserved | checked_in | completed | cancelled | no_show';
COMMENT ON COLUMN booking.book_time      IS 'เวลาที่จอง';
COMMENT ON COLUMN booking.qr_token       IS 'Token ฝังใน QR Code (BR-09: ต้องตรงรอบเดินรถที่กำลังวิ่ง)';
COMMENT ON COLUMN booking.cancel_time    IS 'เวลาที่ยกเลิก (NULL = ยังไม่ยกเลิก)';

COMMENT ON COLUMN trip.trip_id    IS 'รหัสการเดินรถ';
COMMENT ON COLUMN trip.sched_id   IS 'รหัสรอบเวลา (FK -> schedule.sched_id) — 1 รอบ = 1 trip';
COMMENT ON COLUMN trip.driver_id  IS 'รหัสคนขับที่เดินรถจริง (FK -> employee.emp_id)';
COMMENT ON COLUMN trip.veh_id     IS 'รหัสยานพาหนะที่ใช้จริง (FK -> vehicle.veh_id)';
COMMENT ON COLUMN trip.start_time IS 'เวลาออกจริง (NULL = ยังไม่ออก)';
COMMENT ON COLUMN trip.end_time   IS 'เวลากลับถึงจุดปลายจริง';
COMMENT ON COLUMN trip.status     IS 'running | completed';

COMMENT ON COLUMN trip_passenger.trip_passenger_id IS 'รหัสรายการผู้โดยสาร';
COMMENT ON COLUMN trip_passenger.trip_id           IS 'รหัสการเดินรถ (FK -> trip.trip_id)';
COMMENT ON COLUMN trip_passenger.booking_id        IS 'รหัสการจอง (FK -> booking.booking_id)';
COMMENT ON COLUMN trip_passenger.checkin_time      IS 'เวลาที่ยืนยันตั๋ว (สแกน QR)';
COMMENT ON COLUMN trip_passenger.checkin_stop_id   IS 'รหัสจุดที่ขึ้นรถจริง (FK -> stop.stop_id)';
COMMENT ON COLUMN trip_passenger.board_seq         IS 'จุดจอดที่ขึ้นจริง (ใช้ทำรายงาน R1/R5)';
COMMENT ON COLUMN trip_passenger.alight_seq        IS 'จุดจอดที่ลงจริง';
COMMENT ON COLUMN trip_passenger.alight_time       IS 'เวลาที่ลงรถจริง';
```

> **จำนวน COMMENT ON:** 20 ตาราง + 102 คอลัมน์ = **122 รายการ** (DDL ต้นทางมีเพียง 13 รายการ ส่วนที่เหลือเสนอเพิ่มให้ครบตาม DoD)

---

## 8.10 การแปลงค่าจาก MySQL เป็น Oracle (ตารางอ้างอิงตอนถามครับ)

| เรื่อง | MySQL | Oracle (ที่ใช้จริง) | ตาราง/คอลัมน์ที่เกี่ยวข้อง |
|---|---|---|---|
| รหัสอัตโนมัติ | `INT AUTO_INCREMENT` | `NUMBER(10) GENERATED ALWAYS AS IDENTITY` | ทุกตารางที่มี PK |
| เลขที่เอกสาร | `AUTO_INCREMENT` | `CREATE SEQUENCE` + `seq_booking_code.NEXTVAL` | `booking.booking_code` |
| ข้อความ | `VARCHAR(n)` | `VARCHAR2(n CHAR)` | ทุกคอลัมน์ข้อความ |
| ตัวเลขทศนิยม | `DECIMAL(10,7)` | `NUMBER(10,7)` | `stop.latitude`, `stop.longitude` |
| ชนิดวัน-เวลา | `DATETIME` / `TIME` | `TIMESTAMP` (ไม่มี `TIME` ใน Oracle ใช้ TIMESTAMP เต็ม) | `schedule.depart_at`, `schedule_stop.arrive_at` |
| วันที่อย่างเดียว | `DATE` | `DATE` | `schedule.service_date` |
| ค่าเริ่มต้นเวลา | `CURRENT_TIMESTAMP` | `SYSTIMESTAMP` / `CURRENT_TIMESTAMP` | คอลัมน์ `created_at`, `book_time`, `assign_at` |
| สถานะแบบ Enum | `ENUM('a','b')` | `VARCHAR2(20)` + `CHECK (status IN (...))` | `booking.status`, `trip.status` |
| Boolean | `TINYINT(1)` | `NUMBER(1)` + `CHECK (x IN (0,1))` | `is_active` ทุกตาราง |
| ต่อสตริง | `CONCAT(a,b)` | `a \|\| b` | — |
| ตรวจ NULL | `IFNULL(a,b)` | `NVL(a,b)` หรือ `COALESCE(a,b)` | รายงานที่รวมค่า NULL |
| จำกัดจำนวนแถว | `LIMIT 10 OFFSET 20` | `OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY` | ตารางรายงาน |
| รวมค่าเป็นข้อความ | `GROUP_CONCAT` | `LISTAGG(name, ', ') WITHIN GROUP (ORDER BY name)` | รายงานสรุปรายการ |
| ปิด Transaction | `START TRANSACTION` | ไม่มีคำสั่ง — `conn.commit()` / `conn.rollback()` | Service Layer |
| ล็อกแถว | `SELECT ... FOR UPDATE` | `SELECT ... FOR UPDATE NOWAIT` | ตรวจที่นั่งขณะจอง (UC-18, BR-07) |
| คอมเมนต์ | `--` / `/* */` | เหมือนกัน + `COMMENT ON` (บังคับใน Data Dictionary) | 122 รายการ |
| เก็บเวลาหลายโซน | `DATETIME` | `TIMESTAMP(6) WITH TIME ZONE` | ถ้าต้องเทียบข้ามโซนเวลา |

> **คำสงวนที่ต้องระวัง:** ชื่อ `role` เป็นคำสงวนของ Oracle จึงต้องใช้ `app_role` — ห้ามเปลี่ยนกลับเป็น `role`
>
> **คำสงวนอื่นที่ควรหลีกเลี่ยง:** `LEVEL`, `SIZE`, `DATE`, `NUMBER`, `COMMENT`, `MODE`, `ORDER`, `GROUP`, `START`, `END`, `ACCESS`, `ONLINE`, `RESOURCE`, `SESSION`, `PASSWORD`

---

## 8.11 การนำ Data Dictionary ไปใช้กับ Backend

### 8.11.1 ตัวอย่างการเชื่อมต่อด้วย `node-oracledb`

> ตัวอย่างนี้เป็นแนวทางเท่านั้น การเขียนโค้ดจริงอยู่ในขอบเขตของ T-011 (`@agent-coder`) และต้องไม่เก็บ credential ใน Git

```js
const oracledb = require('node-oracledb');

// ค่าจาก Environment Variable เท่านั้น (R-06) — ห้าม hardcode
const poolConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1
};

async function getPool() {
  return oracledb.createPool(poolConfig);
}
```

### 8.11.2 ตัวอย่างการอ่านข้อมูลด้วย Bind Variable (R-03)

```js
// ถูกต้อง — ใช้ Bind Variable ทุกค่าที่มาจากผู้ใช้
const sql = `
  SELECT b.booking_code, s.depart_at, rs.stop_name AS board_stop
    FROM booking b
    JOIN schedule s       ON b.sched_id = s.sched_id
    JOIN stop rs          ON b.board_stop_id = rs.stop_id
   WHERE b.cust_id = :custId
     AND b.status = 'reserved'
   ORDER BY b.book_time DESC
`;
// execute(sql, { custId })
```

| ห้ามทำ | ต้องทำ |
|---|---|
| `WHERE username = '" + input + "'"` | `WHERE username = :username` พร้อม pass เป็น bind |
| เอา `seats` จาก request ไป `WHERE seats = ${x}` | ตรวจด้วย `ck_booking_seats` และ validate ที่ Service |

### 8.11.3 ตัวอย่างการสร้างเลขที่เอกสาร

```js
// ดึงค่าจาก Sequence แล้วประกอบเป็นรหัสอ่านง่าย
const result = await conn.execute(
  `SELECT seq_booking_code.NEXTVAL AS n FROM dual`
);
const bookingCode = `BK${String(result.rows[0].n).padStart(8, '0')}`;
```

### 8.11.4 ตัวอย่างการตรวจชนช่วงเวลา (BR-04) ด้วย Index ที่มีอยู่

```js
// ใช้ ix_da_emp และ ix_va_veh — ค้นเฉพาะรอบของคนขับ/รถที่เกี่ยวข้อง
const sql = `
  SELECT s.depart_at, s.sched_id
    FROM driver_assign da
    JOIN schedule s ON da.sched_id = s.sched_id
   WHERE da.emp_id = :empId
     AND s.depart_at BETWEEN :startAt AND :endAt
`;
```

> เงื่อนไขการชนกันจริงต้องเทียบทั้งช่วงเวลาออก–ถึง ไม่ใช่แค่ `depart_at` อย่างเดียว ให้ Service Layer จัดการภายใต้ Transaction และตรวจซ้ำเมื่อ Commit

---

## 8.12 ความสัมพันธ์กับ Requirement และ Use Case

> ⚠️ **เลขอ้างอิง:** ตารางนี้ใช้เลข `UC-01`…`UC-30` ชุดเดียวกับ
> [`docs/diagrams/usecase/usecase-spec.md`](../diagrams/usecase/usecase-spec.md) และ `usecase-00-overview.puml`
> ไม่ใช้ชุดเลขของเอกสารเก่า — ถ้าแก้เลข UC ต้องแก้ทั้ง 3 ไฟล์พร้อมกัน

| Use Case | Requirement | ตารางและคอลัมน์ที่เกี่ยวข้อง | BR |
|---|---|---|---|
| UC-01 เข้าสู่ระบบ (Login) | M3 | `employee.username`, `employee.password_hash`, `employee.is_active` | — |
| UC-02 ออกจากระบบ (Logout) | M3 | `token_blacklist.jti`, `.expires_at`, `.revoked_at` | — |
| UC-03 เปลี่ยนรหัสผ่าน | M3 | `employee.password_hash` | — |
| UC-04 จัดการข้อมูลพนักงาน | M1 | `employee`, `employee_role`, `.dept_id`, `.pos_id` | — |
| UC-05 จัดการแผนก (Department) | M1 | `department` | — |
| UC-06 จัดการตำแหน่ง (Job Position) | M1 | `job_position` | — |
| UC-07 จัดการบทบาท (Role) | M2 | `app_role`, `app_role.is_active` | R-02 |
| UC-08 จัดการสิทิธิ์ (Permission) | M2 | `permission`, `permission.screen_key`, `.sort_no` | R-02 |
| UC-09 กำหนดสิทิธิ์ให้บทบาท | M2 | `role_permission` | R-02 |
| UC-10 กำหนดบทบาทให้พนักงาน | M2 | `employee_role` | R-02 |
| UC-11 จัดการจุดจอด (Stop) | F1 | `stop`, `.stop_name`, `.latitude`, `.longitude`, `.is_active` | — |
| UC-12 จัดการเส้นทาง (Route) | F1 | `route`, `route_stop`, `route.total_minutes` | **BR-01**, **BR-03** |
| UC-13 จัดการประเภทรถและรถ | F2 | `vehicle_type`, `vehicle`, `.capacity`, `.plate_no` | BR-07 (ใช้ `capacity`) |
| UC-14 จัดรอบเวลาเดินรถ (Schedule) | F2 | `schedule`, `schedule_stop`, `schedule.depart_at`, `schedule_stop.arrive_at` | **BR-02** |
| UC-15 มอบหมายคนขับให้รอบเวลา | F2 | `driver_assign`, `ix_da_emp` | **BR-04** |
| UC-16 มอบหมายรถให้รอบเวลา | F2 | `vehicle_assign`, `ix_va_veh` | **BR-04** |
| UC-17 เลือกจุดขึ้น–ลง และดูรอบเวลาที่จองได้ | B1 | `schedule`, `schedule_stop.arrive_at`, `booking.status`, `ix_sched_route_date` | **BR-05**, **BR-07**, **BR-11**, **BR-12** |
| UC-18 เลือกจำนวนที่นั่งและยืนยันการจอง | B1 | `booking` ทั้งตาราง, `ck_booking_seats`, `seq_booking_code`, `.qr_token` | **BR-06**, **BR-07** |
| UC-19 ดูรายการเดินทางของฉัน (My Booking) | B2 | `booking`, `ix_booking_cust`, `ix_tp_booking` | — |
| UC-20 แสดง QR Code สำหรับเช็คอิน | B2 | `booking.booking_code`, `booking.qr_token` | — |
| UC-21 ยกเลิกการจอง | B3 | `booking.status`, `booking.cancel_time` | **BR-08** |
| UC-22 ดูตารางงานรายวัน (D1) | D1 | `driver_assign`, `schedule`, `vehicle_assign`, `trip` | — |
| UC-23 เริ่มการเดินทาง (D2) | D2 | `trip`, `trip.status='running'`, `.start_time` | **BR-04** |
| UC-24 ดูรายชื่อผู้โดยสารขึ้น–ลงรายจุดจอด (D2 Manifest) | D2 | `trip_passenger`, `.board_seq`, `.alight_seq`, `schedule_stop` | BR-11 |
| UC-25 สแกน QR เช็คอินขึ้นรถ (D3) | D3 | `booking.qr_token`, `trip_passenger.checkin_time`, `.checkin_stop_id` | **BR-09** |
| UC-26 ปิดรอบการเดินทางและดูสรุป (D4) | D4 | `trip.status='completed'`, `.end_time`, `booking.status`, `trip_passenger.alight_time` | **BR-10** |
| UC-27 รายงานที่ 1 : เปรียบเทียบจำนวนคนขึ้น/ลงรายสัปดาห์ | R1 | `trip`, `trip_passenger`, `.board_seq`, `.alight_seq`, `schedule.service_date` | — |
| UC-28 รายงานที่ 4 : สรุปยอดผู้ใช้รายวันรายเส้นทาง | R4 | `booking`, `schedule`, `.route_id`, `.service_date`, `ix_sched_route_date` | — |
| UC-29 รายงานที่ 6 : สรุปการมอบหมายงานคนขับ | R6 | `driver_assign`, `schedule.depart_at`, `employee`, `ix_da_emp` | — |
| UC-30 เลือกปี / ช่วงวันที่ และส่งออกรายงาน (ใช้ร่วม) | R1/R4/R6 | `schedule.service_date`, `trip.start_time` | — |

> ℹ️ **ไม่มีระบบชำระเงิน (Payment)** และ **ไม่มี Dashboard ผู้ดูแล** ในขอบเขตงาน
> ตาม `docs/requirement-review-checklist.md` ข้อ ก.4 มีเฉพาะ Login → เลือกจุด → จอง → QR → ดูรายการ → ยกเลิก
> ถ้าภายหลังอาจารย์เพิ่มข้อกำหนด ให้เพิ่ม UC ใหม่ต่อท้าย (UC-31) และอัปเดต `usecase-spec.md` + `usecase-00-overview.puml` พร้อมกัน

### 8.12.1 Requirement → Use Case → ตาราง (แบบย่อ)

| Requirement | Use Case | ตารางหลัก |
|---|---|---|
| M1 จัดการพนักงาน | UC-04, UC-05, UC-06 | `employee`, `department`, `job_position`, `employee_role` |
| M2 สิทิธิ์แบบ Dynamic | UC-07 … UC-10 | `app_role`, `permission`, `role_permission`, `employee_role` |
| M3 Login / Logout | UC-01, UC-02, UC-03 | `employee`, `token_blacklist` |
| F1 จัดเส้นทางเดินรถ | UC-11, UC-12 | `stop`, `route`, `route_stop` |
| F2 รอบเวลา / รถ / คนขับ | UC-13 … UC-16 | `vehicle_type`, `vehicle`, `schedule`, `schedule_stop`, `driver_assign`, `vehicle_assign` |
| B1 เงื่อนไขการจอง | UC-17, UC-18 | `booking`, `schedule`, `schedule_stop`, `vehicle_type` |
| B2 QR + ดูรายการ | UC-19, UC-20 | `booking`, `trip`, `trip_passenger` |
| B3 ยกเลิก + คืนที่นั่ง | UC-21 | `booking`, `trip_passenger` |
| D1 ตารางงานคนขับ | UC-22 | `driver_assign`, `schedule`, `trip` |
| D2 เริ่มงาน + Manifest | UC-23, UC-24 | `trip`, `trip_passenger`, `schedule_stop` |
| D3 สแกน QR | UC-25 | `booking`, `trip`, `trip_passenger` |
| D4 ปิดงาน + สรุป | UC-26 | `trip`, `booking`, `trip_passenger` |
| R1 | UC-27, UC-30 | `trip`, `trip_passenger` |
| R4 | UC-28, UC-30 | `booking`, `schedule` |
| R6 | UC-29, UC-30 | `driver_assign`, `schedule`, `employee` |

---

## 8.13 Definition of Done (DoD) ของ T-006

| # | เกณฑ์ | สถานะ | หลักฐาน |
|---|---|---|---|
| 1 | มี Data Dictionary ครบทุกตาราง | ✅ | 20 ตาราง (หัวข้อ 8.3–8.6) |
| 2 | แต่ละคอลัมน์มี Data Type, Size, Null, Default, Key, Constraint, Description | ✅ | ทุกตารางใช้รูปแบบตาราง 7 คอลัมน์เดียวกัน |
| 3 | มี `COMMENT ON` ครบทุกคอลัมน์สำคัญ | ✅ | หัวข้อ 8.9 — 122 รายการ (20 TABLE + 102 COLUMN) |
| 4 | สอดคล้องกับ ER และ ER Mapping | ✅ | `docs/diagrams/er/er-mapping.md` |
| 5 | สอดคล้องกับ DDL ใน 17.4.3 | ✅ | นับจำนวนตาราง/คอลัมน์ตรงกันทุกกลุ่ม |
| 6 | ไม่มีชื่อตารางชนกับคำสงวน | ✅ | ใช้ `app_role` แทน `role` |
| 7 | ไม่แก้ไฟล์นอกขอบเขต | ✅ | เขียนเฉพาะ `docs/report/` |
| 8 | บันทึก Prompt Log | ✅ | `docs/agile/ai-prompts/prompt-log.md` |
| 9 | ผ่านการตรวจสอบโดยนายเก่งกาญ | ⏳ | รอ Review ใน Sprint 0 |

---

## 8.14 ข้อจำกัดและสิ่งที่ต้องยืนยันภายหลัง

| ข้อ | สถานะ | ผู้รับผิดชอบ |
|---|---|---|
| ยืนยันว่า DDL ใน 17.4.3 ตรงกับเอกสารเล่มนี้ทุกจุด | รอตรวจเมื่อ T-007 สร้าง `01_schema.sql` | T-007 `@agent-oracle` |
| รัน DDL บน Oracle 19c ได้ 0 error | ยังไม่ดำเนินการ | T-007 |
| ตรวจจำนวน `COMMENT ON` ในไฟล์จริงเท่ากับ 122 รายการ | รอ T-007 | T-007 |
| ทดสอบ Constraint ทุกตัวด้วย Seed Data (เช่น จอง 5 ที่นั่งต้องถูกปฏิเสธ) | ยังไม่ดำเนินการ | T-008 `@agent-oracle` |
| เชื่อมต่อ Oracle จริงจาก Backend | รอ T-002 แก้ WDAC และติดตั้ง Node.js 20 | T-002 |

> **หมายเหตุสำคัญ:** เอกสารนี้อ้างอิง DDL ในบทที่ 17 ซึ่งเป็น *ข้อกำหนดการออกแบบ* หาก T-007 สร้าง DDL ที่แตกต่างจากนี้ ให้ยึด DDL จริงเป็นหลักและปรับเอกสารทั้งบทที่ 8 และ ER Mapping ให้ตรงกัน

---

## 8.15 บันทึกผลการตรวจสอบอัตโนมัติ

ตรวจสอบด้วยสคริปต์นับจากข้อความจริงใน `docs/chapter-17-fullstack.md` และไฟล์ ER

| # | รายการตรวจ | ผลที่ได้ | สถานะ |
|---|---|---|---|
| 1 | จำนวน `CREATE TABLE` ใน DDL 17.4.3 | 20 ตาราง | ✅ ตรงกับเอกสาร |
| 2 | จำนวนคอลัมน์รวมจาก DDL | 102 คอลัมน์ | ✅ ตรงกับเอกสาร |
| 3 | จำนวนหัวข้อตารางในเอกสารนี้ | 20 หัวข้อ | ✅ ครบ |
| 4 | ผลรวมแถวคอลัมน์ในตารางของเอกสาร | 102 | ✅ ตรงกับ DDL |
| 5 | จำนวน `CREATE SEQUENCE` ใน DDL | 1 (`seq_booking_code`) | ✅ ตรงกับเอกสาร |
| 6 | จำนวน `COMMENT ON TABLE` ในเอกสารนี้ | 20 | ✅ ครบทุกตาราง |
| 7 | จำนวน `COMMENT ON COLUMN` ในเอกสารนี้ | 102 | ✅ ครบทุกคอลัมน์ |
| 8 | Entity และคอลัมน์ใน `er-02-logical.puml` | 20 entity / 102 คอลัมน์ | ✅ ตรงกับ DDL ทุกคอลัมน์ |
| 9 | ตารางและคอลัมน์ใน Physical ER 3 ไฟล์ | 20 ตาราง / 102 คอลัมน์ | ✅ ตรงกับ DDL ทุกคอลัมน์ |
| 10 | จำนวน FK ในเอกสาร = FK ใน DDL | 27 = 27 | ✅ ตรงกัน |
| 11 | Constraint รวม (PK 20 + UK 18 + CK 12 + FK 27) | 77 | ✅ ตรงกับ DDL |
| 12 | Index ในเอกสาร = `CREATE INDEX` ใน DDL | 9 = 9 | ✅ ตรงกัน |

**รายละเอียด Constraint ที่นับได้จาก DDL:**

| ประเภท | จำนวน | รายการ |
|---|---|---|
| PRIMARY KEY | 20 | หนึ่งต่อหนึ่งตาราง (Composite 3 ตาราง: `route_stop`, `role_permission`, `employee_role` · Inline 1 ตาราง: `token_blacklist`) |
| UNIQUE | 18 | `uq_department_name`, `uq_position_name`, `uq_employee_code`, `uq_employee_user`, `uq_app_role`, `uq_perm_code`, `uq_stop_name`, `uq_route_stop_uk`, `uq_vtype`, `uq_vehicle_plate`, `uq_route_depart`, `uq_sched_seq`, `uq_driver_sched`, `uq_vehicle_sched`, `uq_booking_code`, `uq_booking_qr`, `uq_trip_sched`, `uq_trip_booking` |
| CHECK | 12 | `ck_employee_active`, `ck_app_role_active`, `ck_stop_active`, `ck_route_min`, `ck_route_act`, `ck_rs_min`, `ck_vtype_cap`, `ck_vehicle_act`, `ck_schedule_act`, `ck_booking_seats`, `ck_booking_status`, `ck_trip_status` |
| FOREIGN KEY | 27 | ดูตารางในหัวข้อ 8.7.1 |
