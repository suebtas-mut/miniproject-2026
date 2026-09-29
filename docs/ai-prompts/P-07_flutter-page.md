# AI Prompt Log — P-07 `flutter-page`

> บันทึกตามข้อ **AR-06** (`docs/chapter-18-development-plan.md` ข้อ 18.1.3) · ห้ามบันทึกข้อมูลส่วนบุคคลจริง / Password / API Key (**AR-03**)

| หัวข้อ | รายละเอียด |
|---|---|
| **สถานะ** | 🕐 **Template พร้อมใช้** — ยังไม่ได้ใช้จริง |
| **Task** | — |
| **Prompt Template** | **P-07 `flutter-page`** (18.1.3) |
| **AI Agent** | `@agent-ui` |
| **ผู้ใช้ Prompt** | นายเก่งกาญ เชี่ยวชาญ |
| **ผู้ตรวจผลลัพธ์** | นางสาวสุขสรร มาณีศรี (AR-02) |
| **ผลลัพธ์** | — |

> ⛔ **AR-11:** ห้ามสร้างเว็บ — ทั้งโปรเจกต์เป็น **Flutter เท่านั้น**

---

## 1. Prompt Template

```text
สร้างหน้า [ชื่อหน้า] ด้วย Flutter ใช้ dio เรียก REST API
เก็บ token ใน flutter_secure_storage
รองรับทั้งมือถือ/แท็บเล็ต (LayoutBuilder) — ห้ามสร้างเว็บ

ข้อกำหนดเพิ่มเติม:
1. ⛔ ห้ามสร้าง React / Vue / HTML / โฟลเดอร์ frontend-web ใด ๆ
2. ใช้ dio พร้อม Interceptor ที่แนบ token อัตโนมัติ และจัดการ 401
   ให้ล้าง token แล้วพาผู้ใช้กลับหน้า Login
3. ต้องแยก 3 ชั้น: Widget (UI) / Provider หรือ Bloc (State) / Service (เรียก API)
   ห้ามเรียก dio จาก Widget โดยตรง
4. ต้องมีสถานะครบ 4 อย่าง: loading (มี skeleton หรือ progress) ·
   สำเร็จ · ว่าง (ไม่มีข้อมูล) · ผิดพลาด (พร้อมปุ่มลองใหม่)
5. ต้องรองรับจอเล็ก (มือถือ) และจอใหญ่ (แท็บเล็ต) ด้วย LayoutBuilder
   ห้ามกำหนดความกว้างตายตัว
6. แสดงข้อความภาษาไทยทั้งหมด · ใช้ฟอนต์ที่รองรับภาษาไทย
7. ห้าม hardcode URL ของ backend ในโค้ด — อ่านจาก --dart-define
8. เมื่อเรียก API ล้มเหลว ห้ามแสดงรายละเอียด error ภายในของ backend ตรง ๆ
9. ถ้าต้องสร้าง widget ใหม่ ให้ทำซ้ำได้ (StatelessWidget) และตั้งชื่อชัดเจน
```

---

## 2. บริบทที่ต้องใส่

| ประเภท | ไฟล์ | หมายเหตุ |
|---|---|---|
| Use Case ของหน้า | `docs/diagrams/usecase/usecase-spec.md` | Precondition / Postcondition / Alternative Flow |
| API ที่หน้านี้เรียก | เอกสารข้อ 17.x | endpoint + request/response |
| Business Rule | `docs/diagrams/usecase/usecase-spec.md` | BR-01…BR-12 |

### 🔒 ข้อมูลที่ **ไม่** ส่งเข้า Prompt (AR-03)
`.env` · token จริง · base URL จริงของ backend

---

## 3. การตรวจสอบ (AR-05) — เติมเมื่อใช้จริง

| รายการ | วิธีตรวจ | ผล |
|---|---|---|
| ไม่มีโค้ดเว็บ | grep `react` `html` `frontend-web` (AR-11) | — |
| `flutter analyze` ผ่าน | รันในโปรเจกต์ | — |
| มี 4 สถานะครบ | ทดสอบจริงทั้ง 4 เคส | — |
| ไม่มี URL hardcode | grep `http` | — |
| ใช้ flutter_secure_storage | grep | — |
| ใช้งานได้ทั้งมือถือ/แท็บเล็ต | ทดสอบ 2 ขนาดจอ | — |
| Code Review (AR-02) | สุขสรร ตรวจ | — |

---

## 4. AI Credit (AR-04) — เติมเมื่อใช้จริง

| รายการ | ค่า |
|---|---|
| **Task** | — |
| **AI Agent** | `@agent-ui` |
| **สิ่งที่นักศึกษาต้องทำเอง** | ทดสอบบนอุปกรณ์จริง/อีมูเลเตอร์ และตรวจ UX เอง |
| **เวลาที่ประหยัดได้** | — |

---

## 5. สิ่งที่ AI ทำผิด (AR-07) — เติมเมื่อใช้จริง

| # | ปัญหา | วิธีแก้ | นำไปใช้ครั้งต่อไป |
|---|---|---|---|
| — | — | — | — |

---

*Prompt Library: [ดูดัชนีทั้งหมด](README.md)*
