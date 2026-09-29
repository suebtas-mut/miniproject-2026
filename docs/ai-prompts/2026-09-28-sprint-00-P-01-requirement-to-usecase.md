# AI Prompt Log — P-01 `requirement-to-usecase`

> บันทึกตามข้อ **AR-06** (`docs/chapter-18-development-plan.md` ข้อ 18.1.3) · เก็บ Prompt ไว้เพื่อทำซ้ำและตรวจสอบ
> ห้ามบันทึกข้อมูลส่วนบุคคลจริง / Password / DB Password / API Key ลงไฟล์นี้ (**AR-03**)

| หัวข้อ | รายละเอียด |
|---|---|
| **วันที่ใช้** | 2026-09-28 (Sprint 0 · วันที่ 1) |
| **Task** | T-004 — Requirement → Use Case Diagram + Use Case Specification |
| **Prompt Template** | **P-01 `requirement-to-usecase`** (18.1.3) |
| **AI Agent** | `@agent-architect` |
| **ผู้ใช้ Prompt** | นายเก่งกาญ เชี่ยวชาญ |
| **ผู้ตรวจผลลัพธ์** | นางสาวสุขสรร มาณีศรี (AR-02) — ⬜ รอรีวิว |
| **ผลลัพธ์** | `docs/diagrams/use-case.puml` · `docs/diagrams/use-case-spec.md` |

---

## 1. Prompt ที่ใช้จริง (verbatim)

```text
จาก Requirement ใน MINI PROJECT SHUTTLE BUS.pdf + docs/chapter-17-fullstack.md
จงสร้าง Use Case Diagram พร้อม Use Case Specification ที่มี Precondition / Postcondition /
Business Rule ... ใช้ PlantUML

ข้อกำหนดเพิ่มเติม:
1. 4 Actors เท่านั้น — Admin / Staff / Customer / Driver (ห้ามเพิ่มบทบาทอื่น)
2. ใช้ PlantUML (.puml) เท่านั้น ห้ามเขียน Mermaid หรือ draw.io
3. ระบุความสัมพันธ์ <<include>> และ <<extend>> ให้ครบ เช่น
   - จองรถ <<include>> แสดง QR Code
   - ยกเลิกการจอง <<extend>> แจ้งเตือนว่าที่นั่งถูกคืน
4. ⛔ ห้ามเสนอ React / Web ใด ๆ — ตัดออกตามข้อ 17.0 (AR-11)
5. Use Case ต้องครอบคลุม M1–M3, F1, F2, B1–B3, D1–D4 และรายงาน 3 ข้อที่ทีมเลือก
   (R1 + R4 + R6)
6. ทุก Use Case ต้องมี Business Rule ที่ผูกกับ BR-01…BR-12 ในเอกสารข้อกำหนด
7. ถ้าข้อกำหนดใน PDF ไม่ชัดเจน ให้ยกเป็น "คำถามที่ต้องรออาจารย์ยืนยัน"
   ห้ามตัดสินใจแทนเอง
8. ทำ Traceability Matrix: Requirement ↔ Use Case ↔ Endpoint ↔ BR ↔ Task
```

---

## 2. บริบทที่ใส่ให้ AI (Context ที่ป้อนเข้าไป)

| ประเภท | ไฟล์ / เนื้อหา | หมายเหตุ |
|---|---|---|
| Requirement ต้นฉบับ | `MINI PROJECT SHUTTLE BUS.pdf` | ข้อกำหนด M1–M3, F1–F2, B1–B3, D1–D4, R1–R7 + ตัวอย่างตัวเลข |
| Requirement สรุป + คำถามค้าง | `docs/requirement-review-checklist.md` | BR-01…BR-12 · Q1, Q4–Q7, Q11, Q14 |
| สถาปัตยกรรมระบบ | `docs/chapter-17-fullstack.md` ข้อ 17.0, 17.6.1, 17.6.4 | ตัด Web · Adaptive UI · RBAC |
| แผนงาน | `docs/chapter-18-development-plan.md` ข้อ 18.1.3, 18.4.1 | T-004 · Prompt P-01 · AR-01…AR-11 |
| ข้อมูลตัวอย่าง | เส้นทาง 1/2/3 = 7/4/5 จุดจอด, 30/13/12 นาที · รอบ 9:30/11:00/13:00/15:00 · รถ 9 ที่นั่ง | ใช้ตรวจว่า AI **ไม่สร้างตัวเลขขึ้นเอง** (AR-08) |

### 🔒 ข้อมูลที่ **ไม่** ส่งเข้า Prompt (AR-03)
- `.env` และ `.env.example` (ค่าจริงทุกตัว)
- `docker-compose.yml` ฉบับเต็ม — ส่งเฉพาะชื่อ image/port
- รหัสผ่านฐานข้อมูล, Service Name, SID, ชื่อ schema ที่เป็นของจริง

> ⚠️ **บันทึกข้อสังเกต (AR-07):** รอบแรก AI ถามกลับว่าจะใช้ Service Name หรือ SID
> → แก้โดย **อ่านจาก `docker-compose.yml` เอง แล้วสรุปเป็นข้อเท็จจริงแบบไม่ระบุค่า** แทนการถาม
> ผลลัพธ์: ครั้งต่อไปให้ใส่ "ข้อเท็จจริงที่ตกลดแล้ว" ในหัวข้อ 1 ของ Prompt โดยตรง

---

## 3. ผลลัพธ์ที่ AI สร้าง

| ไฟล์ | รายละเอียด | ขนาด |
|---|---|---|
| `docs/diagrams/use-case.puml` | Use Case Diagram 4 actors · 30 use cases · ความสัมพันธ์ `<<include>>` / `<<extend>>` | 11,251 bytes |
| `docs/diagrams/use-case-spec.md` | Use Case Specification ครบ 30 UC + BR-01…BR-12 + Traceability + คำถามค้าง 7 ข้อ | 33 KB |

### 3.1 การตรวจสอบ (AR-05 ต้องทดสอบด้วยตนเอง)
| รายการ | วิธีตรวจ | ผล |
|---|---|---|
| Syntax ของ PlantUML | `java -jar plantuml.jar -checkonly -failfast2 -charset UTF-8` | ✅ ผ่าน (exit 0) |
| Render ได้จริง | `-tpng -tsvg` | ✅ SVG 90 KB + PNG 721 KB |
| ตรงกับ Requirement | เทียบทีละข้อกับ PDF | ✅ ครบ M1–M3, F1, F2, B1–B3, D1–D4, R1/R4/R6 |
| ไม่มีโค้ด Web | ค้นหา `react` / `web` / `html` ในทั้ง 2 ไฟล์ | ✅ ไม่พบ (AR-11) |
| ตัวเลขตรงตัวอย่าง PDF | เทียบ 7/4/5 จุดจอด · 30/13/12 นาที | ✅ ตรง · ไม่มีตัวเลข AI แต่ง (AR-08) |
| Code Review (AR-02) | สุขสรร ตรวจ 4 จุด (ดูหัวข้อ 9 ใน spec) | ⬜ **รอรีวิว** |

---

## 4. AI Credit (AR-04)

| รายการ | ค่า |
|---|---|
| **Task** | T-004 Use Case Diagram + Specification |
| **AI Agent** | `@agent-architect` |
| **ประเภทงานที่ใช้ AI** | Requirement Analysis · Diagram (PlantUML) · Specification Writing |
| **สัดส่วนงานที่ AI ช่วย** | ร่างโครงเรื่อง + ภาษาไทยในเอกสาร โดย **นักศึกษาเป็นผู้ตรวจและรับรอง** |
| **สิ่งที่ AI ช่วยได้** | แปลง Requirement เป็น 30 Use Case พร้อม Precondition/Postcondition/Alternative Flow · จัดหมวด 12 Business Rules · เขียน Traceability Matrix |
| **สิ่งที่นักศึกษาต้องทำเอง** | ตรวจทุก Business Rule เทียบกับ PDF · ตัดสินใจว่าจะเลือกรายงาน 3 ข้อข้อไหน · ปิดคำถามค้างกับอาจารย์ · รับรองผลลัพธ์ใน Sprint Review |
| **เวลาที่ประหยัดได้** | ประมาณ 2 ชั่วโมง (ปกติ T-004 = 5 ชม.) |

> ตาม **AR-01** — นักศึกษาต้องอ่านและเข้าใจทุกบรรทัดใน `use-case-spec.md`
> เพราะจะถูกถามตรง ๆ ในช่วง Demo หน้าคณะกรรมการ

---

## 5. สิ่งที่ AI ทำผิด / ต้องแก้ (AR-07)

| # | ปัญหา | วิธีแก้ | นำไปใช้กับ Prompt ครั้งต่อไป |
|---|---|---|---|
| 1 | ถามกลับเรื่อง Service Name / SID ทั้งที่มีข้อมูลอยู่ในโปรเจกต์แล้ว | ส่ง "ข้อเท็จจริงที่ตกลดแล้ว" เป็นหัวข้อแรกแทนการถาม | ✅ เพิ่มข้อ 1 ใน Prompt เป็น "ข้อเท็จจริงที่ตกลดแล้ว" |
| 2 | ร่างเอกสารยาวจนเสี่ยงพิมพ์ผิดในชื่อหัวข้อภาษาไทย | ตรวจ `grep` คำผิดหลังเขียนเสร็จ | ✅ เพิ่มขั้นตอน "grep ตรวจ typo" หลังสร้างไฟล์ |
| 3 | — | — | — |

---

## 6. ประเภทงานที่ AI ช่วยในวันที่ 1 (สรุปรวม AR-04)

| Task | งาน | AI Agent | ผู้ตรวจ |
|---|---|---|---|
| T-001 | Git Repo + โครงสร้าง + `.gitignore` + ติดตั้ง Oracle XE | `@agent-coder` | สุขสรร (AR-02) |
| T-004 | Use Case Diagram + Specification | `@agent-architect` | สุขสรร (AR-02) ⬜ รอ |
| — | ตรวจ config ไม่ให้ Password ตกไปใน Git | `@agent-coder` | สุขสรร |
