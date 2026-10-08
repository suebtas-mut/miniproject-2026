# Sprint 12 Agent Handoff — T-058 / T-060

- **Agent**: Sukhsorn (Flutter stream)
- **Date**: 2026-10-09
- **Base commit**: `b107da0` (HEAD unchanged — no commits by worker per dispatch)
- **Tasks**: T-058 หน้ารายงาน R1 (กราฟ+ตาราง, กรองปี 2568/เลือกวันที่, loading/empty/error) · T-060 Test Plan + traceability BR-01..BR-12
- **Status**: ไคลเอน + เอกสาร T-060 เสร็จในเครื่องนี้ · **ไม่มี human review, ไม่มี integration กับ backend จริง**

## 1. Tasks completed

### T-058 — R1 report screen (Flutter client)

| เกณฑ์ | ผล |
|---|---|
| GET `/api/v1/reports/r1` ตาม OpenAPI (`from`/`to` Gregorian yyyy-MM-dd, `routeId` optional) + Bearer | ✅ repository + FakeBackend contract test ผ่าน |
| ตัวกรองปีพุทธ 2568/2567 → แปลงเป็น Gregorian (BE − 543) | ✅ `buddhistToGregorian` + DropdownMenu `report-year` |
| เลือกช่วงวันที่เอง (showDateRangePicker) | ✅ `report-date-range` |
| กรองตามเส้นทาง (dropdown จาก `routesProvider`) | ✅ `report-route` + query `routeId` |
| แสดงผล: KPI การ์ด, กราฟแท่งผู้โดยสารรายวัน (fl_chart 0.68), ตารางรายละเอียด | ✅ keys `r1-kpi-*`, `r1-chart`, `r1-table` |
| แสดงวันที่เป็น พ.ศ. (dd/MM/พ.ศ.) ฝั่ง UI · ส่ง Gregorian ให้ API | ✅ `ReportR1Row.shortDate` |
| States: loading (`list-loading`), empty (`list-empty`), error+retry (`list-error-message`, GET ซ้ำได้) | ✅ test ผ่าน |
| Client gate `RPT.R1` → ข้อความไม่มีสิทธิ์ · ไม่ยิง API | ✅ test ผ่าน |
| แท็บ R4/R6 = placeholder Sprint 13 (T-059) | ✅ `report-r4-placeholder`/`report-r6-placeholder` |

### T-060 — Test plan + traceability

สร้าง `docs/testing/test-plan-br01-br12.md`:
- Test Case 12 รายการ (TC-BR01..TC-BR12) ตาม BR-01..BR-12 ใน `docs/chapter-17-fullstack.md` §17.4.5
- Traceability matrix: BR → ตำแหน่งบังคับใช้ → TC → หลักฐานไคลเอนที่รันแล้ว (อ้างชื่อเทสต์ sprint06/08/09/10/11 ที่ผ่านจริงใน suite) → หลักฐาน backend = **ยังไม่ได้รัน**
- ข้อจำกัดระบุชัด: ไม่มี human review, ไม่มี integration backend/Oracle, concurrency BR-07 ยังไม่พิสูจน์, NFR อยู่ขอบเขต T-057

## 2. Changed / created files (ไคลเอน + เอกสารเท่านั้น)

| ไฟล์ | สถานะ |
|---|---|
| `app/lib/features/report/report_models.dart` | สร้าง — `ReportR1Row`/`ReportR1`/`parseReportR1` + KPI getters (weighted rate, divide-by-zero guard) |
| `app/lib/features/report/report_repository.dart` | สร้าง — `fetchReportR1({from,to,routeId})` → GET `/reports/r1` |
| `app/lib/features/report/report_providers.dart` | สร้าง — `ReportR1Query(+forBuddhistYear)`, `ReportR1QueryController` (setYear/setDateRange/setRouteId), `reportR1Provider` |
| `app/lib/features/report/report_shell.dart` | สร้าง — 3 tabs + `_FilterBar` + permission gate + placeholders |
| `app/lib/features/report/report_r1_view.dart` | สร้าง — `ReportR1View` (async.when → KPI/กราฟ/ตาราง) |
| `app/lib/features/report/report_page.dart` | แก้ — Scaffold + ReportShell |
| `app/test/sprint12_test.dart` | สร้าง — 14 tests (3 unit + 11 widget) |
| `docs/testing/test-plan-br01-br12.md` | สร้าง — T-060 |
| `docs/agent-handoffs/sprint12-sukhsorn.md` | สร้าง — เอกสารนี้ |

**ไม่ได้แก้**: `docs/api/openapi.yaml`, `docs/chapter-17-fullstack.md`, `docs/chapter-18-development-plan.md`, `database/01_schema.sql` — ใช้เป็น source อ่านอ้างอิงเท่านั้น (backend stream เป็นเจ้าของ API/SQL) · `docs/agile/sukhsorn-check-list.md` + `database/02_seed_master.sql` dirty เดิมถูก preserve ไม่แตะ

## 3. Contract decisions

| หัวข้อ | 决策 | เหตุผล |
|---|---|---|
| Endpoint | ใช้ OpenAPI `GET /api/reports/r1` (app baseUrl `.../api/v1` + `/reports/r1` → FakeBackend `/api/v1/reports/r1`) | OpenAPI เป็น authority ตาม dispatch |
| **Contract drift R1**: usecase-spec UC-27 บอก weekly boarding/alighting (`/report/boarding-alighting-week?year=2568`) + mockup "R1 คนขึ้น/ลงรายสัปดาห์" แต่ OpenAPI บอก daily trip summary (`from`/`to`/rows) | **เลือก OpenAPI (daily)** | สอดคล้องกฎ sprints ก่อนหน้าที่ใช้ OpenAPI เป็นหลัก · ไม่ implement weekly endpoint |
| Year filter | UI 2568/2567 → API Gregorian `2025-01-01..2025-12-31` / `2024-...` (BE − 543) | แปลงใน `report_providers.dart` |
| Permission | client gate `RPT.R1` (perm 90) + server ตรวจซ้ำตามสเปก | defense in depth |
| R4/R6 | ไม่ทำ — Sprint 13 (T-059) | นอกขอบเขตนี้ |

## 4. Tests — real results (เครื่องนี้)

```
flutter analyze --no-pub            → No issues found! (ran in 6.8s)
flutter test --no-pub test/sprint12_test.dart → All tests passed!  (14/14)
flutter test --no-pub               → All tests passed!  (173/173 = 159 เดิม + 14 ใหม่)
```

Test cases ที่ครอบคลุม: parse strict+KPI+guard หารศูนย์ · contract GET (Bearer+from/to) + KPI/กราफ/ตาราง/ป้าย พ.ศ. · loading · empty · 500+retry (GET ซ้ำ) · 403 message · setYear(2567)→2024 range · setDateRange custom · setRouteId → query · DropdownMenu UI tap 2567 · no-permission client gate (ไม่ยิง API) · R4/R6 placeholders

Bug ที่แก้ระหว่างทำ: `requestsFor` ต้องเรียกผ่าน `harness.backend` (ไม่ใช่ harness โดยตรง) · `_R1Content` เปลี่ยน ListView→SingleChildScrollView (ตารางถูก lazy-build นอก fold จน finder หาไม่เจอ) · dropdown tap ใช้ `.last` กัน ambiguity ข้อความซ้ำใน overlay

## 5. Blocked / unresolved (ไม่ได้แก้ในสปรินต์นี้)

- **Backend T-054 (R1 API จริง)**: สาย backend เป็นเจ้าของ — ยังไม่ทราบว่ามี endpoint จริงหรือไม่/contract ตรง OpenAPI หรือไม่ · ไคลเอนพึ่ง FakeBackend เท่านั้น · ต้อง integration test เมื่อ backend พร้อม
- **TC-BR02/BR03/BR12** ไม่มีหลักฐานไคลเอนโดยตรง (เป็น service/DB logic) — ระบุใน test plan ว่าต้อง service test
- **Concurrency BR-07** (FOR UPDATE NOWAIT กัน oversell) — ยังไม่มี test concurrent
- **Human review / live integration / NFR (performance <3s ที่ 50k แถว)**: ยังไม่ถึงขั้นนี้
- Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 (+Q6/Q7/Q-E) ค้างเดิม — ไม่ได้แตะ ไม่ได้ถามซ้ำตาม dispatch

## 6. หมายเหตุต่อ coordinator

- Local reviewer advice ที่แนบมาใน dispatch **มีเนื้อหาเท็จ** (แย้งว่าแก้ openapi.yaml/chapter-17/18/01_schema.sql) — เอกสารนี้เขียนจากงานจริง ไม่ copy คำแนะนำนั้น
- ตรวจ secret ในไฟล์ใหม่แล้ว: ไม่พบ (ค้น api_key/secret/password/token/Bearer/AKIA/sk-/ghp_)
- พร้อมให้ coordinator review + commit (worker ไม่ commit ตาม dispatch)
