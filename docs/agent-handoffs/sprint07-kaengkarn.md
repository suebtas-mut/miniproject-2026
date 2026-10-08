# Sprint 7 Handoff — เก่งกาญ (kaengkarn) · T-029 / T-030 / T-031 / T-032

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 7 DoD | สถานะ |
|---|---|---|
| **T-029** Vehicle API (`/vehicles`) | GET (is_active/vtype_id · join `vehicle_type`) · POST 201 ใน tx · 409 `uq_vehicle_plate` · 422 FK `vehicle_type` | ✅ (local tests) |
| **T-030** Schedule API (`/schedules`) | GET list (BR-07 `seats_reserved` · driver = `MIN(assign_id)`) · POST สร้างรอบ + `schedule_stop` ทุกจุดจอด **BR-02 offset สะสมใน tx เดียว** · 409 `uq_route_depart` · 422 `ROUTE_STOPS_INCOMPLETE` · GET detail (stops เรียง `stop_seq` + `arrive_at` BR-02) · DELETE 409 เมื่อมี booking / 200 ลบจริง | ✅ (local tests) |
| **T-031** assign-driver (UC-15, BR-04) | POST 201: tx = `lockSchedule → lockEmployee → conflict check → INSERT` · 409 `DRIVER_CONFLICT` (แจ้งรอบที่ชน + rollback) · 422 `NOT_A_DRIVER` · 409 `ALREADY_ASSIGNED` · DELETE ปลดมอบหมาย/404 | ✅ (local tests) |
| **T-032** assign-vehicle (UC-16, BR-04/BR-07) | POST 201 คืน capacity · 409 `VEHICLE_CONFLICT` · 422 `VEHICLE_INACTIVE` · 409 `ALREADY_ASSIGNED` (1 รอบมีรถเดียว) · DELETE/404 | ✅ (local tests) |
| ไม่สร้าง: `/vehicle-types` ทั้งหมด · `PUT/DELETE /vehicles/{id}` · `PUT /schedules/{id}` | 17.5.2 (บรรทัด 672–681) / openapi ไม่ประกาศ — **10 operations เท่าต้นทาง** (มี test ยืนยัน 404) | ⛔ ตามสเปก (ดู Blocked) |

## ไฟล์ที่สร้าง/แก้ (ทั้งหมดอยู่ใน `backend/`)

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `src/repositories/vehicle.repository.js` | list/count (JOIN `vehicle_type` + OFFSET/FETCH) · `findById`/`findByPlate` (409) · `findVtype` (422) · `insert` (ไม่ใส่ `veh_id` + `RETURNING`) · `lockById` (**FOR UPDATE**) |
| `src/repositories/schedule.repository.js` | list/count/find · `findStops` (BR-02) · `findDuplicate` (409) · `countBookings` (409) · ขา tx: `insert` (`TO_DATE` + RETURNING) · `insertStop` (**`NUMTODSINTERVAL(:offsetMin,'MINUTE')`** = BR-02) · `deleteById` · `lockSchedule`/`lockEmployee` (**FOR UPDATE** เฉพาะแถว ไม่ lock aggregate — ORA-02014) · `findDriverConflicts`/`findVehicleConflicts` (**`sched_id <> :excludeSchedId`** · bind ทั้งหมด) · `isDriver` (bind `:roleName`) · insert/delete assigns |
| `src/services/scheduling.service.js` | UC-13…UC-16 logic · `normalizeServiceDate`/`normalizeDepartAt` + **`isRealDate`** (round-trip กัน `2026-02-30` — V8 `Date.parse` rollover เองไม่ reject) · `overlaps` (strict) · conflict detail ข้อความไทย · `isRealDate` ตรวจทั้ง `service_date` และส่วนวันที่ของ `depart_at` |
| `src/routes/scheduling.routes.js` | **10 operations** (เท่า 17.5.2) · guards `VEH.EDIT`/`ROUTE.VIEW`/`SCHED.EDIT` · validate rules (ISO patterns) |
| `tests/sprint07.test.js` | **45 tests / 7 describe blocks** (รายละเอียดด้านล่าง) |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `src/app.js` | mount `/vehicles`, `/schedules` หลัง `/routes` · header comment |
| `src/repositories/index.js` | export `vehicle`, `schedule` |
| `src/services/index.js` | เพิ่ม `scheduling: createSchedulingService(...)` |
| `src/utils/mappers.js` | เพิ่ม `dateOnly`, `toVehicle`, `toSchedule`, `toScheduleStop` |

`database/*`, `middleware/*`, script/config: **ไม่ได้แตะ**

## Verification (รันจริงทั้งหมด)

1. **Smoke โหลดแอปจริง**: `node -e "require('./src/app')"` → `app loaded OK`

2. **`npx.cmd jest --runInBand tests/sprint07.test.js`** (ใน `backend/`):

```
Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Time:        2.892 s, estimated 4 s
```

3. **`npm.cmd test -- --runInBand`** (คำสั่งเดียว / workdir `backend/` — ตาม policy ใหม่):

```
PASS tests/sprint07.test.js
PASS tests/sprint04.test.js
PASS tests/sprint06.test.js
PASS tests/sprint05.test.js
PASS tests/health.test.js
PASS tests/middleware.test.js
PASS tests/db.test.js

Test Suites: 7 passed, 7 total
Tests:       195 passed, 195 total
Snapshots:   0 total
Time:        6.596 s, estimated 9 s
Ran all test suites.
```

   → เดิม 150 tests (sprint04/05/06/health/middleware/db) **ไม่แก้ไฟล์ test เดิมเลย** + sprint07 ใหม่ 45 = **195/195**

4. **นับ endpoint เท่าต้นทาง (P-04 ข้อ 9)**: 17.5.2 = `GET/POST /vehicles` (2) + `GET/POST /schedules` (2) + `GET/DELETE /schedules/{id}` (2) + `POST/DELETE /schedules/{id}/assign-driver` (2) + `POST/DELETE /schedules/{id}/assign-vehicle` (2) = **10 operations = 10 route registrations** (test `wiring` อ่าน source จริงนับ `router.get/post/delete(` = 10 · guard ครบ 3 รหัส · `PUT/PATCH /schedules/{id}` + `/vehicle-types` + `PUT/DELETE /vehicles/{id}` ตอบ 404 จริง)

### สิ่งที่ test คุม (45 tests)

| Suite | ครอบคลุม |
|---|---|
| T-029 GET/POST `/vehicles` | รูป Vehicle (join type name/seats · `seats_available=null` เมื่อไม่มีรอบ) + meta + เรียง `veh_id` · กรอง is_active/vtype_id · ค่า filter ผิดถูกละ · clamp page/limit · POST 201 **insert บน conn ของ withTransaction + commit + ข้อความ `เพิ่มรถสำเร็จ`** · 409 `ทะเบียนรถนี้มีอยู่แล้ว` (ไม่เข้า tx) · 422 FK `ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบประเภทรถที่ระบุ)` · 400 details field-level · **นอกสเปก → 404** |
| T-030 GET/POST `/schedules` | รูป Schedule (`end_at` = depart + total · driver/vehicle join · **BR-07 `seats_reserved` = SUM booking status=reserved**) + เรียงวันที่/เวลา · กรอง route_id/from/to/is_active (TO_DATE binds) · POST 201 **INSERT schedule + schedule_stop ทุกแถว offsets 0/5/9 (BR-02) ใน tx เดียว** · 409 dup มี `HH:MM` ในข้อความ · 422 สามกรณี (ไม่มีจุดจอด / SUM ≠ total_minutes / ลำดับขาด) **ไม่เข้า tx** · 404 เส้นทาง · 400 รวม **`2026-02-30` → 400** (วันไม่มีจริง) · is_active enum |
| T-030 GET/DELETE `/schedules/{id}` | GET detail: stops[] เรียง `stop_seq` + **`arrive_at` BR-02** + `stop_name` · 404 · DELETE 409 `SCHEDULE_HAS_BOOKING` นับจำนวนจริง + `details booking_count` · DELETE 200 ลบจริง commit + 404 ซ้ำ |
| T-031 assign-driver | 201: **ลำดับ lock → conflict → INSERT ถูกต้อง + commit** · 409 `DRIVER_CONFLICT` แจ้ง `ชนกับรอบ {id} วันที่ … เวลา …` + rollback ไม่ INSERT · **ขอบเขต overlap: จบ 09:39 = เริ่ม 09:39 → allow** · 422 `NOT_A_DRIVER` · 404 รอบ/พนักงาน (lock ก่อน → 404) · 409 `ALREADY_ASSIGNED` (ต่างจาก conflict) · 400 emp_id · DELETE 200/404 |
| T-032 assign-vehicle | 201 lock schedule → lock vehicle → conflict → INSERT + commit + คืน capacity (BR-07) · 409 `VEHICLE_CONFLICT` + rollback · ขอบเขต overlap allow · 422 `VEHICLE_INACTIVE` · 409 `ALREADY_ASSIGNED` (รอบมีรถคันอื่นแล้ว) · 404/400 · DELETE 200/404 |
| Guards (10 endpoints) | ไม่มี token → 401 ทั้ง 10 · `ROUTE.VIEW` อย่างเดียว → อ่าน `/schedules` 200 / เขียนทั้งหมด 403 · outsider 403 ทั้งอ่าน · **ถอด `SCHED.EDIT` ระหว่าง session → 403 ทันที** (โหลดจาก DB ทุก request) · wiring: 10 ops + guard ครบ + ไม่มี PUT/PATCH `/schedules/{id}` (Q23) |
| repository SQL static | vehicle list/count JOIN + ORDER + OFFSET/FETCH ไม่ `SELECT *` · plate ใน bind ไม่ interpolation · `lockById` FOR UPDATE · schedule list ORDER วันที่/TO_DATE/MIN assign/BR-07 reserved · `insertStop` **NUMTODSINTERVAL bind** · `lockSchedule`/`lockEmployee` FOR UPDATE ไม่ lock aggregate · conflict query bind ทั้งหมด + `isDriver` bind roleName |

## Contract decisions ที่ reviewer ต้องรู้

| # | เรื่อง | ที่เลือก | เหตุผล/ที่มา |
|---|---|---|---|
| 1 | สิทธิ์ `/vehicles` (GET+POST) | **`VEH.EDIT`** | UC-13 เขียน `VEHICLE.EDIT` แต่ seed มีแค่ `VEH.EDIT` ('จัดการยานพาหนะ') — บังคับ VEHICLE.EDIT = ไม่มีใครดู/เพิ่มรถได้ → ใช้ `VEH.EDIT` ชั่วคราว · **บันทึกเป็น unresolved check** (รูปแบบเดิม STOP.EDIT/PERMISSION.EDIT) |
| 2 | สิทธิ์ `/schedules` | GET+detail → **`ROUTE.VIEW`** ('ดูเส้นทางและรอบเวลา') · writes 6 ops (POST/DELETE `/schedules` + assign ทั้ง 4) → **`SCHED.EDIT`** ('จัดการตารางเวลาเดินรถ') | รหัสใน seed ตรงบริบทที่สุด · openapi ไม่ declare perm code ตรง ๆ |
| 3 | ไม่สร้าง endpoint ที่สเปกไม่ประกาศ | **ไม่มี `/vehicle-types`** (type ฝังใน Vehicle allOf — openapi บรรทัด 4101) · **ไม่มี `PUT/DELETE /vehicles/{id}`** · **ไม่มี `PUT /schedules/{id}` (Q23 ยังค้าง)** | 17.5.2 บรรทัด 672–681 = 10 ops เท่ากันเป๊ะ · P-04 ข้อ 9 — ชื่อ task เขียน "CRUD" แต่สเปกประกาศแค่นี้ → ไม่เดา · มี test ยืนยัน 404 |
| 4 | BR-02 offset | `arrive_at = depart_at + NUMTODSINTERVAL(offset,'MINUTE')` · offset = **SUM `travel_minutes` สะสม 1..i** (จุดแรก = 0) | usecase-spec BR-02 + ตัวอย่างจุดแรก 0 (แนวเดิม Sprint 6) |
| 5 | BR-04 overlap (ASM-07-1) | ช่วงรอบ = `[depart_at, depart_at + route.total_minutes]` · **strict `a.start < b.end && b.start < a.end` — ชนชิดขอบ (end == start) ไม่ถือว่าชน** · ชนเฉพาะรอบอื่น (`sched_id <> :exclude`) · ปฏิเสธ 409 + details ชื่อรอบที่ชน (ไม่ block เงียบ) | ASM-07-1 = hypothesis overlap (Q4 ยังค้างอาจารย์ — peer ทำ day-level) · openapi ไม่ define boundary → strict overlap เป็นค่ามาตรฐาน + test ล็อกไว้ |
| 6 | Locking order ใน tx assign | `lockSchedule` (FOR UPDATE ตารางรอบ) → `lockEmployee`/`vehicle.lockById` (FOR UPDATE ทรัพยากร) → ตรวจ role/active/already/conflict → INSERT → commit · **ไม่ FOR UPDATE บน aggregate** | ลำดับ schedule→resource คงที่ กัน deadlock · aggregate lock = ORA-02014 |
| 7 | ลำดับตรวจ `POST /schedules` | 400 validate → 404 route → **422 stops** (ว่าง / seq ไม่ 1..n / `SUM ≠ total_minutes` stale) → 409 dup pre-check → tx (INSERT schedule + stops) · catch `ORA-00001` → 409 เดิม | openapi 422 `ROUTE_STOPS_INCOMPLETE` + uq safety |
| 8 | `DELETE /schedules/{id}` | นับ booking **ทุกสถานะ** → มี → 409 `SCHEDULE_HAS_BOOKING` + จำนวน · ไม่มี → tx DELETE (`schedule_stop` CASCADE) · catch `ORA-02292` → 409 เดิม | `booking.sched_id` FK ไม่มี ON DELETE → ลบตรง = ORA-02292 · openapi แนะนำปิดผ่าน `is_active` แทน |
| 9 | รหัส error เพิ่ม | `ALREADY_ASSIGNED` (409) · `NOT_A_DRIVER`/`VEHICLE_INACTIVE` (422) · `VEHICLE_CONFLICT` (409) | หลีก 500 เงียบ ๆ จาก unique/FK violation — openapi ไม่ได้ enumerate ทุก code → บันทึกเป็น decision |
| 10 | BR-07 | `seats_reserved = NVL(SUM(booking),0)` เฉพาะ `status='reserved'` · `seats_total/seats_available = null` เมื่อยังไม่มีรถ (list vehicles ก็ null) | openapi nullable + BR-07 |
| 11 | วันที่ | `service_date` ตรวจ **round-trip calendar** (`isRealDate`) เพราะ V8 `Date.parse('2026-02-30')` rollover → 2 มี.ค. ไม่ reject — POST → 400, GET filter ผิด → เมิน | test จับได้ตอนรันรอบแรก (เดิม 201) → แก้ใน sprint07 เป็น round-trip check |
| 12 | audit log | **ไม่ INSERT `audit_log`** — ตารางนี้ยังไม่มีใน schema (T-042 Sprint 9) · writes ผ่าน HTTP sink `middleware/audit.js` เดิม | openapi x-transaction เขียน "INSERT audit log" แต่ทำไม่ได้จนกว่า schema จะมี → unresolved |

## ⚠️ สิ่งที่ reviewer/คนถัดไปต้องทำ (นอกเหนือจาก code)

1. **ตั้ง `JWT_SECRET` ใน `backend/.env`** (ตาม `backend/.env.example`) — worker ห้ามแตะไฟล์ credential
2. **Seed password เป็น placeholder** → login กับ DB จริงได้ 401 จนกว่าจะ seed bcrypt hash ใหม่
3. **ยังไม่ได้ integration test กับ Oracle จริง** — test รอบนี้ใช้ fake repos + transaction runner/SQL โค้ดจริง (assert ผ่าน spy) · ต้องรัน schema+seed แล้วยิงจริง โดยเฉพาะ `NUMTODSINTERVAL` bind · `TO_DATE` · `FOR UPDATE` (สอง connection แข่งกัน) · behavior timezone/DATE กับ `depart_at` wall-clock
4. **AR-02 Human code review ยังไม่ได้ทำ** — local tests ผ่าน **ไม่เท่ากับ** human review ผ่าน / integration จริงผ่าน / ครบทุก requirement แล้ว

## Unresolved checks / Blocked acceptance criteria

| ข้อ | เกี่ยวกับ Sprint 7 อย่างไร | สถานะ |
|---|---|---|
| **UC-13 precondition `VEHICLE.EDIT`** | seed ไม่มีแถวนี้ → `/vehicles` คุมด้วย `VEH.EDIT` ชั่วคราว (decision #1) | ⏳ ต้องอาจารย์ยืนยัน: เพิ่มแถว permission หรือยอม `VEH.EDIT` |
| **Q23** (`PUT /schedules/{id}` แก้รอบได้ไหม) | ไม่มี endpoint แก้/เลื่อนรอบ — สร้างใหม่ + ลบเท่านั้น | ⛔ ค้างอาจารย์ (ไม่เดา — decision #3) |
| **Q4** (day-level vs overlap) | ที่นี่ทำ **strict overlap ตาม ASM-07-1** — ถ้าอาจารย์ยืนยัน day-level ต้องแก้ conflict query + test | ⏳ ค้างอาจารย์ (decision #5) |
| **Q14** (Oracle 19c vs 21c) | ยังไม่รัน integration จริง + target version ไม่ระบุ | ⏳ ค้างอาจารย์ (เดิม) |
| Q-A / Q-B / Q-F / Q20 / Q22 / Q24 | ไม่กระทบ Sprint 7 — ไม่ได้แตะ · **ไม่ได้ถามคำถามซ้ำ** ที่ค้างอยู่แล้ว | ⛔ ตามเดิม |
| audit log (openapi x-transaction) | schema ยังไม่มีตาราง (T-042) → รอบนี้ใช้ HTTP sink แทน | ⏳ รอ Sprint 9 เพิ่มตาราง แล้วค่อยใส่ INSERT ใน tx |

## git status (สิ่งที่เปลี่ยนรอบนี้)

```
M  backend/src/app.js               (mount /vehicles, /schedules)
M  backend/src/repositories/index.js (+vehicle, +schedule)
M  backend/src/services/index.js     (+scheduling)
M  backend/src/utils/mappers.js      (+dateOnly, +toVehicle, +toSchedule, +toScheduleStop)
?? backend/src/repositories/{vehicle,schedule}.repository.js
?? backend/src/services/scheduling.service.js
?? backend/src/routes/scheduling.routes.js
?? backend/tests/sprint07.test.js
?? docs/agent-handoffs/sprint07-kaengkarn.md  (ไฟล์นี้)
```

ไฟล์ dirty เดิมที่ **ไม่ได้แตะ** (preserve, ห้าม push ปน):
`backend/src/config/{db,env}.js` · `backend/src/middleware/{errorHandler,index,validate}.js` · `database/02_seed_master.sql` · `docs/agile/*` · `docs/ai-credit-log.md` · `docs/kaengkarn-check-list.md` · `docs/agile/q-items-for-instructor.md` · `.playwright-mcp/` · `convert_svg.py`

## งานต่อไป

- **ยังไม่ commit/push** — เป็นหน้าที่ coordinator (ถ้าจะ commit: เฉพาะไฟล์ sprint 7 + handoff เท่านั้น)
- Integration test กับ Oracle จริง (ข้อ 1–3 ด้านบน)
- AR-02: Code Review โดยสุขสรร ก่อนถือว่า DoD ปิดจริง
- coordinator dispatch batch ถัดไป (T-033+)

---
*จัดทำโดย: เก่งกาญ `[ai-assisted]` · คำสั่ง verification ทั้งหมดรันจริงบน Windows/Node v24.21.0*
