# Sprint 10 Handoff — เก่งกาญ (kaengkarn) · T-043 / T-044 / T-045 / T-046

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ⚠️ CONTRACT-DRIFT-01 — ยัง open (อ้างจาก sprint08/sprint09 handoff — ไม่ได้แก้/ไม่ได้ merge)

| ฝั่ง | commit | พฤติกรรม |
|---|---|---|
| **kaengkarn (ที่นี่)** | HEAD `1818593` | snake_case `route_id` · `GET/PUT /routes/{id}/stops` |
| **sukhsorn (peer)** | HEAD `b107da0` | camelCase `routeId` · `GET/PUT /routes/{id}` |

- ยังคง **ห้ามอ้าง live interoperability / "ครบทุก sprint"** · ไม่ merge อัตโนมัติ · ไม่แตะ code ฝั่ง peer
- sprint 10 รอบนี้ทำเฉพาะ backend stream (driver schedule/start/manifest/scan) — ไม่แตะ `docs/api/openapi.yaml`

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 10 DoD | สถานะ |
|---|---|---|
| **T-043** `GET /driver/schedule` (UC-22) | rounds ของตัวเองเท่านั้น (driver_assign) · `?date=` optional (default วันนี้ · ผิด → 400 details `field:'date'`) · item = 13 ฟิลด์ openapi DriverSchedule · `end_at = depart_at + total_minutes` · `passenger_count` = COUNT `status='reserved'` · `can_start` 3 สถานะ + `blocked_reason` (3c/3b) | ✅ (local tests) |
| **T-044** `POST /driver/trip/{schedId}/start` (UC-23) | tx: `FOR UPDATE` (ไม่ NOWAIT · ORA-00054 → 409 SCHEDULE_LOCKED) → 404 → **422 NOT_ASSIGNED** (ไม่มีคนขับ/ไม่มีรถ) → **403** (ไม่ใช่คนขับที่ได้รับมอบหมาย · backup driver ผ่านได้) → **409 TRIP_ALREADY_STARTED** (3c ก่อน) → **409 TRIP_PENDING** (3b) → insert trip RETURNING → 201 `Trip` 7 ฟิลด์ + commit ครั้งเดียว | ✅ (local tests) |
| **T-045** `GET /driver/trip/{tripId}/manifest` (UC-24) | 403 ownership (trip.driver_id) · header 7 ฟิลด์ · stops เรียง `stop_seq` · **LISTAGG** `first_name||' '||last_name, ', ' WITHIN GROUP (ORDER BY last_name)` ขึ้น=`checkin_stop_id`+`checkin_time` ลง=`alight_seq`+`alight_time` · `is_passed` = `arrive_at <= now` · trip `completed` เปิดดูได้ | ✅ (local tests) |
| **T-046** `POST /driver/trip/scan` (UC-25 / BR-09 / ASM-07-3) | guard `QR.SCAN` · validate `trip_id/qr_token(≤64)/checkin_stop_id` → 400 · 404 `QR_NOT_FOUND` · **409 `TRIP_NOT_RUNNING`** · check order: **BR-09 ผิดรอบ → wrong_trip** (ไม่แก้สถานะ) → cancelled → already_checked_in (มี `checkin_time`) → checked_in (update + insert `trip_passenger` + `board_seq` จาก stop_seq) · **สแกนซ้ำ atomic ผ่าน `FOR UPDATE`** (ไม่ insert ซ้ำ) · insert ล้ม → 500 + rollback คง `reserved` | ✅ (local tests) |
| Repository SQL | bind variables เท่านั้น (qr_token/empId/dates ไม่ต่อลง SQL) · `FOR UPDATE` ไม่ใช่ NOWAIT · `TRUNC(SYSDATE)` default · LISTAGG WITHIN GROUP | ✅ (spy asserts) |

## ไฟล์ที่สร้าง/แก้

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/src/repositories/driver.repository.js` | `createDriverRepository(db)` → `listMyRounds` (driver_assign JOIN schedule/route · LEFT JOIN trip/vehicle_assign/vehicle · `passenger_count` scalar COUNT reserved · `pending_trip_id/sched_id` scalar subquery running · `service_date = CASE WHEN :serviceDate IS NULL THEN TRUNC(SYSDATE) ELSE TO_DATE(...)` · ORDER BY depart_at) · tx fns: `lockSchedule` (`FOR UPDATE`) · `findDriverAssignments` · `findVehicleAssignment` · `findTripBySched` · `findDriverRunningTrip(empId, exceptSchedId)` · `insertTrip` (RETURNING trip_id BIND_OUT) · `findTripById` (JOIN route/vehicle/employee driver_name) · `findManifestStops` (LISTAGG 2 ฝั่ง + `alight_seq` ไม่ใช่ alight_stop_id) · `lockBookingByQr` (JOIN employee + `FOR UPDATE OF b.booking_id` + checkin_time subquery `:tripId` + qr_token เสมอ bind) · `findStopSeq` · `updateCheckin` · `insertTripPassenger` (SYSTIMESTAMP) · `findCheckin` |
| `backend/src/services/driver.service.js` | `createDriverService({db, repos})` → `getMySchedule` / `startTrip` / `getManifest` / `scanQr` + mappers `toDriverSchedule`/`toTrip`/`toManifestStop` · error helpers `body400`/`isRealDate` · ข้อความ/常量 contract ทั้งหมด (ดู "Contract decisions") |
| `backend/src/routes/driver.routes.js` | `createDriverRouter({service, requirePermission})` · `GET /schedule` + `POST /trip/:schedId/start` + `GET /trip/:tripId/manifest` → `requirePermission('TRIP.START')` · `POST /trip/scan` → `requirePermission('QR.SCAN')` + `SCAN_RULES` validate |
| `backend/tests/sprint10.test.js` | **35 tests / 5 describe blocks** (รายละเอียดด้านล่าง) |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `backend/src/repositories/index.js` | +`driver` export (header → T-046) |
| `backend/src/services/index.js` | +`createDriverService` + entry `services.driver` (header → T-046) |
| `backend/src/app.js` | +`createDriverRouter` require · `api.use('/driver', createDriverRouter({service: services.driver, requirePermission}))` · header → T-046 |

`database/*` · `docs/api/openapi.yaml` · script/config · test เดิมอื่น: **ไม่ได้แตะ**

## Contract decisions (สำคัญ — ใช้ต่อใน sprint 11 / review)

1. **Guards**: schedule/start/manifest → `TRIP.START` · scan → `QR.SCAN` (seed 02 lines 76-78 มีแค่ 3 โค้ดใน driver module · `TRIP.END` เก็บไว้ T-047)
2. **Scan `not_found` → 404 `QR_NOT_FOUND`** `'ไม่พบ QR นี้ในระบบ'` (openapi responses "404 - ไม่พบ qr_token นี้ (result = not_found)") — แต่ ScanResult enum **ก็มี `not_found`** → inconsistency → ดู Unresolved
3. **Scan 409 `TRIP_NOT_RUNNING`** `'รอบนี้ปิดงานไปแล้ว'` — openapi ไม่มี 409 ใน scan แต่ UC-25 precondition (trip running) → contract extension → ดู Unresolved
4. **3b → 409 `TRIP_PENDING`** `'ยังมีรอบงานค้างอยู่ที่ยังไม่ปิดงาน ต้องปิดรอบเดิมก่อน'` details `[{trip_id},{sched_id}]` · **3c → 409 `TRIP_ALREADY_STARTED`** details `[{field:'trip_id',message:'trip_id = N'}]` · ตรวจ 3c ก่อน 3b ตาม openapi x-transaction
5. **422 `NOT_ASSIGNED`** `'รอบนี้ยังไม่ได้มอบหมายคนขับและรถ'` มาก่อน 403 ownership · 403 message `'คุณไม่ใช่คนขับที่ได้รับมอบหมายรอบนี้'` code `FORBIDDEN` (ไม่มี openapi example)
6. คนขับ **คนใดใน driver_assign ของรอบ** กดเริ่มได้ (backup driver ผ่าน) · lock = `FOR UPDATE` ธรรมดา · ORA-00054 → 409 `SCHEDULE_LOCKED`
7. `passenger_count` = **COUNT(*)** `status='reserved'` (openapi literal)
8. `is_passed` = `arrive_at <= now` คำนวณใน mapper (contract ไม่ได้นิยาม method)
9. `end_at` = `depart_at + route.total_minutes*60000`
10. `?date=` ไม่ส่ง/ว่าง → `TRUNC(SYSDATE)` ใน SQL · ผิดรูป → 400 `details:[{field:'date',message:'must be a date (YYYY-MM-DD)'}]`
11. Scan check order: **BR-09 (เทียบ booking.sched_id กับ trip.sched_id ของ trip_id ที่ส่งมา ไม่ self-join)** → status → checkin · cancelled/no_show → 200 `cancelled` · checked_in/completed → 200 `already_checked_in` (+`checkin_time`) · no_show ระหว่าง trip running เป็นไปไม่ได้ (BR-10) → defensive `cancelled` · 4a → 200 `checked_in` · ผิดรอบข้อความ `'QR นี้ไม่ใช่ของรอบที่กำลังเดิน'` (ตรงตัว)
12. Scan success: `checkin_stop_id = body || booking.board_stop_id` · `board_seq` จาก `schedule_stop.stop_seq` · UPDATE booking + INSERT trip_passenger + COMMIT ใน tx เดียวใต้ booking `FOR UPDATE` (สแกนซ้ำ atomic)
13. Manifest `board` = `tp.checkin_stop_id = ss.stop_id AND checkin_time IS NOT NULL` · `alight` = `tp.alight_seq = ss.stop_seq AND alight_time IS NOT NULL` (สคีมา **ไม่มี** `alight_stop_id`) · LISTAGG เรียง `last_name`
14. `blocked_reason`: `'รอบนี้เริ่มงานไปแล้ว'` (3c · trip_id ตั้ง) / `'ยังมีรอบงานค้างอยู่ที่ยังไม่ปิดงาน'` (3b · pending_trip_id) · `can_start` true นอกนั้น (ไม่มีรถก็ true — โชว์ตอน start 作为 422)
15. Start 201 = `{success, message:'เริ่มงานสำเร็จ', data: Trip}` · ScanResult `message` อยู่ใน `data` (ตาม openapi ไม่ใช่ top-level)

## Verification (รันจริงทั้งหมด)

1. **Smoke**: `node -e "require('./src/app')"` (workdir `backend/`) → `app require OK`

2. **`npx.cmd jest --runInBand tests/sprint10.test.js`** (workdir `D:\data\shuttle-kaengkarn\backend`):

```
PASS tests/sprint10.test.js
Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
```

   ครอบคลุม 5 blocks:
   - **T-043 schedule (6)**: 401/403 guard ทุก endpoint · DriverSchedule 13 ฟิลด์ + `end_at`+13min + `passenger_count=1` (reserved-only) · 3b blocked_reason (rounds 32/321) · `?date=`/ว่าง/ไม่มีรอบ · date ผิด 3 แบบ → 400 · เห็นเฉพาะรอบตัวเอง + admin `[]`
   - **T-044 start (8)**: 401/403 · 201 Trip 7 ฟิลด์ + commit ครั้งเดียว + insertTrip binds · ซ้ำ → 409 details `trip_id = 100` + ไม่ insert ซ้ำ · 404 ×2 (rollback) · 422 ×2 · 403 คนขับอื่น · 409 TRIP_PENDING details · audit sink path/method/empId (GET ไม่ audit)
   - **T-045 manifest (4)**: 401/403 guard/403 ownership/404 ×2 · header+stops keys + LISTAGG names `'สมชาย มั่นคง, มานี รักดี'` + `is_passed` T/T/F · completed เปิดได้ · สแกนแล้ว manifest เห็นทันที (board_count 3 + ชื่อซ้ำนับแถว)
   - **T-046 scan (11)**: 401/403 ×2/400 ×3 · 404 trip + 404 `QR_NOT_FOUND` · 409 `TRIP_NOT_RUNNING` · wrong_trip (ไม่แก้สถานะ/ไม่แทรกแถว) · cancelled · already_checked_in (+`checkin_time` ไม่แทรกซ้ำ) · checked_in keys + `board_seq` 1 + tp row + commit + call order lock→update→insert · **สแกนซ้ำ → already_checked_in + 1 แถว** · `checkin_stop_id=4` override → `board_seq` 3 · **insert fail → 500 + rollback + `reserved` + 0 แถว** · audit ไม่ leak qr_token
   - **repo SQL (6)**: `listMyRounds` (driver_assign + TRUNC(SYSDATE) + reserved + bind-only) · `lockSchedule` FOR UPDATE ไม่ NOWAIT · `insertTrip` RETURNING bind-only · `lockBookingByQr` `FOR UPDATE OF b.booking_id` + ไม่มี token literal · `findManifestStops` LISTAGG/WITHIN GROUP/ORDER BY · update/insert binds (status literal ตาม contract)

3. **`npm.cmd test -- --runInBand`** (workdir `backend/`, bash แยกกัน):

```
PASS tests/sprint08.test.js (7.32 s)
PASS tests/sprint10.test.js
PASS tests/sprint04.test.js
PASS tests/sprint07.test.js
PASS tests/sprint09.test.js
PASS tests/sprint06.test.js
PASS tests/sprint05.test.js
PASS tests/middleware.test.js
PASS tests/health.test.js
PASS tests/db.test.js
Test Suites: 10 passed, 10 total
Tests:       309 passed, 309 total
```

   (sprint9 = 274 → +35 = **309** · ไม่มี test เดิมถูกแก้/ถูกลบในรอบนี้)

4. **`git status --porcelain`**: ไฟล์ใหม่/แก้ของ sprint 10 = `driver.repository.js` · `driver.service.js` · `driver.routes.js` · `sprint10.test.js` · `app.js` · `repositories/index.js` · `services/index.js` · handoff ไฟล์นี้ — **ไม่ได้ commit** (ยืนตาม constraint)

## Unresolved checks (ต้อง coordinator/reviewer ตัดสิน — ไม่ใช่สิ่งที่ worker invent ได้)

| # | เรื่อง | สถานะ |
|---|---|---|
| 1 | openapi ScanResult enum มี `not_found` แต่ responses บอก 404 — เลือก 404 ตาม responses | open |
| 2 | scan ไม่มี 409 ใน openapi แต่ UC-25 บังคับ trip running → เพิ่ม `409 TRIP_NOT_RUNNING` (contract extension) | open |
| 3 | `TRIP_PENDING` / `SCHEDULE_LOCKED` codes ไม่อยู่ใน openapi (openapi 409 มีแค่ TRIP_ALREADY_STARTED) | open |
| 4 | driver 403 messages ไม่มี openapi example → ใช้ข้อความไทยตาม decisions ข้อ 5 | open |
| 5 | CONTRACT-DRIFT-01 (kaengkarn `1818593` snake_case vs sukhsorn `b107da0` camelCase) | open |
| 6 | Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 (มาจาก sprint8/9 handoff) | open |

**DoD ที่ยังถูกบล็อก**: ไม่มี live-Oracle integration test (ทั้ง suite รันบน fake repos/conn) · ไม่มี human review · ยังไม่ได้ verify กับ openapi validator จริง · ยังไม่ commit/push

## Standing constraints (รอบถัดไป)

- Windows absolute paths เท่านั้น · PowerShell 5 (ไม่มี `&&`) · tests = bash call แยก workdir `D:\data\shuttle-kaengkarn\backend` · ไม่ commit/push · ไม่อ่าน `.env` · ห้ามแตะ dirty files ของ peer (`backend/src/config/*`, `middleware/{errorHandler,validate}.js`, `database/02_seed_master.sql`, `docs/agile/*`, `docs/ai-credit-log.md`, `docs/kaengkarn-check-list.md`, `.playwright-mcp/`, `convert_svg.py`)
- ข้อ 1-6 ใน Unresolved + Q-list **ไม่ใช่ permission ให้ invent** — ถ้า sprint 11 ต้องใช้ ให้ list blocked acceptance criteria ไว้ใน handoff
- local pass ≠ human review / live integration / ครบทุก requirement
