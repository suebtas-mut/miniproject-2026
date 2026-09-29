# AI Prompt Log — P-02 `oracle-ddl`

> บันทึกตามข้อ **AR-06** (`docs/chapter-18-development-plan.md` ข้อ 18.1.3) · เก็บ Prompt ไว้เพื่อทำซ้ำและตรวจสอบ
> ห้ามบันทึกข้อมูลส่วนบุคคลจริง / Password / DB Password / API Key ลงไฟล์นี้ (**AR-03**)

| หัวข้อ | รายละเอียด |
|---|---|
| **วันที่ใช้** | 2026-09-29 (Sprint 1 · วันที่ 2) |
| **Task** | T-007 — `database/01_schema.sql` |
| **Prompt Template** | **P-02 `oracle-ddl`** (18.1.3) |
| **AI Agent** | `@agent-oracle` |
| **ผู้ใช้ Prompt** | นายเก่งกาญ เชี่ยวชาญ |
| **ผู้ตรวจผลลัพธ์** | นางสาวสุขสรร มาณีศรี (AR-02) — ⬜ รอรีวิว |
| **ผลลัพธ์** | `database/01_schema.sql` · `database/99_drop_schema.sql` |

---

## 1. Prompt ที่ใช้จริง (verbatim)

```text
สร้าง Oracle DDL จาก ER [schema] ใช้ GENERATED ... AS IDENTITY, VARCHAR2(n CHAR),
TIMESTAMP, CHECK CONSTRAINT แทน ENUM, COMMENT ON COLUMN, Index สำหรับรายงาน
— ห้ามใช้ syntax ของ MySQL

ข้อกำหนดเพิ่มเติม:
1. แหล่งอ้างอิงลำดับความสำคัญ:
   1) docs/chapter-17-fullstack.md ข้อ 17.4.3 = DDL ต้นทาง
   2) docs/report/chapter-08-data-dictionary.md ข้อ 8.9 = COMMENT ON ฉบับเต็ม
   3) docs/diagrams/er/er-03..05-physical-*.puml = Physical ER
   ถ้าขัดแย้งกัน ให้ยึดข้อ 1 แล้วบันทึกข้อขัดแย้งไว้ ห้ามตัดสินใจเอง
2. DoD ที่ต้องผ่าน:
   ตาราง 20 · คอลัมน์ 102 · Sequence 1 · PK 20 · UNIQUE 18 · CHECK 12 · FK 27
   (CASCADE 10 / RESTRICT 17) · COMMENT ON 122 = TABLE 20 + COLUMN 102
3. ปิดท้ายไฟล์ด้วย query ตรวจจำนวนจริงเทียบ expected และขึ้น PASS/FAIL
   พร้อม query หา object ที่ status <> 'VALID'
4. ต้องรันบน Oracle จริงให้ผ่าน 0 error ก่อนถือว่าเสร็จ
   (ต้องเขียนไฟล์ล้างฐานข้อมูลแยกต่างหาก เพื่อรันซ้ำได้)
5. ⛔ ห้ามสร้างตารางที่ไม่มีใน ER · ห้ามเพิ่มคอลัมน์เอง · ห้ามตัดตารางออก
6. ถ้า DDL ต้นทางมีข้อผิดพลาดที่รันไม่ผ่าน ให้รายงานพร้อม ORA- code
   และเสนอทางแก้ ห้ามแก้เงื่อนไขของ Requirement เพื่อให้ผ่าน
```

---

## 2. บริบทที่ใส่ให้ AI

| ประเภท | ไฟล์ / เนื้อหา | หมายเหตุ |
|---|---|---|
| DDL ต้นทาง | `docs/chapter-17-fullstack.md` ข้อ 17.4.3 | มี 13 `COMMENT ON` เท่านั้น — ไม่ครบ DoD |
| Data Dictionary | `docs/report/chapter-08-data-dictionary.md` ข้อ 8.3–8.6, 8.9 | ให้ `COMMENT ON` ครบ 122 รายการ |
| Physical ER | `docs/diagrams/er/er-03..05-physical-*.puml` | ตรวจจำนวนตาราง/คอลัมน์เทียบกัน |
| เทคโนโลยีตามข้อตกลง | `docs/requirement-review-checklist.md` | Oracle · `node-oracledb` · ไม่มี Web |

### 🔒 ข้อมูลที่ **ไม่** ส่งเข้า Prompt (AR-03)
- `.env` / `.env.example` — ค่า `ORACLE_PASSWORD` และ `APP_USER_PASSWORD` จริง
- ชื่อ user / schema จริงของฐานข้อมูล
- เชื่อมต่อฐานข้อมูลด้วย SQL\*Plus โดยตรง

> ✅ **ทำได้ถูกต้องรอบนี้:** ตอนรันทดสอบจริง ใช้รหัสผ่านจาก env ของ Docker container
> โดยอ่านค่าจาก `$APP_USER_PASSWORD` ภายใน container ตรง ๆ ไม่มีการพิมพ์ค่าออกมาที่ stdout หรือ commit ลงไฟล์

---

## 3. ผลลัพธ์ที่ AI สร้าง

| ไฟล์ | รายละเอียด |
|---|---|
| `database/01_schema.sql` | 20 `CREATE TABLE` + 1 `CREATE SEQUENCE` + 8 `CREATE INDEX` + `COMMENT ON` 122 + query ตรวจสอบ 13 รายการ |
| `database/99_drop_schema.sql` | ล้างสคีมาแบบ idempotent (ลบตามลำดับลูกก่อนพ่อ) |

### 3.1 การตรวจสอบ (AR-05 ต้องทดสอบด้วยตนเอง)

| รายการ | วิธีตรวจ | ผล |
|---|---|---|
| Syntax ของ SQL | `sqlplus` รันจริงบน XEPDB1 | ✅ **0 error** |
| จำนวน object | query ในไฟล์เทียบ expected | ✅ **13/13 PASS** |
| Object ที่ INVALID | `user_objects WHERE status <> 'VALID'` | ✅ 0 แถว |
| `IDENTITY` สร้างค่าให้เอง | `INSERT` แล้วดูค่า id | ✅ ได้ 1 |
| `CHECK` กันค่าเกิน (BR-06) | `INSERT seats = 99` | ✅ ปฏิเสธ ORA-02290 |
| UNIQUE กันจุดจอดซ้ำ (BR-03) | `INSERT stop ซ้ำใน route เดียว` | ✅ ปฏิเสธ ORA-00001 |
| FK ต้องมี parent จริง | `INSERT dept_id = 9999` | ✅ ปฏิเสธ ORA-02291 |
| `COMMENT ON` ภาษาไทย | `DUMP(comments)` | ✅ เป็น UTF-8 ถูกต้อง |
| ไม่มี MySQL syntax | grep `AUTO_INCREMENT`/`ENUM`/backtick/`NOW()` | ✅ ไม่พบ |
| รันซ้ำได้ | `99_drop_schema.sql` แล้วรัน `01_schema.sql` ใหม่ | ✅ สะอาด 0 object ค้าง |
| Code Review (AR-02) | สุขสรร ตรวจ | ⬜ **รอรีวิว** |

---

## 4. AI Credit (AR-04)

| รายการ | ค่า |
|---|---|
| **Task** | T-007 Oracle DDL |
| **AI Agent** | `@agent-oracle` |
| **ประเภทงานที่ใช้ AI** | Database Design · SQL Authoring · Debugging (ORA-01408 / ORA-32794 / ORA-00933) |
| **สัดส่วนงานที่ AI ช่วย** | แปลง ER + Data Dictionary เป็น DDL ฉบับรันได้ · สร้าง query ตรวจสอบตัวเอง · วินิจฉัย error จาก Oracle |
| **สิ่งที่นักศึกษาต้องทำเอง** | เลือกว่าจะตัดดัชนีที่ซ้ำทิ้งอย่างไร (ต้องรักษา Requirement) · ตัดสินใจเรื่อง Oracle 19c/21c · ตรวจทุกจำนวนเทียบ DoD |
| **เวลาที่ประหยัดได้** | ประมาณ 3 ชั่วโมง (ปกติ T-007 ≈ 8 ชม.) |

---

## 5. สิ่งที่ AI ทำผิด / ต้องแก้ (AR-07)

| # | ปัญหา | วิธีแก้ | นำไปใช้กับ Prompt ครั้งต่อไป |
|---|---|---|---|
| 1 | เขียน `FOREIGN KEY (sched_id) FOREIGN KEY (sched_id)` ซ้ำใน `schedule_stop` | ตรวจ syntax ด้วยการ count ว่าคำสั่ง constraint แต่ละตัวมี keyword ครบ | ✅ เพิ่มข้อ: "ก่อนเสร็จให้ตรวจทุกบรรทัด CONSTRAINT ว่าไม่มี keyword ซ้ำ" |
| 2 | นับ CHECK ได้ 95 เพราะลืมว่า Oracle เก็บ `NOT NULL` เป็น constraint ชนิด `C` | แยก `constraint_name LIKE 'CK_%'` ออกจาก `SYS_C%` | ✅ เพิ่มข้อ 7 ด้านล่าง |
| 3 | นับ sequence ได้ 17 เพราะ `user_sequences` รวม identity sequence (`ISEQ$`) | กรอง `sequence_name NOT LIKE 'ISEQ$%'` | ✅ รวมในข้อ 7 |
| 4 | เขียนคอมเมนต์ต่อท้าย `;` ในบรรทัดเดียวกัน → SQL\*Plus ขึ้น **ORA-00933** | ย้ายคอมเมนต์ไปบรรทัดก่อนหน้าเสมอ | ✅ เพิ่มข้อ 8 ด้านล่าง |
| 5 | แนะนำ `DROP TABLE ... CASCADE CONSTRAINTS` ซึ่งทำให้เกิด identity sequence ค้างลบไม่ได้ (ORA-32794) | ใช้ `DROP TABLE` ธรรมดาเรียงลูกก่อนพ่อ | ✅ เพิ่มข้อ 9 ด้านล่าง |
| 6 | ไม่ได้ตรวจว่าดัชนีซ้ำกับ unique constraint จนรันแล้วเจอ ORA-01408 | ก่อน `CREATE INDEX` ให้เทียบคอลัมน์กับ constraint `UNIQUE`/`PK` ที่มีอยู่ | ✅ เพิ่มข้อ 10 ด้านล่าง |

### 📌 Prompt P-02 รุ่นปรับปรุง (เพิ่มเติมจากบทเรียนข้างบน)

```text
7.  ก่อนจบ ต้องอธิบายวิธีนับ object ที่ถูกต้องสำหรับ Oracle โดยเฉพาะ:
    - CHECK  → กรอง constraint_name LIKE 'CK_%' (ไม่รวม SYS_C ที่มาจาก NOT NULL)
    - SEQUENCE→ ตัด ISEQ$ ออก (เป็น identity sequence)
    - INDEX   → นับเฉพาะที่ตั้งชื่อเอง (IX_%) ไม่รวม index ที่มาจาก PK/UK
8.  ห้ามเขียนคอมเมนต์ไว้ต่อท้ายคำสั่งในบรรทัดเดียวกันหลังเครื่องหมาย ;
    SQL*Plus จะ parse ไม่ผ่าน (ORA-00933) ให้เขียนคอมเมนต์ไว้บรรทัดก่อนหน้า
9.  ไฟล์ล้างฐานข้อมูลต้อง DROP TABLE แบบธรรมดาเรียงลูกก่อนพ่อ
    ห้ามใช้ CASCADE CONSTRAINTS เพราะจะทิ้ง identity sequence ค้าง (ORA-32794)
10. ก่อน CREATE INDEX ให้เทียบรายการคอลัมน์กับ UNIQUE/PK constraint ที่มีอยู่แล้ว
    และตัดดัชนีที่ซ้ำออก พร้อมรายงานว่าตัดอะไรเพราะอะไร
```

---

*Prompt Library: [P-01](2026-09-28-sprint-00-P-01-requirement-to-usecase.md) · **P-02** · [P-03](P-03_plsql-bulk-seed.md) · [ดูดัชนีทั้งหมด](README.md)*
