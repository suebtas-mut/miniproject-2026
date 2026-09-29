# Prompt Log — การใช้ AI Agent

**โครงการ:** ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
**สาขา:** `sukhsorn`
**เจ้าของงาน:** นางสาวสุขสรร มาณีศรี

> บันทึกนี้เป็นหลักฐานประกอบข้อ 5 ของ Requirement Checklist — ต้องบันทึก Prompt ที่ใช้กับ AI Agent ทุกครั้ง พร้อมผลลัพธ์และผู้ตรวจสอบ

---

## รูปแบบการบันทึก

| คอลัมน์ | ความหมาย |
|---|---|
| **Task** | รหัสงานตามแผนพัฒนา (T-001…T-062) |
| **Agent** | ตัวแทน AI ที่รับงาน (`@agent-doc`, `@agent-oracle`, …) |
| **ผู้ใช้ควบคุม** | คนสั่งงานและตรวจผลงาน |
| **Prompt** | คำสั่ง/ความต้องการที่ส่งให้ Agent |
| **ไฟล์ที่แก้** | ไฟล์ที่ถูกสร้างหรือแก้ไข |
| **ผลลัพธ์** | สิ่งที่ได้ออกมาและสถานะการตรวจสอบ |

---

## T-002 — ตรวจสอบสภาพแวดล้อม (เตรียมความพร้อม)

| รายการ | ค่า |
|---|---|
| Task | T-002 |
| Agent | `@agent-orchestrator` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตรวจสอบเครื่องมือที่ต้องใช้: Android Studio, Flutter SDK, Android SDK, AVD, Node.js และ Java พร้อมรายงานผลและสิ่งที่ขาด" |
| ไฟล์ที่แก้ | ไม่มี (ตรวจสอบอย่างเดียว) |
| ผลลัพธ์ | ✅ พบ Android Studio `C:\Program Files\Android\Android Studio`, Flutter SDK `D:\data\projects\flutter\tools\flutter`, Dart 3.13.4, Android SDK ที่ `$env:LOCALAPPDATA\Android\Sdk`, AVD 4 ตัว (`Flutter_Emulator`, `Flutter_Emulator_New`, `Medium_Phone`, `Medium_Phone_2`)<br>⚠️ **ข้อบกพร่อง 2 จุด**: (1) `flutter --version` ล้มเหลวด้วย WDAC Application Control policy บล็อก `flutter_tools.snapshot` — พบ `CodeIntegrityPolicyEnforcementStatus = 2`, `UsermodeCodeIntegrityPolicyEnforcementStatus = 2` (2) พบ Node.js `v24.21.0` แต่โครงการกำหนด Node.js 20 |
| การดำเนินการแก้ไข | ต้องให้ผู้ดูแลระบบแก้ WDAC/UMCI — **ห้าม bypass policy** และต้องติดตั้ง Node.js 20 ก่อนจึงจะทดสอบ Emulator ได้ |
| ผู้ตรวจสอบ | ⏳ รอผู้ดูแลระบบ |

---

## T-003 — ตั้งค่า ClickUp

| รายการ | ค่า |
|---|---|
| Task | T-003 |
| Agent | `@agent-orchestrator` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สร้าง Workspace/Project/List บน ClickUp สำหรับโครงการนี้" |
| ไฟล์ที่แก้ | ไม่มี |
| ผลลัพธ์ | ❌ **BLOCKED** — ไม่มี ClickUp authentication/session ในเครื่อง จึงยังสร้าง Workspace, Project, List และ Sprint ไม่ได้ |
| สิ่งที่ต้องทำ | ผู้ใช้ต้อง Login ผ่านเบราว์เซอร์และเชื่อมบัญชีกับ Agent ก่อน |
| ผู้ตรวจสอบ | ⏳ รอผู้ใช้เชื่อมบัญชี |

---

## T-004 — Use Case Diagram และ Use Case Specification

| รายการ | ค่า |
|---|---|
| Task | T-004 |
| Agent | `@agent-architect` (diagram) + `@agent-doc` (spec) |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สร้าง Use Case Diagram และ Use Case Specification ครบทุกบทบาทตามบทที่ 17 และ 18 โดยใช้ PlantUML และ Adaptive UI" |
| ไฟล์ที่แก้ | `docs/diagrams/usecase/usecase-00-overview.puml`<br>`docs/diagrams/usecase/usecase-01-auth-master.puml`<br>`docs/diagrams/usecase/usecase-02-front.puml`<br>`docs/diagrams/usecase/usecase-03-booking.puml`<br>`docs/diagrams/usecase/usecase-04-driver.puml`<br>`docs/diagrams/usecase/usecase-05-report.puml`<br>`docs/diagrams/usecase/usecase-06-actor-relation.puml`<br>`docs/diagrams/usecase/usecase-spec.md`<br>`docs/diagrams/usecase/README.md` |
| ผลลัพธ์ | ✅ สร้างครบ 7 ไฟล์ PlantUML + Specification — **UC-01 ถึง UC-30** ครอบคลุม 4 บทบาท (Admin, Staff, Driver, Customer) และระบุ Include/Extend พร้อม Trace ไป Requirement<br>✅ **ตรวจสอบแล้ว:** `plantuml -checkonly` ผ่าน 7/7 ไฟล์ 0 error และ render PNG ได้ครบ 7/7 ไฟล์ (PlantUML 1.2026.8)<br>✅ สคริปต์ตรวจยืนยัน `UC-01`–`UC-30` ครบ 30 ตัว ไม่มีเลขกำะดับ/เกิน และ Specification มีหัวข้อครบ 30 หัวข้อ ตรงกับ Diagram<br>🔧 **แก้ข้อผิดพลาด 2 จุด:** (1) `skinparam usecase { A; B }` แบบบรรทัดเดียวทำให้เกิด Syntax Error → เปลี่ยนเป็นแบบหลายบรรทัด (2) บรรทัด `..> "ข้อความ" as N1` เป็น Syntax Error → ลบออก เพราะเนื้อหาอยู่ใน `note` แล้ว |
| ผู้ตรวจสอบ | ⏳ รอนายเก่งกาญ / นางสาวสุขสรร มาณีศรี |

---

## T-005 — ER Diagram 3 ระดับ + ER Mapping

| รายการ | ค่า |
|---|---|
| Task | T-005 |
| Agent | `@agent-architect` (diagram) + `@agent-doc` (mapping) |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สร้าง ER Diagram 3 ระดับ (Conceptual, Logical, Physical) และเอกสาร Mapping จาก DDL Oracle ในข้อ 17.4.3" |
| ไฟล์ที่แก้ | `docs/diagrams/er/er-01-conceptual.puml`<br>`docs/diagrams/er/er-02-logical.puml`<br>`docs/diagrams/er/er-03-physical-master.puml`<br>`docs/diagrams/er/er-04-physical-front.puml`<br>`docs/diagrams/er/er-05-physical-booking-trip.puml`<br>`docs/diagrams/er/er-mapping.md`<br>`docs/diagrams/er/README.md` |
| ผลลัพธ์ | ✅ สร้างครบ 5 ไฟล์ PlantUML + Mapping — 20 ตาราง 102 คอลัมน์ แบ่ง 3 ระดับ พร้อม Trace ไป Requirement และระบุ Physical ที่ต้องแยกตามกลุ่ม MASTER/FRONT/BOOKING/TRIP<br>✅ **ตรวจสอบแล้ว:** `plantuml -checkonly` ผ่าน 5/5 ไฟล์ 0 error และ render PNG ได้ครบ 5/5 ไฟล์<br>✅ **เทียบกับ DDL 17.4.3 ด้วยสคริปต์:** DDL = 20 ตาราง / 102 คอลัมน์ · `er-02-logical` = 20 entity / 102 คอลัมน์ · Physical 3 ไฟล์ = 20 ตาราง / 102 คอลัมน์ (+1 entity สำหรับ Sequence) — **ชื่อตารางและชื่อคอลัมน์ตรงกันทุกตัว**<br>✅ Conceptual = 13 Entity ตามที่ระบุไว้ (5 + 5 + 3) |
| ผู้ตรวจสอบ | ⏳ รอนายเก่งกาญ / นางสาวสุขสรร มาณีศรี |

---

## T-006 — Data Dictionary

| รายการ | ค่า |
|---|---|
| Task | T-006 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สร้าง Data Dictionary ครบทุกตารางพร้อม `COMMENT ON` ตาม DDL ในข้อ 17.4.3" |
| ไฟล์ที่แก้ | `docs/report/chapter-08-data-dictionary.md` |
| ผลลัพธ์ | ✅ สร้างเอกสาร 908 บรรทัด ครบ 20 ตาราง 102 คอลัมน์ 1 Sequence และ 9 Index<br>• หัวข้อ 8.1 — สรุปจำนวนออบเจกต์และ Constraint (PK 20, UK 18, CK 12, FK 27 รวม 77 ตัว)<br>• หัวข้อ 8.2 — สัญลักษณ์ Data Type และ Business Rule BR-01…BR-08<br>• หัวข้อ 8.3–8.6 — รายละเอียดทุกตาราง/คอลัมน์ (Data Type, Null, Default, Key, Constraint, Description)<br>• หัวข้อ 8.7–8.8 — Foreign Key Map และ Index<br>• หัวข้อ 8.9 — `COMMENT ON` ฉบับเต็ม 122 รายการ (20 TABLE + 102 COLUMN)<br>• หัวข้อ 8.10–8.11 — ตารางแปลง MySQL→Oracle และตัวอย่าง `node-oracledb`<br>• หัวข้อ 8.12–8.15 — Trace ไป Use Case, DoD, ข้อจำกัด และสรุปยอดตรวจอัตโนมัติ<br>✅ **ตรวจสอบอัตโนมัติแล้ว:** นับ `COMMENT ON TABLE` = 20, `COMMENT ON COLUMN` = 102, หัวข้อตาราง = 20, ผลรวมคอลัมน์รายตารางตรงกับ 102<br>⚠️ พบข้อผิดพลาดระหว่างทำงาน: ครั้งแรกเขียนไฟล์ล้มเหลวด้วย `JSON Parse error: Unterminated string` จึงแก้โดยแบ่งเขียนเป็น 4 ส่วน |
| ข้อจำกัด | เอกสารนี้เป็นเอกสารประกอบเท่านั้น — ไม่ได้แก้ `database/**` ซึ่งเป็นหน้าที่ของ T-007 |
| ผู้ตรวจสอบ | ⏳ รอนายเก่งกาญ |

---

## สรุปการใช้ Agent

| Task | Agent | ผลลัพธ์ | สถานะ |
|---|---|---|---|
| T-002 | `@agent-orchestrator` | ตรวจเครื่องมือครบ แต่พบ WDAC และ Node.js เวอร์ชันผิด | ⚠️ BLOCKED |
| T-003 | `@agent-orchestrator` | ไม่มี ClickUp authentication | ❌ BLOCKED |
| T-004 | `@agent-architect`, `@agent-doc` | Use Case 30 รายการ + PlantUML 7 ไฟล์ | ✅ ผ่าน 0 error รอ Review |
| T-005 | `@agent-architect`, `@agent-doc` | ER 3 ระดับ 20 ตาราง + PlantUML 5 ไฟล์ | ✅ ผ่าน 0 error รอ Review |
| T-006 | `@agent-doc` | Data Dictionary 20 ตาราง 102 คอลัมน์ | ✅ เสร็จ รอ Review |

**หลักการที่ใช้ตลอดงาน:**
1. ยึด PDF เป็นข้อกำหนดสูงสุด แล้วไล่ checklist → บทที่ 17 → บทที่ 18
2. แก้ได้เฉพาะ `app/**`, `docs/diagrams/**`, `docs/mockups/**`, `docs/report/**`, `docs/agile/**`, `docs/chapter-17-fullstack.md`, `docs/requirement-review-checklist.md`
3. ห้ามแก้ `backend/**` และ `database/**` โดยไม่ได้รับอนุญาต
4. ห้าม bypass นโยบาย WDAC และห้าม hardcode secret
5. ยังไม่ commit และไม่ push จนกว่าจะผ่านการตรวจสอบ
