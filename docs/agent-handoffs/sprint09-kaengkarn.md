# Sprint 9 Handoff — เก่งกาญ (kaengkarn) · T-036 / T-038 / T-039 / T-042

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ⚠️ CONTRACT-DRIFT-01 — ยัง open (อ้างจาก sprint08 handoff — ไม่ได้แก้/ไม่ได้ merge)

| ฝั่ง | commit | พฤติกรรม |
|---|---|---|
| **kaengkarn (ที่นี่)** | HEAD `1818593` | snake_case `route_id` · `GET/PUT /routes/{id}/stops` |
| **sukhsorn (peer)** | HEAD `b107da0` | camelCase `routeId` · `GET/PUT /routes/{id}` |

- ยังคง **ห้ามอ้าง live interoperability / "ครบทุก sprint"** · ไม่ merge อัตโนมัติ · ไม่แตะ code ฝั่ง peer
- sprint 9 รอบนี้ทำเฉพาะ backend stream (booking cancel/me + audit) — ไม่แตะ `docs/api/openapi.yaml`

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 9 DoD | สถานะ |
|---|---|---|
| **T-036** BR-06 สองชั้น | ชั้น Service (400 ก่อนเข้า tx — regression จาก sprint8) + ชั้น **CHECK CONSTRAINT** `ck_booking_seats`: INSERT คืน **ORA-02290 → 400 `VALIDATION_ERROR` BR-06 + rollback** (ไม่ใช่ 500, ไม่ leak ORA) + schema static ยืนยัน `CHECK (seats BETWEEN 1 AND 4)` | ✅ (local tests) |
| **T-038** `POST /booking/{id}/cancel` (UC-21) | tx: `SELECT booking ... FOR UPDATE` (**blocking** ตาม openapi x-transaction) → 404 → 403 เจ้าของ → 409 ซ้ำ/422 สถานะ → 409 `< 20 นาที` → `UPDATE status='cancelled', cancel_time=SYSTIMESTAMP` + commit · **BR-08 คืนที่นั่ง** (SUM นับเฉพาะ `reserved` — ว่าง 6→7 พิสูจน์จริง) · หลังยกเลิก QR → 404 | ✅ (local tests) |
| **T-039** `GET /booking/me` (UC-19) | `status` enum `upcoming\|completed\|cancelled\|all` (default `upcoming` · ผิด → 400 details `field:'status'`) · `cust_id` จาก **JWT เท่านั้น** (`?cust_id=99` ถูกละเลย) · `meta` = `{page,limit,total,total_pages}` · รูป item = openapi Booking + `schedule{...}` · page/limit clamp (ไม่ 400) | ✅ (local tests) |
| **T-042** Audit Log + API logging | `audit_log` table **เพิ่มลง `database/01_schema.sql`** (8 คอลัมน์ · PK identity · **ไม่มี FK**) · `audit.repository.insert` (`autoCommit:true`) · `app.js` ต่อ default sink · `audit.js` **mask ค่า query ของ password/token/...** ก่อนถึง sink · ยัง write-methods-only (GET ไม่ audit — ล็อกโดย test เดิม) | ✅ (local tests) |
| Sprint 8 test 2 ตัวที่ถูก scope ครอบ | wiring `3 ops → 5 ops` (+`cancelGuard` + `BK.CANCEL`) · `/me`+`/cancel` `404 → 401` (endpoint ลงทะเบียนแล้ว) | ✅ ขยายตามขอบเขต ไม่ใช่การอ่อนข้อ (หัวไฟล์บันทึกไว้) |

## ไฟล์ที่สร้าง/แก้

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/src/repositories/audit.repository.js` | `createAuditRepository(db)` → `insert(entry)`: INSERT 6 คอลัมน์ binds + `{autoCommit:true}` (global autoCommit=false) · ตัด `path≤500 / method≤10 / ip≤45` · ไม่ insert `ts` (`created_at DEFAULT SYSTIMESTAMP`) · db ไม่ inject → fallback `config/db.query` |
| `backend/tests/sprint09.test.js` | **36 tests / 6 describe blocks** (รายละเอียดด้านล่าง) |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `database/01_schema.sql` | **`CREATE TABLE audit_log`** (audit_id identity PK · method · path · status_code · duration_ms · emp_id ไม่ทำ FK · ip · created_at) + `COMMENT ON` table+8 columns · **อัปเดตตัวเลขทุกจุด**: ตาราง 20→**21** · คอลัมน์ 102→**110** · PK 20→**21** · Constraint 77→**78** · COMMENT 122→**131** · verification block ทั้ง `ค่าที่คาดหวัง` และ query `expected` (TABLE/COLUMN/PK/T_COMMENT/C_COMMENT) |
| `backend/src/repositories/booking.repository.js` | **+`lockBooking`** (scalar subquery `board_arrive_at` + **`FOR UPDATE`** ไม่ใช่ NOWAIT) · **+`cancelBooking`** (UPDATE status+cancel_time) · **+`listMine`/`countMine`** (JOIN employee/schedule/route/stop×2/vehicle/driver_assign · WHERE 4 แบบ · `ORDER BY s.depart_at, b.booking_id` · `OFFSET/FETCH` binds) · `findDetails` ขยาย: `cust_name` (join employee) + `driver_name` (MIN assign subquery) |
| `backend/src/services/booking.service.js` | **+`listMyBookings`** (validate status → `parsePagination` → count/list → `buildMeta`) · **+`cancelBooking`** (tx flow ตามลำดับด้านบน · ข้อความ openapi) · **+catch `errorNum 2290` → 400 BR-06** · mapper `toMyBooking` (14 ฟิลด์ + schedule 5 ฟิลด์) · `toBooking` เดิมไม่แตะ (POST 201 shape เดิม) |
| `backend/src/routes/booking.routes.js` | **+`GET /me`** (`viewGuard` = BK.VIEW) · **+`POST /:id/cancel`** (`cancelGuard` = **BK.CANCEL**) → 5 operations · ข้อความ 200 cancel ตรงตัวอย่าง openapi |
| `backend/src/middleware/audit.js` | **+`redactPath`** (`password\|token\|access_token\|refresh_token\|qr_token\|secret` → `***`) ก่อนส่ง sink · export เพิ่ม `redactPath` · คง write-only + entry 7 คีย์เดิม (test เดิมล็อก) |
| `backend/src/app.js` | default sink = `createAuditRepository(db).insert` (`auditSink \|\| ...`) · header → T-042 |
| `backend/src/middleware/index.js` | export `redactPath` |
| `backend/src/repositories/index.js` | export `audit` · header → T-042 |
| `backend/src/services/index.js` | header → T-042 |
| `backend/tests/sprint08.test.js` | **2 test + หัวไฟล์** ตามขอบเขตใหม่ (ด้านบน) — ไม่มี test  nàoถูกลบ/อ่อนข้อ |

`database/02_seed_master.sql` (มี `BK.CANCEL` อยู่แล้ว line 74) · `docs/api/openapi.yaml` · script/config · test เดิมอื่น: **ไม่ได้แตะ**

## Verification (รันจริงทั้งหมด)

1. **Smoke**: `node -e "require('./src/app')"` → `app require OK`

2. **`npx.cmd jest --runInBand tests/sprint09.test.js`** (workdir `backend/`):

```
PASS tests/sprint09.test.js
Test Suites: 1 passed, 1 total
Tests:       36 passed, 36 total
```

3. **`npm.cmd test -- --runInBand`** (คำสั่งเดียว / workdir `backend/`):

```
Test Suites: 9 passed, 9 total
Tests:       274 passed, 274 total
Time:        34.896 s
Ran all test suites.
```

   → เดิม 238 (รวม sprint08 43 ที่ผ่านหลังแก้ 2 test) + sprint09 ใหม่ 36 = **274/274**

### สิ่งที่ test คุม (36 tests)

| Suite | ครอบคลุม |
|---|---|
| T-039 `GET /booking/me` (9) | 401 · 403 (ไม่มี BK.VIEW) · default upcoming = `[5,4]` เรียง depart_at (จองปี 2020 ถูกกรอง) + meta · รูป item `toEqual` ครบ 14 ฟิลด์ + schedule 5 ฟิลด์ (ไม่มี qr_token) · `completed→[6]` `cancelled→[2]` `all→[7,5,2,3,4,6]` · 400 invalid status (details เป๊ะ) · `?cust_id=99` ถูกละเลย · admin เห็น `[]` (JWT scoping) · pagination `limit=1&page=2` + clamp `page=0&limit=999` · page เกินจริง → `data:[]` meta ถูก (ไม่ 400/404) |
| T-038 `POST /booking/{id}/cancel` (9) | 401 · 403 guard (outsider + viewer ไม่มี BK.CANCEL — `lockBooking` ไม่ถูกเรียก) · 404 (lock ใน tx ก่อนค่อย 404 / id `abc` → ก่อนเข้า tx) · 403 ownership ข้อความ openapi · 409 ซ้ำ (`INVALID_STATUS` + `'การจองนี้ถูกยกเลิกไปแล้ว'`) · 422 checked_in (ข้อความ openapi เป๊ะ) + 422 completed · 409 `CANCEL_TOO_LATE` (15 นาที < 20 · ไม่แตะ UPDATE) · 200 สำเร็จ (message+data shape+commit+audit entry) · **BR-08 ว่าง 6→7** + `/me cancelled` เห็นรายการ + QR 404 · dynamic RBAC ถอด BK.CANCEL → 403 |
| T-036 BR-06 (3) | seats=5 → 400 ก่อนเข้า tx (INSERT/lock ไม่ถูกเรียก) · **ORA-02290 → 400 BR-06 + rollback + ไม่ leak ORA** · schema static `ck_booking_seats CHECK (seats BETWEEN 1 AND 4)` |
| T-042 Audit (8) | write → sink entry ครบ 7 คีย์ + `empId` จาก JWT + statusCode จริง · **GET ไม่เรียก sink** · login → `empId: null` · **redaction integration** (`password=***&token=***&qr_token=***&access_token=***` · `keep=1` ไม่โดน · ไม่มีค่าจริงหลุดใน entry) + `redactPath` unit · sink reject → 200 ปกติ + ไม่มี unhandledRejection · schema static (8 คอลัมน์เป๊ะ · ไม่มี FK · จำนวน 21/110/78/131 + verification query) · wiring static (app.js/audit.js) · `audit.repository` SQL+binds+`autoCommit:true`+ตัดยาว |
| repository SQL (6) | `lockBooking` `FOR UPDATE` ไม่ใช่ NOWAIT + scalar subquery + bind · `cancelBooking` UPDATE + ไม่แตะ `seats` · `listMine` 4 สถานะ (variants) + `OFFSET/FETCH` binds + ไม่ `SELECT *` · injection `custId` อยู่ใน bind ล้วน · `countMine` COUNT(*) + bind เฉพาะ custId · `findDetails` cust_name + driver MIN subquery |

## Contract decisions ที่ reviewer ต้องรู้

| # | เรื่อง | ที่เลือก | เหตุผล/ที่มา |
|---|---|---|---|
| 1 | ลำดับตรวจ cancel | **404 → 403 เจ้าของ → สถานะ (409 ซ้ำ / 422) → 409 เวลา** | ห้าม leak ข้อมูลคนอื่นก่อน · openapi ไม่ระบุลำดับ — บันทึกเป็น decision |
| 2 | ยกเลิกซ้ำ (status=cancelled) | **409 `INVALID_STATUS`** `'การจองนี้ถูกยกเลิกไปแล้ว'` | openapi 409 กลุ่ม INVALID_STATUS — interpretation (ไม่ใช่ 422) |
| 3 | checked_in / completed / no_show | **422 `INVALID_STATUS`** (ข้อความ checked_in ตรงตัวอย่าง openapi) | DoD/UC-21 4c |
| 4 | เกิน 20 นาที (ASM-07-2) | **409 `CANCEL_TOO_LATE`** `'เลยกำหนดเวลายกเลิกแล้ว'` | openapi declare — ตรวจ **หลัง** สถานะ |
| 5 | BR-08 คืนที่นั่ง | ไม่มีคอลัมน์ "ที่นั่งว่าง" — คืนด้วย `status='cancelled'` (SUM นับเฉพาะ `reserved` เท่านั้น) | design เดิมจาก sprint8 — หลีกเลี่ยง UPDATE หลายแถว |
| 6 | lock ของ cancel | **`FOR UPDATE ธรรมดา** (ไม่ NOWAIT) | openapi x-transaction เขียน plain FOR UPDATE · ไม่มี 409 lock ในสเปก cancel |
| 7 | `upcoming` | `status='reserved' AND service_date >= TRUNC(SYSDATE)` | นิยามจาก chapter-18 tab "กำลังจะถึง" — **ไม่** กรอง lead time |
| 8 | `cust_id` ของ /me | มาจาก JWT เสมอ · query `cust_id` ถูกละเลย | openapi ในตัวเมธอดไม่รับ — P-04 กันยิงค่า |
| 9 | guards | `/me` → **BK.VIEW** · `/cancel` → **BK.CANCEL** (seed line 74 มีอยู่แล้ว) | permission code จาก seed — ไม่เดา |
| 10 | pagination /me | `parsePagination` clamp (page≥1, limit≤100) — **ไม่ตอบ 400** | convention เดิมทุก list endpoint |
| 11 | ORA-02290 → | 400 `VALIDATION_ERROR` + details `field:'seats'` BR-06 | CHECK ที่ user รับผิดชอบได้คือ `ck_booking_seats` เท่านั้น (status/seats ฝั่ง service เช็คก่อน) |
| 12 | audit scope | **write-methods-only** · entry 7 คีย์ · ไม่เก็บ body/header · path mask ค่า sensitive query | test เดิมล็อก GET ไม่ audit — T-042 ต่อยอดไม่ย้อนกลับ |
| 13 | `audit_log.emp_id` | **ไม่ทำ FK** (log ต้องอยู่แม้ลบพนักงาน) · ไม่ตีกรอบเป็น FK 27 เดิม | design — บันทึกใน schema comment |
| 14 | audit insert | `autoCommit:true` ต่อแถว (แยกจาก TX หลัก) · `created_at DEFAULT SYSTIMESTAMP` | audit ห้าม roll back รวมคำขอ |
| 15 | default sink | `app.js` ต่อ DB insert เมื่อไม่ inject `auditSink` · pool ยังไม่ขึ้น → reject → middleware log เอง (ไม่ throw ออกมา) | คง testability เดิม |

## shapes จริงตามที่ implement (ให้ coordinator reconcile กับ authoritative requirements)

> พิสูจน์ด้วย local tests — ไม่ใช่การอ้าง interoperability/cross-workspace

### `GET /api/v1/booking/me?status=&page=&limit=`

```json
{"success":true,"data":[{"booking_id":5,"booking_code":"BK5","cust_id":7,"cust_name":"มานี รักดี",
"sched_id":21,"board_stop_id":1,"board_stop_name":"มหาวิทยาลัยเทคโนโลยีมหานคร",
"alight_stop_id":4,"alight_stop_name":"ร้านส้มตำปูนาง","seats":2,"status":"reserved",
"book_time":"...","cancel_time":null,
"schedule":{"service_date":"2026-10-08","depart_at":"...","route_name":"เส้นทางที่ 2",
"plate_no":"สย 2592","driver_name":"สมชาย ขับรถ"}}],
"meta":{"page":1,"limit":20,"total":2,"total_pages":1}}
```

- 400 ถ้า `status` นอก enum: `details:[{field:'status', message:'must be one of upcoming, completed, cancelled, all'}]`
- ไม่มี `qr_token` ใน list (ตรรกะเดียวกับ openapi ตัวอย่าง GET list)

### `POST /api/v1/booking/{id}/cancel`

200: `{"success":true,"message":"ยกเลิกการจองสำเร็จ ที่นั่งถูกคืนเข้ารอบแล้ว","data":<Booking ฉบับเต็ม + schedule>}`

| กรณี | status | code | ข้อความ/details |
|---|---|---|---|
| ไม่มี token | 401 | `UNAUTHORIZED` | global middleware |
| ไม่มี BK.CANCEL | 403 | `FORBIDDEN` | guard message |
| ไม่พบ / id ไม่ใช่เลข | 404 | `NOT_FOUND` | `'ไม่พบข้อมูลที่ต้องการ'` |
| ของคนอื่น | 403 | `FORBIDDEN` | `'ยกเลิกได้เฉพาะรายการของตัวเองเท่านั้น'` |
| ยกเลิกแล้ว | 409 | `INVALID_STATUS` | `'การจองนี้ถูกยกเลิกไปแล้ว'` |
| checked_in/completed/no_show | 422 | `INVALID_STATUS` | ข้อความสถานะ |
| < 20 นาที | 409 | `CANCEL_TOO_LATE` | `'เลยกำหนดเวลายกเลิกแล้ว'` |
| ไม่คาดคิด | 500 | `INTERNAL_ERROR` | ไม่ leak ORA |

## ⚠️ สิ่งที่ reviewer/คนถัดไปต้องทำ (นอกเหนือจาก code)

1. **ยังไม่ integration Oracle จริง** — `SELECT ... FOR UPDATE` (สอง connection แข่งกันจริง) · `TRUNC(SYSDATE)`/timezone (`service_date >= วันนี้` ใช้ NLS/เซสชันจริง) · ORA-02290 จริงจาก `ck_booking_seats` · INSERT `audit_log` + `autoCommit` — ทั้งหมดรันบน fake repos + static SQL เท่านั้น
2. **AR-02 Human code review ยังไม่ได้ทำ** — local tests ผ่าน **ไม่เท่ากับ** human review / live integration / **ครบทุก requirement**
3. **CONTRACT-DRIFT-01** ยังค้าง coordinator (หัวไฟล์)
4. **ตัวเลข schema เปลี่ยน** (21 ตาราง/110 คอลัมน์/78 constraint/131 comment) — ต้องรัน verification block บน Oracle จริงยืนยัน `STATUS=PASS` ทุกแถว · **`docs/report/chapter-08*` ยังเขียน "20 ตาราง"** — เป็นของ documentation stream ไม่ได้แก้ที่นี่
5. Frontend ต้องยิง shapes ด้านบน (list ไม่มี qr_token · cancel คืน data ฉบับเต็ม)

## Unresolved checks / Blocked acceptance criteria

| ข้อ | เกี่ยวกับ Sprint 9 อย่างไร | สถานะ |
|---|---|---|
| **CONTRACT-DRIFT-01** | ยัง open — ไม่กระทบโค้ด batch นี้ | ⛔ coordinator |
| **Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24** | ไม่กระทบ batch นี้ · **ไม่ได้ถามซ้ำ** | ⛔ ตามเดิม |
| **Q17** (จองซ้ำ) · **BR-05/`SCHEDULE_LOCKED` codes** · **403 ที่ `/booking/available`** | ค้างจาก sprint8 — ไม่ได้แก้/ทวน | ⏳ เหมือนเดิม |
| ยกเลิกซ้ำ→409 · ลำดับตรวจ cancel · `upcoming` = reserved+วันนี้ · capacity-null→SEAT_FULL | interpretation ใหม่ 5 ข้อ (decision #1–7) | ⏳ ให้ reviewer ยืนยัน |
| audit_log นับ 21 ตาราง · ไม่มี FK | design ใหม่ — ต้อง verify บน Oracle จริง | ⏳ integration |

## git status (สิ่งที่เปลี่ยนรอบนี้ — จาก `git status --porcelain` รวมของเดิม)

```
M  database/01_schema.sql               (+audit_log +ตัวเลข)
M  backend/src/app.js                   (+audit sink)
M  backend/src/middleware/audit.js       (+redactPath)
M  backend/src/middleware/index.js       (+redactPath)
?? backend/src/repositories/audit.repository.js
?? backend/tests/sprint09.test.js
?? docs/agent-handoffs/sprint09-kaengkarn.md  (ไฟล์นี้)
```

ไฟล์ที่แก้ในไฟล์เดิมซึ่ง untracked/modified อยู่แล้ว (ยังไม่ commit ทั้งหมด):
`backend/src/repositories/booking.repository.js` · `backend/src/services/booking.service.js` · `backend/src/routes/booking.routes.js` · `backend/src/repositories/index.js` · `backend/src/services/index.js` · `backend/tests/sprint08.test.js` (2 test + หัวไฟล์)

ไฟล์ dirty เดิมที่ **ไม่ได้แตะ** (preserve, ห้าม push ปน):
`backend/src/config/{db,env}.js` · `backend/src/middleware/{errorHandler,validate}.js` · `database/02_seed_master.sql` · `docs/agile/*` · `docs/ai-credit-log.md` · `docs/kaengkarn-check-list.md` · `.playwright-mcp/` · `convert_svg.py`

## งานต่อไป

- **ยังไม่ commit/push** — เป็นหน้าที่ coordinator (ถ้าจะ commit: เฉพาะไฟล์ sprint 9 + handoff + การแก้ sprint08 test 2 ตัวเท่านั้น)
- Coordinator: reconcile CONTRACT-DRIFT-01 + decisions ด้านบน + shapes กับ authoritative requirements
- Integration test Oracle จริง (FOR UPDATE จริง · ORA-02290 จริง · audit INSERT จริง · `TRUNC(SYSDATE)`) · รัน schema verification · AR-02 code review
- batch ถัดไป: ตามที่ coordinator dispatch (T-029/T-039/T-053/T-055 ที่ยังค้าง / frontend stream)

---
*จัดทำโดย: เก่งกาญ `[ai-assisted]` · คำสั่ง verification ทั้งหมดรันจริงบน Windows/Node v24.21.0 · **local tests ≠ human review ≠ live integration ≠ ครบทุก requirement***
