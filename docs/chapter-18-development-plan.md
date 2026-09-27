# บทที่ 18 : แผนการดำเนินงาน (Development Plan — Agile Scrum)

> แผนงานนี้อ้างอิงหลักการ **Scrum** ตาม Scrum Guide 2020
> ปรับ **Sprint = 1 วันทำงาน (Fixed Time-box 1 Day)** และมี **Daily Stand-up ทุกวันจันทร์ – เสาร์**
> ทีมงาน **2 คน** ใช้เทคโนโลยีเดียวคือ **Flutter (Android) + REST API (Node.js/Express) + Oracle Database**
> และกำหนด **Agentic AI เป็นผู้ช่วยดำเนินงาน** ในทุกขั้นตอน
> เอกสารนี้ต้องถูก commit ลง **Git** หรือ **ClickUp** ตามข้อกำหนด 10 คะแนน

---

## 18.0 ข้อมูลพื้นฐานของแผนงาน (Project Baseline)

| หัวข้อ | ค่าที่กำหนด |
|---|---|
| โครงการ | MINI PROJECT : ระบบ SHUTTLE BUS (สำนักงานเขตหนองจอก) |
| สมาชิก | **2 คน** — นายเก่งกาญ เชี่ยวชาญ / นางสาวสุขสรร มาณีศรี |
| Client | **Flutter (Android / แท็บเล็ต)** — ทุกบทบาทใช้แอปเดียวกัน |
| Backend | **REST API (Node.js + Express)** พร้อม `node-oracledb` |
| Database | **Oracle Database 19c** (หรือ Oracle XE 19c ในเครื่องนักศึกา) |
| อยู่นอกขอบเขต | การพัฒนาเว็บด้วย React — **ไม่มี Web Application** |
| ระยะเวลา | **14 วันทำงาน** = จันทร์–เสาร์ 2 สัปดาห์ + 2 วัน (Sprint 0 – 13) |
| Sprint | **1 Sprint = 1 วันทำงาน** |
| Daily Stand-up | **ทุกวัน จันทร์ – เสาร์** เวลา 10:00 น. ครั้งละ 15 นาที |
| ผู้ช่วย | **Agentic AI** (8 บทบาท ตาม 18.1.1) |
| Task ทั้งหมด | **62 Task** · ประมาณ **178 ชั่วโมงงาน** |

### 18.0.1 ปฏิทินการทำงาน (Working Day Calendar)

```
สัปดาห์ที่ 1                 สัปดาห์ที่ 2                 สัปดาห์ที่ 3 (2 วัน)
จ.   อ.   พ.   พฤ.  ศ.   ส.    จ.   อ.   พ.   พฤ.  ศ.   ส.    จ.   อ.
S0   S1   S2   S3   S4   S5    S6   S7   S8   S9   S10  S11  S12  S13
 └────── วันทำงาน 1–6 ───────┘└────── วันทำงาน 7–12 ──────┘└─ 13–14 ─┘
                                                    ▲ วันอาทิตย์ = หยุด ไม่มี Sprint
```

| สัปดาห์ | วันทำงาน | Sprint | Sprint Goal รวม |
|---|---|---|---|
| **1** | จันทร์ – เสาร์ (6 วัน) | Sprint 0 – 5 | เครื่องมือ + Oracle + Mockup + Master 1/2/3 |
| **2** | จันทร์ – เสาร์ (6 วัน) | Sprint 6 – 11 | Front 1/2 + Booking + Driver + ข้อมูลรายงาน |
| **3** | จันทร์ – อังคาร (2 วัน) | Sprint 12 – 13 | Report API/UI + Test + เอกสาร + ส่งมอบ |

> **จำนวน Daily Stand-up ที่ต้องบันทึก = 14 ไฟล์** (`docs/agile/standup/YYYY-MM-DD.md`)
> **จำนวน Sprint Retrospective = 14 ไฟล์** (`docs/agile/retro/sprint-XX.md`)

> ⚠️ **ข้อจำกัดสำคัญของแผนนี้**: ทีม 2 คนทำงาน 14 วัน (ประมาณ 6 ชั่วโมงต่อคนต่อวัน) จึงต้องตัดขอบเขตให้เข้มงวด
> รายงานเลือก **3 ข้อ = 24 คะแนน** (R1 จากกลุ่ม {1,2} + R4 จากกลุ่ม {3,4,5} + R6 จากกลุ่ม {6,7} ตามเงื่อนไขตารางคะแนนใน PDF) · ไม่ทำ UAT กับผู้ใช้นอกองค์กร · ไม่มี Web
> ดูความเสี่ยงและแผนรับมือที่ 18.9

---

## 18.1 กรอบการทำงานร่วมกับ Agentic AI

### 18.1.1 บทบาทของ Agentic AI (AI Agent Roles)

เราใช้ AI เป็น **"ผู้ช่วยที่ทำงานเร็ว"** แต่ยังคงกำหนดผู้รับผิดชอบหลักไว้กับนักศึกษา 2 คน

| AI Agent | หน้าที่ที่ได้รับมอบหมาย | ผลงานที่ส่งมอบ | ใช้กับ Epic |
|---|---|---|---|
| `@agent-architect` | วิเคราะห์ Requirement, ออกแบบ ER / DFD / Use Case / Sequence / State Diagram | ไดอะแกรมชุดแรก + Mapping | E0 |
| `@agent-oracle` | ออกแบบ DDL สำหรับ **Oracle** (Identity, Constraint, Index) + PL/SQL + Seed Data | ไฟล์ `.sql` ทั้งหมด | E1, E6 |
| `@agent-coder` | สร้าง REST API (Controller / Service / Repository), Middleware, Connection Pool | โค้ดฝั่ง Backend | E2, E3, E4, E5 |
| `@agent-ui` | สร้าง **Flutter Screen / Widget / Adaptive Layout** | โค้ดฝั่ง Client (Flutter อย่างเดียว) | E7, E8 |
| `@agent-data` | เขียน Query รายงาน, `EXPLAIN PLAN`, Index Tuning, View | ไฟล์ View / Query | E6 |
| `@agent-test` | ออกแบบ Test Case, สร้าง Unit / Integration / Widget Test | ไฟล์เทสต์ + รายงานผล | E9 |
| `@agent-doc` | ร่างเอกสารรายงาน บทที่ 1–18 + Prompt Log | ไฟล์เอกสาร | E10 |
| `@agent-review` | Code Review, ตรวจ Security, ตรวจตาม Requirement, ตรวจว่าไม่มี hardcode | Review Comment | ทุก Epic |

> ⛔ **ไม่มี AI Agent สำหรับ React / Web** เพราะการพัฒนาเว็บอยู่นอกขอบเขต (บทที่ 17 หัวข้อ 17.0)

### 18.1.2 กฎการทำงานร่วมกับ AI (AI Operating Rules) — บังคับทั้ง 2 คน

> ⚠️ **กฎเหล่านี้ต้องเขียนลงในรายงานด้วย** เพื่อแสดงว่า AI ถูกใช้อย่างรับผิดชอบทางวิชาการ

| # | กฎ |
|---|---|
| **AR-01** | AI เป็น **ผู้ช่วย** ไม่ใช่ผู้ตัดสินใจ — นักศึกาต้องอ่านโค้ดและเข้าใจทุกบรรทัดที่นำไปใช้ |
| **AR-02** | โค้ดทุกส่วนที่ AI สร้างต้องผ่าน **Code Review โดยอีกสมาชิก 1 คน** ก่อน Merge (ทีม 2 คน → **ผู้เขียนห้ามรีวิวงานของตัวเอง**) |
| **AR-03** | **ห้ามส่งข้อมูลส่วนบุคคลจริง / Password / DB Password / API Key** เข้า Prompt ของ AI |
| **AR-04** | ต้อง **ระบุ Credit** ในรายงานว่าใช้ AI ช่วยงานใดบ้าง (ภาคผนวก ค) |
| **AR-05** | ต้อง **ทดสอบด้วยตนเองทุกครั้ง** ห้าม Merge โค้ดที่ยังไม่รัน |
| **AR-06** | ต้องเก็บ **Prompt ที่ใช้** ไว้ในโฟลเดอร์ `docs/ai-prompts/` เพื่อทำซ้ำและตรวจสอบ |
| **AR-07** | ถ้า AI ตอบผิด ต้อง **บันทึกลง Retro Log** เพื่อปรับปรุงวิธีเขียน Prompt |
| **AR-08** | ห้ามใช้ AI สร้างข้อมูลตัวอย่างปลอมที่ไม่สอดคล้องกับตัวอย่างในเอกสารข้อกำหนด |
| **AR-09** | *(เพิ่ม — ทีม 2 คน)* งานฝั่ง **Backend + Oracle ให้ นายเก่งกาญ เชี่ยวชาญ เป็นผู้อธิบาย** งานฝั่ง **Flutter/UI + เอกสาร ให้ นางสาวสุขสรร มาณีศรี เป็นผู้อธิบาย** เพื่อให้ทั้งคู่เข้าใจโค้ดทั้งระบบและพร้อมตอบคำถามอาจารย์ |
| **AR-10** | *(เพิ่ม — ทีม 2 คน)* ใช้ **Pair Programming 15 นาทีทุกวัน** (ช่วง AI Sync) เพื่อถ่ายทอดความรู้ข้ามฝั่ง ลดความเสี่ยง "คนเดียวเข้าใจโค้ด" |
| **AR-11** | *(เพิ่ม — ตัด Web)* AI ต้องไม่เสนอโค้ด React / Web เด็ดขาด เพราะอยู่นอกขอบเขต — ถ้าได้โค้ดลักษณะนั้นให้ปฏิเสธทันที |

### 18.1.3 Prompt Library (คลัง Prompt สำเร็จรูป)

เก็บไว้ที่ `docs/ai-prompts/` เพื่อใช้ซ้ำในทุก Sprint

| # | ชื่อ Prompt | ใช้ทำอะไร | โครงสร้าง Prompt |
|---|---|---|---|
| P-01 | `requirement-to-usecase` | Requirement → Use Case | "จาก Requirement [text] จงสร้าง Use Case Diagram พร้อม Use Case Specification ที่มี Precondition / Postcondition / Business Rule ... ใช้ PlantUML" |
| P-02 | **`oracle-ddl`** | Schema → Oracle DDL | "สร้าง **Oracle** DDL จาก ER [schema] ใช้ `GENERATED ... AS IDENTITY`, `VARCHAR2(n CHAR)`, `TIMESTAMP`, `CHECK CONSTRAINT` แทน ENUM, `COMMENT ON COLUMN`, Index สำหรับรายงาน — **ห้ามใช้ syntax ของ MySQL**" |
| P-03 | **`plsql-bulk-seed`** | ข้อมูลปริมาณมาก | "เขียน PL/SQL block ใส่ [จำนวน] แถวลงตาราง [table] ด้วย `FORALL` + `BULK COLLECT` ให้ข้อมูลสมจริงหลากหลายตามตัวอย่างในเอกสาร" |
| P-04 | `rest-endpoint` | Module → REST API | "สร้าง Express Router + Controller + Service + Repository สำหรับ [module] ใช้ `node-oracledb` **bind variables ทุก query** พร้อม validate และ error handling" |
| P-05 | `rbac-middleware` | Dynamic permission | "สร้าง middleware ตรวจสิทธิ์จากตาราง `role_permission` + `app_role` + `permission` แบบ dynamic ไม่ hardcode ห้ามมี `if (role === 'admin')`" |
| P-06 | **`oracle-report-query`** | Report → Query | "เขียน **Oracle SQL** สำหรับรายงานที่ [n] ตามข้อกำหนด [text] ใช้ `TO_CHAR`, `TRUNC(...,'IW')`, `PIVOT`, `LISTAGG`, `CASE WHEN` และอธิบายว่าควรแสดงกราฟแบบใด" |
| P-07 | **`flutter-page`** | Screen → Flutter | "สร้างหน้า [ชื่อ] ด้วย **Flutter** ใช้ `dio` เรียก REST API เก็บ token ใน `flutter_secure_storage` รองรับทั้งมือถือ/แท็บเล็ต (`LayoutBuilder`) — **ห้ามสร้างเว็บ**" |
| P-08 | `flutter-admin-table` | Data-heavy UI | "สร้างหน้าจัดการ [entity] แบบ `DataTable` + `PaginatedDataTable` + `Master-Detail` ที่ใช้งานได้ทั้งมือถือและแท็บเล็ต" |
| P-09 | `flutter-qr-scan` | D3 Scanner | "สร้างหน้าสแกน QR ด้วย `mobile_scanner` พร้อม debounce, แสดงผลสำเร็จ/ไม่สำเร็จ และป้องกันการสแกนซ้ำ" |
| P-10 | `test-case` | Requirement → Test Case | "สร้าง Test Case (ID, Precondition, Step, Expected) ครอบคลุม Business Rule BR-01…BR-12" |
| P-11 | `code-review` | โค้ด → Review | "ตรวจโค้ด [file] เน้น security, error handling, performance, transaction/locking, จุดผิดพลาดเชิงตรรกะ" |
| P-12 | `no-hardcode-check` | ตรวจ Master 2 | "ตรวจโค้ดทั้งโปรเจกต์ว่ามีการ hardcode สิทธิ์/บทบาทหรือไม่ (เช่น `role == 'admin'`, `if (isAdmin)`) รายงานตำแหน่งที่พบ" |

---

## 18.2 องค์ประกอบทีมและหน้าที่ (Team & Responsibility — 2 คน)

| สมาชิก | บทบาท (Scrum) | ความรับผิดชอบหลัก | โฟกัส Epic | ชม. โดยประมาณ |
|---|---|---|---|---|
| **นายเก่งกาญ เชี่ยวชาญ** | Developer A — **Backend & Oracle** · สลับบทบาท Scrum Master / Product Owner ตามสัปดาห์ | Oracle Schema, REST API, Business Logic, Seed Data, Performance Tuning, Test ฝั่ง Server | E1, E2, E3, E4, E5, E6 | ~86 ชม. |
| **นางสาวสุขสรร มาณีศรี** | Developer B — **Flutter & Documentation** · สลับบทบาท Product Owner / Scrum Master ตามสัปดาห์ | Flutter UI ทุกบทบาท, ER/Diagram, Mockup, เอกสารรายงาน, Agile Docs, Widget Test | E0, E7, E8, E9, E10 | ~86 ชม. |
| — | `@agent-*` | **ผู้ช่วย AI** ตาม 18.1.1 | ทุก Epic | — |

> **เหตุผลที่แยกหน้าที่แบบนี้ (ตอบคำถามอาจารย์ได้)**
> - ทีม 2 คนจึงต้อง **แบ่งงานตาม "ชั้นของระบบ"** ไม่ใช่ตามหน้าจอ เพื่อให้แต่ละคนเชี่ยวชาญเต็มที่
> - **ฝั่ง Oracle + Backend** มี Logic หนักที่ต้องอธิบายต่อหน้าคณะกรรมการ (เงื่อนไข 20 นาที, ที่นั่ง, Conflict)
> - **ฝั่ง Flutter + เอกสาร** มีงานหน้าจอ + งานเอกสารซึ่งต้องใช้เวลาเขียนมาก
> - ทั้งสองฝั่งมี **AI Agent เฉพาะ** ช่วย → ลดเวลาลงถึง 30–40%
> - **สลับบทบาท Scrum Master / Product Owner ทุกสัปดาห์** เพื่อให้ทั้งคู่เข้าใจทั้งกระบวนการ (AR-09)

> **RACI Summary (ปรับสำหรับทีม 2 คน)**
> - **A (Accountable)** : ผู้ถือ Product Owner สัปดาห์นั้น
> - **R (Responsible)** : เจ้าของ Task (ถ้าเป็นงานร่วม → ทั้ง 2 คนเป็น R)
> - **C (Consulted)** : อีกสมาชิก 1 คน + AI Agent
> - **I (Informed)** : อาจารย์ที่ปรึกษา

### 18.2.1 ตารางสลับบทบาทตามสัปดาห์ (Rotation)

| สัปดาห์ | Scrum Master | Product Owner |
|---|---|---|
| 1 | นายเก่งกาญ เชี่ยวชาญ | นางสาวสุขสรร มาณีศรี |
| 2 | นางสาวสุขสรร มาณีศรี | นายเก่งกาญ เชี่ยวชาญ |
| 3 (2 วัน) | นายเก่งกาญ เชี่ยวชาญ | นางสาวสุขสรร มาณีศรี |

> เหตุผล: ทีม 2 คนต้องหมุนเวียนบทบาท เพื่อให้ทั้งคู่มีทักษะด้านการจัดการโครงการด้วย

---

## 18.3 กรอบเวลา Scrum ใน 1 วัน (Scrum Ceremonies — Daily Mon–Sat)

```
┌─────────────── 1 วันทำงาน (09:00 – 18:00) · ทำซ้ำทุก จันทร์–เสาร์ ───────────────┐
│                                                                                 │
│  09:00 – 09:15  │ Sprint Planning      │ เลือก Task จาก Backlog → Sprint Backlog   │
│                 │                      │ ประมาณการชั่วโมง + กำหนด Sprint Goal      │
│─────────────────│──────────────────────│──────────────────────────────────────────│
│                 │                      │                                            │
│  10:00 – 10:15  │ ★ DAILY STAND-UP ★  │ 3 คำถาม (ทำอะไรไปแล้ว / จะทำอะไรต่อไป /  │
│                 │ (ทุกวัน จ.–ส.)       │ ติดอะไร) + เวลาที่ใช้จริงแต่ละงาน          │
│                 │                      │ ⚡ สั้นที่สุด ไม่เกิน 15 นาที (ตั้งเวลา)     │
│                 │                      │ 📄 บันทึก `docs/agile/standup/YYYY-MM-DD.md`  │
│─────────────────│──────────────────────│──────────────────────────────────────────│
│                 │                      │                                            │
│  14:00 – 14:15  │ AI Sync + Pair Prog. │ ตรวจงานค้างของ AI Agent · ถ่ายทอดความรู้ │
│                 │ (ตาม AR-10)          │ ข้ามฝั่ง เก่งกาญ ↔ สุขสรร 15 นาที            │
│─────────────────│──────────────────────│──────────────────────────────────────────│
│                 │                      │                                            │
│  16:30 – 17:00  │ Sprint Review        │ Demo งานที่เสร็จ → อาจารย์/เพื่อนให้ Feedback│
│                 │                      │ อัปเดต Backlog และ Priority                    │
│─────────────────│──────────────────────│──────────────────────────────────────────│
│                 │                      │                                            │
│  17:00 – 17:30  │ Sprint Retrospective │ ไปดี / ไปแย่ / ปรับปรุง / Action Items      │
│                 │                      │ 📄 `docs/agile/retro/sprint-XX.md`             │
│─────────────────│──────────────────────│──────────────────────────────────────────│
│  17:30 – 18:00  │ Commit + Update      │ git commit/push (สลับกัน push) + ปิด Task    │
└─────────────────────────────────────────────────────────────────────────────────┘

★ = การประชุม Daily ตามที่ทีมกำหนด : จันทร์, อังคาร, พุธ, พฤหัสบดี, ศุกร์, เสาร์
```

> **กติกาการทำงานร่วมกันของทีม 2 คน**
> 1. **พักเที่ยง 12:00–13:00** — ถ้ามี Task ไม่เสร็จ ให้พูดคุยกันตอนพักแทน (ประหยัดเวลาและได้ความเห็น)
> 2. **Push โค้ดสลับกัน** — วันจันทร์–พุธ เก่งกาญ push, วันพฤหัสบดี–เสาร์ สุขสรร push
> 3. **ไม่มีการทำงานล่วงเวลาโดยคนเดียว** — ถ้าติดปัญหานานกว่า 30 นาที ต้องขอความช่วยเหลือทันที
> 4. **วันอาทิตย์หยุด** — ประชุม Sprint ถัดไปถ้ากลับมาคิดตก ให้นั่นเป็นเวลา Catch-up

### 18.3.1 Template : Daily Stand-up (ไฟล์ `docs/agile/standup/YYYY-MM-DD.md`)

> **ต้องมีไฟล์นี้ 14 ไฟล์** (จันทร์ – เสาร์)

```markdown
# Stand-up — วันที่ YYYY-MM-DD (Sprint 6)

| สมาชิก | เมื่อวานทำอะไร | วันนี้จะทำอะไร | ติดอะไร |
|---|---|---|---|
| นายเก่งกาญ เชี่ยวชาญ | T-026 Route_Stop API + ที่นาที (2.5 ชม.) | T-027 Auto-calc total_minutes (1 ชม.) → T-024 Stop CRUD (2 ชม.) | — |
| นางสาวสุขสรร มาณีศรี | รีวิว ER Diagram v2 + `route_stop` mapping (1.5 ชม.) | T-028 Flutter: จุดจอด + เส้นทาง (4.5 ชม.) | รอยืนยันจากอาจารย์เรื่อง BR-04 |
| `@agent-coder` | สร้าง Node Router 2 module | รอ Code Review (AR-02) | — |

**Blocker**: ...
**AI Sync 14:00**: หัวข้อที่ถ่ายทอดความรู้ = ...
**Sprint Goal วันนี้**: ... · **ต้องเสร็จภายในวันนี้** เพื่อไม่กระทบงานพรุ่งนี้
```

### 18.3.2 Template : Sprint Retrospective

```markdown
# Retrospective — Sprint XX (วันที่ …)

## 👍 สิ่งที่ทำได้ดี
- AI (`@agent-oracle`) ช่วยเขียน `01_schema.sql` ลดเวลาจาก 5 ชม. เหลือ 1.5 ชม.
- แยก Task เล็กทำให้ปิดงานได้จริงทุกวัน
- Pair Programming 15 นาทีช่วยให้ทั้ง 2 คนเข้าใจทั้ง Backend และ Flutter

## 👎 สิ่งที่ต้องปรับปรุง
- Prompt P-04 ยังสร้าง SQL ที่ไม่ใช้ Bind Variable → ต้องเพิ่ม "ห้ามต่อสตริงใน SQL"
- Conflict check ของคนขับใช้เวลานานกว่าที่ประมาณไว้ 2 เท่า

## 🔧 Action Item (ติดตาม Sprint ถัดไป)
- [ ] แก้ Prompt P-04 ให้ระบุเรื่อง Bind Variable  (ผู้รับผิดชอบ: นายเก่งกาญ, 0.5 ชม.)
- [ ] แบ่ง T-031 เป็น 2 Task ย่อย  (ผู้รับผิดชอบ: นายเก่งกาญ, 0.5 ชม.)
```

### 18.3.3 Definition of Ready (DoR) — Task พร้อมเริ่มได้เมื่อ
- [ ] เขียน Acceptance Criteria ชัดเจน
- [ ] ระบุ Requirement ID ที่เกี่ยวข้อง
- [ ] ประเมินเวลาไม่เกิน 3 ชั่วโมง (เพราะ Sprint = 1 วัน และมีผู้ช่วย AI)
- [ ] ไม่มี Dependency กับ Task ที่ยังไม่เสร็จ
- [ ] มี Mockup / Reference (ถ้าเป็นงาน UI)
- [ ] มี Prompt Template ที่จะใช้กับ AI (ถ้าเป็นงานที่ใช้ AI)

### 18.3.4 Definition of Done (DoD) — Task ถือว่าเสร็จเมื่อ
- [ ] โค้ด Push ขึ้น Git และผ่าน Code Review โดยอีกสมาชิก 1 คน (AR-02)
- [ ] รันบนเครื่องจริง/Emulator แล้ว **ทำงานถูกต้อง** (AR-05)
- [ ] ผ่าน Unit/Integration Test ที่เกี่ยวข้อง
- [ ] ผ่านเกณฑ์ Business Rule ที่เกี่ยวข้องในตาราง **BR-01…BR-12**
- [ ] มีเอกสาร/Comment ที่เพียงพอ (เฉพาะโค้ดส่วนที่ซับซ้อน)
- [ ] Task ถูกเปลี่ยนเป็น **Done** ใน ClickUp พร้อมเวลาที่ใช้จริง
- [ ] บันทึกใน Sprint Report

---

## 18.4 Product Backlog (รายการงานทั้งหมด)

| Epic | รหัส | ชื่อ Epic | คะแนนที่เกี่ยวข้อง |
|---|---|---|---|
| E0 | — | โครงการ & เอกสารประกอบ | 30 คะแนน (ER 10 + Agile 10 + Mockup 10) |
| E1 | — | Database (Oracle) | รองรับทุกส่วน |
| E2 | M1 M2 M3 | Master File (พนักงาน / สิทธิ์ / Login) | 8 คะแนน |
| E3 | F1 F2 | ระบบ Front (เส้นทาง / รอบ / รถ) | 5 คะแนน |
| E4 | B1–B3 | ระบบการจองรถ | 9 คะแนน |
| E5 | D1–D4 | ระบบสำหรับคนขับรถ | 6 คะแนน |
| E6 | R1 R4 R6 | ระบบรายงาน (เลือก 1 จาก {1,2} + 1 จาก {3,4,5} + 1 จาก {6,7}) | 10+7+7 = 24 คะแนน |
| E7 | — | Flutter : Admin / Staff / Customer | — |
| E8 | — | Flutter : Driver | — |
| E9 | — | ทดสอบ & ยืนยันการทำงาน | — |
| E10 | — | เอกสารรายงาน & ส่งมอบ | — |

> ⚠️ **ไม่มี Epic สำหรับ Web/React** เพราะอยู่นอกขอบเขต (บทที่ 17 หัวข้อ 17.0)

### 18.4.1 Task Breakdown ทั้งหมด (62 Task / 178 ชั่วโมง)

| Task ID | Epic | งาน | Req. | ชม. | Owner | AI Agent | Sprint |
|---|---|---|---|---|---|---|---|
| **T-001** | E0 | Git Repo + โครงสร้างโปรเจกต์ + `.gitignore` + ติดตั้ง Oracle XE 19c | — | 3 | เก่งกาญ | `@agent-coder` | 0 |
| **T-002** | E0 | ติดตั้ง Android Studio + Flutter SDK + ทดสอบ Emulator | — | 3 | สุขสรร | — | 0 |
| **T-003** | E0 | ตั้ง ClickUp: Workspace / Project / List / Sprint | — | 1 | สุขสรร | — | 0 |
| **T-004** | E0 | Requirement → Use Case Diagram + Use Case Spec | M1–M3, B, D | 5 | ทั้งคู่ | `@agent-architect` | 0 |
| **T-005** | E1 | ER Diagram (Conceptual → Logical → Physical) + Mapping | F1 | 4 | สุขสรร | `@agent-architect` | 1 |
| **T-006** | E1 | Data Dictionary ทุกตาราง (พร้อม `COMMENT ON`) | F1 | 3 | สุขสรร | `@agent-doc` | 1 |
| **T-007** | E1 | **`01_schema.sql`** — Oracle DDL (Identity, FK, CHECK, Index, Comment) | F1 | 5 | เก่งกาญ | `@agent-oracle` | 1 |
| **T-008** | E1 | **`02_seed_master.sql` + `03_seed_front.sql`** (เส้นทาง 1/2/3, รอบ 9.30/11.00/13.00/15.00) | F1, F2 | 4 | เก่งกาญ | `@agent-oracle` | 2 |
| **T-009** | E0 | **Mockup (Figma) ทั้งระบบ — เฉพาะหน้าจอ Flutter** | E7, E8 | 5 | สุขสรร | `@agent-ui` | 2 |
| **T-010** | E0 | DFD (Context / Lv0 / Lv1) + Sequence Diagram | F1, B3 | 3 | สุขสรร | `@agent-architect` | 3 |
| **T-011** | E2 | ตั้งโปรเจกต์ Backend + config + **node-oracledb Connection Pool** | — | 3 | เก่งกาญ | `@agent-coder` | 3 |
| **T-012** | E2 | Middleware: errorHandler, validate, logger, audit | — | 2 | เก่งกาญ | `@agent-coder` | 3 |
| **T-013** | E7 | **Flutter setup**: routing, theme, `dio`, `flutter_secure_storage`, **Adaptive Shell** | — | 4 | สุขสรร | `@agent-ui` | 3 |
| **T-014** | E0 | เขียน OpenAPI/Swagger spec ของทุก Endpoint | — | 2 | เก่งกาญ | `@agent-doc` | 2 |
| **T-015** | E2 | **Login / Logout API + JWT + token_blacklist** | **M3** | 3 | เก่งกาญ | `@agent-coder` | 4 |
| **T-016** | E2 | **Employee CRUD API + Department / Job_Position CRUD API** | **M1** | 4 | เก่งกาญ | `@agent-coder` | 4 |
| **T-017** | E7 | Flutter: หน้า Login + เปลี่ยนรหัสผ่าน | M3 | 2 | สุขสรร | `@agent-ui` | 4 |
| **T-018** | E7 | Flutter: หน้าจัดการพนักงาน + แผนก/ตำแหน่ง (DataTable + Form) | **M1** | 3 | สุขสรร | `@agent-ui` | 4 |
| **T-019** | E2 | Role CRUD API (เพิ่ม/ลบ/แก้ไข) | **M2** | 2 | เก่งกาญ | `@agent-coder` | 5 |
| **T-020** | E2 | Permission CRUD API | M2 | 1.5 | เก่งกาญ | `@agent-coder` | 5 |
| **T-021** | E2 | Role ↔ Permission Mapping API | M2 | 1.5 | เก่งกาญ | `@agent-coder` | 5 |
| **T-022** | E2 | **RBAC Middleware แบบ Dynamic (ไม่ hardcode)** | **M2** | 2.5 | เก่งกาญ | `@agent-review` | 5 |
| **T-023** | E7 | Flutter: หน้า Permission Matrix (ตารางติ๊ก) + **Dynamic Menu** | **M2** | 4.5 | สุขสรร | `@agent-ui` | 5 |
| **T-024** | E3 | Stop CRUD API (จุดจอดใช้ซ้ำได้หลายเส้นทาง) | **F1** | 2 | เก่งกาญ | `@agent-coder` | 6 |
| **T-025** | E3 | Route CRUD API | F1 | 2 | เก่งกาญ | `@agent-coder` | 6 |
| **T-026** | E3 | Route_Stop API (ลำดับจุดจอด + นาที) | **F1** | 2.5 | เก่งกาญ | `@agent-coder` | 6 |
| **T-027** | E3 | **Auto-calc `total_minutes` (BR-01)** | **F1** | 1 | เก่งกาญ | `@agent-coder` | 6 |
| **T-028** | E7 | Flutter: จุดจอด + เส้นทาง (แสดงเวลารวมอัตโนมัติ) | F1 | 4.5 | สุขสรร | `@agent-ui` | 6 |
| **T-029** | E3 | Vehicle / Vehicle_Type CRUD API (คู่กับ Flutter ที่ใช้ข้อมูลรถ) | **F2** | 2 | สุขสรร | `@agent-coder` | 7 |
| **T-030** | E3 | **Schedule CRUD + auto-generate `schedule_stop` (BR-02)** | **F2** | 2.5 | เก่งกาญ | `@agent-coder` | 7 |
| **T-031** | E3 | **Driver Assignment + Conflict Check (BR-04)** | **F2** | 2.5 | เก่งกาญ | `@agent-coder` | 7 |
| **T-032** | E3 | **Vehicle Assignment + Conflict Check (BR-04)** | **F2** | 2 | เก่งกาญ | `@agent-coder` | 7 |
| **T-033** | E7 | Flutter: ปฏิทินรอบเวลา + มอบหมาย + **Conflict Alert** | F2 | 5 | สุขสรร | `@agent-ui` | 7 |
| **T-034** | E4 | `/booking/available` — กรองรอบตาม **BR-05 (20 นาที)** | **B1** | 2.5 | เก่งกาญ | `@agent-coder` | 8 |
| **T-035** | E4 | ตรวจที่นั่งว่าง + Transaction + **`FOR UPDATE NOWAIT`** (BR-07) | **B1** | 2.5 | เก่งกาญ | `@agent-coder` | 8 |
| **T-036** | E4 | ตรวจจำนวนที่นั่งไม่เกิน 4 (BR-06) | **B1** | 0.5 | เก่งกาญ | `@agent-coder` | 9 |
| **T-037** | E4 | สร้าง Booking + **Generate QR Token** (Sequence `seq_booking_code`) | **B2** | 2 | เก่งกาญ | `@agent-coder` | 8 |
| **T-038** | E4 | ยกเลิก Booking + **คืนที่นั่ง** (BR-08) | **B3** | 1.5 | เก่งกาญ | `@agent-coder` | 9 |
| **T-039** | E4 | My Bookings + filter (กำลังจะถึง/เสร็จแล้ว/ยกเลิก) | B2, B3 | 2 | สุขสรร | `@agent-coder` | 9 |
| **T-040** | E7 | Flutter: จุดขึ้น–ลง → รอบ → ที่นั่ง → ยืนยัน | **B1** | 5 | สุขสรร | `@agent-ui` | 8 |
| **T-041** | E7 | Flutter: แสดง QR Code + My Booking + ยกเลิก | **B2, B3** | 4 | สุขสรร | `@agent-ui` | 9 |
| **T-042** | E2 | Backend: Audit Log + API Logging | — | 3 | เก่งกาญ | `@agent-coder` | 9 |
| **T-043** | E5 | Driver: **ตารางงานรายวัน** API | **D1** | 2 | เก่งกาญ | `@agent-coder` | 10 |
| **T-044** | E5 | **Start Trip** API + แจ้งเตือนงานชนกัน | **D2** | 2 | เก่งกาญ | `@agent-coder` | 10 |
| **T-045** | E5 | **Manifest** API (ขึ้น/ลง รายจุดจอด + ชื่อ) ใช้ `LISTAGG` | **D2** | 2 | เก่งกาญ | `@agent-coder` | 10 |
| **T-046** | E5 | **QR Scan Validate API** (ผิดรอบขึ้นไม่ได้) (BR-09) | **D3** | 2 | เก่งกาญ | `@agent-coder` | 10 |
| **T-047** | E5 | **Complete Trip + Mark No-Show + Summary** (BR-10) | **D4** | 2.5 | เก่งกาญ | `@agent-coder` | 11 |
| **T-048** | E8 | Flutter: ตารางงานรายวัน + เริ่มเดินทาง + แจ้งเตือนงานชนกัน | D1, D2 | 2.5 | สุขสรร | `@agent-ui` | 10 |
| **T-049** | E8 | Flutter: Manifest ผู้โดยสารรายจุดจอด | D2 | 3 | สุขสรร | `@agent-ui` | 10 |
| **T-050** | E8 | Flutter: **สแกน QR** ด้วย `mobile_scanner` | **D3** | 3 | สุขสรร | `@agent-ui` | 11 |
| **T-051** | E8 | Flutter: ปิดงาน + สรุปยอด + รายชื่อ No Show | **D4** | 3 | สุขสรร | `@agent-ui` | 11 |
| **T-052** | E6 | **`04_seed_report_bulk.sql`** — ข้อมูลปี พ.ศ. 2568 ด้วย `FORALL` (≥ 50,000 แถว) | R1 R4 R6 | 5 | เก่งกาญ | `@agent-oracle` | 11 |
| **T-053** | E6 | **`05_views_report.sql`** — Oracle `VIEW` ช่วย Aggregate | R1 R4 R6 | 2.5 | สุขสรร | `@agent-data` | 11 |
| **T-054** | E6 | Report API : รายงานที่ 1 (คนขึ้น/ลง รายสัปดาห์ เทียบกัน) | **R1** | 3 | เก่งกาญ | `@agent-data` | 12 |
| **T-055** | E6 | Report API : รายงานที่ 4 (สรุปยอดรายวัน × เส้นทาง ใช้ `PIVOT` + คอลัมน์รวมทั้งวัน) | **R4** | 3 | สุขสรร | `@agent-data` | 12 |
| **T-056** | E6 | Report API : รายงานที่ 6 (รอบงานคนขับ ก่อน/หลัง 17:00 ใช้ Analytic + `ROLLUP`) | **R6** | 2.5 | เก่งกาญ | `@agent-data` | 12 |
| **T-057** | E6 | Oracle: `EXPLAIN PLAN` + **Index Tuning** ให้รายงาน < 3 วินาที | NFR | 2 | เก่งกาญ | `@agent-data` | 13 |
| **T-058** | E7 | Flutter: หน้ารายงาน R1 + กราฟ `fl_chart` + เลือกปี 2568 | **R1** | 3.5 | สุขสรร | `@agent-ui` | 12 |
| **T-059** | E7 | Flutter: หน้ารายงาน R4 + R6 + กราฟ + เลือกช่วงวันที่ | **R4, R6** | 4 | สุขสรร | `@agent-ui` | 13 |
| **T-060** | E9 | เขียน **Test Plan + Test Case** ตาม BR-01…BR-12 (ใช้เป็น Test Case จริง) | ทั้งหมด | 2 | ทั้งคู่ | `@agent-test` | 12 |
| **T-061** | E10 | Traceability Matrix + เอกสารรายงานบทที่ 1–18 + **AI Usage Credit / Prompt Log** + `README.md` | ทั้งหมด | 5.5 | ทั้งคู่ | `@agent-doc` | 13 |
| **T-062** | E9 | **ทดสอบจริงทั้งระบบ** ตาม Test Case + บันทึกผล + แก้ Defect ที่เจอ | ทั้งหมด | 3 | ทั้งคู่ | `@agent-test` | 13 |

> **รวม 62 รายการงาน (Task)** · **178 ชั่วโมงงาน** · 2 คน + AI
> เฉลี่ย **6.4 ชั่วโมง/คน/วัน** (เก่งกาญ 90.75 / สุขสรร 87.25) พอดีกับเวลาที่ใช้ได้จริง
> (09:00–18:00 บาง 1 ชม. + กิจกรรม 1.5 ชม. ≈ 6.5 ชม.)
> ดูรายละเอียดการกระจายภาระแต่ละ Sprint ที่ **18.7.5**
> **เวลาที่ใช้จริงต่อคนต่อวัน ≈ 6 ชั่วโมง** → 14 วันทำงาน = จันทร์–เสาร์ 2 สัปดาห์ + 2 วัน ✅
>
> ⚠️ **แผนนี้ไม่มี Buffer Sprint** หากงานตกจาก Sprint ใด ต้องเขียน Action Item ใน Retro และเลื่อนงานเอกสาร (T-061) ไปทำต่อหลังส่ง

---

## 18.5 Sprint Backlog และ Sprint Goal

| Sprint | วัน | Sprint Goal | Task | ชม. | คะแนนที่ปิด |
|---|---|---|---|---|---|
| **Sprint 0** | จ. 1 | เครื่องมือพร้อม (Oracle + Flutter) + Requirement เป็นรูปธรรม | T-001…T-004 | 12 | Agile 10 (เริ่ม) |
| **Sprint 1** | อ. 2 | ⭐ **ฐานข้อมูล Oracle** + ER Diagram + Data Dictionary | T-005…T-007 | 12 | **ER 10** |
| **Sprint 2** | พ. 3 | Seed ตามตัวอย่าง + **Mockup 10 คะแนน** + โครงร่าง API | T-008, T-009, T-014 | 11 | **Mockup 10** |
| **Sprint 3** | พฤ. 4 | Backend Skeleton (Oracle) + Flutter Skeleton + DFD/Sequence | T-010…T-013 | 12 | — |
| **Sprint 4** | ศ. 5 | ⭐ **Master 1 + Master 3** (พนักงาน + Login) | T-015…T-018 | 12 | **M1 3 + M3 2** |
| **Sprint 5** | ส. 6 | ⭐ **Master 2** สิทธิ์ Dynamic | T-019…T-023 | 12 | **M2 3** |
| **Sprint 6** | จ. 7 | ⭐ **Front 1** เส้นทาง + เวลารวม | T-024…T-028 | 12 | **F1 2** |
| **Sprint 7** | อ. 8 | ⭐ **Front 2** รอบเวลา + มอบหมาย + Conflict | T-029…T-033 | 14 | **F2 3** |
| **Sprint 8** | พ. 9 | ⭐⭐ **ระบบจอง API** ผ่าน Business Rule + เริ่มหน้าจอจอง | T-034, T-035, T-037, T-040 | 12 | **B1 5** |
| **Sprint 9** | พฤ. 10 | ⭐⭐ จองเสร็จสมบูรณ์ + QR + ยกเลิก + Audit Log | T-036, T-038, T-039, T-041, T-042 | 11 | **B2 1 + B3 3** |
| **Sprint 10** | ศ. 11 | ⭐⭐ **ระบบคนขับ API** + หน้าจอตารางงาน/Manifest | T-043…T-046, T-048, T-049 | 13.5 | **D1 1 + D2 1 + D3 1** |
| **Sprint 11** | ส. 12 | ปิดงานคนขับ + **ข้อมูลรายงานปี 2568** (Oracle) | T-047, T-050…T-053 | 16 | **D4 2** |
| **Sprint 12** | จ. 13 | Report API 3 ข้อ + หน้ารายงาน R1 + Test Plan | T-054…T-056, T-058, T-060 | 14 | **R1 3** |
| **Sprint 13** | อ. 14 | 🎤 Report R4/R6 + Tuning + ทดสอบ + เอกสาร + Demo | T-057, T-059, T-061, T-062 | 14.5 | **R4 2 + R6 2 + Agile 10 ปิด** |
| **รวม** | **14 วัน** | **62 Task** | **T-001…T-062** | **178** | **64 SP** (สเกลสมดุล 100 คะแนนของอาจารย์) |

> **หมายเหตุ:** Sprint 10, 11, 13 หนักกว่าปกติเล็กน้อย เพราะเป็น Sprint ที่ต้องทำงานข้ามฝั่ง (Backend + Flutter พร้อมกัน)
> ดูภาระรายคนในแต่ละ Sprint ที่ **18.7.5** · หากทำไม่ทันให้ใช้กติกาในข้อ 18.9 R3 และ 18.9 R9

### 18.5.1 Sprint Goal เป็นรูปแบบ SMART
> ❌ ที่ไม่ดี : *"ทำระบบจองรถให้เสร็จ"*
> ✅ ที่ดี : *"Sprint 8 ต้องปิด T-034…T-039 ครบ 6 Task เพื่อให้ API การจองรองรับ
> BR-05, BR-06, BR-07, BR-08 ผ่านการทดสอบ และพร้อมให้ Sprint 9 ทำ UI ได้ทันที"*

---

## 18.6 Sprint Plan (รายละเอียดราย Sprint)

> **ทุก Sprint มี 3 กิรยา:** เป้าหมาย → ตารางงาน → **Definition of Done ที่ต้องผ่านก่อนปิด Sprint**
> วันทำงาน : จันทร์ / อังคาร / พุธ / พฤหัสบดี / ศุกร์ / เสาร์

### 🗓 Sprint 0 — จันทร์ที่ 1 : Foundation
**Sprint Goal:** ทั้ง 2 คนมีเครื่องมือพร้อม และมีโครงสร้างเก็บงานเรียบร้อย

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-001 | Git Repo + โครงสร้าง + `.gitignore` + **ติดตั้ง Oracle XE 19c** | เก่งกาญ | 3 | `@agent-coder` | `sqlplus` เชื่อมต่อได้ |
| T-002 | **ติดตั้ง Android Studio + Flutter SDK** + ทดสอบ Emulator | สุขสรร | 3 | — | `flutter run` ได้ |
| T-003 | ClickUp Project + Sprint List | สุขสรร | 1 | — | ทุก Task ลง ClickUp |
| T-004 | Requirement → Use Case Diagram + Spec | ทั้งคู่ | 5 | `@agent-architect` | ไดอะแกรม PlantUML |

**DoD วันนี้:** `git log` มี ≥ 1 commit · Oracle เชื่อมต่อได้ · Emulator เปิดแอปว่างได้ · ClickUp มี Backlog ครบ · Stand-up ไฟล์แรกถูกสร้าง

---

### 🗓 Sprint 1 — อังคารที่ 2 : Oracle Database Design ⭐
**Sprint Goal:** ฐานข้อมูล Oracle สร้างได้จริง + เอกสาร ER ครบ

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-005 | ER Diagram 3 ระดับ + Mapping | สุขสรร | 4 | `@agent-architect` | **ER + Mapping (10 คะแนน)** |
| T-006 | Data Dictionary | สุขสรร | 3 | `@agent-doc` | ตารางศัพท์ทุกตาราง |
| T-007 | `01_schema.sql` (Oracle DDL) | เก่งกาญ | 5 | `@agent-oracle` | รันบน Oracle 19c ไม่มี error |

**DoD:** ✅ รัน `01_schema.sql` บน Oracle 19c ผ่าน **0 error** · มีตารางครบตาม ER
· มี `COMMENT ON COLUMN` ครบทุกคอลัมน์สำคัญ · ไม่มีชื่อตารางชนกับคำสงวน
**คะแนนที่ปิด:** ER + Mapping = **10**

---

### 🗓 Sprint 2 — พุธที่ 3 : Seed + Mockup + DFD ⭐
**Sprint Goal:** ปิดคะแนน Mockup 10 และมีข้อมูลตามตัวอย่างในเอกสาร

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-008 | `02_seed_master.sql` + `03_seed_front.sql` | เก่งกาญ | 4 | `@agent-oracle` | 3 เส้นทาง (7/4/5 จุด), รอบ 9.30/11.00/13.00/15.00 |
| T-009 | **Mockup ทั้งระบบ (Figma)** | สุขสรร | 5 | `@agent-ui` | หน้าจอ Flutter ครบทุกบทบาท (**10 คะแนน**) |
| T-014 | OpenAPI / Swagger spec (ร่างโครงสร้าง Endpoint) | เก่งกาญ | 2 | `@agent-doc` | โครงร่าง API ทั้งหมด |

**DoD:** ✅ `total_minutes` เส้นทาง 1 = **30**, เส้นทาง 2 = **13**, เส้นทาง 3 = **12**
· Mockup อัปโหลดขึ้น ClickUp + Git แล้ว · **ไม่มีหน้าจอ Web/React ใน Mockup**
**คะแนนที่ปิด:** Mockup = **10**

---

### 🗓 Sprint 3 — พฤหัสบดีที่ 4 : Backend + Flutter Skeleton + DFD
**Sprint Goal:** Backend เชื่อม Oracle ได้, Flutter เปิดแอปได้ และมีไดอะแกรม DFD ครบ

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-011 | Backend setup + **node-oracledb Pool** | เก่งกาญ | 3 | `@agent-coder` | `GET /health` ตอบ OK + เชื่อม Oracle สำเร็จ |
| T-012 | Middleware (error/validate/logger/audit) | เก่งกาญ | 2 | `@agent-coder` | ทุก route ผ่าน errorHandler |
| T-013 | Flutter setup + **Adaptive Shell** | สุขสรร | 4 | `@agent-ui` | เปิดแอปได้ · สลับเมนูมือถือ/แท็บเล็ตได้ |
| T-010 | DFD (Context / Lv0 / Lv1) + Sequence Diagram | สุขสรร | 3 | `@agent-architect` | 5 ไดอะแกรม |

**DoD:** ✅ `flutter run` ได้บน Emulator · เปลี่ยนขนาดจอแล้วเมนูเปลี่ยนอัตโนมัติ · ไดอะแกรม DFD ครบทุกระดับ

---

### 🗓 Sprint 4 — ศุกร์ที่ 5 : Master 1 + Master 3 ⭐
**Sprint Goal:** Login/Logout ทำงาน และจัดการพนักงานได้ครบ

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-015 | Login/Logout + JWT + token_blacklist | เก่งกาญ | 3 | `@agent-coder` | `/auth/login` คืน token + permissions |
| T-016 | **Employee + Department + Job_Position CRUD API** | เก่งกาญ | 4 | `@agent-coder` | เพิ่ม/แก้ไข/ลบได้ |
| T-017 | Flutter: Login + เปลี่ยนรหัสผ่าน | สุขสรร | 2 | `@agent-ui` | Interceptor จัดการ 401 |
| T-018 | Flutter: หน้าจัดการพนักงาน (DataTable) | สุขสรร | 3 | `@agent-ui` | ครบ Create/Read/Update/Delete |

**DoD:** ✅ เพิ่มพนักงานพร้อมแผนก+ตำแหน่ง → Login → เห็นในตาราง → แก้ไข → ลบ
· Logout แล้วใช้ token เดิมต่อไม่ได้ · เปิดบนแท็บเล็ตตารางไม่ล้นจอ
**คะแนนที่ปิด:** M1 = **3**, M3 = **2**

---

### 🗓 Sprint 5 — เสาร์ที่ 6 : Master 2 Dynamic Permission ⭐
**Sprint Goal:** เปลี่ยนสิทธิ์แล้วเมนูเปลี่ยนทันทีโดยไม่แก้โค้ด

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-019 | Role CRUD | เก่งกาญ | 2 | `@agent-coder` | เพิ่ม/ลบ/แก้ Role ได้ |
| T-020 | Permission CRUD | เก่งกาญ | 1.5 | `@agent-coder` | — |
| T-021 | Role ↔ Permission Mapping | เก่งกาญ | 1.5 | `@agent-coder` | — |
| T-022 | **RBAC Dynamic Middleware** | เก่งกาญ | 2.5 | `@agent-review` | ไม่มี `if(role==='admin')` |
| T-023 | Flutter: Permission Matrix + Dynamic Menu | สุขสรร | 4.5 | `@agent-ui` | ตารางติ๊กบันทึกได้ |

**DoD:** ✅ ถอดสิทธิ์ `EMPLOYEE.VIEW` จาก Role Staff → เมนู "พนักงาน" หายจากแอปทันที
· รัน Prompt P-12 (`no-hardcode-check`) แล้ว **ไม่พบการ hardcode**
**คะแนนที่ปิด:** M2 = **3**

---

### 🗓 Sprint 6 — จันทร์ที่ 7 : Front 1 Route ⭐
**Sprint Goal:** เส้นทาง + จุดจอด + เวลารวม ทำงานครบตาม F1

| Task | งาน | Owner | ชม. | AI |
|---|---|---|---|---|
| T-024 | Stop CRUD | เก่งกาญ | 2 | `@agent-coder` |
| T-025 | Route CRUD | เก่งกาญ | 2 | `@agent-coder` |
| T-026 | Route_Stop + นาที | เก่งกาญ | 2.5 | `@agent-coder` |
| T-027 | **Auto-calc total_minutes (BR-01)** | เก่งกาญ | 1 | `@agent-coder` |
| T-028 | Flutter: จุดจอด + เส้นทาง | สุขสรร | 4.5 | `@agent-ui` |

**DoD:** ✅ เพิ่มจุดจอด 7 จุดในเส้นทาง 1 → ระบบรวมเวลาได้ **30 นาทีอัตโนมัติ**
· เพิ่ม "ร้านส้มตำปูนาง" ลงเส้นทาง 1 และ 2 ได้ (จุดจอดใช้ซ้ำได้) · แก้นาทีแล้วเวลารวมเปลี่ยนทันที
**คะแนนที่ปิด:** F1 = **2**

---

### 🗓 Sprint 7 — อังคารที่ 8 : Front 2 Schedule ⭐
**Sprint Goal:** รอบเวลา + มอบหมายคนขับ/รถ + ตรวจชนกัน

| Task | งาน | Owner | ชม. | AI |
|---|---|---|---|---|
| T-029 | Vehicle / Vehicle_Type CRUD (คู่กับ Flutter ที่ใช้ข้อมูลรถ) | สุขสรร | 2 | `@agent-coder` |
| T-030 | **Schedule + auto-generate schedule_stop (BR-02)** | เก่งกาญ | 2.5 | `@agent-coder` |
| T-031 | **Driver assign + Conflict Check (BR-04)** | เก่งกาญ | 2.5 | `@agent-coder` |
| T-032 | **Vehicle assign + Conflict Check (BR-04)** | เก่งกาญ | 2 | `@agent-coder` |
| T-033 | Flutter: ปฏิทิน + มอบหมาย + Conflict Alert | สุขสรร | 5 | `@agent-ui` |

**DoD:** ✅ สร้างรอบ 9:30 เส้นทาง 1 → ระบบสร้างจุดจอดพร้อมเวลาอัตโนมัติ
(มหาวิทยาลัย 09:30 → โลตัส 09:35 → รพ. 09:38 …)
· มอบหมายรถ สย 2591 ให้ 2 รอบที่ทับเวลากัน → ระบบแจ้ง Conflict
· แก้ไขรอบเดิมที่มีอยู่แล้วได้ (ปรับการจัดการได้ใหม่ตลอดเวลา)
**คะแนนที่ปิด:** F2 = **3**

---

### 🗓 Sprint 8 — พุธที่ 9 : Booking API + เริ่ม UI ⭐⭐ (คะแนนสูงสุด 9)
**Sprint Goal:** API การจองผ่านทุก Business Rule และเริ่มหน้าจอ Flutter ของผู้โดยสาร

| Task | งาน | Owner | ชม. | AI | เงื่อนไขที่ต้องผ่าน |
|---|---|---|---|---|---|
| T-034 | Available trip | เก่งกาญ | 2.5 | `@agent-coder` | **BR-05** เหลือเวลา ≥ 20 นาทีเท่านั้น |
| T-035 | ที่นั่ง + Transaction + `FOR UPDATE NOWAIT` | เก่งกาญ | 2.5 | `@agent-coder` | **BR-07** จองพร้อมกัน 2 คนต้องไม่เกิน capacity |
| T-037 | Create Booking + QR Token | เก่งกาญ | 2 | `@agent-coder` | **B2** ใช้ `seq_booking_code.NEXTVAL` |
| T-040 | Flutter: จุดขึ้น–ลง → รอบ → ที่นั่ง → ยืนยัน | สุขสรร | 5 | `@agent-ui` | Stepper เลือกได้ไม่เกิน 4 ที่นั่ง |

**DoD:** ✅
- จองรถที่ถึงในอีก 15 นาที → ระบบไม่แสดงรอบนั้น
- รถ 9 ที่นั่ง จองไป 8 → จองเพิ่มได้อีก **1 ที่นั่งเท่านั้น**
- เลือกจุดลงก่อนจุดขึ้น → ถูกปฏิเสธ (BR-11)
- ทดสอบ 2 request พร้อมกันด้วย Postman → ไม่มีที่นั่งเกิน
- หน้าเลือกรอบและที่นั่งเปิดได้จริงบน Emulator
**คะแนนที่ปิด:** B1 = **5**

---

### 🗓 Sprint 9 — พฤหัสบดีที่ 10 : Booking เสร็จสมบูรณ์ + QR ⭐⭐
**Sprint Goal:** ผู้ใช้จอง ดู QR และยกเลิกผ่านแอปได้จริง พร้อมเก็บ Audit Log

| Task | งาน | Owner | ชม. | AI | เงื่อนไขที่ต้องผ่าน |
|---|---|---|---|---|---|
| T-036 | ไม่เกิน 4 ที่นั่ง | เก่งกาญ | 0.5 | `@agent-coder` | **BR-06** |
| T-038 | Cancel + คืนที่นั่ง | เก่งกาญ | 1.5 | `@agent-coder` | **BR-08** |
| T-042 | Backend: Audit Log + API Logging | เก่งกาญ | 3 | `@agent-coder` | ทุก endpoint เขียน log |
| T-039 | My Bookings + filter | สุขสรร | 2 | `@agent-coder` | **BR-11, BR-12** จุดขึ้น–ลงถูกต้อง |
| T-041 | Flutter: แสดง QR + My Booking + ยกเลิก | สุขสรร | 4 | `@agent-ui` | แท็บ "กำลังจะถึง / เดินทางแล้ว / ยกเลิก" |

**DoD:** ✅
- จอง 5 ที่นั่ง → ถูกปฏิเสธทั้งที่ Service และ `CHECK CONSTRAINT`
- ยกเลิก 1 ที่นั่ง → ที่นั่งกลับมาเหลือ 1 (BR-08)
- ผู้ใช้จนถึงได้ QR · ยกเลิกแล้วที่นั่งคืนจริงใน Oracle
- แท็บ "กำลังจะถึง / เดินทางแล้ว / ยกเลิก" กรองได้ถูกต้อง
**คะแนนที่ปิด:** B2 = **1**, B3 = **3**

---

### 🗓 Sprint 10 — ศุกร์ที่ 11 : Driver API ⭐⭐
**Sprint Goal:** คนขับใช้ API ได้ครบทั้งวงจร ตั้งแต่ดูตารางจนปิดรอบ

| Task | งาน | Owner | ชม. | AI | เงื่อนไขที่ต้องผ่าน |
|---|---|---|---|---|---|
| T-043 | ตารางงานรายวัน | เก่งกาญ | 2 | `@agent-coder` | **D1** เห็นเฉพาะรอบของตัวเอง |
| T-044 | Start Trip | เก่งกาญ | 2 | `@agent-coder` | **D2** แจ้งชัดว่ามีงานอื่นค้างอยู่หรือไม่ |
| T-045 | Manifest | เก่งกาญ | 2 | `@agent-coder` | **D2** เห็นขึ้น/ลง รายจุดจอด + ชื่อ (ใช้ `LISTAGG`) |
| T-046 | QR Scan Validate | เก่งกาญ | 2 | `@agent-coder` | **D3 / BR-09** ผิดรอบ → ปฏิเสธ |
| T-048 | Flutter: ตารางงาน + เริ่มเดินทาง + เตือนงานชนกัน | สุขสรร | 2.5 | `@agent-ui` | เห็นเฉพาะงานตัวเอง |
| T-049 | Flutter: Manifest รายจุดจอด | สุขสรร | 3 | `@agent-ui` | รายชื่อผู้โดยสาร |

**DoD:** ✅
- คนขับคนเดียวกันเปิด 2 รอบพร้อมกัน → ระบบเตือนชัดเจน
- สแกน QR ของการจองรอบอื่น → ขึ้น "QR นี้ไม่ใช่รอบที่กำลังเดินรถ"
- เห็น Manifest ครบทุกจุดจอดพร้อมชื่อผู้โดยสาร
**คะแนนที่ปิด:** D1 + D2 + D3 = **4**

---

### 🗓 Sprint 11 — เสาร์ที่ 12 : ปิดงานคนขับ + ข้อมูลรายงาน (Oracle)
**Sprint Goal:** ปิดงานคนขับครบวงจร และมีข้อมูลปริมาณมากสำหรับรายงาน

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-047 | Complete + No-Show | เก่งกาญ | 2.5 | `@agent-coder` | D4 / BR-10 สรุป "มา 5 คน / ไม่มา 2 คน / ใครบ้าง" |
| T-050 | Flutter: **สแกน QR (`mobile_scanner`)** | สุขสรร | 3 | `@agent-ui` | ผิดรอบขึ้นไม่ได้ (D3) |
| T-051 | Flutter: ปิดงาน + สรุป + No Show | สุขสรร | 3 | `@agent-ui` | D4 ผ่าน |
| T-052 | **`04_seed_report_bulk.sql`** (PL/SQL `FORALL`) | เก่งกาญ | 5 | `@agent-oracle` | **ข้อมูลปี พ.ศ. 2568 จำนวนมาก** (≥ 50,000 แถว) |
| T-053 | `05_views_report.sql` (Oracle VIEW) | สุขสรร | 2.5 | `@agent-data` | View ช่วย Aggregate |

**DoD:** ✅ `booking` มี **≥ 50,000 แถว** ใน Oracle · `trip` และ `trip_passenger` สอดคล้องกัน
· สถานะครบทั้ง 5 แบบ (reserved/checked_in/completed/cancelled/no_show) และ `no_show` เป็นข้อมูลจริงในฐานข้อมูล
· สแกน QR จริงบน Android สำเร็จ · สแกนซ้ำใน 2 วินาทีไม่ถูกนับซ้ำ
**คะแนนที่ปิด:** D4 = **2**
**ข้อกำหนดสำคัญ:** ต้องเป็นการ **insert ผ่าน SQL โดยตรง** ตามหมายเหตุหน้า 4 ของเอกสาร

---

### 🗓 Sprint 12 — จันทร์ที่ 13 : Report API + หน้ารายงาน R1 ⭐⭐
**Sprint Goal:** Report API ทำงานและหน้ารายงาน R1 พร้อมกราฟใช้งานได้

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-054 | Report API R1 (คนขึ้น/ลง รายสัปดาห์) | เก่งกาญ | 3 | `@agent-data` | เลือกปี 2568 ได้ |
| T-055 | Report API R4 (รายวัน × เส้นทาง ใช้ `PIVOT`) | สุขสรร | 3 | `@agent-data` | เลือกช่วงวันที่ได้ |
| T-056 | Report API R6 (รอบงานคนขับ ก่อน/หลัง 17:00 ใช้ Analytic + `ROLLUP`) | เก่งกาญ | 2.5 | `@agent-data` | เลือกช่วงวันที่ได้ + มีกราฟแท่ง |
| T-058 | Flutter: หน้ารายงาน R1 + กราฟ `fl_chart` | สุขสรร | 3.5 | `@agent-ui` | ตาราง + กราฟ เลือกปีได้ |
| T-060 | **Test Plan + Test Case** ตาม BR-01…BR-12 | ทั้งคู่ | 2 | `@agent-test` | Test Case ครบ 12 ข้อ |

**DoD:** ✅ ทุก Query ใช้ **Bind Variable** · R4 ใช้ `PIVOT` ได้ตารางตามรูปแบบในเอกสาร (มีคอลัมน์ "รวมทั้งวัน")
· R6 แยกรอบงาน **ก่อน/หลัง 17:00** + รวมทั้งหมดด้วย `ROLLUP` · หน้ารายงาน R1 แสดงตาราง + กราฟ
**คะแนนที่ปิด:** R1 = **3 SP** → เลือกจากกลุ่ม {1,2} = **10 คะแนนจริง**

---

### 🗓 Sprint 13 — อังคารที่ 14 : 🎤 Report R4/R6 + Tuning + Test + ส่งมอบ
**Sprint Goal:** รายงานครบ 3 ข้อ ใช้งานได้จริง ทดสอบแล้ว และส่งมอบครบ

| Task | งาน | Owner | ชม. | AI | ผลลัพธ์ |
|---|---|---|---|---|---|
| T-059 | Flutter: หน้ารายงาน R4 + R6 + กราฟ | สุขสรร | 4 | `@agent-ui` | เลือกช่วงวันที่ได้ |
| T-057 | `EXPLAIN PLAN` + Index Tuning | เก่งกาญ | 2 | `@agent-data` | ทุก Query < 3 วินาที |
| T-062 | **ทดสอบจริงทั้งระบบ** ตาม Test Case + แก้ Defect | ทั้งคู่ | 3 | `@agent-test` | Test Case ผ่าน ≥ 95% |
| T-061 | Traceability Matrix + เอกสารบทที่ 1–18 + **AI Credit / Prompt Log** + `README.md` | ทั้งคู่ | 5.5 | `@agent-doc` | รายงานครบ + Tag `v1.0.0` |

**DoD:** ✅ Demo ผ่านทุกเส้นทาง (Admin → Staff → Customer → Driver) บนเครื่องจริง
· รายงานทุก Query < 3 วินาที ที่ข้อมูล 50,000 แถว
· ส่ง: รายงาน 18 บท + APK + โค้ดใน Git + เอกสาร Agile (Stand-up 14 ไฟล์, Retro 14 ไฟล์) + Mockup
· **คะแนนที่ปิด:** R4 = **2 SP** (กลุ่ม {3,4,5} = 7 คะแนนจริง) + R6 = **2 SP** (กลุ่ม {6,7} = 7 คะแนนจริง), แผนงาน Agile = **10**
· **รวมรายงานที่เลือก 3 ข้อ = 24 คะแนนจริง** (10 + 7 + 7) ครบเงื่อนไข "เลือก 1 จาก {1,2} + 1 จาก {3,4,5} + 1 จาก {6,7}"

---

## 18.7 การติดตามความคืบหน้า (Tracking)

### 18.7.1 Sprint Board (คอลัมน์ ClickUp)

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  TO DO   │→│ IN PROG. │→│  AI DEV  │→│  REVIEW  │→│   TEST   │→│   DONE   │
│ (Backlog)│ │ (doing)  │ │(agent)   │ │(อีกคน 1 คน)│ │  (QA)   │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```
> คอลัมน์ **AI DEV** แสดงว่า Task ไหนอยู่ระหว่างให้ AI ช่วยเขียน
> คอลัมน์ **REVIEW** คือจุดบังคับใช้ **AR-02** — ต้องมีอีกสมาชิกตรวจก่อนเสมอ

### 18.7.2 Velocity Chart (Story Points ต่อ Sprint)

| Sprint | SP เป้า | SP ทำได้จริง | Velocity | คะแนนที่ปิด |
|---|---|---|---|---|
| 0 | 5 | 5 | 5 | Agile 10 (เริ่ม) |
| 1 | 5 | 5 | 5 | **ER 10** |
| 2 | 5 | 5 | 5 | **Mockup 10** |
| 3 | 5 | 5 | 5 | — |
| 4 | 6 | 6 | 6 | **M1 3, M3 2** |
| 5 | 5 | 5 | 5 | **M2 3** |
| 6 | 5 | 5 | 5 | **F1 2** |
| 7 | 6 | 6 | 6 | **F2 3** |
| 8 | 6 | 6 | 6 | **B1 5** |
| 9 | 5 | 5 | 5 | **B2 1, B3 3** |
| 10 | 6 | 6 | 6 | **D1 1, D2 1, D3 1** |
| 11 | 5 | 5 | 5 | **D4 2** |
| 12 | 5 | 5 | 5 | **R1 3** |
| 13 | 6 | 6 | 6 | **R4 2, R6 2 + Agile 10 ปิด** |
| **รวม** | **75** | **75** | **75** | **~100** (สเกล SP ตัวอย่างของกราฟ) |

> **ความหมายของ Velocity:** ทีมตัดสินใจว่าจะ "ปิด" ได้กี่คะแนนต่อ 1 วัน โดยอิงจากความสามารถจริงของทีม 2 คนที่มี AI ช่วย
> คะแนนในตารางนี้คือ **คะแนนของข้อกำหนด** (แยกจาก Story Points ที่ใช้วัด velocity)

### 18.7.3 Burndown (ตัวอย่าง Sprint 8 — Sprint ที่ปิดคะแนน B1 = 5)

| ช่วงเวลา | งานคงเหลือ (เป้า) | งานคงเหลือ (จริง) | ความเบี่ยงเบน |
|---|---|---|---|
| เริ่ม Sprint | 4 | 4 | 0 |
| ชั่วโมงที่ 2 | 3 | 2 | −1 ✅ เร็วกว่า |
| ชั่วโมงที่ 4 | 2 | 2 | 0 |
| ชั่วโมงที่ 6 | 1 | 2 | +1 ⚠️ ช้ากว่า |
| ชั่วโมงที่ 7 | 0 | 0 | 0 ✅ |

### 18.7.4 Traceability : Requirement ↔ Task ↔ Sprint ↔ คะแนน

| Requirement | Task ที่เกี่ยวข้อง | Sprint | คะแนน |
|---|---|---|---|
| M1 จัดการพนักงาน | T-016, T-018 | 4 | 3 |
| M2 สิทธิ์ Dynamic | T-019…T-023 | 5 | 3 |
| M3 Login/Logout | T-015, T-017 | 4 | 2 |
| F1 จัดเส้นทาง | T-024…T-028 | 6 | 2 |
| F2 จัดรอบ/มอบหมาย | T-029…T-033 | 7 | 3 |
| B1 เงื่อนไขการจอง | T-034, T-035, T-036, T-040 | 8, 9 | 5 |
| B2 QR + ดูรอบ | T-037, T-039, T-041 | 8, 9 | 1 |
| B3 ยกเลิก + คืนที่นั่ง | T-038, T-039, T-041 | 9 | 3 |
| D1 ตารางงานคนขับ | T-043, T-048 | 10 | 1 |
| D2 เริ่มงาน + manifest | T-044, T-045, T-048, T-049 | 10 | 1 |
| D3 เช็ค QR | T-046, T-050 | 10, 11 | 1 |
| D4 ปิดงาน + สรุป | T-047, T-051 | 11 | 3 |
| R1 คนขึ้น/ลงรายสัปดาห์ | T-052, T-053, T-054, T-058 | 11, 12 | 3 |
| R4 สรุปยอดรายวัน × เส้นทาง | T-052, T-053, T-055, T-059 | 11, 12, 13 | 2 |
| R6 รอบงานคนขับ ก่อน/หลัง 17:00 | T-052, T-053, T-056, T-059 | 11, 12, 13 | 2 |
| ER + Mapping | T-005, T-006, T-007 | 1 | 10 |
| Mockup | T-009 | 2 | 10 |
| Agile Plan | ทั้งบทนี้ | 0–13 | 10 |
| Testing (BR-01…BR-12) | T-060, T-062 | 12, 13 | — |
| เอกสาร + Traceability + AI Credit | T-061 | 13 | — |
| Oracle (นอกเกณฑ์คะแนน) | T-007, T-008, T-052, T-053, T-057 | 1, 2, 11, 13 | — |
| Flutter (นอกเกณฑ์คะแนน) | T-013, T-017, T-018, T-023, T-028, T-033, T-040, T-041, T-048…T-051, T-058, T-059 | ต่าง ๆ | — |
| React / Web (นอกขอบเขต) | — | — | ⛔ 0 |

### 18.7.5 Sprint Load Check (เช็คว่าภาระ 2 คนสมดุลกันไหม)

| Sprint | เก่งกาญ | สุขสรร | รวม Task | สถานะ |
|---|---|---|---|---|
| S0 | 5.5 | 6.5 | 4 | ✅ ปกติ |
| S1 | 5 | 7 | 3 | ✅ ปกติ |
| S2 | 6 | 5 | 3 | ✅ ปกติ |
| S3 | 5 | 7 | 4 | ✅ ปกติ |
| S4 | 7 | 5 | 4 | ✅ ปกติ |
| S5 | 7.5 | 4.5 | 5 | ⚠️ เก่งกาญเต็ม |
| S6 | 7.5 | 4.5 | 5 | ⚠️ เก่งกาญเต็ม |
| S7 | 7 | 7 | 5 | ✅ ปกติ |
| S8 | 7 | 5 | 4 | ✅ ปกติ |
| S9 | 5 | 6 | 5 | ✅ ปกติ |
| S10 | 8 | 5.5 | 6 | 🔺 ยืด 1.5 ชม. (ใช้ AI ช่วย) |
| S11 | 7.5 | 8.5 | 5 | 🔺 ยืด 2 ชม. (ข้อมูล 50k แถว) |
| S12 | 6.5 | 7.5 | 5 | ⚠️ สุขสรรเต็ม |
| S13 | 6.25 | 8.25 | 4 | 🔺 ยืด 1.75 ชม. (เอกสาร + ทดสอบ) |
| **รวม** | **90.75** | **87.25** | **62** | **178 ชม. / คนละ 6.4 ชม.เฉลี่ย** |

> **สรุป:** ภาระต่างกันเพียง **3.5 ชั่วโมง** ตลอดโครงการ (90.75 vs 87.25) → **สมดุลดี**
> ความจุจริง = 14 วัน × 2 คน × 6.5 ชม. = **182 ชม.** · งานจริง = **178 ชม.** → **เหลือ Buffer 4 ชม. (2%)**
>
> ⚠️ **Sprint ที่ล้นความจุรายวัน** (มีคนเดียวเกิน 7.5 ชม.)
> | Sprint | ใคร | เกิน | สาเหตุ |
> |---|---|---|---|
> | S10 | เก่งกาญ | +1.5 ชม. | Driver API 5 endpoint ในวันเดียว |
> | S11 | สุขสรร | +2 ชม. | สแกน QR + ปิดงาน + seed 50k แถว |
> | S13 | สุขสรร | +1.75 ชม. | Report R4/R6 + เอกสารส่งมอบ |
> รวม **5.25 ชม.** ที่ต้องพึ่งความเร็วของ AI Agent
>
> 🛡️ **แผนรับมือ:** ถ้า Sprint ใดล่าช้า ให้ใช้ Buffer 4 ชม. ก่อน
> แล้วจึงตัดขอบเขตตามลำดับใน **18.9 R9**
> ⛔ **ห้ามใช้วิธี "ทำงานดึก"** เพราะจะทำให้ S11 (ข้อมูล 50k แถว) พังตามมา

---

## 18.8 Git Strategy

### 18.8.1 Branching Model (Git Flow แบบย่อ)
```
main          ────────●──────────────────────●────────→  Release v1.0.0
                          \                  /              (tag)
develop      ──●──●──●──●───●──●──●──●──●──●──●──●──●───●──→
                  \/      \/     \/     \/     \/      \/
feature/T-0xx ────●        ●      ●      ●      ●        ●
```
> **เพราะมี 2 คน** ใช้ `feature/T-0xx` ต่อ Task และ **PR ต้องได้ Review 1 เสียง** ก่อน Merge
> ถ้า Merge เองโดยไม่มี Review → ผิด **AR-02**

### 18.8.2 Commit Convention
```
<type>(<task-id>): <description>

feat(T-037): add booking create API with QR token via Oracle sequence
fix(T-035): prevent seat overbooking using FOR UPDATE NOWAIT
db(T-052): add bulk seed data FY2568 via PL/SQL FORALL
ui(T-050): add QR scanner screen with mobile_scanner debounce
docs(T-061): add traceability matrix and AI usage credit
chore(T-001): initial project structure and Oracle XE setup
```
| Type | ใช้กับ |
|---|---|
| `feat` | ฟีเจอร์ใหม่ |
| `fix` | แก้บั๊ก |
| `docs` | เอกสาร |
| `db` | Schema / Seed / View |
| `ui` | หน้าจอ Flutter |
| `test` | เทสต์ |
| `refactor` | ปรับโค้ด |
| `chore` | งานอื่น |

> เนื่องจากใช้ AI ช่วยเขียน ให้เพิ่ม tag ท้ายข้อความ: `[ai-assisted]` เพื่อให้ตรวจสอบย้อนหลังได้

### 18.8.3 โครงสร้างโฟลเดอร์เอกสาร Agile (ต้อง commit)

```
docs/agile/
├── README.md                     # บทที่ 18 (แผนงานฉบับนี้)
├── team.md                        # ข้อมูลสมาชิก 2 คน + ตารางหมุนเวียนบทบาท
├── backlog.md                     # Product Backlog ทั้งหมด (62 รายการ)
├── calendar.md                    # ปฏิทิน Sprint 0-13 (จ.–ส.)
├── sprints/
│   ├── sprint-00-plan.md
│   ├── sprint-00-report.md
│   ├── sprint-01-plan.md
│   └── ...
├── standup/                       # 14 ไฟล์ (จ.–ส.)
│   ├── 2025-06-02.md
│   └── ...
├── retro/                         # 14 ไฟล์
│   ├── sprint-00.md
│   └── ...
└── ai-prompts/                    # Prompt ที่ใช้จริง (AR-06)
    ├── P-02_oracle-ddl.md
    ├── P-03_plsql-bulk-seed.md
    └── ...
```

---

## 18.9 Risk Register (ทะเบียนความเสี่ยง — ปรับสำหรับทีม 2 คน / 14 วัน)

| # | ความเสี่ยง | โอกาส | ผลกระทบ | มาตรการป้องกัน / แผนรับมือ | ผู้รับผิดชอบ |
|---|---|---|---|---|---|
| R1 | **ติดตั้ง Oracle XE ใช้เวลานาน** (เครื่องนักศึกาไม่มี Oracle เดิม) | สูง | สูง | ติดตั้ง **Oracle XE 19c ตั้งแต่ Sprint 0 (T-001)** · ทดสอบ `01_schema.sql` ใน Sprint 1 · ถ้าลงทะเบียนไม่สำเร็จให้ใช้ **Oracle Cloud Free Tier** เป็นทางสำรอง | นายเก่งกาญ เชี่ยวชาญ |
| R2 | **ทีม 2 คน ขาดคนหนึ่ง** (ป่วย/มีนัด) แล้วงานติด | สูง | สูง | Task ทุกอันบันทึกใน ClickUp พร้อม Acceptance Criteria · ใช้ AI Agent ช่วยงานต่อได้ · ⚠️ **ห้ามตัดรายงานเหลือ 2 ข้อ** เพราะ PDF บังคับ 3 ข้อ (1 จากแต่ละกลุ่ม) → ถ้าขาด 1 วันให้ตัด **T-057 Index Tuning** และงานเอกสารส่วนเกินแทน | ทั้งคู่ |
| R3 | **ความรู้กระจายอยู่คนเดียว** (ฝั่ง Oracle/Backend) | สูง | สูง | **AR-10** Pair Programming 15 นาทีทุกวัน · เก็บงานลง Git ทุกวัน · งานสำคัญต้องมีเอกสาร/Comment | ทั้งคู่ |
| R4 | ข้อมูลรายงานน้อยเกินไป รายงานออกไม่ได้ | สูง | สูง | `04_seed_report_bulk.sql` ≥ 50,000 แถวตั้งแต่ Sprint 11 (T-052) · ทดสอบ Query ทุกข้อทันที | นายเก่งกาญ เชี่ยวชาญ |
| R5 | **QR Scanner ไม่ทำงานบน Android Emulator** | สูง | กลาง | เตรียม **ช่องกรอก Token เอง** เป็นทางสำรองตั้งแต่ Sprint 11 (T-050) · ทดสอบบนเครื่องจริง | นางสาวสุขสรร มาณีศรี |
| R6 | เขียน Dynamic RBAC กลับไป hardcode โดยไม่รู้ตัว | กลาง | สูง | **AR-02** Review โดยอีกคน · Prompt **P-12** ตรวจ `if (role === 'admin')` อัตโนมัติทุก Sprint 5 | นายเก่งกาญ เชี่ยวชาญ |
| R7 | โค้ดจาก AI มีบั๊กแฝง / ใช้ syntax ผิด (เช่น MySQL แทน Oracle) | กลาง | สูง | **AR-05** ทดสอบก่อน Merge · Prompt **P-02** ระบุ "ห้ามใช้ syntax ของ MySQL" · รัน `01_schema.sql` จริงทุกครั้ง · **AR-11** ปฏิเสธโค้ด React ทันที | ทั้งคู่ |
| R8 | **หน้าจอ Admin บนมือถือใช้ไม้ได้จริง** (เพราะตัด Web ออก) | กลาง | กลาง | ออกแบบ **Adaptive UI** (T-013) + `DataTable` (T-018) · ทดสอบทั้ง 360px และ 1280px · **ถามอาจารย์เรื่องอุปกรณ์สาธิต** | นางสาวสุขสรร มาณีศรี |
| R9 | **เวลาไม่พอ เพราะ 14 วัน = ทีม 2 คน** | **สูง** | **สูง** | ใช้ MoSCoW · ตัดรายงานเหลือ 2 ข้อก่อนถ้าจำเป็น · ลดรายละเอียดเอกสาร (T-061) เหลือสาระสำคัญ · งานเสร็จก่อน Sprint 13 เท่านั้นที่นำไป Demo | Product Owner ของสัปดาห์ |
| R10 | Schedule generate เวลาไม่ตรงกับตัวอย่างในเอกสาร | กลาง | กลาง | เทียบกับตารางจุดที่ 1–5 ในข้อกำหนดก่อน Sprint Review (Sprint 7) | ทั้งคู่ |
| R11 | Flutter เข้าเครื่อง Android ไม่ได้ (ไม่มี SDK / driver) | กลาง | สูง | ติดตั้ง Android Studio + SDK **ใน Sprint 0 (T-002)** ให้เสร็จก่อนเริ่มงานอื่น | นางสาวสุขสรร มาณีศรี |
| R12 | ลืมบันทึก AI Credit ทำให้เสียคะแนน | ต่ำ | กลาง | รวมไว้ใน Task T-061 (Sprint 13) · บันทึก Prompt ทุกวันใน Stand-up (AR-06) | ทั้งคู่ |
| R13 | **ยกเลิก Daily Stand-up วันเสาร์** เพราะเหนื่อย | กลาง | กลาง | กำหนดเป็นกฎทีมใน Sprint 0 · ถ้าขาดต้องส่ง Stand-up เป็นไฟล์เช่นกัน | ทั้งคู่ |
| R14 | **Sprint 13 หนักเกินไป** (Report R4/R6 + Tuning + Test + เอกสาร) | สูง | กลาง | เริ่มเขียน Traceability Matrix แบบร่างตั้งแต่ Sprint 8 (เก็บงานไว้ใน T-061) · ทดสอบจริงตั้งแต่ Sprint 12 (T-060) · ⚠️ ถ้าจำเป็นต้องตัด **งานเสริม** (T-057) ห้ามตัดรายงานทั้ง 3 ข้อ | ทั้งคู่ |

---

## 18.10 Milestones (หมุดหมาย)

| Milestone | Sprint | วัน | ผลงาน / เกณฑ์สำเร็จ |
|---|---|---|---|
| **M0 — Tools Ready** | 0 | จ. 1 | Oracle XE เชื่อมได้ · Flutter รันบน Emulator ได้ |
| **M1 — Baseline Approved** | 2 | พ. 3 | ER + Mockup + ไดอะแกรม เสนออาจารย์อนุมัติ (**30 คะแนน**) |
| **M2 — Data Ready** | 2 | พ. 3 | Oracle + Seed ตามตัวอย่างในข้อกำหนด (เส้นทาง 30/13/12 นาที) |
| **M3 — Core Master Done** | 5 | ส. 6 | M1 + M2 + M3 ผ่าน (**8 คะแนน**) |
| **M4 — Front Done** | 7 | อ. 8 | F1 + F2 ผ่าน (**5 คะแนน**) |
| **M5 — Booking Done** | 9 | พฤ. 10 | B1–B3 ผ่าน (**9 คะแนน**) |
| **M6 — Driver Done** | 11 | ส. 12 | D1–D4 ผ่าน + ข้อมูล 50,000 แถว (**6 คะแนน**) |
| **M7 — Report Done** | 13 | อ. 14 | รายงาน 3 ข้อ + กราฟ ผ่าน (**7 คะแนน**) |
| **M8 — Test Passed** | 13 | อ. 14 | Test Case ผ่าน ≥ 95% |
| **M9 — Release 1.0 & ส่งมอบ** | 13 | อ. 14 | Tag `v1.0.0` · รายงานครบ 18 บท (**Agile 10 ปิด**) · Demo ผ่าน |

> ⚠️ **ไม่มี Milestone แยกสัปดาห์ที่ 2–3** เพราะแผนนี้กระชับมาก (14 วัน) — ทุก Milestone ต้องปิดภายใน Sprint ของตัวเอง

---

## 18.11 Communication Plan

| ช่องทาง | วัตถุประสงค์ | ความถี่ |
|---|---|---|
| **Daily Stand-up (ตั้งหน้า 15 นาที)** | ซิงก์ความคืบหน้า / หา Blocker | **ทุกวัน จันทร์ – เสาร์ เวลา 10:00** |
| **AI Sync + Pair Programming** | ถ่ายทอดความรู้ข้ามฝั่ง (AR-10) | ทุกวัน จ.–ส. เวลา 14:00 |
| **ClickUp Comments** | อภิปราย Task แบบ asynchronous | ตลอดวัน |
| **`docs/agile/standup/`** | บันทึกถาวร (หลักฐาน Agile) | ทุกวัน จ.–ส. **14 ไฟล์** |
| **Sprint Review** | Demo ให้อาจารย์ / เพื่อนดู | ทุกวัน 16:30 |
| **Sprint Retrospective** | ปรับปรุงวิธีทำงาน | ทุกวัน 17:00 (**14 ครั้ง**) |
| **Line Group** | ประสานงานด่วน | ตลอดเวลา |
| **GitHub Issues** | บันทึก Bug | เมื่อพบ |

---

## 18.12 Definition of Ready / Done (สรุป)

### Definition of Ready (งานพร้อมลงมือ)
1. เขียน **Acceptance Criteria** เป็นข้อความชัดเจน
2. ผูก **Requirement ID** (เช่น `BR-05`, `D3`, `F1`)
3. ประเมินเวลา **≤ 3 ชั่วโมง** (เพราะ Sprint = 1 วัน และมีผู้ช่วย AI)
4. **ไม่มี Dependency** กับงานที่ยังไม่ Done
5. มี **Mockup / Reference** สำหรับงาน UI
6. มี **Prompt Template** ที่จะใช้กับ AI (ถ้าเป็นงานที่ใช้ AI)
7. ระบุ **Owner** ชัดเจนว่าใครทำ (ทีมมี 2 คน → ต้องระบุเสมอ)

### Definition of Done (งานเสร็จสมบูรณ์)
1. โค้ด Push ขึ้น Git ✅
2. ผ่าน **Code Review โดยอีกสมาชิก 1 คน** ✅ (AR-02)
3. **ทดสอบด้วยตนเองแล้วทำงานถูกต้อง** ✅ (AR-05)
4. ผ่าน Unit/Integration Test ✅
5. ผ่าน **Business Rule** ที่เกี่ยวข้อง (BR-01…BR-12) ✅
6. มีเอกสารประกอบโค้ดส่วนซับซ้อน ✅
7. ปิด Task ใน ClickUp พร้อม **เวลาที่ใช้จริง** ✅
8. บันทึกใน Sprint Report และ Stand-up ของวันนั้น ✅

---

## 18.13 สรุปผลลัพธ์ที่คาดหวัง

| ผลลัพธ์ | ตัวชี้วัด | เป้าหมาย |
|---|---|---|
| Requirement ครบถ้วน | Traceability Matrix ครอบคลุม 100% | 100% |
| ระบบทำงานได้จริง | Test Case ที่ทดสอบแล้วผ่าน | ≥ 95% |
| คะแนนโปรแกรม | ปิดครบทุกข้อบังคับ | 100 คะแนน |
| ประสิทธิภาพ | API Response Time | < 500 ms |
| รายงาน (ข้อมูล 50,000 แถว) | เวลาประมวลผล | < 3 วินาที |
| ข้อมูลรายงาน | จำนวน Booking | ≥ 50,000 แถว |
| **เอกสาร Agile** | **Stand-up จันทร์–เสาร์** | **14 ไฟล์** |
| **เอกสาร Agile** | **Retrospective** | **14 ไฟล์** |
| AI Governance | มี Prompt Log + AI Credit | 100% |
| การทำงานร่วมกัน | Stand-up ครบทุกวันทำงาน | 14/14 วัน |
| เทคโนโลยี | จำนวนเทคโนโลยีหลักที่ใช้ | 3 (Flutter / Node+Express / Oracle) |
| ขอบเขต | มี Web Application ในโปรเจกต์หรือไม่ | **0 (นอกขอบเขต)** |

---

## 18.14 สิ่งที่ต้องถามอาจารย์ (เกี่ยวกับแผนงาน)

| # | คำถาม | ทำไมต้องถาม |
|---|---|---|
| 1 | ทีม 2 คน ทำงาน **จันทร์–เสาร์** ได้หรือไม่ ต้องการหยุดวันอาทิตย์หรือเปลี่ยนเป็น จ.–ศ. | กระทบจำนวน Sprint และจำนวนไฟล์ Stand-up |
| 2 | **14 วันทำงาน** (2 สัปดาห์ + 2 วัน) สำหรับทีม 2 คนเพียงพอหรือไม่ หรือควรตัดรายงานเหลือ 2 ข้อตั้งแต่ต้น | ความเสี่ยง R9 สูงมาก ถ้าไม่พอเวลาควรลดขอบเขตทันที |
| 3 | เอกสารแผนงาน Agile ต้องมีไฟล์อะไรบ้างที่จำเป็น | 10 คะแนน |
| 4 | ต้องส่งเป็น **APK (Android)** ใช่หรือไม่ | เนื่องจากไม่มีเว็บ |
| 5 | สาธิตระบบจัดการข้อมูลบน **แท็บเล็ต** ได้หรือไม่ | กระทบคะแนน M1/M2/F1/F2 |
| 6 | Oracle เวอร์ชันที่ใช้ตรวจ (19c · ทดสอบ 21c / XE ได้) | กระทบสคริปต์และข้อกำหนดสิทธิ์ในการติดตั้ง |
| 7 | ถ้าไม่มี Web ถือว่าหน้าจอ Admin/Staff ต้องทำเป็น **Flutter** ทั้งหมดใช่หรือไม่ | ยืนยันขอบเขตให้ชัดเจนก่อนเริ่ม Sprint 4 |
