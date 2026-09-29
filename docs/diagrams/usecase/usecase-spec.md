# Use Case Specification — ระบบ SHUTTLE BUS (T-004)

> **เจ้าของเอกสาร:** นางสาวสุขสรร มาณีศรี
> **AI Agent ที่ใช้:** `@agent-architect` (Prompt P-01 `requirement-to-usecase`)
> **แหล่งที่มา (เรียงตามลำดับความสำคัญ):** `MINI PROJECT SHUTTLE BUS.pdf` → `docs/requirement-review-checklist.md` → `docs/chapter-17-fullstack.md` (17.0 / 17.4.5 / 17.5.2) → `docs/chapter-18-development-plan.md`
> **Task ที่เกี่ยวข้อง:** T-004 (Sprint 0) · เชื่อมกับ Checklists A4 / A8 (Traceability)
> **Diagram:** [`docs/diagrams/usecase/`](./README.md)

---

## ขอบเขต (Scope)

| หัวข้อ | ค่า |
|---|---|
| บทบาท (Actor) | 4 บทบาท — Admin / Staff / Driver / Customer |
| จำนวน Use Case หลัก | 30 ตัว (UC-01 … UC-30) |
| Use Case ย่อย (Sub-flow) | เรียกผ่าน `«include»` / `«extend»` ใน Diagram |
| Client | **Flutter (Android / แท็บเล็ต) เท่านั้น** — ⛔ ไม่มี Web / React (R-07) |
| Backend | REST API (Node.js + Express + `node-oracledb`) |
| ฐานข้อมูล | Oracle 19c |
| รายงานที่ทำจริง | **R1 + R4 + R6** (24 คะแนน ตามเงื่อนไขตารางคะแนน PDF) |

### แผนภาพที่เกี่ยวข้อง

| ไฟล์ | เนื้อหา |
|---|---|
| [`usecase-00-overview.puml`](./usecase-00-overview.puml) | ภาพรวมทั้งระบบ + ความสัมพันธ์ Actor ↔ Use Case |
| [`usecase-01-auth-master.puml`](./usecase-01-auth-master.puml) | M1 / M2 / M3 |
| [`usecase-02-front.puml`](./usecase-02-front.puml) | F1 / F2 |
| [`usecase-03-booking.puml`](./usecase-03-booking.puml) | B1 / B2 / B3 |
| [`usecase-04-driver.puml`](./usecase-04-driver.puml) | D1 / D2 / D3 / D4 |
| [`usecase-05-report.puml`](./usecase-05-report.puml) | R1 / R4 / R6 + Export |
| [`usecase-06-actor-relation.puml`](./usecase-06-actor-relation.puml) | อธิบายสิทธิ์แบบ Dynamic (R-03) |

> **วิธีสร้างภาพ:** เปิดไฟล์ `.puml` ใน [PlantUML Web](https://www.plantuml.com/plantuml/umlviewer) หรือ
> ติดตั้ง VS Code Extension `jebbs.plantuml` แล้วกด `Alt+D` เพื่อ export เป็น PNG/SVG ไปใส่ในรายงาน
> (T-061 จะ export เป็นภาพแล้วใส่ `docs/diagrams/usecase/png/`)

---

## สัญลักษณ์ที่ใช้

| สัญลักษณ์ | ความหมาย |
|---|---|
| `«include»` | Use Case หลัก **ต้องเรียก** Use Case ย่อยเสมอ (ถ้าทำไม่ได้ = หลักล้มเหลว) |
| `«extend»` | Use Case ย่อย **อาจถูกเรียก** เมื่อเงื่อนไขเป็นจริง (ไม่บังคับทุกครั้ง) |
| BR-xx | Business Rule ตาม `docs/chapter-17-fullstack.md` ข้อ 17.4.5 |
| ASM-07 | ค่าที่ใช้ระหว่างรอคำตอบอาจารย์ (สมมติฐาน — ต้องบันทึกใน Retro) |
| R-0x | ข้อกำหนดเชิงเทคนิกที่ห้ามละเมิด (17.0.0) |

---

## 1. M3 — ระบบ Login / Logout และการตรวจสิทธิ์ (UC-01 … UC-03)

### UC-01 เข้าสู่ระบบ (Login)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-01 |
| **ชื่อ** | เข้าสู่ระบบ |
| **Primary Actor** | Admin, Staff, Driver, Customer (ทุกบทบาท) |
| **Trigger** | ผู้ใช้เปิดแอปแล้วกรอกชื่อผู้ใช้ + รหัสผ่าน |
| **Precondition** | 1) มีข้อมูลใน `employee` และ `is_active = 1` · 2) มี `password_hash` แบบ bcrypt (R-04) · 3) ผู้ใช้ไม่ถูก revoke ใน `token_blacklist` |
| **Postcondition** | 1) ได้รับ `access_token` (JWT, อายุ 2 ชม., มี `jti`) · 2) ได้รับรายการ `perm_code` + `screen_key` ทั้งหมด · 3) แอปสร้างเมนู Dynamic · 4) Token ถูกเก็บใน `flutter_secure_storage` (ไม่ใช้ plaintext) |
| **Business Rule** | R-03 (สิทธิ์อ่านจาก DB ไม่ hardcode) · R-04 (bcrypt) · R-02 (bind variable ทุก query) |
| **Main Flow (Basic Flow)** | |
| 1 | ระบบแสดงหน้า Login |
| 2 | ผู้ใช้กรอก `username` และ `password` |
| 3 | ระบบค้น `employee` ด้วย **bind variable** `:username` |
| 4 | ถ้าไม่พบข้อมูล หรือ `bcrypt.compare` ไม่ผ่าน → ข้อความ "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" (ไม่บอกว่าอะไรผิด) |
| 5 | ระบบโหลดสิทธิ์ด้วย JOIN `employee_role → app_role → role_permission → permission` โดยกรอง `is_active = 1` |
| 6 | ระบบออก JWT + คืนค่า `permissions` และ `screen_key` |
| 7 | แอปบันทึก token แล้วเปลี่ยนเป็น `AdaptiveShell` พร้อมเมนูตามสิทธิ์ |
| **Alternative / Exception Flow** | |
| A1 | 3a. พบข้อมูลแต่ `is_active = 0` → ปฏิเสธ "บัญชีถูกปิดใช้งาน" |
| A2 | 3b. ผิดเกิน 5 ครั้งติดกัน → `429 Too Many Requests` (rate limit) |
| A3 | 5a. ไม่พบสิทธิ์เลย → ยัง Login ได้ แต่เมนูว่าง และตอบ `403` ทุก endpoint |
| **หน้าจอ Flutter** | `features/auth/login_screen.dart` |
| **API** | `POST /api/v1/auth/login` · `GET /api/v1/auth/me` |
| **ตารางที่เกี่ยวข้อง** | `employee`, `employee_role`, `app_role`, `role_permission`, `permission`, `token_blacklist` |
| **Task** | T-015 (Backend), T-017 (Flutter) |
| **Test Case** | TC-01-01, TC-01-02 |

---

### UC-02 ออกจากระบบ (Logout)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-02 |
| **Primary Actor** | ทุกบทบาท |
| **Precondition** | ยัง Login อยู่ มี `jti` ใน token |
| **Postcondition** | 1) เพิ่ม `jti` ลง `token_blacklist` พร้อม `expires_at` · 2) ลบ token ออกจาก `flutter_secure_storage` · 3) กลับไปหน้า Login |
| **Business Rule** | Token ที่ถูก revoke ต้องใช้ต่อไม่ได้แม้ยังไม่หมดอายุ |
| **Main Flow** | |
| 1 | ผู้ใช้กด "ออกจากระบบ" |
| 2 | ระบบ `INSERT INTO token_blacklist (jti, emp_id, expires_at) VALUES (:jti, :empId, :expiresAt)` |
| 3 | แอปลบ token แล้วเปลี่ยนหน้า Login |
| **Alternative Flow** | 2a. ตาราง `token_blacklist` มีแถวเดิมอยู่แล้ว → ใช้ `MERGE` เพื่อไม่ให้ซ้ำ |
| **หน้าจอ Flutter** | `features/auth/` (เมนูผู้ใช้) |
| **API** | `POST /api/v1/auth/logout` |
| **Task / Test Case** | T-015 · TC-02-01 |

---

### UC-03 เปลี่ยนรหัสผ่าน

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-03 |
| **Primary Actor** | ทุกบทบาท |
| **Precondition** | Login แล้ว |
| **Postcondition** | `employee.password_hash` ถูกอัปเดตเป็นค่าใหม่ (bcrypt) · token เดิมถูก revoke ทั้งหมด |
| **Main Flow** | 1 กรอกรหัสผ่านเดิม → 2 กรอกรหัสผ่านใหม่ + ยืนยัน → 3 ตรวจความยาวขั้นต่ำ → 4 `bcrypt.hash` → 5 `UPDATE` → 6 บังคับ Login ใหม่ |
| **Business Rule** | R-04 · ห้ามเก็บ plaintext · ต้อง validate ความยาว ≥ 8 ตัวอักษร |
| **API** | `POST /api/v1/auth/change-password` |
| **Task / Test Case** | T-017 · TC-03-01 |

---

## 2. M1 — ระบบจัดการพนักงาน (UC-04 … UC-06)

### UC-04 จัดการข้อมูลพนักงาน

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-04 (ย่อย: UC-04.1 เพิ่ม, UC-04.2 แก้ไข, UC-04.3 ปิดใช้งาน/ลบ, UC-04.4 ค้นหา/ดู) |
| **Primary Actor** | Admin · **Supporting Actor:** Staff (ดูอย่างเดียว) |
| **Precondition** | Login แล้ว และมีสิทธิ์ `EMPLOYEE.VIEW` / `EMPLOYEE.EDIT` จาก DB |
| **Postcondition** | ข้อมูลใน `employee` (และ `employee_role`) ถูกเพิ่ม/แก้/ปิดใช้งานอย่างถูกต้อง |
| **Business Rule (M1)** | 1) เพิ่มพนักงาน **ต้องระบุแผนกและตำแหน่ง** · 2) `username` และ `emp_code` ต้องไม่ซ้ำ · 3) `is_active` ใช้ค่า 0/1 เท่านั้น (Oracle ไม่มี BOOLEAN ใน SQL — R-01) · 4) รหัสผ่านเก็บเป็น bcrypt (R-04) |
| **Main Flow — UC-04.1 เพิ่มพนักงาน** | 1 กด "เพิ่มพนักงาน" → 2 กรอก รหัสพนักงาน/ชื่อ-นามสกุล/เบอร์โทร/อีเมล/แผนก/ตำแหน่ง/ชื่อผู้ใช้ → 3 กด "บันทึก" → 4 ระบบ validate → 5 `INSERT INTO employee ...` → 6 แสดงข้อความสำเร็จและรีเฟรชตาราง |
| **Alternative Flow** | 2a. ไม่ได้เลือกแผนก/ตำแหน่ง → ไม่ให้บันทึก (M1) · 2b. `username` ซ้ำ → `409 Conflict` |
| **Main Flow — UC-04.2 แก้ไข** | 1 เลือกแถวในตาราง (Master–Detail) → 2 แก้ข้อมูล → 3 `UPDATE ... WHERE emp_id = :empId` → 4 บันทึกลง Audit Log |
| **Main Flow — UC-04.3 ปิดใช้งาน/ลบ** | 1 เลือกพนักงาน → 2 ยืนยัน → 3a. มี `booking` ที่ผูกอยู่ → ใช้ "ปิดใช้งาน" (`is_active = 0`) เท่านั้น เพื่อไม่ทำลายข้อมูลรายงาน · 3b. ไม่มีข้อมูลผูก → ลบได้ |
| **Main Flow — UC-04.4 ค้นหา/ดู** | 1 ค้นด้วยชื่อ/รหัส/แผนก → 2 แสดงผลแบบ `PaginatedDataTable` (R-07 : ต้องเป็น Adaptive UI) |
| **หน้าจอ Flutter** | `features/master/employee_screen.dart` (`DataTable` + Stepper Form) |
| **API** | `GET/POST/PUT/DELETE /api/v1/employees` · `GET/POST/PUT/DELETE /departments` · `/positions` |
| **ตาราง** | `employee`, `department`, `job_position`, `employee_role` |
| **Task / Test Case** | T-016, T-018 · TC-04-01 … TC-04-06 |

---

### UC-05 จัดการแผนก (Department)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-05 · **Actor:** Admin |
| **Precondition** | มีสิทธิ์ `DEPARTMENT.EDIT` |
| **Postcondition** | ข้อมูล `department` ถูกเพิ่ม/แก้/ลบ · `dept_name` ต้องไม่ซ้ำ |
| **Main Flow** | 1 เปิดหน้าแผนก → 2 เพิ่ม/แก้ชื่อแผนก → 3 บันทึก → 4 ระบบอัปเดต `department` และรีเฟรช |
| **ข้อควรระวัง** | ลบแผนกที่ยังมีพนักงานอยู่ไม่ได้ → แจ้งให้ย้ายพนักงานออกก่อน (FK constraint) |
| **Task** | T-016, T-018 · **ตาราง:** `department` |

---

### UC-06 จัดการตำแหน่ง (Job Position)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-06 · **Actor:** Admin |
| **Precondition** | มีสิทธิ์ `POSITION.EDIT` |
| **Postcondition** | ข้อมูล `job_position` ถูกเพิ่ม/แก้/ลบ · `position_name` ไม่ซ้ำ |
| **หมายเหตุ** | ชื่อตารางใช้ `job_position` เพราะ `POSITION` เป็นคำสงวนของ Oracle (17.4.1) |
| **Task** | T-016, T-018 · **ตาราง:** `job_position` |

---

## 3. M2 — ระบบกำหนดสิทธิ์การเข้าถึง (UC-07 … UC-10)

### UC-07 จัดการบทบาท (Role)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-07 · **Actor:** Admin |
| **Precondition** | มีสิทธิ์ `ROLE.EDIT` |
| **Postcondition** | ข้อมูล `app_role` ถูกเพิ่ม/แก้/ลบ · ลบได้ก็ต่อเมื่อไม่มีพนักงานใช้บทบาทนั้น |
| **Business Rule (M2)** | ⛔ **ห้าม fix** ว่า admin เข้าได้ทุกหน้า · เพิ่ม/ลบ/แก้สิทธิ์ได้ **ตลอดเวลา** |
| **Main Flow** | 1 เปิดหน้า Role → 2 เพิ่ม/แก้/ปิดใช้งาน → 3 บันทึก → 4 มีผลทันทีกับผู้ใช้ที่ Login ใหม่ |
| **หมายเหตุชื่อ** | ใช้ `app_role` เพราะ `ROLE` เป็นคำสงวน (คำสั่ง `CREATE ROLE`) |
| **Task / ตาราง** | T-019 · `app_role` |

---

### UC-08 จัดการสิทธิ์ (Permission)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-08 · **Actor:** Admin |
| **Precondition** | มีสิทธิ์ `PERMISSION.EDIT` |
| **Postcondition** | ข้อมูล `permission` ถูกเพิ่ม/แก้/ลบ · `perm_code` ไม่ซ้ำ |
| **ข้อมูลสำคัญ** | `perm_code` (เช่น `ROUTE.EDIT`) · `module` (`master/front/booking/driver/report`) · `screen_key` (ใช้สร้าง Dynamic Menu ในแอป) · `sort_no` (ลำดับเมนู) |
| **Task / ตาราง** | T-020 · `permission` |

---

### UC-09 กำหนดสิทธิ์ให้บทบาท (Permission Matrix)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-09 · **Actor:** Admin |
| **Trigger** | Admin เปิดหน้า Permission Matrix แล้วติ๊ก/เอาติ๊กออก |
| **Precondition** | มีสิทธิ์ `ROLE.EDIT` |
| **Postcondition** | แถวใน `role_permission` ถูกเพิ่ม/ลบ · ผลมีผลทันทีโดยไม่ต้อง restart server |
| **Business Rule (M2 — ข้อสำคัญที่สุดของระบบ)** | 1) สิทธิ์ถูก **อ่านจากฐานข้อมูลทุกครั้ง** ที่ middleware ตรวจ ไม่ใช่จาก token แบบ cache ถาวร · 2) ⛔ ห้ามมี `if (role === 'admin')` ในโค้ด · 3) เมื่อถอดสิทธิ์แล้ว ผู้ใช้ Login ใหม่ → เมนูหายทันที โดย **ไม่ต้องแก้โค้ด Dart และไม่ต้อง build แอปใหม่** |
| **Main Flow** | 1 เปิดหน้า Matrix → 2 ระบบโหลด Role × Permission → 3 ติ๊กช่องที่ต้องการ → 4 กดบันทึก → 5 ระบบ `MERGE` / `DELETE` ใน `role_permission` → 6 แสดง "บันทึกแล้ว มีผลกับการ Login ครั้งถัดไป" |
| **Alternative Flow** | 3a. ติ๊กทั้งหมด/ไม่ติ๊กทั้งหมด → ใช้ปุ่มลัดได้ |
| **หน้าจอ Flutter** | `features/master/permission_matrix_screen.dart` (ตารางติ๊ก + โหมดแนวนอนบนแท็บเล็ต) |
| **API** | `PUT /api/v1/permission-matrix` |
| **Task** | T-021, T-022, T-023 · **ตาราง:** `role_permission`, `app_role`, `permission` |
| **Test Case** | TC-09-01 (ถอด `EMPLOYEE.VIEW` จาก Staff → เมนู "พนักงาน" หาย) |

---

### UC-10 กำหนดบทบาทให้พนักงาน

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-10 · **Actor:** Admin |
| **Precondition** | มีสิทธิ์ `ROLE.ASSIGN` |
| **Postcondition** | แถวใน `employee_role` ถูกเพิ่ม/ลบ (พนักงาน 1 คนมีได้หลายบทบาท) |
| **Main Flow** | 1 เลือกพนักงาน → 2 เลือกบทบาทที่ต้องการให้ → 3 บันทึก → 4 สิทธิ์ของพนักงานรวมเป็นผลรวมของทุกบทบาทที่มี |
| **Task / ตาราง** | T-019 … T-021 · `employee_role` |

---

## 4. F1 — ระบบจัดเส้นทางเดินรถ (UC-11 … UC-12)

### UC-11 จัดการจุดจอด (Stop)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-11 · **Actor:** Staff, Admin |
| **Precondition** | มีสิทธิ์ `STOP.EDIT` |
| **Postcondition** | ข้อมูล `stop` ถูกเพิ่ม/แก้/ปิดใช้งาน · `stop_name` ไม่ซ้ำ |
| **Business Rule (F1 / BR-03)** | 1) **1 จุดจอดอยู่ได้หลายเส้นทาง** → `stop_id` ห้าม UNIQUE เป็นจุดเดียว · 2) ห้าม UNIQUE ที่ `stop_id` แต่ต้อง UNIQUE ที่ `(route_id, stop_id)` (จุดจอดซ้ำในเส้นทางเดียวกันไม่ได้) · 3) 1 เส้นทางมีจุดจอดได้หลายจุด |
| **Main Flow** | 1 เปิดหน้าจุดจอด → 2 เพิ่มจุดจอด (ชื่อ/ที่อยู่/พิกัด) → 3 บันทึก → 4 ระบบ `INSERT INTO stop` → 5 จุดจอดใหม่นี้จะเลือกใช้ได้ในทุกเส้นทาง |
| **หน้าจอ Flutter** | `features/front/stop_screen.dart` |
| **API / Task** | `/stops` · T-024, T-028 · **ตาราง:** `stop` |

---

### UC-12 จัดการเส้นทาง (Route)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-12 (ย่อย: 12.1 เพิ่ม/แก้เส้นทาง · 12.2 เรียงจุดจอด+นาที · 12.3 คำนวณเวลารวม · 12.4 ดูรายละเอียด) |
| **Actor** | Staff, Admin |
| **Precondition** | มีสิทธิ์ `ROUTE.EDIT` และมีข้อมูลจุดจอดแล้ว |
| **Postcondition** | `route` และ `route_stop` ถูกบันทึก · `route.total_minutes` เท่ากับผลรวม `travel_minutes` เสมอ |
| **Business Rule (F1)** | 1) **BR-01** `route.total_minutes` = `SUM(route_stop.travel_minutes)` คำนวณอัตโนมัติ ผู้ใช้ห้ามพิมพ์เอง · 2) **BR-03** จุดจอด 1 จุดอยู่ได้หลายเส้นทาง · 3) เก็บ "ใช้เวลากี่นาที" ของแต่ละจุดจอด · 4) ต้องมีข้อมูลตามตัวอย่าง: **เส้นทาง 1 = 30 นาที (7 จุด) · เส้นทาง 2 = 13 นาที (4 จุด) · เส้นทาง 3 = 12 นาที (5 จุด)** |
| **Main Flow — UC-12.2 / 12.3** | 1 เลือกเส้นทาง → 2 เพิ่มจุดจอดเรียงลำดับ (`stop_seq` 1..n) → 3 กำหนดนาทีจากจุดก่อนหน้าถึงจุดนี้ → 4 กดบันทึก → 5 ระบบคำนวณ `total_minutes` ใหม่ทันที → 6 แสดง "เวลารวมทั้งเส้นทาง: XX นาที" |
| **Alternative Flow** | 2a. `stop_seq` ซ้ำ → ปฏิเสธ · 2b. เพิ่มจุดจอดเดิมในเส้นทางเดิม → ปฏิเสธ (UNIQUE `(route_id, stop_id)`) |
| **หน้าจอ Flutter** | `features/front/route_screen.dart` (Stepper Form แทนฟอร์มยาว 1 หน้า ตาม 17.0.1) |
| **API** | `/routes` · `GET/PUT /routes/:id/stops` · `POST /routes/:id/recalculate` |
| **Task** | T-025, T-026, T-027, T-028 · **ตาราง:** `route`, `route_stop`, `stop` |
| **Test Case** | TC-12-01 (เพิ่ม 7 จุด เส้นทาง 1 → ได้ 30 นาทีอัตโนมัติ) · TC-12-02 (เพิ่ม "ร้านส้มตำปูนาง" ลงเส้นทาง 1 และ 2 ได้) |

---

## 5. F2 — ระบบจัดรอบเวลา จัดรถ และคนขับ (UC-13 … UC-16)

### UC-13 จัดการประเภทรถและรถ (Vehicle / Vehicle_Type)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-13 · **Actor:** Staff, Admin |
| **Precondition** | มีสิทธิ์ `VEHICLE.EDIT` |
| **Postcondition** | `vehicle_type` (พร้อม `capacity`) และ `vehicle` (พร้อม `plate_no`) ถูกเพิ่ม/แก้/ปิดใช้งาน |
| **Business Rule** | `capacity > 0` (BR-07 ใช้ค่านี้ตรวจที่นั่งว่าง) · `plate_no` ไม่ซ้ำ · 1 รถมี 1 ประเภท |
| **API / Task / ตาราง** | `/vehicles` · T-029 · `vehicle_type`, `vehicle` |

---

### UC-14 จัดรอบเวลาเดินรถ (Schedule)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-14 (ย่อย: 14.1 สร้างรอบ · 14.2 แก้ไข/ยกเลิกรอบ) |
| **Actor** | Staff, Admin |
| **Precondition** | เส้นทางนั้นมีจุดจอดครบแล้ว และ `route.total_minutes` ถูกต้อง |
| **Postcondition** | มีแถวใน `schedule` + มี `schedule_stop` ครบทุกจุดจอดของเส้นทางแบบอัตโนมัติ |
| **Business Rule (F2)** | 1) จัดรอบเวลา **ตามเส้นทางที่กำหนด** · 2) **BR-02** เวลาที่รถถึงจุดจอด = `depart_at + NUMTODSINTERVAL(SUM(travel_minutes),'MINUTE')` · 3) เส้นทางมีรอบเวลา/จำนวนรอบ **เหมือนหรือต่างกันได้** · 4) **ปรับเปลี่ยนจัดการได้ใหม่ตลอดเวลา** · 5) ตัวอย่างรอบเวลา: **9:30 / 11:00 / 13:00 / 15:00** · 6) `(route_id, depart_at)` ต้องไม่ซ้ำ |
| **Main Flow — UC-14.1** | 1 เลือกเส้นทาง + วันที่ให้บริการ + เวลาออก → 2 เลือกรอบเวลา → 3 กดบันทึก → 4 ระบบ `INSERT INTO schedule` → 5 ระบบสร้าง `schedule_stop` 1 แถวต่อจุดจอด พร้อมคำนวณ `arrive_at` ตาม BR-02 → 6 แสดงตารางเวลาที่ถึงทุกจุดจอด |
| **Alternative Flow — UC-14.2** | 1 เลือกรอบ → 2 แก้เวลาออก → 3 ระบบคำนวณ `arrive_at` ใหม่ทั้งรอบ → 4 **บล็อกการยกเลิก/แก้ไข** หากรอบนั้นมี `booking` แล้ว ต้องแจ้งผู้ใช้ก่อน |
| **หน้าจอ Flutter** | `features/front/schedule_screen.dart` (ปฏิทิน/ตาราง) |
| **API / Task** | `/schedules` · T-030, T-033 · **ตาราง:** `schedule`, `schedule_stop` |

---

### UC-15 มอบหมายคนขับให้รอบเวลา

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-15 · **Actor:** Staff, Admin |
| **Trigger** | Staff เลือกรอบเวลา แล้วเลือกคนขับ |
| **Precondition** | รอบเวลานั้นยังไม่มีคนขับ (หรือกำลังจะเปลี่ยน) · พนักงานคนนั้นมี Role = Driver |
| **Postcondition** | มีแถวใน `driver_assign` · พนักงานคนนั้นเห็นรอบนี้ใน UC-22 |
| **Business Rule — BR-04 (สำคัญ)** | 1) **ตรวจข้อมูลชนกัน**: คนขับคนเดียวกัน หรือรถคันเดียวกัน ถูกมอบหมายในเวลาที่ทับกัน → **ห้ามกำหนด** · 2) นิยาม "ชนกัน" = **{ASM-07-1 สมมติฐาน}** เทียบ **ช่วงเวลาเดินทางที่ซ้อนทับกันจริง** · 3) ช่วงเวลา = `[depart_at, depart_at + route.total_minutes]` · 4) ถ้าชนกัน → ระบบ **ปฏิเสธ + แจ้งรอบที่ชน** ไม่ใช่แค่บล็อกเงียบ ๆ |
| **Main Flow** | 1 เลือกรอบ → 2 เลือกคนขับ → 3 กดมอบหมาย → 4 ระบบตรวจชนกันแบบ Transaction → 5a. ไม่ชน → `INSERT INTO driver_assign` → 5b. ชน → แสดง Conflict Alert พร้อมรายละเอียดรอบที่ชน → 6 บันทึก Audit Log |
| **หน้าจอ Flutter** | `features/front/assign_screen.dart` (Conflict Alert) |
| **API / Task / ตาราง** | `POST/DELETE /schedules/:id/assign-driver` · T-031, T-033 · `driver_assign`, `employee` |

---

### UC-16 มอบหมายรถให้รอบเวลา

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-16 · **Actor:** Staff, Admin |
| **Precondition** | รอบเวลานั้นยังไม่มีรถ |
| **Postcondition** | มีแถวใน `vehicle_assign` · ที่นั่งของรอบ = `vehicle_type.capacity` |
| **Business Rule** | BR-04 เหมือน UC-15 แต่เปรียบเทียบด้วย `veh_id` · 1 รอบมี 1 รถ (ใช้ `capacity` ในการตรวจที่นั่งของ UC-17/UC-18) |
| **Main Flow** | เหมือน UC-15 โดยเปลี่ยน `emp_id` → `veh_id` |
| **API / Task / ตาราง** | `POST/DELETE /schedules/:id/assign-vehicle` · T-032, T-033 · `vehicle_assign`, `vehicle` |

---

## 6. B — ระบบการจองรถของผู้ใช้บริการ (UC-17 … UC-21)

### UC-17 เลือกจุดขึ้น-ลง และดูรอบเวลาที่จองได้

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-17 · **Actor:** Customer |
| **Trigger** | ลูกค้าเปิดหน้าจอง แล้วเลือกจุดจอดขึ้นและจุดจอดลง |
| **Precondition** | **Login เข้าระบบก่อนจอง** (B1 ข้อแรก) |
| **Postcondition** | แสดงเฉพาะ **รอบเวลาที่สามารถขึ้นรถได้จริง** พร้อมที่นั่งว่าง |
| **Business Rule (B1)** | 1) **Login เข้าระบบก่อนจอง** · 2) เลือก **จุดจอดขึ้น** และ **จุดจอดลง** · 3) ระบบแสดง **รอบเวลาที่สามารถขึ้นรถได้** · 4) **BR-05** จองก่อนรถถึงจุดจอดขึ้น **20 นาที** → เกิน 20 นาที = **ไม่แสดงรอบนั้น** · 5) **BR-12** จุดขึ้นและจุดลงต้องอยู่ใน **เส้นทางของรอบที่เลือก** · 6) **BR-11** จุดขึ้นรถต้อง **อยู่ก่อน** จุดลงรถตามลำดับ `stop_seq` · 7) **BR-07** แสดงเฉพาะรอบที่ **ที่นั่งว่างพอ** |
| **สูตร BR-05 (Oracle)** | `schedule_stop.arrive_at - SYSTIMESTAMP >= INTERVAL '20' MINUTE`<br>(เทียบกับเวลาถึง **จุดขึ้นรถ** ไม่ใช่เวลาออกจากจุดเริ่มต้น) |
| **สูตร BR-07 (Oracle)** | `capacity - NVL(SUM(booking.seats), 0)` โดยนับเฉพาะ `status = 'reserved'` |
| **Main Flow** | 1 เลือกวันที่ → 2 เลือกจุดจอดขึ้น → 3 เลือกจุดจอดลง → 4 กด "ค้นหารอบเวลา" → 5 ระบบกรองรอบด้วย BR-05, BR-07, BR-11, BR-12 → 6 แสดงรายการรอบพร้อม "เหลือ X ที่นั่ง" |
| **Alternative Flow** | 3a. เลือกจุดลงที่อยู่ **ก่อน** จุดขึ้น → แจ้ง "จุดจอดลงต้องอยู่หลังจุดจอดขึ้น" (BR-11) · 5a. ไม่มีรอบที่ผ่านเงื่อนไข → แจ้ง "ไม่มีรอบที่จองได้ในวันนี้" |
| **หน้าจอ Flutter** | `features/booking/booking_screen.dart` |
| **API / Task / ตาราง** | `GET /booking/available?board_stop=&alight_stop=&date=` · T-034 · `schedule`, `schedule_stop`, `vehicle`, `vehicle_type`, `booking` |

---

### UC-18 เลือกจำนวนที่นั่งและยืนยันการจอง

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-18 · **Actor:** Customer |
| **Precondition** | เลือกรอบเวลาที่ผ่าน UC-17 แล้ว |
| **Postcondition** | มี `booking` สถานะ `reserved` พร้อม `booking_code` และ `qr_token` · ที่นั่งถูกลดลงทันที |
| **Business Rule (B1 — 5 ข้อ)** | 1) Login ก่อนจอง · 2) เลือกจุดขึ้น–ลง · 3) เห็นเฉพาะรอบที่ขึ้นรถได้ · 4) **BR-05** 20 นาที · 5) **BR-06 เลือกจำนวนที่นั่งได้ไม่เกิน 4 คน** · 6) **BR-07 เช็คที่นั่งว่างพอ** (เช่น รถ 9 ที่นั่ง จองแล้ว 8 → เหลือจองได้ 1) |
| **Main Flow** | 1 แตะรอบเวลา → 2 เลือกจำนวนที่นั่ง (1–4) → 3 กด "ยืนยันการจอง" → 4 ระบบตรวจ BR-05/BR-06/BR-07 อีกครั้งฝั่ง Server → 5 เปิด Transaction + `SELECT ... FOR UPDATE NOWAIT` ล็อกแถว `schedule` → 6 `INSERT INTO booking` พร้อม `booking_code` (Sequence) และ `qr_token` (สุ่ม) → 7 แสดง QR Code (UC-20) |
| **Alternative / Exception Flow** | 2a. เลือกเกิน 4 → ปฏิเสธทันทีที่ UI และที่ `CHECK (seats BETWEEN 1 AND 4)` · 5a. ถูกล็อกอยู่ → `ORA-00054` → ตอบ `409 Conflict` (ไม่ค้าง) · 5b. ที่นั่งไม่พอ → `SEAT_FULL` พร้อมจำนวนที่เหลือ |
| **ข้อควรระวัง Oracle** | ⛔ ห้ามใช้ `FOR UPDATE` กับ aggregate (`SUM`/`GROUP BY`) → `ORA-02014` · ให้ล็อกแถว `schedule` ก่อน แล้วค่อยนับแบบ aggregate · ใช้ `NVL(SUM(...),0)` เพราะ Oracle คืน `NULL` ไม่ใช่ 0 |
| **หน้าจอ Flutter** | `features/booking/seat_select_screen.dart` + `qr_screen.dart` |
| **API / Task / ตาราง** | `POST /booking` · T-035, T-036, T-037 · `booking`, `seq_booking_code` |

---

### UC-19 ดูรายการเดินทางของฉัน (My Booking)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-19 · **Actor:** Customer, Admin |
| **Precondition** | Login แล้ว |
| **Postcondition** | ไม่มีการเปลี่ยนแปลงข้อมูล (Read-only) |
| **Business Rule (B2)** | ผู้ใช้ดูรายการเดินทางที่ **กำลังจะถึง / เสร็จแล้ว / ยกเลิก** ได้ |
| **Main Flow** | 1 เปิดหน้า "การเดินทางของฉัน" → 2 เลือกแท็บ `กำลังจะถึง` / `เดินทางแล้ว` / `ยกเลิก` → 3 ระบบกรองจาก `booking.cust_id` + `status` + `schedule.service_date` → 4 แสดงรายการพร้อมปุ่ม "ดู QR" / "ยกเลิก" |
| **API / Task / ตาราง** | `GET /booking/me?status=upcoming` · T-039, T-041 · `booking`, `schedule` |

---

### UC-20 แสดง QR Code สำหรับเช็คอิน

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-20 · **Actor:** Customer |
| **Trigger** | จองสำเร็จ หรือแตะ "ดู QR" ใน UC-19 |
| **Precondition** | มี `booking` สถานะ `reserved` หรือ `checked_in` |
| **Postcondition** | แสดงภาพ QR ของ `qr_token` นั้น |
| **Business Rule (B2)** | 1) เมื่อจองสำเร็จ → **generate QR Code** · 2) ใช้สำหรับ **check in ขึ้นรถ** · 3) **{ASM-07-3 สมมติฐาน}** QR **ใช้ได้ 1 ครั้งต่อ 1 การจอง** · 4) `qr_token` ต้อง **เดาไม่ได้** และ **เปลี่ยนได้** |
| **Main Flow** | 1 เปิดหน้า QR → 2 Backend คืน `qr_token` (หรือ Data URL จาก `qrcode`) → 3 Flutter วาดด้วย `qr_flutter` → 4 แสดงรหัสการจอง + เวลา + จุดขึ้น–ลง + จำนวนที่นั่ง |
| **Alternative Flow** | 2a. `status = cancelled` → ไม่แสดง QR · 2b. `status = checked_in` → แสดงว่า "เช็คอินแล้ว" |
| **API / Task** | `GET /booking/:id/qr` · T-037, T-041 · **ตาราง:** `booking.qr_token` |

---

### UC-21 ยกเลิกการจอง

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-21 · **Actor:** Customer |
| **Trigger** | ผู้ใช้กด "ยกเลิกการจอง" ใน UC-19 |
| **Precondition** | `booking.status = 'reserved'` และเป็นการจอง **ของตัวเอง** |
| **Postcondition** | `booking.status = 'cancelled'` + `cancel_time` ถูกบันทึก → **ที่นั่งถูกคืนเข้ารอบทันที** |
| **Business Rule (B3)** | 1) ผู้ใช้ยกเลิกรายการ **ของตัวเอง** ได้ · 2) **BR-08** เมื่อยกเลิก → **ที่นั่งกลับมาตามจำนวนที่ยกเลิก** · 3) **{ASM-07-2 สมมติฐาน}** ยกเลิกได้ **ก่อนรถถึงจุดขึ้น 20 นาที** |
| **Main Flow** | 1 เลือกรายการ → 2 กดยกเลิก → 3 แสดง Dialog ยืนยัน → 4 ระบบตรวจว่าเป็นของตัวเอง + ยังไม่เลยเวลาที่กำหนด → 5 เปิด Transaction → 6 `UPDATE booking SET status='cancelled', cancel_time = SYSTIMESTAMP WHERE booking_id = :id` → 7 Commit → 8 รายการย้ายไปแท็บ "ยกเลิก" |
| **Alternative Flow** | 4a. เป็นการจองของคนอื่น → `403` · 4b. เลยเวลา 20 นาที → แจ้ง "เลยกำหนดเวลายกเลิกแล้ว" · 4c. `status` เป็น `checked_in`/`completed` → ยกเลิกไม่ได้ |
| **หน้าจอ Flutter** | `features/booking/my_booking_screen.dart` |
| **API / Task / ตาราง** | `POST /booking/:id/cancel` · T-038, T-041 · `booking` |

---

## 7. D — ระบบสำหรับคนขับรถ (UC-22 … UC-26)

### UC-22 ดูตารางงานรายวัน (D1)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-22 · **Actor:** Driver |
| **Precondition** | Login แล้ว · พนักงานมี Role = Driver และมีแถวใน `driver_assign` |
| **Postcondition** | ไม่มีการเปลี่ยนแปลงข้อมูล |
| **Business Rule (D1)** | คนขับเห็น **ตารางการทำงานของตัวเองในแต่ละวัน** |
| **Main Flow** | 1 เปิดแอป → 2 ระบบโหลด `driver_assign JOIN schedule JOIN route` ของ `emp_id` ที่ Login · 3 แสดงรายการรอบของวันนั้น (เวลาออก, เส้นทาง, รถ, จำนวนผู้โดยสารโดยประมาณ, ปุ่ม "เริ่มการเดินทาง") |
| **API / Task / ตาราง** | `GET /driver/schedule?date=` · T-043, T-048 · `driver_assign`, `schedule`, `route`, `vehicle` |

---

### UC-23 เริ่มการเดินทาง (D2)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-23 · **Actor:** Driver |
| **Trigger** | คนขับกด "เริ่มการเดินทาง" ในรอบเวลานั้น |
| **Precondition** | รอบนี้มีคนขับและรถถูกมอบหมายแล้ว |
| **Postcondition** | มีแถว `trip` สถานะ `running` พร้อม `start_time` |
| **Business Rule (D2)** | 1) **กดเริ่มได้ในแต่ละรอบเวลา** · 2) ระบบต้อง **แสดงชัดเจนว่า ณ เวลานั้น ๆ มีงานอื่นที่ต้องทำอยู่หรือไม่** · 3) BR-04: คนขับ 1 คน ห้ามถูกมอบหมาย 2 รอบที่เวลาทับกัน |
| **Main Flow** | 1 กด "เริ่มการเดินทาง" → 2 ระบบตรวจว่ามี `trip` อื่นที่ยัง `running` ของคนขับคนนี้หรือไม่ → 3a. ไม่มี → `INSERT INTO trip` + เปิดหน้า Manifest (UC-24) → 3b. **มี** → แสดง **Conflict Alert** พร้อมรายละเอียดรอบที่ค้างอยู่ + ให้เลือก "ปิดรอบเก่าก่อน" หรือ "ออก" |
| **Alternative Flow** | 3c. รอบนี้เคยเริ่มแล้ว (`uq_trip_sched`) → บอกว่าเริ่มไปแล้ว ไม่ให้เริ่มซ้ำ |
| **หน้าจอ Flutter** | `features/driver/driver_schedule_screen.dart` + `trip_screen.dart` |
| **API / Task / ตาราง** | `POST /driver/trip/:schedId/start` · T-044, T-048 · `trip`, `driver_assign` |

---

### UC-24 ดูรายชื่อผู้โดยสารขึ้น-ลงรายจุดจอด (D2 Manifest)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-24 · **Actor:** Driver |
| **Precondition** | เริ่มการเดินทางแล้ว (มี `trip`) |
| **Postcondition** | ไม่มีการเปลี่ยนแปลงข้อมูล |
| **Business Rule (D2)** | 1) เห็นว่าในรอบนั้น **มีผู้ใช้บริการขึ้นกี่คน ลงกี่คน ในแต่ละสถานี** · 2) **และเป็นใครบ้าง** · 3) ใช้ `LISTAGG` รวมชื่อเป็นบรรทัดเดียว · 4) เรียงตาม `stop_seq` |
| **สูตร Oracle** | `LISTAGG(first_name \|\| ' ' \|\| last_name, ', ') WITHIN GROUP (ORDER BY last_name)` |
| **Main Flow** | 1 เปิดหน้า Manifest → 2 Backend โหลด `schedule_stop` → `trip_passenger` → `booking` → `employee` → 3 แสดงรายการ: **จุดจอด | เวลาถึง | ขึ้นกี่คน (รายชื่อ) | ลงกี่คน (รายชื่อ)** · 4 แถวที่ผ่านแล้วเปลี่ยนเป็น ✓ |
| **หน้าจอ Flutter** | `features/driver/manifest_screen.dart` (Mobile–Detail) |
| **API / Task / ตาราง** | `GET /driver/trip/:tripId/manifest` · T-045, T-049 · `trip`, `trip_passenger`, `schedule_stop`, `employee` |

---

### UC-25 สแกน QR เช็คอินขึ้นรถ (D3)

| หัวข้อ | รายละเอิด |
|---|---|
| **Use Case ID** | UC-25 · **Actor:** Driver · **Supporting Actor:** Customer (แสดง QR) |
| **Trigger** | คนขับเปิดหน้าสแกน → จับ QR ของผู้โดยสาร → ระบบอ่านค่าด้วย `mobile_scanner` |
| **Precondition** | เริ่มการเดินทางแล้ว (มี `trip` ที่ `running`) |
| **Postcondition** | สำเร็จ → `booking.status = 'checked_in'` + สร้าง `trip_passenger` พร้อม `checkin_time` + `board_seq` |
| **Business Rule (D3 / BR-09)** | 1) คนขับสแกน QR จากผู้ใช้บริการที่จองเดินทางมาได้ · 2) **ถ้าผิดรอบจะไม่สามารถขึ้นรถได้** · 3) ต้องเทียบ `booking.sched_id` กับ `trip.sched_id` **ของ trip ที่กำลังเดิน** · 4) **{ASM-07-3 สมมติฐาน}** QR ใช้ได้ **1 ครั้งต่อ 1 การจอง** |
| **สูตร Oracle (สำคัญ — กันเทียบผิด)** | `LEFT JOIN trip t ON t.trip_id = :currentTripId`<br>⛔ ห้าม join ด้วย `sched_id` เพราะจะเทียบตัวเองเสมอ → ตรวจ "ผิดรอบ" ไม่ได้ |
| **Main Flow** | 1 เปิดหน้าสแกน (กล้อง) → 2 อ่าน `qr_token` (debounce 2 วินาที กันอ่านซ้ำ) → 3 ส่ง `qr_token` + `trip_id` ไปตรวจ → 4a. ถูกต้อง → บันทึก `checkin_time`/`board_seq` และแสดงชื่อผู้โดยสาร → 4b. **ผิดรอบ** → แสดง "QR นี้ไม่ใช่รอบที่กำลังเดินรถ" สีแดง → 4c. ยกเลิกแล้ว → "การจองถูกยกเลิกแล้ว" → 4d. เช็คอินแล้ว → "ผู้โดยสารเช็คอินไปแล้ว" |
| **เหตุผลทางเทคนิคที่ต้องเป็น Mobile** | คนขับต้องสแกน QR **ริมทาง** → ต้องใช้กล้องมือถือ → ยืนยันว่า Flutter เป็นเทคโนโลยีเดียวที่เหมาะสม (R-07) |
| **หน้าจอ Flutter** | `features/driver/scan_qr_screen.dart` |
| **API / Task / ตาราง** | `POST /driver/trip/scan` · T-046, T-050 · `booking`, `trip`, `trip_passenger` |
| **Test Case** | TC-25-01 (สแกนผิดรอบ → ขึ้นรถไม่ได้) |

---

### UC-26 ปิดรอบการเดินทางและดูสรุป (D4)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-26 · **Actor:** Driver |
| **Trigger** | คนขับกด "ปิดรอบการเดินทาง" เมื่อถึงจุดปลายทาง |
| **Precondition** | มี `trip` สถานะ `running` |
| **Postcondition** | 1) `trip.status = 'completed'` + `end_time` · 2) `booking` ที่ยัง `reserved` กลายเป็น `no_show` · 3) แสดงหน้าสรุป |
| **Business Rule (D4 / BR-10)** | 1) เมื่อถึงจุดปลายทาง คนขับกดปิดรอบการเดินทาง · 2) ระบบสรุป **เส้นทางนี้มีผู้ใช้บริการทั้งหมดกี่คน** · 3) และ **ใครบ้างที่ไม่ได้มาใช้บริการตามที่จองไว้ (No Show)** · 4) ปิดรอบ → การจองที่ยังสถานะ `reserved` ถูกเปลี่ยนเป็น **`no_show`** |
| **สูตร Oracle** | `UPDATE booking SET status = 'no_show' WHERE sched_id = :schedId AND status = 'reserved'`<br>ต้องรันใน Transaction เดียวกับการปิด `trip` |
| **Main Flow** | 1 กด "ปิดรอบ" → 2 แสดง Dialog "ยืนยันการปิดรอบ?" → 3 เปิด Transaction → 4 `UPDATE trip` → 5 `UPDATE booking ... no_show` → 6 Commit → 7 แสดงหน้าสรุป: จำนวนผู้โดยสารทั้งหมด / ขึ้นจริง / ลงจริง / **No Show + รายชื่อ** |
| **Alternative Flow** | 3a. ปิดรอบนี้ไม่ได้ (ยังไม่ถึงปลายทาง) → ยังปิดได้แต่ต้องยืนยัน · 5a. ไม่มีใคร No Show → แสดง "ไม่มีผู้โดยสาร No Show" |
| **หน้าจอ Flutter** | `features/driver/trip_summary_screen.dart` |
| **API / Task / ตาราง** | `POST /driver/trip/:tripId/complete` · T-047, T-051 · `trip`, `booking`, `trip_passenger` |

---

## 8. ระบบรายงาน — R1 + R4 + R6 (UC-27 … UC-30)

### UC-30 เลือกปี / ช่วงวันที่ และส่งออกรายงาน (ใช้ร่วมกันทุกรายงาน)

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-30 · **Actor:** Staff, Admin |
| **Precondition** | มีสิทธิ์ `REPORT.VIEW` · Login แล้ว |
| **Postcondition** | ไม่มีการเปลี่ยนแปลงข้อมูล |
| **Business Rule** | 1) ทุกรายงานมี **ทั้งตารางรายละเอียด และกราฟ** · 2) **R-07** ต้องทำบน Flutter เท่านั้น ใช้ `fl_chart` + ปุ่ม **Export เป็น PNG/PDF** เพื่อให้นำกราฟไปใส่รายงานได้ · 3) รายงานต้องรันได้ **< 3 วินาที** ที่ข้อมูล 50,000 แถว |
| **Main Flow** | 1 เปิดเมนู "รายงาน" → 2 เลือกปี (พ.ศ. 2568) หรือช่วงวันที่ → 3 Backend คืนทั้ง **ตาราง + ข้อมูลกราฟ** → 4 แสดงตาราง (แนวตั้ง = มือถือ, แนวนอน/แท็บเล็ต = กว้าง) → 5 แสดงกราฟ → 6 กด "ส่งออก" → 7 ได้ไฟล์ PNG/PDF |
| **หน้าจอ Flutter** | `features/report/report_shell.dart` + `_date_range_picker.dart` |
| **Task** | T-058, T-059 |

---

### UC-27 รายงานที่ 1 : เปรียบเทียบจำนวนคนขึ้น/ลงรายสัปดาห์ ✅

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-27 · **Actor:** Staff, Admin |
| **คะแนน** | **10 คะแนน** (กลุ่มแรก `{R1, R2}`) |
| **ต้องแสดง** | เลือกปี 2568 → แสดงรายละเอียด + กราฟเปรียบเทียบ |
| **ตารางที่ใช้** | `trip` + `trip_passenger` (`board_seq`, `alight_seq`, `alight_time`) + `schedule` |
| **เทคนิค Oracle ที่ต้องใช้** | `TRUNC(service_date, 'IW')` + `TO_CHAR(..., 'IW')` (ISO Week) + `CASE WHEN ... IS NOT NULL` + `EXISTS` |
| **Business Rule / กับดัก** | ⛔ **ห้าม `COUNT(DISTINCT alight_time)`** เพราะจะนับ "จำนวนเวลาที่ไม่ซ้ำกัน" ไม่ใช่ "จำนวนคน" — ถ้าผู้โดยสาร 3 คนลงพร้อมกันเวลา 17:30 จะได้ 1 แทน 3 · ต้องนับด้วย `COUNT(DISTINCT CASE WHEN tp.checkin_time IS NOT NULL THEN tp.booking_id END)` |
| **Main Flow** | 1 เลือกปี 2568 → 2 เรียก `GET /report/boarding-alighting-week?year=2568` → 3 แสดงตาราง `สัปดาห์ | จำนวนคนขึ้น | จำนวนคนลง` → 4 แสดงกราฟเปรียบเทียบ (Bar Grouped / Line) |
| **API / Task** | `/report/boarding-alighting-week` · T-054, T-058, T-053 |

---

### UC-28 รายงานที่ 4 : สรุปยอดผู้ใช้รายวันรายเส้นทาง ✅

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-28 · **Actor:** Staff, Admin |
| **คะแนน** | **7 คะแนน** (กลุ่ม `{R3, R4, R5}`) |
| **ต้องแสดง** | เลือกช่วงวันที่ → แยกตามวัน (จ/อ/พ/พฤ/ศ/ส/อา) × เส้นทาง 1–3 + **คอลัมน์รวมทั้งวัน** + กราฟ · **ถ้าช่วงที่เลือกมีวันจันทร์มากกว่า 1 ครั้ง ให้รวมจำนวนทั้งหมดของวันนั้น** |
| **ตารางที่ใช้** | `booking` + `schedule` (`service_date`, `route_id`) |
| **เทคนิค Oracle ที่ต้องใช้** | **`PIVOT`** สร้างตาราง เส้นทาง 1–3 + `SUM(...) OVER (PARTITION BY service_date)` หรือ `GROUPING SETS` เพื่อได้คอลัมน์ "รวมทั้งวัน" |
| **Business Rule / กับดัก** | ต้อง `GROUP BY s.service_date` (วัน**เต็ม**) ไม่ใช่แค่ชื่อวัน → จึงรวมวันจันทร์ทุกสัปดาห์ในช่วงที่เลือกเป็นแถวเดียวโดยอัตโนมัติ |
| **Main Flow** | 1 เลือกช่วงวันที่ → 2 เรียก `GET /report/daily-by-route?from=&to=` → 3 แสดงตาราง `วันที่ | วัน | เส้นทาง 1 | เส้นทาง 2 | เส้นทาง 3 | รวมทั้งวัน` → 4 แสดงกราฟ Stacked Bar |
| **API / Task** | `/report/daily-by-route` · T-055, T-059 |

---

### UC-29 รายงานที่ 6 : สรุปการมอบหมายงานคนขับ ✅

| หัวข้อ | รายละเอียด |
|---|---|
| **Use Case ID** | UC-29 · **Actor:** Staff, Admin |
| **คะแนน** | **7 คะแนน** (กลุ่ม `{R6, R7}`) |
| **ต้องแสดง** | เลือกช่วงวันที่ → คนขับ / รวมรอบ / **ก่อน 17:00** / **หลัง 17:00** + กราฟ |
| **ตารางที่ใช้** | `driver_assign` + `schedule` (`depart_at`) |
| **เทคนิค Oracle ที่ต้องใช้** | `Analytic` + **`ROLLUP`** (เพื่อได้แถว "รวมทั้งหมด" ตามตัวอย่างในเอกสารหน้า 9) + `CASE WHEN TO_CHAR(depart_at,'HH24') < 17` |
| **Business Rule** | 1) "รวมรอบ" = จำนวนรอบทั้งหมด · 2) "ก่อน 17:00" = `depart_at` ก่อน 17:00 · 3) "หลัง 17:00" = `depart_at` ตั้งแต่ 17:00 เป็นต้นไป · 4) ต้องมีแถวรวม (`ROLLUP` → `driver_name IS NULL`) |
| **Main Flow** | 1 เลือกช่วงวันที่ → 2 เรียก `GET /report/driver-workload?from=&to=` → 3 แสดงตาราง `คนขับ | รวมรอบ | ก่อน 17:00 | หลัง 17:00` พร้อมแถว "**รวมทั้งหมด**" → 4 แสดงกราฟ |
| **API / Task** | `/report/driver-workload` · T-056, T-059, T-053 |

---

## 9. Use Case ที่ไม่ทำจริง (ตามเงื่อนไข PDF)

> รายงานที่ **ไม่ได้เลือก** จะคืนค่า `501 Not Implemented` และ **ไม่มีหน้าจอ** ใน Mockup / แอป

| รหัส | ชื่อรายงาน | เหตุผลที่ไม่ทำ | เทคนิคที่ "สำรองไว้" แล้ว |
|---|---|---|---|
| R2 | สถิติการจองรายปี | ทีมเลือก R1 จากกลุ่ม `{R1,R2}` (R1 คะแนนสูงกว่า) | `booking.status` ครบ 5 สถานะ + `trip_passenger.checkin_time` |
| R3 | พฤติกรรมผู้ใช้ในช่วงวันที่ | ต้องเลือก 1 จาก `{R3,R4,R5}` แล้วเลือก R4 | `booking.cust_id` + `status` |
| R5 | การใช้บริการในแต่ละจุดจอดตามรอบเวลา | R5 อยู่กลุ่มเดียวกับ R4 → **เลือกไม่ได้** | `schedule_stop.arrive_at` + `trip_passenger` + `LISTAGG` |
| R7 | จำนวนรอบต่อรถแต่ละประเภท | ต้องเลือก 1 จาก `{R6,R7}` แล้วเลือก R6 | `vehicle` + `vehicle_type` + `vehicle_assign` |

> ⚠️ **ห้ามเลือกชุดผิด** — R1 + R4 + R5 **ไม่ได้** เพราะ R4 กับ R5 อยู่กลุ่มเดียวกัน
> และต้องเลือกครบ 1 ข้อจากทุกกลุ่ม ไม่งั้นคะแนนไม่ครบเงื่อนไข

---

## 10. Traceability : Requirement → Use Case

| Req | รหัสข้อกำหนด | Use Case ที่ครอบคลุม | Task | สถานะ |
|---|---|---|---|---|
| **M1** | จัดการพนักงาน (เพิ่ม/แก้/ระบุแผนก/ระบุตำแหน่ง) | UC-04, UC-05, UC-06 | T-016, T-018 | ☐ |
| **M2** | กำหนดสิทธิ์ Dynamic (เพิ่ม/ลบ/แก้ได้ ไม่ fix) | UC-07, UC-08, UC-09, UC-10 | T-019…T-023 | ☐ |
| **M3** | Login / Logout + เช็คสิทธิ์ | UC-01, UC-02, UC-03 | T-015, T-017 | ☐ |
| **F1** | จัดเส้นทางเดินรถ (จุดจอด/นาที/เวลารวม) | UC-11, UC-12 | T-024…T-028 | ☐ |
| **F2** | จัดรอบเวลา + จัดรถ + คนขับ + ตรวจชนกัน | UC-13, UC-14, UC-15, UC-16 | T-029…T-033 | ☐ |
| **B1** | เงื่อนไขการจอง 5 ข้อ | UC-17, UC-18 | T-034…T-036, T-040 | ☐ |
| **B2** | QR Code + ดูรายการ | UC-19, UC-20 | T-037, T-039, T-041 | ☐ |
| **B3** | ยกเลิกการจอง + คืนที่นั่ง | UC-21 | T-038, T-041 | ☐ |
| **D1** | แสดงงานรายวัน | UC-22 | T-043, T-048 | ☐ |
| **D2** | กดเริ่มการเดินทาง + แจ้งงานชนกัน + manifest | UC-23, UC-24 | T-044, T-045, T-048, T-049 | ☐ |
| **D3** | สแกน QR (ผิดรอบขึ้นไม่ได้) | UC-25 | T-046, T-050 | ☐ |
| **D4** | กดปิดงาน + สรุป + No Show | UC-26 | T-047, T-051 | ☐ |
| **R1** | เปรียบเทียบจำนวนคนขึ้น/ลงรายสัปดาห์ | UC-27, UC-30 | T-053, T-054, T-058 | ☐ |
| **R4** | สรุปยอดผู้ใช้รายวันรายเส้นทาง | UC-28, UC-30 | T-053, T-055, T-059 | ☐ |
| **R6** | สรุปการมอบหมายงานคนขับ | UC-29, UC-30 | T-053, T-056, T-059 | ☐ |
| — | เอกสารประกอบ (ER, Agile, Mockup) | ไม่ใช่ Use Case | T-005, T-009, T-061 | ☐ |
| — | ⛔ Web / React | ⛔ **นอกขอบเขต** — ไม่มี Use Case | — | ตัดออก |

> **Traceability Matrix แบบเต็ม** (Req ↔ Use Case ↔ Table ↔ Screen ↔ Test) จะทำใน **T-061 (Sprint 13)**
> เพื่อให้สะท้อนข้อมูลจริงหลังพัฒนาเสร็จ

---

## 11. สมมติฐาน ASM-07 ที่ใช้ในเอกสารนี้ (ต้องบันทึกใน Retro)

| # | เรื่อง | ค่าที่ใช้ในเอกสารนี้ | กระทบ | ต้องยืนยัน |
|---|---|---|---|---|
| ASM-07-1 | **"ชนกัน" (BR-04)** | เทียบ **ช่วงเวลาเดินทางที่ซ้อนทับกันจริง** คือ `[depart_at, depart_at + total_minutes]` | UC-15, UC-16, UC-23 | Q4 |
| ASM-07-2 | **ยกเลิกการจองได้ถึงเมื่อไร** | ก่อนรถถึง **จุดขึ้น 20 นาที** | UC-21 | Q6 |
| ASM-07-3 | **QR ใช้ซ้ำได้ไหม** | ใช้ได้ **1 ครั้งต่อ 1 การจอง** | UC-20, UC-25 | Q7 |
| ASM-07-4 | **Mockup รับเป็น Figma ได้ไหม** | วางเป็นภาพ/PDF ใน `docs/mockups/` | T-009 | Q3 |
| ASM-07-5 | **ต้องส่งเป็น APK ไหม** | เตรียม `flutter build apk` ไว้ | T-059 ขึ้นไป | Q15 |

> ⛔ ค่าอื่นที่ไม่อยู่ในตารางนี้ **ห้ามเดา** — ต้องถามก่อน

---

## 12. สิ่งที่ยังไม่ครบและต้องทำต่อ

| รายการ | ทำที่ Task | หมายเหตุ |
|---|---|---|
| Export PlantUML เป็น PNG/SVG ใส่รายงาน | T-061 | ใช้ `jebbs.plantuml` หรือ plantuml.com |
| Sequence Diagram (Login / จอง / ยกเลิก / สแกน QR / ปิดรอบ) | T-010 | Checklist A5 · Sprint 3 |
| State Diagram ของ Booking | T-010 | Checklist A6 · จำเป็นเพราะ R2/R3/R4 อาศัยสถานะ |
| Test Case ที่อ้างอิง (TC-xx) | T-060 | Sprint 12 |
| Traceability Matrix เต็ม | T-061 | Sprint 13 |
| Mockup ของทุกหน้าจอใน UC นี้ | T-009 | Sprint 2 · **เฉพาะหน้าจอ Flutter** (R-07) |
