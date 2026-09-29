# AI Prompt Log — P-04 `rest-endpoint`

> บันทึกตามข้อ **AR-06** (`docs/chapter-18-development-plan.md` ข้อ 18.1.3) · เก็บ Prompt ไว้เพื่อทำซ้ำและตรวจสอบ
> ห้ามบันทึกข้อมูลส่วนบุคคลจริง / Password / DB Password / API Key ลงไฟล์นี้ (**AR-03**)

| หัวข้อ | รายละเอียด |
|---|---|
| **สถานะ** | ✅ **ใช้จริงแล้ว (T-014)** — ใช้เป็นข้อบังคับหลักในการเขียน `docs/api/openapi.yaml` |
| **Task** | **T-014** — เขียน OpenAPI spec ครบทุก Endpoint (UC-01…UC-30) |
| **Prompt Template** | **P-04 `rest-endpoint`** (18.1.3) |
| **AI Agent** | `@agent-doc` (สเปก) + `@agent-coder` (ตรวจสอบเงื่อนไขข้อ 1–9) |
| **ผู้ใช้ Prompt** | นายเก่งกาญ เชี่ยวชาญ |
| **ผู้ตรวจผลลัพธ์** | นางสาวสุขสรร มาณีศรี (AR-02) — *รอตรวจ* |
| **ผลลัพธ์** | `docs/api/openapi.yaml` — OpenAPI 3.0.3 · 41 paths / 59 operations / 47 schemas<br>Redocly lint **valid · 0 error · 4 warning** (4 warning = 501 ตามข้อ 7 โดยตั้งใจ) |

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

## 3. การตรวจสอบ (AR-05) — ผลจาก T-014

| รายการ | วิธีตรวจ | ผล |
|---|---|---|
| ทุก query ใช้ bind | ระบุ `:param` ใน `description` ของทุก endpoint | ✅ 59/59 |
| ไม่มี `SELECT *` | grep `SELECT \*` | ✅ 2 จุด = ข้อความ "⛔ ห้าม" เท่านั้น ไม่มีการ select * จริง |
| Error mapping ครบ | ตรวจ `responses` ของทุก operation | ✅ ทุก operation มี 401 · แยก 400/403/404/409/422/429/500 · 501 สำหรับ R2/R3/R5/R7 |
| ไม่มี CORS | grep `cors` | ✅ ไม่มี · ระบุว่า client เป็น Flutter อย่างเดียว |
| ไม่มี secret ในโค้ด | grep `password_hash` | ✅ 5 จุด = ข้อความอธิบาย/ข้อห้าม ไม่มี hash อยู่ใน response ใด |
| ไม่มี Web/React | grep `react` / `html` (AR-11) | ✅ ระบุ R-07 "ไม่มี Web/React" ใน `info.description` |
| รายการยาวมี pagination | grep `PageParam` | ✅ 10 endpoint รายการยาวมี `?page=&limit=` |
| ป้องกัน SQL Injection ในตัวอย่าง | ตรวจ `qr_token` / `username` เป็น bind | ✅ ระบุ "ห้ามต่อสตริง" ใน `/booking/available` และ `/driver/trip/scan` |
| Code Review (AR-02) | สุขสรร ตรวจ | ⏳ รอตรวจ |

> ✅ **ครอบคลุมข้อ 8 (feature ของ Oracle)** — ระบุของจริงที่ต้องใช้: `LISTAGG ... WITHIN GROUP (ORDER BY ...)` (UC-24)
> `TRUNC(SYSDATE,'IW')` (R1 รายสัปดาห์) · `ROLLUP` (R6) · `NUMTODSINTERVAL` (BR-02) · `NVL(SUM(...),0)` (BR-07)
> `FOR UPDATE NOWAIT` (BR-07) และกับดับ ORA-02014 / ORA-00054 ที่ UC-18 เตือนไว้
>
> ✅ **ครอบคลุมข้อ 9 (ห้ามตัดสินใจเอง)** — ยกเป็นคำถาม **Q22 / Q23 / Q24** ใน `info.description` แล้ว ไม่เดา endpoint

---

## 4. AI Credit (AR-04) — T-014

| รายการ | ค่า |
|---|---|
| **Task** | T-014 — OpenAPI spec ครบทุก Endpoint |
| **AI Agent** | `@agent-doc` |
| **สัดส่วนงานที่ AI ช่วย** | อ่าน Use Case Spec + chapter 17 + DDL → เขียน `openapi.yaml` ทั้ง 5,600+ บรรทัด (59 operations)<br>ตรวจ traceability เอง (UC/BR/operationId/response code) · แก้จน Redocly lint ผ่าน |
| **สิ่งที่นักศึกษาต้องทำเอง** | ตรวจชื่อคอลัมน์ทุกตัวเทียบ `01_schema.sql` · ทดสอบกับฐานข้อมูลจริง<br>ตัดสินใจเรื่อง **Q22 / Q23 / Q24** (AI ยกเป็นคำถาม ไม่ได้เดาเอง ตามข้อ 9) |
| **เวลาที่ประหยัดได้** | ประมาณ 2.5 ชม. (เทียบงานเขียนสเปก 59 endpoint จากศูนย์) |

---

## 5. สิ่งที่ AI ทำผิด (AR-07) — T-014

| # | ปัญหา | วิธีแก้ | นำไปใช้ครั้งต่อไป |
|---|---|---|---|
| 1 | *(คาดการณ์)* มักสร้าง SQL แบบต่อสตริง และใช้ `SELECT *` | grep ทันทีหลังสร้าง | ✅ เพิ่มข้อ 1–2 ใน Prompt แล้ว |
| 2 | **เพิ่ม `GET /permission-matrix` ที่ไม่มีใน 17.5.2** — ใส่เองเพราะคิดว่า UC-09 ต้องอ่านตารางติ๊ก | นับ operation เทียบ 17.5.2 แล้วเหลือ 59 → ตัดออก<br>ย้าย `granted_perm_ids` ไปไว้ใน `GET /roles` แทน | ✅ เพิ่มข้อ 9 บังคับให้เทียบจำนวน endpoint กับเอกสารต้นทาง **ก่อน** ปิดงาน |
| 3 | **ห่อ response ซ้อนสองชั้น** — `LoginResponse` เป็น envelope เต็ม แต่ path ห่อด้วย envelope อีกชั้น | Redocly เตือน example ไม่ตรง schema | ✅ เปลี่ยน `LoginResponse` เป็น payload ใน `data` แล้วย้าย `example` ไปที่ path |
| 4 | **ตัวอย่าง base64 ไม่ตรง `format: byte`** — ใส่ prefix `data:image/png;base64,` | Redocly `no-invalid-schema-examples` | ✅ ใช้ base64 เปล่าในตัวอย่าง แล้วอธิบายว่า client เติม prefix เอง |

---

*Prompt Library: [ดูดัชนีทั้งหมด](README.md)*
