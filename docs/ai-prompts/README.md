# Prompt Library — P-01 … P-12

> ตามข้อ **AR-06** (`docs/chapter-18-development-plan.md` ข้อ 18.1.3)
> เก็บ Prompt ที่ใช้จริงไว้ เพื่อ **ทำซ้ำได้** และ **ตรวจสอบย้อนหลังได้**
> ⛔ ห้ามบันทึกข้อมูลส่วนบุคคลจริง / Password / API Key ในโฟลเดอร์นี้ (**AR-03**)

---

## ดัชนี

| # | Template | AI Agent | ไฟล์ | สถานะ |
|---|---|---|---|---|
| P-01 | `requirement-to-usecase` | `@agent-architect` | [`2026-09-28-sprint-00-P-01-requirement-to-usecase.md`](2026-09-28-sprint-00-P-01-requirement-to-usecase.md) | ✅ **ใช้แล้ว** 2026-09-28 · T-004 |
| P-02 | `oracle-ddl` | `@agent-oracle` | [`P-02_oracle-ddl.md`](P-02_oracle-ddl.md) | ✅ **ใช้แล้ว** 2026-09-29 · T-007 |
| P-03 | `plsql-bulk-seed` | `@agent-data` | [`P-03_plsql-bulk-seed.md`](P-03_plsql-bulk-seed.md) | 🕐 พร้อมใช้ |
| P-04 | `rest-endpoint` | `@agent-coder` | [`P-04_rest-endpoint.md`](P-04_rest-endpoint.md) | 🕐 พร้อมใช้ · **ปรับปรุงแล้ว** |
| P-05 | `rbac-middleware` | `@agent-coder` | [`P-05_rbac-middleware.md`](P-05_rbac-middleware.md) | 🕐 พร้อมใช้ |
| P-06 | `oracle-report-query` | `@agent-data` | [`P-06_oracle-report-query.md`](P-06_oracle-report-query.md) | 🕐 พร้อมใช้ |
| P-07 | `flutter-page` | `@agent-ui` | [`P-07_flutter-page.md`](P-07_flutter-page.md) | 🕐 พร้อมใช้ |
| P-08 | `flutter-admin-table` | `@agent-ui` | [`P-08_flutter-admin-table.md`](P-08_flutter-admin-table.md) | 🕐 พร้อมใช้ |
| P-09 | `flutter-qr-scan` | `@agent-ui` | [`P-09_flutter-qr-scan.md`](P-09_flutter-qr-scan.md) | 🕐 พร้อมใช้ |
| P-10 | `test-case` | `@agent-test` | [`P-10_test-case.md`](P-10_test-case.md) | 🕐 พร้อมใช้ |
| P-11 | `code-review` | `@agent-review` | [`P-11_code-review.md`](P-11_code-review.md) | 🕐 พร้อมใช้ |
| P-12 | `no-hardcode-check` | `@agent-review` | [`P-12_no-hardcode-check.md`](P-12_no-hardcode-check.md) | 🕐 พร้อมใช้ |

**สรุป:** ใช้จริงแล้ว 2 / 12 · เตรียมไว้ 10

---

## โครงสร้างไฟล์ (ต้องมีครบทุกไฟล์)

| หัวข้อ | เนื้อหา |
|---|---|
| ตารางหัวข้อ | วันที่ใช้ · Task · Template · AI Agent · ผู้ใช้ · ผู้ตรวจ (AR-02) · ผลลัพธ์ |
| 1. Prompt | ข้อความที่ใส่ให้ AI **จริงแบบ verbatim** |
| 2. บริบท | ไฟล์/เนื้อหาที่ป้อนเข้าไป + 🔒 ข้อมูลที่ **ไม่** ส่งเข้าไป (AR-03) |
| 3. ผลลัพธ์ | ไฟล์ที่ได้ + ตารางการตรวจสอบ (AR-05) |
| 4. AI Credit | สัดส่วนที่ AI ช่วย / ที่นักศึกษาต้องทำเอง (AR-04) |
| 5. สิ่งที่ AI ทำผิด | ปัญหา → วิธีแก้ → ใช้กับครั้งต่อไป (AR-07) |

> ไฟล์ที่ยังไม่ได้ใช้งาน ให้เขียนว่า **—** ในช่องผลลัพธ์ และคงหัวข้อ 3–5 ไว้
> เพื่อให้เติมข้อมูลต่อได้ทันทีโดยไม่ต้องเปลี่ยนโครงสร้าง

---

## กฎที่ต้องยึดทุก Prompt

| ข้อ | กฎ | อ้างอิง |
|---|---|---|
| 1 | ห้ามบันทึก Password / API Key / secret จริง | AR-03 |
| 2 | ต้องมีคนอีกคนหนึ่งรีวิวผล — AI นับแทนไม่ได้ | AR-02 |
| 3 | นักศึกษาต้องอ่านและเข้าใบ้ได้เองทุกบรรทัด | AR-01 |
| 4 | ต้องระบุสัดส่วนงานที่ AI ช่วย | AR-04 |
| 5 | ต้องทดสอบด้วยตนเองก่อนบอกว่าผ่าน | AR-05 |
| 6 | Prompt ที่ใช้แล้วต้องเก็บไว้ ห้ามลบทิ้ง | AR-06 |
| 7 | ถ้า AI ผิด ต้องบันทึกไว้ว่าผิดอย่างไร | AR-07 |
| 8 | ต้องระบุว่าใครเป็นผู้ตรวจ (คนจริง) | AR-02 |
| 9 | ห้ามสร้างโค้ด React / Web ใด ๆ | AR-11 |
| 10 | ตัวเลขต้องตรงตัวอย่างใน PDF ห้ามให้ AI แต่งเอง | AR-08 |

---

## บันทึกรวม (AR-04)

รายงานส่วนของ AI ทั้งหมดต้องสรุปไว้ที่
[`docs/ai-credit-log.md`](../ai-credit-log.md) ทุก Sprint

---

*สร้าง/ปรับปรุงล่าสุด: 2026-09-29 โดย นายเก่งกาญ เชี่ยวชาญ*
