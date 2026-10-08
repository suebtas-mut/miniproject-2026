# Sprint 8 Handoff — เก่งกาญ (kaengkarn) · T-034 / T-035 / T-037

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ⚠️ CONTRACT-DRIFT-01 — OpenAPI baseline ของสอง workspace ไม่ตรงกัน (บันทึกตามคำสั่ง coordinator)

| ฝั่ง | commit | พฤติกรรม |
|---|---|---|
| **kaengkarn (ที่นี่)** | HEAD `1818593` | `docs/api/openapi.yaml` = **snake_case `route_id`** · path **`GET/PUT /routes/{id}/stops`** · `backend/src/routes/front.routes.js` **ไม่ mount** `GET/PUT /routes/{id}` (test ยืนยัน 404) |
| **sukhsorn (peer)** | HEAD `b107da0` | OpenAPI = **camelCase `routeId`/`includeStops`** · `FrontRepository` เรียก **`GET/PUT /routes/{id}`** |

ผลกระทบ/ข้อจำกัดที่ต้องยึด:

- **ห้ามอ้าง live interoperability** — test ทั้งหมดรอบนี้เป็น mock/fake repos + โค้ดจริง (assert ผ่าน spy) เท่านั้น ไม่มีการยิงข้าม workspace จริงแม้แต่ request เดียว
- **ห้ามอ้าง "ครบทุก sprint"** — sprint 9 (T-038/T-039) ยังไม่ทำ · AR-02 human review ยังไม่ได้ทำ · integration Oracle จริงยังไม่รัน
- **ไม่ merge อัตโนมัติ** · ไม่แตะ code ฝั่ง peer · ไม่เดา endpoint ใหม่
- Frontend fixtures ของ sukhsorn ต้องถูกปรับไปใช้ API จริงที่ backend ที่นี่ implement ไว้ (ดู "shapes จริงตามที่ implement" ด้านล่าง) ห้ามเงียบ ๆ รับ spec ที่เข้ากันไม่ได้
- Coordinator ใช้หัวข้อ "shapes จริง" ด้านล่าง reconcile กับ requirements ที่เป็นอำนาจบังคับใช้

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 8 DoD | สถานะ |
|---|---|---|
| **T-034** `GET /booking/available` (UC-17) | validate 4 พารามิเตอร์ · BR-05 ตัดรอบ < 20 นาที · BR-07 ตัดรอบเต็ม · BR-11 ตัดคู่กลับด้าน (คู่อื่นปกติ → 200) · BR-12 คู่ไม่อยู่ใน route/วันไม่มีรอบ → `data: []` | ✅ (local tests) |
| **T-035/T-036** `POST /booking` (UC-18) | tx: `FOR UPDATE NOWAIT` schedule → BR-05 ใน tx (400 `LEAD_TIME_REQUIRED` + rollback) · BR-06 (400 ตามตัวอย่าง openapi) · BR-07 นับที่นั่ง (409 `SEAT_FULL` + จำนวนที่เหลือ) · ORA-00054 → 409 `SCHEDULE_LOCKED` · 201 commit · oversell พร้อมกัน = INSERT เดียว | ✅ (local tests) |
| **T-037** `GET /booking/{id}/qr` (UC-20) | ownership (403 ข้อความสิทธิ์ QR) · cancelled → 404 · checked_in → 200 + status · `qr_token` สุ่มจริง + `qr_image` PNG จริง | ✅ (local tests) |
| BR-06 max-4 | seats นอก 1–4 → 400 `VALIDATION_ERROR` + `details[{field:'seats', message:'ต้องมีค่าระหว่าง 1 ถึง 4 (BR-06)'}]` — ไม่เข้า transaction | ✅ |
| ไม่ทำ (นอก batch) | `GET /booking/me` (T-039) · `POST /booking/{id}/cancel` (T-038) → ตอบ 404 จริง (มี test) | ⛔ sprint 9 |

## ไฟล์ที่สร้าง/แก้ (ทั้งหมดอยู่ใน `backend/`)

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `src/repositories/booking.repository.js` | `findAvailable` (query เดียว: BR-05 `INTERVAL '20' MINUTE` + BR-11 `ass.stop_seq > bss.stop_seq` + BR-07 `NVL(capacity) - SUM(reserved)` · binds `:boardStop/:alightStop/:serviceDate` · ORDER BY `depart_at`) · `findStopPairSeqs` (ตรวจ BR-11 ก่อน tx) · `findBookingContext` (LEFT JOIN — แยก 404 ออกจาก 422) · `lockSchedule` (**`FOR UPDATE NOWAIT`** เฉพาะแถว schedule) · `seatSummary` (NVL capacity + scalar SUM reserved · **ไม่ FOR UPDATE aggregate** — ORA-02014) · `insertBooking` (**`'BK' || seq_booking_code.NEXTVAL`** + `RETURNING :newId` BIND_OUT) · `findDetails` |
| `src/services/booking.service.js` | UC-17/18/20 logic · `isRealDate` (round-trip กัน `2026-02-30`) · `leadMinutes` · defense-in-depth กรอง BR-05/07/11 ซ้ำฝั่ง service · `renderQrImage` (`qrcode.toBuffer` → base64 PNG) · error codes/messages คงที่ · catch errorNum 54 → 409 |
| `src/routes/booking.routes.js` | 3 operations · guards `BK.VIEW` (GET) / `BK.CREATE` (POST) · `validate(BOOKING_RULES)` (4 integer required) |
| `tests/sprint08.test.js` | **43 tests / 5 describe blocks** (รายละเอียดด้านล่าง) |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `src/app.js` | mount `/booking` หลัง `/routes` · header comment → T-037 |
| `src/repositories/index.js` | export `booking` · header → T-037 |
| `src/services/index.js` | เพิ่ม `booking: createBookingService(...)` · header → T-037 |

`database/*`, `middleware/*`, script/config, test เดิม (sprint04–07): **ไม่ได้แตะ**

## Verification (รันจริงทั้งหมด)

1. **Smoke โหลดแอปจริง**: `node -e "require('./src/app')"` → `app loaded OK`

2. **`npx.cmd jest --runInBand tests/sprint08.test.js`** (ใน `backend/`):

```
PASS tests/sprint08.test.js (7.855 s)

Test Suites: 1 passed, 1 total
Tests:       43 passed, 43 total
Snapshots:   0 total
Time:        7.968 s
```

3. **`npm.cmd test -- --runInBand`** (คำสั่งเดียว / workdir `backend/`):

```
Test Suites: 8 passed, 8 total
Tests:       238 passed, 238 total
Snapshots:   0 total
Time:        15.96 s
Ran all test suites.
```

   → เดิม 195 tests (sprint04–07 + health/middleware/db) **ไม่แก้ไฟล์ test เดิมเลย** + sprint08 ใหม่ 43 = **238/238**

### สิ่งที่ test คุม (43 tests)

| Suite | ครอบคลุม |
|---|---|
| T-034 GET `/booking/available` (12) | 401 · 403 (outsider ไม่มี BK.VIEW) · 400 ขาดพารามิเตอร์/รูปแบบผิด/`2026-02-30`/`board_stop=abc` · 400 BR-11 ทุกคู่กลับด้าน (UC-17 3a — `findAvailable` ไม่ถูกเรียก) · 200 รูป AvailableSchedule ครบตาม openapi + ไม่มี meta · BR-05 (round 21 ถึงใน 15 นาที) ไม่แสดง · BR-07 (round 22 เต็ม 4/4) ไม่แสดง · BR-11 (round 25 กลับด้าน) ตัดแต่คู่อื่นยัง 200 · BR-12 → `data: []` · defense-in-depth 3 ตัว (แถวหลุดจาก SQL → service ตัดทิ้ง ไม่แตะแถวถูก) |
| T-035/036/037 POST `/booking` (16) | 401 · 403 (viewer มี BK.VIEW ไม่มี BK.CREATE) · 400 validate (ขาด field / seats ไม่ integer) · 400 BR-06 (`0, 5, -1` → ตามตัวอย่าง openapi · **ไม่เข้า tx**) · 404 (รอบไม่มีจริง / `is_active=0` · ไม่เข้า tx) · 422 BR-12 · 422 BR-11 · 400 BR-05 ใน tx + **rollback** · 409 `SEAT_FULL` ข้อความ `'เหลือที่นั่งว่าง 1 ที่นั่ง'` + rollback · 409 ORA-00054 → `SCHEDULE_LOCKED` ไม่ค้าง + rollback · 201 สำเร็จ (รูป Booking ครบ · qr_token 32 hex · PNG magic `89 50 4E 47` · commit · `cust_id` มาจาก JWT) · BR-07 accounting จองทีละรอบเห็นผลทันที (เหลือ 6 → จอง 4 → เหลือ 2 → รอบสอง 409) · จอง 2 ครั้ง qr_token ต่างกัน · **oversell พร้อมกัน** `Promise.all` 2 request → สถานะ `[201, 409]` + INSERT ครั้งเดียว · INSERT ล้มเหลว → 500 **ไม่ leak ORA-00001** + rollback |
| T-037 GET `/booking/{id}/qr` (6) | 401 · 403 guard (outsider) + 403 ownership (ของคนอื่น — คนละข้อความ) · 404 ไม่มีการจอง / id `abc` · 404 cancelled (UC-20 A2) · 200 `BookingQr` `toEqual` ครบ (qr_token + qr_image + stop names + depart) · 200 checked_in (คืน status) |
| Guards + wiring (4) | 401 ทั้ง 3 endpoint · ถอด BK.VIEW/BK.CREATE ระหว่าง session → 403 ทันที (โหลดจาก DB ทุก request) · wiring อ่าน source จริง: 3 ops + guard ครบ · `/booking/me` + `/booking/4/cancel` → **404** |
| repository SQL static (6) | `findAvailable`: BR-05/07/11 อยู่ใน query เดียว + bind ครบ + ไม่มี `OR 1=1` + ไม่ `SELECT *` · pair/context LEFT JOIN + bind · `lockSchedule` FOR UPDATE NOWAIT ไม่มี SUM/COUNT · `seatSummary` NVL(SUM) เฉพาะ `status=reserved` + **ไม่ FOR UPDATE** · `insertBooking` `'BK' || seq_booking_code.NEXTVAL` + RETURNING + qr_token อยู่ใน bind (ไม่ literal) · `findDetails` join + bind เท่านั้น |

## Contract decisions ที่ reviewer ต้องรู้

| # | เรื่อง | ที่เลือก | เหตุผล/ที่มา |
|---|---|---|---|
| 1 | BR-05 บน POST | 400 code **`LEAD_TIME_REQUIRED`** · msg `'กรุณาจองล่วงหน้าอย่างน้อย 20 นาทีก่อนรถถึงจุดขึ้น'` | **code นี้ไม่มีใน openapi** (grep ยืนยัน) — บันทึกเป็น undeclared code |
| 2 | BR-06 | 400 `VALIDATION_ERROR` + `'ข้อมูลที่ส่งมาไม่ถูกต้อง'` + details `[{field:'seats', message:'ต้องมีค่าระหว่าง 1 ถึง 4 (BR-06)'}]` | ตรงตัวอย่าง openapi BadRequest (บรรทัด 241–242) เป๊ะ |
| 3 | BR-07 | 409 `SEAT_FULL` + `'ที่นั่งไม่เพียงพอ'` + details `[{field:'seats', message:'เหลือที่นั่งว่าง N ที่นั่ง'}]` | ตัวอย่างราย endpoint (openapi 4862) ชนะ generic example (ไม่มี `(BR-07)` ต่อท้าย) |
| 4 | ORA-00054 | 409 code **`SCHEDULE_LOCKED`** + ข้อความมี `'กรุณาลองอีกครั้ง'` | **undeclared** — บันทึกเป็น decision |
| 5 | BR-11 ทั้ง 2 ทาง | GET → 400 `STOP_ORDER_INVALID` (`'จุดจอดลงต้องอยู่หลังจุดจอดขึ้น'`) · POST → **422** code เดียวกัน | openapi GET ประกาศ 400 · POST ใช้กลุ่ม 422 rule-violation |
| 6 | BR-12 POST | 422 `STOP_NOT_IN_ROUTE` / `'จุดจอดที่เลือกไม่อยู่ในเส้นทางของรอบเวลานี้'` | openapi declare |
| 7 | QR ownership | 403 **`FORBIDDEN`** + `'ไม่มีสิทธิ์ดู QR ของการจองนี้'` · cancelled → 404 · checked_in → 200 + status | guard 403 vs ownership 403 **คนละข้อความ** (test แยก assert) |
| 8 | `booking_code` | `'BK' || seq_booking_code.NEXTVAL` inline ใน INSERT | chapter-17 บรรทัด 880 (schema ไม่มี trigger สำหรับ booking_code) |
| 9 | `qr_token` | `crypto.randomBytes(16).toString('hex')` (32 chars) | รูปแบบ example ใน openapi (chapter-17 เสนอ randomUUID แต่ shape  hex ถูกกว่า) |
| 10 | Guards | `BK.VIEW` (GET available + GET qr) · `BK.CREATE` (POST) | openapi **ไม่ declare 403** ที่ `/booking/available` — ยัง guard อยู่ (บันทึก) |
| 11 | รอบ `is_active=0` บน POST | **404 NOT_FOUND** (ไม่เข้า tx) | interpretation — บันทึกเป็น decision |
| 12 | capacity = null (ไม่มีรถ) | ถือเป็น 0 → 409 `SEAT_FULL` | BR-07 — จองตอนไม่มีรถ = ที่นั่ง 0 |
| 13 | ไม่มี restriction จองซ้ำ | **ไม่กันซ้ำ user เดิมจองรอบเดิม** (ไม่มี unique constraint ใน schema) | Q17 ยัง unresolved — ไม่เดา |
| 14 | Defense-in-depth | service กรอง BR-05 (`Math.floor` lead) / BR-07 / BR-11 ซ้ำ — นอกเหนือจาก SQL | ทำให้ behavior ทดสอบได้กับ fake repos + กันแถวหลุดจาก DB |
| 15 | BR-11/BR-12 | ทำฝั่ง service (และ SQL) เท่านั้น | schema CHECK ทำไม่ได้ — บันทึก |

## shapes จริงตามที่ implement (ให้ coordinator reconcile กับ authoritative requirements)

> **นี่คือ response ที่โค้ดที่นี่ produce จริง** (พิสูจน์ด้วย local tests) — ไม่ใช่การอ้าง interoperability กับ sukhsorn และไม่ใช่การอนุมัติว่าถูกต้องตาม requirements ที่ยังไม่ถูก reconcile

### `GET /api/v1/booking/available?board_stop&alight_stop&date`

```json
{"success":true,"data":[{"sched_id":20,"route_id":1,"route_name":"เส้นทาง A",
"service_date":"2026-10-07","depart_at":"2026-10-07T08:00:00",
"board_stop":{"stop_seq":2,"stop_name":"จุดขึ้น 2","arrive_at":"2026-10-07T08:05:00"},
"alight_stop":{"stop_seq":4,"stop_name":"จุดลง 4","arrive_at":"2026-10-07T08:15:00"},
"seats_total":9,"seats_reserved":3,"seats_available":6,"minutes_until_departure":48}]}
```

- query params ทั้ง 3 **required** (ขาด → 400 `VALIDATION_ERROR` + details ราย field)
- **ไม่มี `meta`** (ไม่มี pagination)
- ผลว่าง → `data: []` (200 ไม่ใช่ 404)

### `POST /api/v1/booking`

Request: `{"schedule_id":20,"board_stop":2,"alight_stop":4,"seats":2}` (integer ทุก field)

201:

```json
{"success":true,"data":{"id":101,"booking_code":"BK101",
"customer_id":7,"schedule_id":20,"board_stop":2,"alight_stop":4,"seats":2,
"status":"reserved","qr_token":"3f2a9c...","qr_image":"iVBORw0KGgo...",
"created_at":"2026-10-07T21:58:43.000Z"}}
```

Error matrix ที่ test ยืนยัน:

| กรณี | status | code | ข้อความ/details |
|---|---|---|---|
| ไม่มี token | 401 | `UNAUTHORIZED` | global middleware |
| ไม่มี BK.CREATE | 403 | `FORBIDDEN` | guard message |
| validate | 400 | `VALIDATION_ERROR` | `'ข้อมูลที่ส่งมาไม่ถูกต้อง'` + details |
| BR-06 | 400 | `VALIDATION_ERROR` | details `field:'seats'` BR-06 |
| BR-05 | 400 | `LEAD_TIME_REQUIRED` | undeclared code |
| รอบไม่มี/ปิด | 404 | `NOT_FOUND` | `'ไม่พบข้อมูลที่ต้องการ'` |
| BR-11/BR-12 | 422 | `STOP_ORDER_INVALID` / `STOP_NOT_IN_ROUTE` | — |
| BR-07 | 409 | `SEAT_FULL` | details จำนวนที่เหลือ |
| lock | 409 | `SCHEDULE_LOCKED` | undeclared code |
| ไม่คาดคิด | 500 | `INTERNAL_ERROR` | ไม่ leak ORA |

### `GET /api/v1/booking/{id}/qr`

200 `BookingQr`: `{"success":true,"data":{"booking_id":4,"booking_code":"BK4","qr_token":"...","qr_image":"<base64 PNG>","status":"reserved", ...stop names + depart...}}` · checked_in → เพิ่ม `"status":"checked_in"` · cancelled → 404

## ⚠️ สิ่งที่ reviewer/คนถัดไปต้องทำ (นอกเหนือจาก code)

1. **ยังไม่ได้ integration test กับ Oracle จริง** — `FOR UPDATE NOWAIT` (สอง connection แข่งกันจริง) · `seq_booking_code` · `INTERVAL '20' MINUTE` · timezone/DATE — ทั้งหมดรันบน fake repos + SQL assert ผ่าน spy เท่านั้น
2. **AR-02 Human code review ยังไม่ได้ทำ** — local tests ผ่าน **ไม่เท่ากับ** human review ผ่าน / integration จริงผ่าน / **ครบทุก requirement แล้ว**
3. **CONTRACT-DRIFT-01 (หัวบน)** ต้องให้ coordinator reconcile กับสเปก authoritative ก่อน — ห้ามใช้ test ที่นี่สรุปว่าหน้าต่าง API สองฝั่งเข้ากันได้
4. Frontend (sukhsorn) ต้องยิง shapes ด้านบนจริง ไม่ใช่ fixture ที่รับ spec ท้องถิ่นของตัวเอง

## Unresolved checks / Blocked acceptance criteria

| ข้อ | เกี่ยวกับ Sprint 8 อย่างไร | สถานะ |
|---|---|---|
| **CONTRACT-DRIFT-01** | snake_case vs camelCase + `/routes/{id}` ต่าง baseline — ข้าม workspace | ⛔ ส่ง coordinator reconcile · ไม่ merge เอง |
| **Q17** (จองซ้ำ user เดิม?) | ไม่มี restriction — ไม่เดา (decision #13) | ⏳ ค้างอาจารย์ |
| **BR-05 code** (`LEAD_TIME_REQUIRED`) · **lock code** (`SCHEDULE_LOCKED`) | undeclared ใน openapi | ⏳ ต้องเพิ่มในสเปกหรือแทนที่ |
| **403 ที่ `/booking/available`** · **401 message ต่างจากตัวอย่างราย endpoint** | openapi ไม่ declare — ยัง guard ด้วยค่า global | ⏳ บันทึกให้ reconcile |
| รอบ `is_active=0` → 404 (decision #11) · capacity null → SEAT_FULL (#12) | interpretation | ⏳ ยืนยันกับ requirements |
| **Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24** | ไม่กระทบ batch นี้ · **ไม่ได้ถามซ้ำ** | ⛔ ตามเดิม |
| T-038/T-039 (`/cancel`, `/me`) | นอก scope batch — ตอบ 404 ยืนยันแล้ว | ⛔ sprint 9 |

## git status (สิ่งที่เปลี่ยนรอบนี้)

```
M  backend/src/app.js                    (mount /booking)
M  backend/src/repositories/index.js     (+booking)
M  backend/src/services/index.js         (+booking)
?? backend/src/repositories/booking.repository.js
?? backend/src/services/booking.service.js
?? backend/src/routes/booking.routes.js  (รวม routes/ ทั้ง dir เป็น untracked)
?? backend/tests/sprint08.test.js
?? docs/agent-handoffs/sprint08-kaengkarn.md  (ไฟล์นี้)
```

ไฟล์ dirty เดิมที่ **ไม่ได้แตะ** (preserve, ห้าม push ปน):
`backend/src/config/{db,env}.js` · `backend/src/middleware/{errorHandler,index,validate}.js` · `database/02_seed_master.sql` · `docs/agile/*` · `docs/ai-credit-log.md` · `docs/kaengkarn-check-list.md` · `docs/agile/q-items-for-instructor.md` · `.playwright-mcp/` · `convert_svg.py`

## งานต่อไป

- **ยังไม่ commit/push** — เป็นหน้าที่ coordinator (ถ้าจะ commit: เฉพาะไฟล์ sprint 8 + handoff เท่านั้น)
- Coordinator: reconcile CONTRACT-DRIFT-01 + shapes ด้านบนกับ authoritative requirements
- Integration test กับ Oracle จริง (NOWAIT จริง 2 connections) · AR-02 code review
- sprint 9 (T-038 cancel / T-039 me)

---
*จัดทำโดย: เก่งกาญ `[ai-assisted]` · คำสั่ง verification ทั้งหมดรันจริงบน Windows/Node v24.21.0*
