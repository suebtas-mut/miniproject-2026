# AI Prompt Log — P-04 `rest-endpoint`

> บันทึกตามข้อ **AR-06** (`docs/chapter-18-development-plan.md` ข้อ 18.1.3) · เก็บ Prompt ไว้เพื่อทำซ้ำและตรวจสอบ
> ห้ามบันทึกข้อมูลส่วนบุคคลจริง / Password / DB Password / API Key ลงไฟล์นี้ (**AR-03**)

| หัวข้อ | รายละเอียด |
|---|---|
| **สถานะ** | 🕐 **Template พร้อมใช้** — ยังไม่ได้ใช้จริง (รอ Sprint 2+) |
| **Task** | — |
| **Prompt Template** | **P-04 `rest-endpoint`** (18.1.3) |
| **AI Agent** | `@agent-coder` |
| **ผู้ใช้ Prompt** | นายเก่งกาญ เชี่ยวชาญ |
| **ผู้ตรวจผลลัพธ์** | นางสาวสุขสรร มาณีศรี (AR-02) — ต้องตรวจเมื่อใช้จริง |
| **ผลลัพธ์** | — |

> ✅ **ปรับปรุง 2026-09-29** — ปิด Action Item ใน `docs/chapter-18-development-plan.md`
> (บรรทัด 210/214: *"Prompt P-04 ยังสร้าง SQL ที่ไม่ใช้ Bind Variable → ต้องเพิ่ม 'ห้ามต่อสตริงใน SQL'"*)
> โดยเพิ่มข้อ 2–4 ด้านล่าง · ผู้รับผิดชอบ: นายเก่งกาญ เชี่ยวชาญ (0.5 ชม.)

---

## 1. Prompt Template (ปรับปรุงแล้ว)

```text
สร้าง Express Router + Controller + Service + Repository สำหรับ [module]
ใช้ node-oracledb bind variables ทุก query พร้อม validate และ error handling

ข้อกำหนดเพิ่มเติม:
1. ⛔ ห้ามต่อสตริงเข้า SQL เด็ดขาด — ห้ามใช้ template literal ที่แทรกค่า user
   ลงใน SQL เพราะเป็น SQL Injection และเสีย Statement Cache
   ต้องใช้ :bind1, :bind2 ... และ binds ใน execute()
2. ⛔ ห้าม SELECT * — ต้องระบุคอลัมน์ชัดเจน เพื่อไม่ให้ schema เปลี่ยนแล้วพังเงียบ
3. ทุก query ต้องมี :limit / :offset สำหรับรายการยาว และ ORDER BY ที่มีคอลัมน์
   ที่ unique (กันลำดับไม่นิ่งเวลาแบ่งหน้า)
4. ใช้ Transaction เมื่อมีมากกว่า 1 statement — BEGIN/COMMIT/ROLLBACK
   และห้าม COMMIT อยู่ใน Repository
5. Error handling ต้องแยก: validation error (400) / ไม่พบข้อมูล (404)
   / ชน unique (409) / ผิด FK (422) / ผิดตารางหรือคอลัมน์ (500)
   และห้ามส่ง stack trace หรือรายละเอียดของ Oracle กลับไปหา client
6. ห้ามเพิ่ม CORS — ไม่มี Web Origin ในระบบนี้
7. ห้าม import ค่ารหัสผ่านจากไฟล์อื่น — อ่านจาก process.env เท่านั้น
8. Query ที่ต้องใช้ feature ของ Oracle ให้ใช้ของจริง เช่น
   TRUNC(SYSDATE,'IW') · PIVOT · LISTAGG · Analytic Function
9. ถ้า Use Case ไหนไม่ชัดเจน ให้ยกเป็นคำถามที่ต้องรออาจารย์ยืนยัน ห้ามตัดสินใจเอง
```

---

## 2. บริบทที่ต้องใส่

| ประเภท | ไฟล์ | หมายเหตุ |
|---|---|---|
| Use Case ของ module | `docs/diagrams/usecase/usecase-spec.md` | Precondition / Postcondition / BR |
| โครงตาราง | `database/01_schema.sql` | ชื่อคอลัมน์ต้องตรงกันจริง |
| Business Rule | `docs/diagrams/usecase/usecase-spec.md` | BR-01…BR-12 |
| รายงานที่ต้องทำ | PDF ข้อกำหนด | R1 + R4 + R6 |

### 🔒 ข้อมูลที่ **ไม่** ส่งเข้า Prompt (AR-03)
- `.env` · ค่า `ORACLE_PASSWORD` / `APP_USER_PASSWORD` จริง
- DSN จริง · ชื่อ service / SID ที่เป็นของจริง

> ส่งเฉพาะ **ชื่อ** ตัวแปร (เช่น "อ่านรหัสผ่านจาก `process.env.ORACLE_PASSWORD`")
> โดยไม่ต้องบอกค่าจริง

---

## 3. การตรวจสอบ (AR-05) — เติมเมื่อใช้จริง

| รายการ | วิธีตรวจ | ผล |
|---|---|---|
| ทุก query ใช้ bind | grep หา `` ` `` ในไฟล์ SQL / template literal | — |
| ไม่มี `SELECT *` | grep `SELECT \*` | — |
| Error mapping ครบ | ทดสอบ 400/404/409/422 | — |
| ไม่มี CORS | grep `cors` | — |
| ไม่มี secret ในโค้ด | grep `password\s*=\s*['"]` | — |
| ไม่มี Web/React | grep `react` / `html` (AR-11) | — |
| Code Review (AR-02) | สุขสรร ตรวจ | — |

---

## 4. AI Credit (AR-04) — เติมเมื่อใช้จริง

| รายการ | ค่า |
|---|---|
| **Task** | — |
| **AI Agent** | `@agent-coder` |
| **สัดส่วนงานที่ AI ช่วย** | — |
| **สิ่งที่นักศึกษาต้องทำเอง** | ตรวจ SQL ทุกบรรทัด · ทดสอบกับฐานข้อมูลจริง · ตรวจ logic เทียบ BR |
| **เวลาที่ประหยัดได้** | — |

---

## 5. สิ่งที่ AI ทำผิด (AR-07) — เติมเมื่อใช้จริง

| # | ปัญหา | วิธีแก้ | นำไปใช้ครั้งต่อไป |
|---|---|---|---|
| 1 | *(ทำนาย)* มักสร้าง SQL แบบต่อสตริง และใช้ `SELECT *` | grep ทันทีหลังสร้าง | ✅ เพิ่มข้อ 1–2 ใน Prompt แล้ว |

---

*Prompt Library: [ดูดัชนีทั้งหมด](README.md)*
