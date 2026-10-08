# Sprint 11 Handoff — เก่งกาญ (kaengkarn) · T-047 / T-052 / T-053

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ⚠️ CONTRACT-DRIFT-01 — ยัง open (อ้างจาก sprint08/09/10 handoff — ไม่ได้แก้/ไม่ได้ merge)

| ฝั่ง | commit | พฤติกรรม |
|---|---|---|
| **kaengkarn (ที่นี่)** | HEAD `1818593` | snake_case `route_id` · `GET/PUT /routes/{id}/stops` |
| **sukhsorn (peer)** | HEAD `b107da0` | camelCase `routeId` · `GET/PUT /routes/{id}` |

- ยังคง **ห้ามอ้าง live interoperability / "ครบทุก sprint"** · ไม่ merge อัตโนมัติ · ไม่แตะ code ฝั่ง peer
- sprint 11 รอบนี้: T-047 (backend API) + T-052/T-053 (SQL ใหม่) — **ไม่ได้แก้ `docs/api/openapi.yaml`** (openapi มี contract ครบอยู่แล้ว)

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 11 DoD | สถานะ |
|---|---|---|
| **T-047** `POST /driver/trip/{tripId}/complete` (UC-26 / BR-10) | guard `TRIP.END` · tx ตาม openapi x-transaction: `SELECT trip FOR UPDATE` → 404 ไม่พบ → **403** ไม่ใช่คนขับรอบนี้ → **409 `TRIP_ALREADY_COMPLETED`** → `UPDATE trip SET end_time=SYSTIMESTAMP, status='completed'` → **BR-10** `UPDATE booking reserved→no_show (WHERE sched_id + status='reserved')` → สรุป + รายชื่อ no_show อ่านใน TX เดียวกัน → COMMIT · ขั้นใดล้ม = rollback ทั้งหมด · 200 `{success, message:'ปิดงานสำเร็จ', data: TripSummary 12 ฟิลด์}` | ✅ (local tests) |
| **T-052** `database/04_seed_report_bulk.sql` | INSERT ล้วน (non-destructive) · guard `RAISE_APPLICATION_ERROR(-20001)` ตรวจซ้ำก่อน DML · ปี **พ.ศ. 2568 = ค.ศ. 2025** (openapi YearParam) · **FORALL** bulk · 5,840 รอบ (365 วัน × 2 เส้นทาง × 8 ช่วง — 6 ช่วงก่อน 17:00 + 2 ช่วงหลัง 17:00 สำหรับ R6) · ลูกค้าใหม่ 6,000 · booking ≥ 50,000 (Q10) · trip_passenger ≥ 30,000 · BR-04/05/07/10/11 ถูก enforce ในข้อมูล + verification block (PASS/FAIL + BR checks) | ✅ (ไฟล์เขียนครบ · **ยังไม่ได้รัน** — ดู Verification) |
| **T-053** `database/05_views_report.sql` | 3 `CREATE OR REPLACE VIEW` (ไม่มี DROP) — R1 `v_report_boarding_alighting_week` (`TRUNC(...,'IW')` + `TO_CHAR(...,'IW')` + `CASE IS NOT NULL` + `EXISTS` · ⛔ ไม่ใช่ `COUNT(DISTINCT alight_time)`) · R4 `v_report_daily_by_route` (`SUM(...) OVER (PARTITION BY service_date)` = day_total + GROUP BY วันเต็ม + ตัวอย่าง PIVOT) · R6 `v_report_driver_workload` (`TO_CHAR(depart_at,'HH24') < / >= '17'` + ตัวอย่าง `GROUP BY ROLLUP` สำหรับ T-056) · verification queries ท้ายไฟล์ | ✅ (ไฟล์เขียนครบ · **ยังไม่ได้รัน**) |
| **T-047 regression tests** | `backend/tests/sprint11.test.js` — **23 tests / 6 blocks** (ด้านล่าง) | ✅ |
| Repository SQL | bind variables เท่านั้น · `FOR UPDATE` ไม่ใช่ NOWAIT · literals `'completed'`/`'no_show'`/`'reserved'` ตาม contract | ✅ (spy asserts) |

## ไฟล์ที่สร้าง/แก้

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `database/04_seed_report_bulk.sql` | SECTION 0 guard (abort ก่อน DML ถ้ามีรอบปี 2025 แล้ว) · SECTION 1 main block: preload route/route_stop (cum travel สูตร BR-02 เดียวกับ 03) + drivers + vehicles+capacity + roles/positions · ลูกค้า 6,000 (FORALL + `RETURNING emp_id BULK COLLECT`) · schedule 5,840 (`uq_route_depart` ไม่ชน · คนขับ/รถ mod ต่างฐานกันข้ามเส้นทาง = BR-04) · schedule_stop ~26,280 (arrive = depart + cum) · driver_assign/vehicle_assign · trip 5,840 (`'completed'` + end = depart + total_minutes) · booking ≥50k (แบทช์ 5,000 · สถานะ 70/20/10 completed/no_show/cancelled · seats 60/25/10/5% dist · BR-07 เต็ม容量 หยุดรอบ · BR-11 alight > board · BR-05 book_time = depart−12h · `booking_code 'BK68…'` · `qr_token 'SEED68…'` 64 ตัวอักษร) · trip_passenger set-based จาก qr `SEED68%` + completed (~5% `alight_time` NULL ให้ทดสอบ R1 ฝั่งนับแยก) · COMMIT + EXCEPTION `ROLLBACK; RAISE;` · SECTION 2 verification (expected: schedule 5840 · schedule_stop 26280 · assign 5840×2 · trip 5840 · ลูกค้า 6000 · booking ≥50000 · tp ≥30000 — ทุกแถว `got >= expected` → PASS) + BR-10/07/04/11/05 zero-violation + status distribution |
| `database/05_views_report.sql` | 3 VIEW ตาม T-053 (หัวข้อด้านบน) + ตัวอย่าง query สำหรับ T-055 (PIVOT) / T-056 (ROLLUP + `GROUPING(driver_name)`) เป็นคอมเมนต์ + verification SELECT 4 ชุด (แถว/ยอดรวม/BR R6 before+after = total) |
| `backend/tests/sprint11.test.js` | **23 tests / 6 describe blocks** |
| `docs/agent-handoffs/sprint11-kaengkarn.md` | ไฟล์นี้ |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `backend/src/repositories/driver.repository.js` | +5 fns: `lockTripById` (`FOR UPDATE` plain) · `updateTripComplete` (`SYSTIMESTAMP` + `'completed'`) · `markNoShow` (`WHERE sched_id = :schedId AND status = 'reserved'`) · `summarizeTrip` (scalar subqueries: total_booked/seats `<> 'cancelled'` · boarded `checkin_time IS NOT NULL` · alighted `alight_time IS NOT NULL` · no_show_count · capacity จาก vehicle→vehicle_type) · `listNoShowNames` (`ORDER BY e.last_name, e.first_name` · map `PASSENGER_NAME ?? passenger_name`) · header → T-047 |
| `backend/src/services/driver.service.js` | +`completeTrip(tripId, empId)` (ลำดับตรวจ 404→403→409 ภายใน TX) · +mapper `toTripSummary` (12 ฟิลด์ · uppercase-then-lowercase fallback) · constants `TRIP_ALREADY_COMPLETED_MESSAGE='รอบนี้ปิดงานไปแล้ว'` · `COMPLETE_OK_MESSAGE='ปิดงานสำเร็จ'` · header → T-047 |
| `backend/src/routes/driver.routes.js` | +`completeGuard = requirePermission('TRIP.END')` · `POST /trip/:tripId/complete` → 200 `{success, message:'ปิดงานสำเร็จ', data}` · header → T-047 |
| `backend/tests/sprint10.test.js` | **flaky fix เท่านั้น**: `DATE = at(45)` (now+45min) → `new Date(t0)` — เดิมค่าข้ามเที่ยงคืน UTC ในช่วง 23:15–24:00 ทำให้ default-date tests ได้ `[]` (พบตอนรัน full suite 23:15Z · ไม่ได้อ่อนแอ Assertions ใด ๆ — ยัง assert เดิมทุกตัว) |

`database/01_schema.sql` · `02_seed_master.sql` · `03_seed_front.sql` · `docs/api/openapi.yaml` · script/config · test เดิมอื่น: **ไม่ได้แตะ**

## Contract decisions (สำคัญ — ใช้ต่อใน sprint 12 / review)

1. **Guard complete → `TRIP.END`** (`'กดปิดรอบเดินรถ'` DRIVER_HOME · seed 02) — พิสูจน์แล้วว่าคนละตัวกับ `TRIP.START` (admin มี START แต่โดน 403 ที่ complete)
2. **ลำดับตรวจใน TX**: `lockTripById` → null=404 `NOT_FOUND` → `driver_id !== empId` = **403 `FORBIDDEN`** `'คุณไม่ใช่คนขับที่ได้รับมอบหมายรอบนี้'` → `status !== 'running'` = **409 `TRIP_ALREADY_COMPLETED`** `'รอบนี้ปิดงานไปแล้ว'` (ตรง openapi example) → update → markNoShow → summarize → names → commit · **403 มาก่อน 409** (มี test ยืนยัน)
3. **tripId ไม่ใช่จำนวนบวก/ไม่ใช่ตัวเลข → 404 ก่อนเข้า TX** (ไม่เริ่ม transaction — ตรงพฤติกรรม start/manifest)
4. **TripSummary = 12 ฟิลด์** (openapi required 6 `trip_id,status,total_booked,boarded,alighted,no_show_count` + `sched_id,start_time,end_time,no_show_names,seats_booked,capacity`) · `total_booked`/`seats_booked` = สถานะ `<> 'cancelled'` (นับรวม no_show ที่เพิ่ง mark) · `no_show_names` เรียง `last_name` (ผล test: `['สมชาย มั่นคง','มานี รักดี']`) · `capacity` null ได้ (`numOrNull`)
5. **สรุปอ่านใน TX เดียวกันหลัง mark** (เห็นค่าที่ยังไม่ commit) — ถ้า `summarizeTrip` คืน null → throw → rollback (trip หายกลางทาง = defensive)
6. **Seed — ปี 2568 = CE 2025** (`YearParam: ปี พ.ศ. (2568)`) · 8 ช่วง/วัน (PDF หน้า 3 มี 4 ช่วง + ทีมขยาย 07:30/17:30/19:00 เพื่อให้ R6 มีข้อมูลทั้งสองฝั่ง) · **ห้ามรันบน shared DB** · marker `qr_token LIKE 'SEED68%'` แยก data ชุดรายงานออกจาก seed หน้า (03)
7. **Seed statuses = completed/no_show/cancelled เท่านั้น** (`'reserved'` ห้ามปรากฏ — สอดคล้อง BR-10 "ปิดรอบแล้วไม่ค้าง") · ที่นั่งรวม (ไม่รวม cancelled) ≤ capacity (BR-07) enforced ตอนสร้าง
8. **Views grain**: R1 = ต่อสัปดาห์ (ISO) · R4 = ต่อ (service_date × route) + `day_total` analytic (กรอง `BETWEEN` ที่ API ได้ · วันจันทร์หลายสัปดาห์รวมอัตโนมัติเพราะ group ที่วันเต็ม) · R6 = ต่อ (คนขับ × วัน) — **ROLLUP เป็น query ของ T-056 ไม่ใช่ใน view** (view ต้องรองรับ from/to parameterized · แถวรวม `driver_name IS NULL` ตาม UC-29) · ตัวอย่าง PIVOT/ROLLUP แนบเป็นคอมเมนต์ในไฟล์
9. **R4 `booked_count` = สถานะ `<> 'cancelled'`** + แถม `customer_count` (DISTINCT cust) ให้ T-055 เลือกนิยามได้ — **ทีมยังไม่ยืนยันนิยาม (Q-REPORT-4)** · แก้จุดเดียวใน CASE ถ้า instructor กำหนดใหม่
10. **T-053 ในแผนมนุษย์ = สุขสรร/@agent-data** แต่ `sprints04-13-execution.md` ให้ operational ownership งาน SQL ทั้งหมดกับ stream นี้ — **ไม่ได้แต่งสิทธิ์อธิบาย/ตรวจของมนุษย์** · เขียนไว้ในหัวข้อไฟล์

## Verification (รันจริงทั้งหมด)

1. **Smoke**: `node -e "require('./src/app'); console.log('smoke OK')"` (workdir `backend/`) → `smoke OK`

2. **`npx.cmd jest --runInBand tests/sprint11.test.js --silent`** (workdir `D:\data\shuttle-kaengkarn\backend`):

```
PASS tests/sprint11.test.js
Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
```

   ครอบคลุม 6 blocks:
   - **T-047 API (7)**: 401 + 403 guard แยกจาก TRIP.START (viewer/admin/mai · ไม่เข้า service) · 200 TripSummary 12 ฟิลด์ + ค่า fixture ครบ (total_booked 5 · boarded 3 · alighted 1 · no_show_count 2 · no_show_names เรียง last_name · seats 6 · capacity 9) + BR-10 flip 2 รายการ (checked_in/cancelled ไม่แตะ) + commit ครั้งเดียว + ลำดับ lock→update→mark→summarize→names · 409 ซ้ำ (ไม่แตะ trip/booking) · 404 ×3 (999 ใน TX / `abc`/`-1` ก่อน TX) · 403 ownership ×2 (รวม **403 ก่อน 409**) · **markNoShow fail → 500 + rollback คง trip running + booking reserved** · audit entry path/method/empId
   - **repo SQL (5)**: `lockTripById` FOR UPDATE ไม่ NOWAIT · `updateTripComplete` literal completed + SYSTIMESTAMP · `markNoShow` `WHERE sched_id = :schedId AND status = 'reserved'` · `summarizeTrip` นับ 4 แหล่ง + capacity + bind · `listNoShowNames` ORDER BY last_name + bind
   - **T-052 static (4)**: non-destructive (ไม่มี DROP/TRUNCATE/DELETE/UPDATE · มี guard+COMMIT+ROLLBACK) · FORALL ≥6 + 50000 + verification PASS + 5840/26280 · BR-10/07/04/11/05 + ห้าม `'reserved'` + `used_seats > capacity` · INSERT targets ⊆ whitelist 9 ตาราง
   - **T-053 static (5)**: `CREATE OR REPLACE VIEW` ×3 + non-destructive · R1 techniques (IW/EXISTS/CASE + ห้ามกับดัก `COUNT(DISTINCT alight_time)` ตรวจบน SQL จริงไม่นับคอมเมนต์) · R4 analytic + PIVOT · R6 HH24 + ROLLUP · FROM/JOIN ⊆ whitelist (คอมเมนต์ถูก strip ก่อน — เคยเจอ false positive จาก `:from AND :to`)
   - **contract (2)**: openapi.yaml มี path/operationId/`TRIP_ALREADY_COMPLETED`/ข้อความ 200+409/TripSummary · route ใช้ `requirePermission('TRIP.END')` + service มี `markNoShow(conn, schedId)` ใน BR-10 TX

3. **`npm.cmd test -- --runInBand --silent`** (workdir `backend/`, bash แยกกัน):

```
PASS tests/sprint08.test.js (5.38 s)
PASS tests/sprint10.test.js
PASS tests/sprint04.test.js
PASS tests/sprint07.test.js
PASS tests/sprint09.test.js
PASS tests/sprint06.test.js
PASS tests/sprint05.test.js
PASS tests/sprint11.test.js
PASS tests/middleware.test.js
PASS tests/health.test.js
PASS tests/db.test.js
Test Suites: 11 passed, 11 total
Tests:       332 passed, 332 total
```

   (sprint10 = 309 → +23 sprint11 = **332** · ไม่มี test ถูกแก้Assertions/ถูกลบ — sprint10 มีแค่ flaky DATE fix ตามที่ระบุข้างบน)

4. **`git status --porcelain`**: ไฟล์ใหม่ของรอบนี้ = `database/04_seed_report_bulk.sql` · `database/05_views_report.sql` · `backend/tests/sprint11.test.js` · handoff ไฟล์นี้ (+ ไฟล์ sprint ก่อน ๆ ที่ยัง untracked) — **ไม่ได้ commit** (ยืนตาม constraint) · dirty files เดิม (config/middleware/01/02/agile/...) ไม่ถูกแตะเพิ่ม

## ⛔ ข้อจำกัดที่ต้องพูดตรง ๆ (ห้ามอ้างเกิน)

- **SQL ทั้ง 2 ไฟล์ยังไม่เคยถูกรันที่ไหน** — ไม่มี Oracle instance ใน environment นี้ · tests รอบนี้เป็น **static content assertions** + fake-repo HTTP เท่านั้น · local pass ≠ SQL รันผ่านจริง
- **Isolated integration prerequisites** (ให้ human/coordinator รันบนฐาน isolate เท่านั้น · ห้าม shared DB):
  1. เรียงลำดับ: `01_schema.sql` → `02_seed_master.sql` → `03_seed_front.sql` → **`04_seed_report_bulk.sql`** → **`05_views_report.sql`**
  2. `sqlplus shuttle_app/<รหัสผ่าน>@localhost:1521/XEPDB1 @04_seed_report_bulk.sql` (แล้ว `@05_views_report.sql`)
  3. ตรวจ SECTION 2 ของ 04: ทุกแถว `PASS` — expected `schedule 5840 · schedule_stop 26280 · driver_assign 5840 · vehicle_assign 5840 · trip completed 5840 · BULK_CUSTOMER 6000 · BOOKING_SEED68 ≥ 50000 · TRIP_PASSENGER ≥ 30000` + BR-10/07/04/11/05 ทุก `bad_rows = 0`
  4. ตรวจ 05: R1/R4/R6 verification ทุกตัวเลข > 0 + `rounds_before+after <> total` → `bad_rows = 0`
  5. รันซ้ำได้เฉพาะฐานใหม่ — guard `-20001` จะ abort ถ้ามีรอบปี 2025 แล้ว (non-destructive idempotency)
- ** Bugs ที่เจอ/แก้เองระหว่างทาง** (เผื่อ reviewer ย้อนดู): (ก) `toTripSummary` เขียน `?? … || …` ไม่ครอบเลนส์ → Babel SyntaxError → แก้เป็น `(a ?? b) || 0` ทั้ง 5 บรรทัด (ข) 04 draft มี status distribution 7/2/91% (แทน 70/20/10) + checkin offset อาจเกิน alight บนขา 2 นาที → แก้ก่อน test (ค) sprint10 `DATE=at(45)` flaky ข้ามเที่ยงคืน UTC → แก้เป็น `t0`
- ยังไม่มี human review · ยังไม่ commit/push · ยังไม่ verify ด้วย openapi validator จริง

## Unresolved checks (ต้อง coordinator/reviewer ตัดสิน — ไม่ใช่สิ่งที่ worker invent ได้)

| # | เรื่อง | สถานะ |
|---|---|---|
| 1 | CONTRACT-DRIFT-01 (kaengkarn `1818593` snake_case vs sukhsorn `b107da0` camelCase) | open |
| 2 | Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 (มาจาก sprint8/9/10 handoff) | open |
| 3 | openapi scan: ScanResult enum `not_found` vs 404 responses · scan ไม่มี 409 · `TRIP_PENDING`/`SCHEDULE_LOCKED` ไม่อยู่ใน openapi (sprint10 ค้าง) | open |
| 4 | **Q-REPORT-4**: นิยาม `booked_count` ของ R4 (ที่นี่ = `<> 'cancelled'` + แถม `customer_count`) — instructor อาจนับใหม่ | open |
| 5 | **Q10 vs Answer-Day1**: ตัวเลขตัวอย่าง PDF (R4=1865 · R6 100/70/30 · rounds/vehicle 28/25/10/22/15/12/8) **จับคู่พร้อมกันไม่ได้** กับข้อมูล ≥50,000 แถวในปีเดียว — ต้องยืนยันว่าจะตรวจแบบไหน | open |
| 6 | T-053 ในแผนมนุษย์ = สุขสรร (E6/@agent-data) — ownership จริง/คะแนนงาน | open (ไม่ได้แต่งสิทธิ์) |
| 7 | 8 ช่วงรอบ/วันของ bulk seed (ทีมขยายจาก 4 ช่วงตาม PDF) — ถ้า instructor ยืนยัน 4 ช่วง → ตัวเลข verification ต้องแก้ | open |

**DoD ที่ยังถูกบล็อก**: ไม่มี live-Oracle integration (SQL 2 ไฟล์ไม่เคยรัน) · ไม่มี human review · ไม่ได้ verify openapi validator · ไม่ได้ commit/push

## Standing constraints (รอบถัดไป)

- Windows absolute paths เท่านั้น · PowerShell 5 (ไม่มี `&&`) · tests = bash call แยก workdir `D:\data\shuttle-kaengkarn\backend` · ไม่ commit/push · ไม่อ่าน `.env` · ห้ามแตะ dirty files ของ peer (`backend/src/config/*`, `middleware/{errorHandler,validate,audit,index}.js`, `database/01_schema.sql`, `02_seed_master.sql`, `docs/agile/*`, `docs/ai-credit-log.md`, `docs/kaengkarn-check-list.md`, `.playwright-mcp/`, `convert_svg.py`)
- Unresolved ข้อ 1-7 + Q-list **ไม่ใช่ permission ให้ invent** — sprint ถัดไปที่ต้องใช้ ให้ list blocked acceptance criteria ไว้ใน handoff
- local pass ≠ human review / live integration / ครบทุก requirement
