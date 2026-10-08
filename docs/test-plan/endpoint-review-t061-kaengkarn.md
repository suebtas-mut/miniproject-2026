# Endpoint Review + Integration Status — T-061 (ส่วน backend) · kaengkarn

| งาน | T-061 (Sprint 13) — ส่วนที่ backend stream รับผิดชอบ |
|---|---|
| วันที่ | 2026-10-08 |
| ขอบเขต | ตรวจ endpoint จริงเทียบ `docs/api/openapi.yaml` + บันทึกสถานะ integration แบบมีหลักฐาน |
| ผลลัพธ์ทั้งหมด | รันจริงจาก `backend/tests/sprint13.test.js` + suite รวม — **ไม่มีตัวเลขที่ไม่ได้วัด** |
| ไม่ใช่ขอบเขตนี้ | Traceability Matrix · รายงานบทที่ 1–18 · AI Usage Credit/Prompt Log · README · export PNG — **เป็นงาน stream เอกสาร** (ดู §6) |

---

## 1. วิธีตรวจ (ซ้ำได้ — เป็น automated tests ทั้งหมด)

| ขั้น | ทำอย่างไร | test ไหน |
|---|---|---|
| รายการ endpoint | เดิน `app._router.stack` จริงของ Express (recurse mount router) → normalize `:id` → `{id}` · เทียบ bidirectional กับ paths ใน openapi (parse YAML ตรง ๆ) | sprint13 `endpoint conformance` |
| Auth ครบ | ยิง request **ไร้ token** ทุก endpoint ยกเว้น `POST /auth/login` → ต้อง 401 envelope เท่านั้น | sprint13 `auth sweep` |
| Error path มาตรฐาน | JSON พัง · body > 1mb · method ผิด | sprint13 `defect fix` |
| SQL injection | query param payload `x' OR '1'='1'; DROP TABLE employee; --` ผ่าน endpoint จริง (real repos + mocked `db.query`) | sprint13 `SQL injection` |
| Race/ concurrency | ยกเลิกซ้ำ + สแกนซ้ำ แบบ `Promise.all` (parallel HTTP) | sprint13 `concurrency` |

## 2. ผลตรวจจริง (รันแล้ว 2026-10-08)

| หัวข้อ | ผล | หลักฐาน |
|---|---|---|
| Endpoint inventory ↔ openapi | **59 ops = 59 ops · ต่างฝั่งละ 0** (method + path + path-param ตรงกันทุกเส้นทาง) | sprint13 2 tests ✓ |
| 401 sweep | **58/58 endpoint** (ทุกตัวยกเว้น login) → `401 {code:'UNAUTHORIZED', message:'กรุณาเข้าสู่ระบบใหม่'}` ไม่มีตัวไหน 500/HTML | sprint13 ✓ |
| JSON body พัง | **เดิม**: 400 แต่ message = ข้อความอังกฤษ raw ของ body-parser → **แก้แล้ว**: 400 `VALIDATION_ERROR` + `"ข้อมูลที่ส่งมาไม่ถูกต้อง"` ตรง openapi BadRequest example | defect fix + test ✓ |
| Body > 1mb | **เดิม**: 413 `INTERNAL_ERROR` + อังกฤษ → **แก้แล้ว**: 413 `PAYLOAD_TOO_LARGE` + ข้อความไทย (ดู §3 ข้อ 1) | defect fix + test ✓ |
| Wrong method (มี token) | `DELETE /booking/available` · `PATCH /report/driver-workload` → **404 JSON envelope** (`NOT_FOUND`) ไม่ใช่ HTML/500 | sprint13 ✓ |
| SQLi ค้นหา (departments/employees/stops) | 200 · payload อยู่ใน **bind values เท่านั้น** ไม่มีใน SQL string · ทุก `LIKE` มี `ESCAPE` | sprint13 ✓ |
| SQLi validate ก่อน query | `booking/me?status=` · `booking/available?date=` · `driver/schedule?date=` ผิดรูป → **400 ก่อนเรียก `db.query`** (0 queries) | sprint13 ✓ |
| Race ยกเลิกซ้ำ | parallel ×2 → **200 หนึ่ง + 409 `INVALID_STATUS` หนึ่ง** · UPDATE ครั้งเดียว | sprint13 ✓ |
| Race สแกนซ้ำ | parallel ×2 → **`checked_in` + `already_checked_in`** · `trip_passenger` แถวเดียว | sprint13 ✓ |
| Regression ทั้งชุด | **13 suites / 364 tests ผ่านทั้งหมด** (เดิม 354 + ใหม่ 10 · ไม่มี test เดิมถูกลด assertion) | `npm.cmd test -- --runInBand` |

## 3. Deviations จาก openapi (เปิดเผย — ไม่ใช่ silent change)

| # | เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|---|
| 1 | **413 `PAYLOAD_TOO_LARGE`** — openapi รายการ error mapping = 400/401/403/404/409/422/429/500 (ไม่มี 413) | คง **413** + code คงที่ + ข้อความไทย | ตรง semantics ของ HTTP/body-parser · ฝั่ง client อ่าน `error.code` เป็นหลักอยู่แล้ว · **แนะนำให้เพิ่ม 413 ใน openapi** (รอบนี้ห้ามแก้สเปก) |
| 2 | **501 `REPORT_NOT_SELECTED`** (R2/R3/R5/R7 — Sprint 12) | คง 501 | มีตัวอย่างใน openapi `components/responses/NotImplemented` แล้ว แต่ 501 ไม่อยู่ในบรรทัด error mapping บรรทัดบน — spec เองก็ contradict ตัวเอง · openapi มีอำนาจเหนือ Q-list เดิม |
| 3 | envelope ชั้นนอกมีทั้ง `error:{...}` และ `status/code/message` ซ้ำ | คงไว้ | `ErrorEnvelope` ในสเปกกำหนด `required: [success, error]` ส่วน field บน = backward compatibility กับ test เดิม (errorHandler header ระบุไว้เอง) |

## 4. สิ่งที่ "ยังไม่" ตรวจ / ยังไม่จริง (ห้ามอ้างเกิน)

- ⬜ **ยังไม่มี live-Oracle integration**: ผลทั้งหมดใน §2 มาจาก fake repos + mocked `db.query` — query จริงบน Oracle (T-060 Part B · view 05 · seed 04) **ยังไม่เคยรันที่ไหน**
- ⬜ **ยังไม่ได้วัดผล performance** — T-057 ให้แค่ script + ขั้นตอนทำซ้ำ · ตารางผลวัดว่างเปล่า (`perf-procedure-t057.md` §5)
- ⬜ ยังไม่ได้ verify ด้วย openapi validator จริง (Redocly/swagger-cli) — contract ตรวจด้วย test อ่าน YAML เอง
- ⬜ ยังไม่มี human review (AR-02) · ไม่ได้ commit/push · ไม่มี Tag `v1.0.0`
- ⬜ การทดสอบระดับ transport/infra จริง: TLS, rate-limit ครบวงจร (รอหมดอายุ), multi-instance token revocation, load test หลาย concurrent clients
- ⬜ Race tests จำลอง row-lock ด้วย mutex (ดูข้อจำกัดใน §5) — ยังไม่ได้พิสูจน์บน Oracle FOR UPDATE จริง

## 5. ข้อจำกัดของ race test (ต้องพูดตรง ๆ)

`withTransaction` ใน test = mutex ที่ serialize ทีละ transaction เพื่อ **จำลองพฤติกรรมของ `SELECT … FOR UPDATE` ของ Oracle** (transaction ที่ 2 รอ transaction แรก commit) · สิ่งที่ test พิสูจน์ = *logic ของ service ถูกต้องเมื่อ row lock ทำงานตามที่ Oracle สัญญา* (ตรวจซ้ำ → 409/already_checked_in · ไม่ insert ซ้ำ) · สิ่งที่ **ยังไม่พิสูจน์** = ตัว Oracle lock เอง (ต้องรันจริง 2 sessions บน Oracle) — SQL `FOR UPDATE` ใน repo อ่านด้วยตาแล้ว (`booking.repository lockBooking` = `FOR UPDATE` ไม่ใช่ NOWAIT ตาม openapi x-transaction)

## 6. T-061 ส่วนที่เหลือ (งาน stream เอกสาร — ไม่ใช่ของ stream นี้)

| รายการ | สถานะ |
|---|---|
| Traceability Matrix (Req ↔ UC ↔ Table ↔ Screen ↔ Test) | ⬜ stream เอกสาร |
| รายงานบทที่ 1–18 · README (วิธีรัน) | ⬜ stream เอกสาร |
| AI Usage Credit / Prompt Log ฉบับรวม (ภาคผนวก ค) | ⬜ stream เอกสาร (ไม่แตะ `ai-credit-log.md` — preserve) |
| Export PNG diagrams + Tag `v1.0.0` | ⬜ stream เอกสาร · tag ต้อง commit (สั่งห้าม commit ในรอบนี้) |
| หน้าจอรายงานฝั่ง Flutter (T-058/R7) | ⬜ Flutter stream |
