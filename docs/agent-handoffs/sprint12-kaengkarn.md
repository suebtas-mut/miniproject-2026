# Sprint 12 Handoff — เก่งกาญ (kaengkarn) · T-054 / T-055 / T-056 / T-060

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ⚠️ ยัง open จาก sprint ก่อน (อ้างอิง ไม่ได้แก้/ไม่ได้ merge)

- **CONTRACT-DRIFT-01**: kaengkarn `1818593` snake_case `route_id` vs sukhsorn `b107da0` camelCase `routeId` — ห้ามอ้าง live interoperability · ไม่ merge อัตโนมัติ · ไม่แตะ code ฝั่ง peer
- รอบนี้ **ไม่ได้แก้ `docs/api/openapi.yaml`** — contract รายงานมีครบอยู่แล้ว (paths `/report/*` · schemas ReportBoardingAlightingWeek / ReportDailyByRoute / ReportDriverWorkload · components/responses/NotImplemented)

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 12 DoD | สถานะ |
|---|---|---|
| **T-054** `GET /api/v1/report/boarding-alighting-week` (UC-27 · R1) | guard `RPT.R1` · `?year=` บังคับ (พ.ศ. 4 หลัก 2500–2600) + `?route_id=` optional · พ.ศ.→ค.ศ. (`−543`) + ขอบสัปดาห์ Monday-boundary คำนวณใน JS · อ่าน view `v_report_boarding_alighting_week` (SUM ต่อ week · bind `:fromWeek/:toWeek/:routeId` · ไม่มีวันที่ literal) · 200 `{success, data: {year, total_weeks, rows[week_no,week_start,board_count,alight_count], chart bar_grouped}}` | ✅ (local tests) |
| **T-055** `GET /api/v1/report/daily-by-route` (UC-28 · R4 · PIVOT) | guard `RPT.R4` · `?from=&to=` บังคับ (YYYY-MM-DD, วันจริง, from ≤ to) + `?route_id=` optional · **PIVOT** `SUM(customer_count) FOR route_id IN (SELECT route_id FROM route WHERE is_active=1)` + **calendar spine** `CONNECT BY LEVEL` แล้ว LEFT JOIN (วันไม่มีรอบ → 0 ไม่ตัดแถว) · `route_ids` จาก `listActiveRouteIds` · `day_name` จ/อ/พ/พฤ/ศ/ส/อา คำนวณเอง (ไม่พึ่ง NLS) · `total` = ผลรวม `route_counts` · chart `stacked_bar` | ✅ (local tests) |
| **T-056** `GET /api/v1/report/driver-workload` (UC-29 · R6 · ROLLUP + Analytic) | guard `RPT.R6` · `?from=&to=` บังคับ · คนขับทุกคน (`driver_assign JOIN employee` DISTINCT) LEFT JOIN view · ไม่มีรอบ → 0/0 · **`GROUP BY ROLLUP(emp_id, driver_name)` + `HAVING GROUPING` ตรงกัน** (ตัด subtotal ระดับ emp) · **`RANK() OVER (ORDER BY total_trips DESC)`** · แถวรวม (`driver_id=null`) ท้าย `rows` · กราฟ **ไม่รวม** แถวรวม (ตามตัวอย่าง openapi) | ✅ (local tests) |
| **501 stubs** R2/R3/R5/R7 | guard `RPT.R2/R3/R5/R7` ต่อ endpoint → `501 {error.code:'REPORT_NOT_SELECTED', message:'รายงานนี้ไม่ได้อยู่ในชุดที่ทีมเลือกทำจริง (R1 + R4 + R6)'}` ตรงตัวอย่าง openapi · **ไม่ validate query** (responses มีแค่ 501/401/403) | ✅ (local tests) |
| **T-060** Test Plan + Test Case BR-01…BR-12 (P-10) | `docs/test-plan/test-case-br01-br12-kaengkarn.md` — Part A script 12 เคส (ครบทุก BR · ทุกเคสชี้ test file จริงที่รันผ่าน) + Part B manual 13 เคส + boundary seats 1/4/5 + เคส ⏸ รอยืนยันอาจารย์ · P-10 log อัปเดต | ✅ เอกสารครบ · Part B **ยังไม่ได้รัน** (ต้อง Oracle จริง) |
| Regression tests | `backend/tests/sprint12.test.js` — **22 tests / 7 blocks** (ด้านล่าง) | ✅ |
| Repository/service/route wiring | bind variables เท่านั้น · READ ONLY (ไม่มี transaction — UC-30) · mounts `/api/v1/report` | ✅ (spy asserts) |

## ไฟล์ที่สร้าง/แก้

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/src/repositories/report.repository.js` | `weeklyBoarding` (view + SUM ต่อ week + 3 binds) · `listActiveRouteIds` (`is_active=1` + optional filter) · `dailyByRoute` (WITH `cal` spine + `piv` PIVOT subquery + LEFT JOIN · 3 binds) · `driverWorkload` (WITH `drv` DISTINCT + ROLLUP/HAVING + RANK analytic + LEFT JOIN view + 2 binds) — ไม่มี INSERT/UPDATE/DELETE |
| `backend/src/services/report.service.js` | parse/validate `year`/`from`/`to`/`route_id` (400 `VALIDATION_ERROR` + `details[{field}]` envelope) · `weekBounds` (พ.ศ.→ค.ศ. + Monday of Jan-1 week / Dec-31 week — คำนวณใน JS ไม่พึ่ง NLS) · `dayNameOf` (UTC) · shape rows + chart ตาม openapi 3 schemas |
| `backend/src/routes/report.routes.js` | 7 endpoints (R1/R4/R6 จริง + 4 × 501) · guard `RPT.R1…R7` · 501 ด้วย `res.status(501).json(errorBody(...))` **ตรง ๆ ไม่ throw HttpError** (errorHandler แปลง ≥500 → INTERNAL_ERROR จะทำ code ไม่ตรง openapi) |
| `backend/tests/sprint12.test.js` | **22 tests / 7 describe blocks** |
| `docs/test-plan/test-case-br01-br12-kaengkarn.md` | T-060 (P-10 format) |
| `docs/agent-handoffs/sprint12-kaengkarn.md` | ไฟล์นี้ |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน (รอบนี้) |
|---|---|
| `backend/src/repositories/index.js` | + `report` export |
| `backend/src/services/index.js` | + `createReportService({ repos })` |
| `backend/src/app.js` | + `api.use('/report', createReportRouter({ service: services.report, requirePermission }))` (ใต้ authenticate เดิม — 401 มาก่อน guard เสมอ) |
| `database/05_views_report.sql` | **แก้ view 1**: + `s.route_id` ใน SELECT/GROUP BY (ตัวกรองเส้นทางที่ API) · **แก้ view 2**: metric หลัก = `customer_count` (นิยาม openapi R4 — สถานะ `reserved/checked_in/completed` · `COUNT(DISTINCT cust_id)`) · เก็บ `booked_count` เป็นคอลัมน์สำรอง · หัวไฟล์บันทึกการแก้ Sprint 12 |
| `docs/ai-prompts/P-10_test-case.md` | สถานะ → ใช้จริงแล้ว (T-060) · เติม AR-05/AR-04/AR-07 ด้วยผลจริง |

`database/01_schema.sql` · `02_seed_master` · `03_seed_front` · `04_seed_report_bulk` · `docs/api/openapi.yaml` · script/config · test เดิมอื่น · `app/` (Flutter — เจ้าของอีก stream): **ไม่ได้แตะ**

## Contract decisions (สำคัญ — ใช้ต่อใน review)

1. **Guard ต่อรายงาน**: `RPT.R1/R4/R6` ทำจริง · `RPT.R2/R3/R5/R7` → 501 หลัง guard (permission seed module `report` ทั้ง 7 ตัว) · 401 จาก authenticate mount มาก่อน guard เสมอ
2. **501 ต้องเขียนด้วย `res.status(501).json(errorBody(...))`** — `throw HttpError(501)` จะโดน errorHandler แปลงเป็น `INTERNAL_ERROR`/ข้อความ 500 (code ไม่ตรง openapi) · message ตรง components/responses/NotImplemented ทุกอักขระ
3. **Query validation อยู่ใน service** (`validate()` middleware ตรวจแค่ body) — 400 envelope `{code:'VALIDATION_ERROR', details:[{field, message}]}` แบบเดียวกับ endpoint อื่น
4. **Year = พ.ศ.** (`YearParam` 2500–2600, 4 หลัก) → ค.ศ. = `year − 543` · ขอบสัปดาห์ = จันทร์ของสัปดาห์ที่มี 1 ม.ค. → จันทร์ของสัปดาห์ที่มี 31 ธ.ค. (** Monday-boundary คำนวณใน JS** — ไม่พึ่ง NLS/รูปแบบ Oracle) · สำหรับ 2568 → `2024-12-30 … 2025-12-29`
5. **⚠ week-boundary**: สัปดาห์ที่คาบเกี่ยวปี (เช่น 29 ธ.ค.–4 ม.ค.) ติดทั้งสองปีของรายงาน เพราะ view เก็บ grain ระดับสัปดาห์ — เป็น **ข้อตัดสินใจออกแบบ** ให้ reviewer ตรวจ (ไม่ใช่ requirement ที่ตั้งเอง)
6. **R4 metric = `customer_count`** ตาม openapi (นับ `COUNT(DISTINCT cust_id)` · สถานะ 3 ตัว · `no_show` แยก) — sprint11 draft เคยใช้ `booked_count` เป็นหลัก → **รอบนี้แก้ view ให้ openapi เป็นตัวตั้ง** และเก็บ `booked_count` ไว้เป็นสำรอง · **Q-REPORT-4 ยัง open** (instructor อาจนิยามใหม่ — แก้จุดเดียวที่ view CASE)
7. **PIVOT column set ไม่ hardcode**: `IN (SELECT route_id FROM route WHERE is_active=1)` — เส้นทางใหม่โผล่อัตโนมัติ · **calendar spine อยู่ใน SQL** (`CONNECT BY`) เพราะ openapi กำหนดวันไม่มีข้อมูลต้องแสดง 0
8. **`day_name` คำนวณใน service (UTC)** — `TO_CHAR(...,'Day')` ของ DB ค่าขึ้น NLS
9. **R6**: `HAVING GROUPING(emp_id) = GROUPING(driver_name)` ตัด subtotal ระดับคน (เหลือเฉพาะระดับ driver + แถวรวม) · `ORDER BY (CASE driver_id IS NULL THEN 1 ELSE 0 END), rank_no` → แถวรวมท้ายสุด · **กราฟไม่รวมแถวรวม** (ตัวอย่าง openapi)
10. **READ ONLY ทั้ง 3 query** — ไม่มี transaction (UC-30 ไม่มีการเปลี่ยนแปลงข้อมูล) · bind variables ทุกตัว (ไม่มีวันที่/รหัส literal ใน SQL)

## Verification (รันจริงทั้งหมด)

1. **Smoke**: `node -e "require('./src/app'); console.log('smoke OK')"` (workdir `backend/`) → `smoke OK`

2. **`npx.cmd jest --runInBand tests/sprint12.test.js`** (workdir `D:\data\shuttle-kaengkarn\backend`):

```
Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
exit=0
```

   ครอบคลุม 7 blocks:
   - **T-054 R1 (4)**: 200 keys ครบ `ReportBoardingAlightingWeek` + แปลง 2568 → ขอบสัปดาห์ 2025 · 400 year (ขาด/ไม่ 4 หลัก/นอก 2500–2600/ส่ง 2 ค่า — ไม่เรียก repo) · ขอบ 2500/2600 ผ่าน + route_id ส่งต่อ/ผิดรูป → 400 · 401/403 (viewer/mai ไม่มี `RPT.R1` — guard ก่อน service)
   - **T-055 R4 (4)**: 200 keys + `day_name` ไทย + `route_counts` + `total` + stacked_bar · route_id=2 → `route_ids=[2]` + repo รับค่า · 400 (from/to ขาด · รูปผิด · วันไม่มีจริง `2026-02-30` · from > to · route_id ผิด — ไม่เรียก repo) · 401/403 `RPT.R4`
   - **T-056 R6 (3)**: 200 keys + แถวรวม ROLLUP (`driver_id=null`) ท้ายสุด + คนขับไม่มีรอบ = 0/0 + กราฟไม่รวมแถวรวม · 400 (ขาด/รูป/from > to) · 401/403 `RPT.R6`
   - **501 stubs (3)**: ทั้ง 4 endpoints → 501 + code/message ตรงตัวอย่าง openapi · **ไม่ validate query** (ไม่ส่ง query ก็ได้ 501) · 401/403 · guard คนละตัว (admin มีทั้ง 7 → ผ่านทุกตัว · mai ไม่มีสิทธิ์รายงาน → 403 ทุกตัว)
   - **repo SQL static (5)**: `weeklyBoarding` view+SUM+3 binds ไม่มี literal · `listActiveRouteIds` is_active+map number[] · `dailyByRoute` PIVOT subquery + CONNECT BY spine + LEFT JOIN + 3 binds · `driverWorkload` ROLLUP + HAVING GROUPING + RANK + 0-drivers LEFT JOIN · FROM/JOIN ⊆ whitelist
   - **contract (3)**: openapi มี path/operationId ครบ 7 รายงาน + ตัวอย่าง 501 ตรงค่าจริง · routes ผูก guard ครบ 7 `RPT.R*` + app.js mount `/report` + seed มี permission ครบ 7 · 05 views: view1 มี `route_id` (GROUP BY) · view2 metric = นิยาม 3 สถานะ openapi
   - whitelist test รอบนี้: ตัดชื่อ CTE (`cal`, `piv`, `drv`) ก่อนตรวจชื่อตาราง (เคส false positive แรกเจอตอนรัน → แก้ใน test เอง ไม่ได้ลด assertion)

3. **`npm.cmd test -- --runInBand`** (workdir `backend/`, bash call แยก):

```
PASS tests/sprint04.test.js
PASS tests/sprint12.test.js
PASS tests/sprint07.test.js
PASS tests/sprint10.test.js
PASS tests/sprint09.test.js
PASS tests/sprint06.test.js
PASS tests/sprint05.test.js
PASS tests/sprint11.test.js
PASS tests/middleware.test.js
PASS tests/health.test.js
PASS tests/db.test.js
PASS tests/sprint08.test.js (5.351 s)
Test Suites: 12 passed, 12 total
Tests:       354 passed, 354 total
exit=0
```

   (sprint11 = 332 → +22 sprint12 = **354** · ไม่มี test เดิมถูกแก้ Assertions/ถูกลบ — ไฟล์เดิมที่แตะรอบนี้มีแค่ wiring index/app + views + P-10 log)

4. **`git status --porcelain`**: ไฟล์ใหม่รอบนี้ = `backend/src/repositories/report.repository.js` · `backend/src/services/report.service.js` · `backend/src/routes/report.routes.js` · `backend/tests/sprint12.test.js` · `docs/test-plan/test-case-br01-br12-kaengkarn.md` · `docs/agent-handoffs/sprint12-kaengkarn.md` (+ ไฟล์ sprint ก่อนที่ยัง untracked) — **ไม่ได้ commit** · dirty files เดิมไม่ถูกแตะเพิ่ม (รวม `.playwright-mcp/`, `convert_svg.py`, `docs/agile/*`, `ai-credit-log`, check-lists)

5. **Flutter**: รอบนี้ **ไม่มีไฟล์ใน `app/` เปลี่ยน** (backend stream เป็นเจ้าของ API/SQL) → ไม่ได้รัน `flutter test`/`flutter analyze` (ไม่มีสิ่งที่จะตรวจ)

## T-060 (Test Plan) — สรุปสถานะจริง

- **Part A script 12 เคส**: ชี้ไปที่ test จริง (sprint06→BR-01/03 · sprint07→BR-02/04 · sprint08→BR-05/07/11/12 · sprint08+09→BR-06 · sprint09→BR-08 · sprint10→BR-09 · sprint11→BR-10) — **รันผ่านแล้วบนเครื่อง dev** (คือ suite 354 ข้างบน)
- **Part B manual 13 เคส**: ขั้นตอน+ค่าจริงจาก seed (เส้นทาง 2 = 13 นาที 4 จุด · รอบ 2026-10-01 09:30/11:00/13:00/15:00 · รถตู้ 9 ที่นั่ง) — **ยังไม่ได้รัน** ต้อง Oracle จริง/หน้าจอ · คอลัมน์ ผ่าน/ไม่ผ่าน = ⬜ ทุกแถว
- **Boundary**: seats 1 → 201 · 4 → 201 · 5 → 400 (มีทั้ง script + manual)
- **⏸ รอยืนยันอาจารย์ (ในไฟล์ test-plan)**: (1) BR-01 เส้นทาง 3 = 12 หรือ 15 นาที (Q-B/Q18 — seed จริง SUM = 15, usecase-spec เขียน 12) · (2) BR-04 boundary ช่วงติดกัน (Q4) · (3) BR-06 นิยาม 1–4 ต่อการจอง (ปัจจุบันตาม 01_schema ck_booking_seats — ถ้าอาจารย์ให้ต่อรอบ ต้องแก้ schema+service แล้วรีเทส)
- P-10 log (`docs/ai-prompts/P-10_test-case.md`) เติม AR-05/AR-04/AR-07 แล้วด้วยผลจริง · **AR-02 (สุขสรร ตรวจ) ยังไม่เกิดขึ้น** · AI credit แถว "เวลาที่ประหยัดได้" ยังไม่วัด (ไม่แตะ `ai-credit-log.md` — เป็น preserve file)

## ⛔ ข้อจำกัดที่ต้องพูดตรง ๆ (ห้ามอ้างเกิน)

- **local pass ≠ human review / live integration / ครบทุก requirement** — ยังไม่มี reviewer คนไหนตรวจโค้ดรอบนี้ · ยังไม่ commit/push
- **ไม่มี Oracle instance ใน environment นี้**: view ใน `05_views_report.sql` (รวมที่แก้รอบนี้) และ seed `04` **ยังไม่เคยรันที่ไหน** — tests เป็น fake-repo + static assertions เท่านั้น · T-060 Part B ก็ยังไม่ได้รัน
- **ยังไม่ได้ verify ด้วย openapi validator จริง** (contract ตรวจด้วย test อ่าน YAML เอง)
- ไม่ได้แตะ `app/` (Flutter เป็นเจ้าของ) — หน้ารายงาน R1 ฝั่ง UI (T-058) ยังเป็นงาน stream อื่น
- งาน SQL/รายงานทั้งหมดเป็นของ stream นี้ตาม execution plan แต่ **ไม่ได้แต่งสิทธิ์อธิบาย/ตรวจของมนุษย์** (T-053 ในแผนมนุษย์ = สุขสรร เหมือนเดิม)

## Unresolved checks (ต้อง coordinator/reviewer ตัดสิน — ไม่ใช่สิ่งที่ worker invent ได้)

| # | เรื่อง | สถานะ |
|---|---|---|
| 1 | CONTRACT-DRIFT-01 (snake_case vs camelCase) | open |
| 2 | Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 (sprint8/9/10) | open |
| 3 | openapi scan: ScanResult `not_found` vs 404 · ไม่มี 409 scan · `TRIP_PENDING`/`SCHEDULE_LOCKED` ไม่อยู่ใน openapi (sprint10) | open |
| 4 | **Q-REPORT-4**: นิยาม `booked_count` — รอบนี้ยึด openapi `customer_count` เป็นหลัก + เก็บ `booked_count` สำรอง · instructor อาจนิยามใหม่ | open |
| 5 | **Q10 vs Answer-Day1**: ตัวเลขตัวอย่าง PDF จับคู่กับ seed ≥50,000 แถวไม่ได้ | open |
| 6 | T-053 ownership (มนุษย์ = สุขสรร) | open |
| 7 | 8 ช่วงรอบ/วันของ bulk seed (ทีมขยายจาก 4 ช่วง PDF) | open |
| 8 | **week-boundary ข้ามปี** ของ R1 (สัปดาห์ 29 ธ.ค.–4 ม.ค. ติด 2 ปี — design note ข้อ 5) | open (ใหม่ — ให้ reviewer ยืนยัน) |
| 9 | T-060 Part B (manual 13 เคส) ยังไม่ได้รัน + AR-02 ยังไม่ตรวจ + เคส ⏸ BR-01/Q4/BR-06 | blocked (ต้อง Oracle จริง/อาจารย์/ผู้ตรวจ) |

**DoD ที่ยังถูกบล็อก**: ไม่มี live-Oracle integration · ไม่มี human review · ไม่ได้ verify openapi validator · T-060 manual ไม่ได้รัน · ไม่ได้ commit/push

## Standing constraints (รอบถัดไป)

- Windows absolute paths เท่านั้น · PowerShell 5 (ไม่มี `&&`) · tests = bash call แยก workdir `D:\data\shuttle-kaengkarn\backend` (`npm.cmd test -- --runInBand`) · ไม่ commit/push · ไม่อ่าน `.env` · ห้ามแตะ dirty files ของ peer (`backend/src/config/*`, `middleware/{errorHandler,validate,audit,index}.js`, `database/01_schema.sql`, `02_seed_master.sql`, `docs/agile/*`, `docs/ai-credit-log.md`, `docs/kaengkarn-check-list.md`, `.playwright-mcp/`, `convert_svg.py`)
- Unresolved ข้อ 1-9 + Q-list **ไม่ใช่ permission ให้ invent** — sprint ถัดไปที่ต้องใช้ ให้ list blocked acceptance criteria ไว้ใน handoff
- API prefix `/api/v1` · contract = `docs/api/openapi.yaml` · Backend stream = API/SQL · Flutter stream = client/docs · ห้ามแก้ peer workspace
- local pass ≠ human review / live integration / ครบทุก requirement
