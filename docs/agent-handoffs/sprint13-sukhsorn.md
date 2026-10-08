# Sprint 13 Agent Handoff — T-059 / T-061 / T-062

- **Agent**: Sukhsorn (Flutter stream)
- **Date**: 2026-10-09
- **Base commit**: `b107da0` (HEAD unchanged — no commits by worker per dispatch)
- **Tasks**: T-059 หน้าจอ R4/R6 + export · T-061/T-062 ส่วนของ Flutter:
  regression/widget/integration tests + traceability matrix + build Android APK
- **Status**: ไคลเอน + เอกสารเสร็จในเครื่องนี้ · **ไม่มี human review, ไม่มี
  integration กับ backend จริง, ไม่มี real-device/E2E**

## 1. Tasks completed

### T-059 — R4/R6 screens + export (UC-28/UC-29/UC-30)

| เกณฑ์ | ผล |
|---|---|
| แท็บ R4: `GET /api/v1/reports/r4` (from/to + Bearer) · KPI + กราฟแท่ง 3 ช่วงเวลา (เช้า/บ่าย/เย็น) + ตาราง | ✅ `report_r4_view.dart` · test ผ่าน |
| แท็บ R6: `GET /api/v1/reports/r6` (from/to + Bearer) · KPI 4 การ์ด + กราฟรายคัน + ตาราง (ทะเบียน/รอบ/ผู้โดยสาร/นาที) | ✅ `report_r6_view.dart` · test ผ่าน |
| ตัวกรองปี 2568/2567 + ช่วงวันที่ ใช้ร่วมกันทุกแท็บ (เปลี่ยน → R1/R4/R6 โหลดใหม่) | ✅ ใช้ `reportR1QueryProvider` เดิม · test ผ่าน |
| แทนที่ placeholder R4/R6 ( Sprint 12) ด้วยหน้าจริง + client gate `RPT.R4`/`RPT.R6` | ✅ `_ReportPlaceholder` ถูกลบ · ไม่มีสิทธิ์ → ข้อความ + ไม่ยิง API |
| Export (UC-30): ปุ่ม "ส่งออก" ทุกแท็บ → dialog เลือก CSV / Excel (.xlsx) → `GET /reports/{id}/export?format=` | ✅ `report_export.dart` · CSV แสดงชื่อไฟล์ (Content-Disposition) + preview 15 บรรทัด · XLSX แสดงจำนวนไบต์ · error → snackbar ข้อความเซิร์ฟเวอร์ |

### T-061/T-062 (ส่วน Flutter)

| เกณฑ์ | ผล |
|---|---|
| Regression/widget/integration tests `app/test/sprint13_test.dart` | ✅ **20 tests ผ่านทั้งหมด** (parse R4/R6, contract+KPI+กราฟ+ตาราง, สถานะโหลด/ว่าง/500+retry, ตัวกรองร่วม, client gate, export CSV/XLSX/error, integration ข้ามแท็บ R1→R4→R6) |
| Full suite | ✅ **193/193 ผ่าน** (173 เดิม + 20 ใหม่) |
| Traceability matrix | ✅ `docs/testing/traceability-matrix.md` (รายงาน→UC→สัญญา→หน้าจอ→task→หลักฐาน + ช่อง "ยังไม่พิสูจน์") |
| Build Android APK | ✅ `flutter build apk --debug` → `app/build/app/outputs/flutter-apk/app-debug.apk` (**170.13 MB**, 2026-10-09 04:22) |

## 2. Changed / created / deleted files

| ไฟล์ | สถานะ |
|---|---|
| `app/lib/features/report/report_models.dart` | แก้ — เพิ่ม `ReportR4Row/ReportR4/parseReportR4`, `ReportR6Row/ReportR6/parseReportR6`, `ReportExportFile` |
| `app/lib/features/report/report_repository.dart` | แก้ — เพิ่ม `fetchReportR4`, `fetchReportR6`, `exportReport` (bytes + Content-Disposition + ถอด error message จาก bytes body) |
| `app/lib/features/report/report_providers.dart` | แก้ — เพิ่ม `reportR4Provider`, `reportR6Provider` (family ใช้ query เดียวกับ R1) |
| `app/lib/features/report/report_r4_view.dart` | สร้าง |
| `app/lib/features/report/report_r6_view.dart` | สร้าง |
| `app/lib/features/report/report_export.dart` | สร้าง — `ReportExportButton` (dialog CSV/XLSX + preview + error snackbar) |
| `app/lib/features/report/report_r1_view.dart` | แก้ — เพิ่มปุ่มส่งออก |
| `app/lib/features/report/report_shell.dart` | แก้ — R4/R6 เป็นหน้าจริง + gate `RPT.R4`/`RPT.R6` · ลบ `_ReportPlaceholder` |
| `app/test/sprint13_test.dart` | สร้าง — 20 tests |
| `app/test/sprint12_test.dart` | แก้ — 1 test สุดท้าย (เดิม assert placeholder R4/R6 ซึ่งถูกแทนที่ตามขอบเขต T-059) เปลี่ยนเป็น assert ไม่มีสิทธิ์ R4/R6 → ข้อความ + ไม่ยิง API (คง regression value: แท็บไม่ใช่หน้า R1, gate ทำงาน) |
| `docs/testing/traceability-matrix.md` | สร้าง |
| `docs/agent-handoffs/sprint13-sukhsorn.md` | สร้าง — เอกสารนี้ |

**ไม่ได้แก้**: openapi.yaml / chapter-17 / chapter-18 / 01_schema.sql (source อ่านอ้างอิง) · `database/02_seed_master.sql` + `docs/agile/sukhsorn-check-list.md` dirty เดิมถูก preserve · ไม่ได้แตะ peer workspace · ไม่ได้แก้ automation scripts/config

## 3. Contract decisions

| หัวข้อ | 决策 | เหตุผล |
|---|---|---|
| R4 schema | ตาม OpenAPI `ReportR4` (period enum morning/afternoon/evening, totalPassengers, avgPerTrip) | usecase-spec UC-28 เขียน `/report/daily-by-route` (stacked รายเส้นทาง) — **drift จาก OpenAPI** · เลือก OpenAPI เหมือน R1 (sprint12) |
| R6 schema | ตาม OpenAPI (vehId/plateNo/totalTrips/totalPassengers/totalMinutes · ไม่มี from/to ใน response) | usecase-spec UC-29 เขียน `/report/driver-workload` (คนขับ x ช่วงเวลา) — drift · เลือก OpenAPI |
| Export | ปุ่มเดียว "ส่งออก" → เลือก CSV/XLSX ตาม enum OpenAPI · ไม่ส่ง from/to (สเปกไม่มีพารามิเตอร์นี้) | สัญญาปัจจุบัน |
| Export UX | ไม่บันทึกไฟล์ลงอุปกรณ์ (ไม่เพิ่ม path_provider/share_plus) — แสดง preview CSV / นับไบต์ xlsx | ลด dependency · test ได้ · ข้อจำกัดบันทึกใน handoff/traceability |
| Error ของ export | `ResponseType.bytes` ทำให้ error body เป็น bytes — repository ถอด JSON `message` → `ApiException` ก่อน rethrow | snackbar แสดงข้อความเซิร์ฟเวอร์จริง (test 503 ยืนยัน) |
| ปี filter ร่วมแท็บ | R4/R6 ใช้ `reportR1QueryProvider` เดิม (`from`/`to` เท่านั้น — ไม่ส่ง `routeId`) | ตัวกรองเดียวทุกแท็บตาม mockup report-pick |
| RPT.R4 | Client gate ตาม `x-permission: RPT.R4` — ตาราง permission จริงไม่มีตัวนี้ (OpenAPI ระบุ) → ผู้ใช้จริงเห็น "ไม่มีสิทธิ์" หาก backend ไม่เพิ่ม | ไม่เดา requirements — ทำตามสเปก แล้วบันทึกข้อจำกัด |

## 4. Tests — real results (เครื่องนี้)

```
flutter analyze --no-pub                     → No issues found! (ran in 6.0s)
dart format lib/features/report test/...     → 0 changed (หลังแก้ครั้งสุดท้าย)
flutter test --no-pub test/sprint13_test.dart → All tests passed!  (20/20)
flutter test --no-pub                        → All tests passed!  (193/193)
flutter build apk --debug                    → √ Built build\app\outputs\flutter-apk\app-debug.apk (170.13 MB)
```

### หมายเหตุการ build APK (สภาพแวดล้อม Windows)

build ครั้งแรกล้มเหลวซ้ำด้วย Kotlin incremental-cache error
(`:mobile_scanner:compileDebugKotlin` — "different roots" ระหว่าง pub cache
( C: ) กับ project ( D: ) + storage already registered จาก daemon เก่า) ·
วิธีแก้ที่ใช้ (**ไม่แก้ไฟล์ config ใน repo**):
1. ล้าง `app/build` (robocopy empty-mirror แก้ long-path Windows)
2. ตั้ง `$env:PUB_CACHE='D:\data\pub-cache-d'` ชั่วคราว + `flutter pub get`
   (ให้ source อยู่ไดรฟ์เดียวกับ build cache)
3. `gradlew --stop` + kill kotlin daemon ก่อน build ใหม่

`pubspec.lock` ที่เห็น dirty ใน git status เป็น**ของเดิม** (mobile_scanner /
qr_flutter เพิ่มจาก sprint ก่อนหน้า ยังไม่ commit) — pub get ไม่เปลี่ยนเวอร์ชัน

## 5. Blocked / unresolved (ไม่ได้แก้ในสปรินต์นี้)

- **Backend ทุก endpoint ที่ใช้** (r1/r4/r6/export + T-054/T-055/T-056*) — สาย backend เป็นเจ้าของ · client ทดสอบกับ FakeBackend เท่านั้น · ยังไม่มี live integration
- **RPT.R4 ในตาราง permission จริง** — OpenAPI ระบุว่าไม่มี → ถ้าไม่เพิ่ม R4 จะใช้ไม่ได้สำหรับผู้ใช้จริง (acceptance criteria ส่วนนี้ blocked ที่ backend/data stream)
- **Export บันทึกไฟล์จริงลงเครื่อง / เปิดด้วย Excel จริง** — ไม่ทำในสปรินต์นี้ (ไม่เพิ่ม dep) · xlsx binary จริงต้องรอ backend + อุปกรณ์จริง
- **Real device / E2E / release APK / NFR (<3s ที่ 50k แถว)** — ยังไม่ถึงขั้นนี้ · ระบุใน traceability matrix §5
- **T-061 ส่วนเอกสารครบเล่ม** (เรียบเรียงบทที่ 1–18, AI Usage Credit / Prompt Log, README.md, tag v1.0.0) — เป็นงานส่วน docs/controller ตามแผน (owner `@agent-doc`) · สายนี้ทำเฉพาะ traceability matrix ส่วน Flutter
- Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 (+Q6/Q7/Q-E) ค้างเดิม — ไม่ได้แตะ ไม่ได้ถามซ้ำตาม dispatch

## 6. หมายเหตุต่อ coordinator

- ตรวจ secret ในไฟล์ใหม่: ไม่พบ
- พร้อมให้ review + commit (worker ไม่ commit ตาม dispatch) · ไฟล์ที่ต้องเลือก commit:
  ไฟล์ `app/lib/features/report/*` ทั้งหมด + `app/test/sprint12_test.dart` (แก้ 1 test) +
  `app/test/sprint13_test.dart` + `docs/testing/test-plan-br01-br12.md` (sprint12) +
  `docs/testing/traceability-matrix.md` + handoffs sprint12/13 ·
  **ไม่ต้อง commit**: `database/02_seed_master.sql`, `docs/agile/sukhsorn-check-list.md`
  (dirty ของผู้อื่น), `.opencode/`, scripts ชั่วคราว root (`check_conflicts.py`,
  `fix_ai_credit*.py`, `merge_ai_credit.py` — ไม่ทราบเจ้าของ อย่าเพิ่ม)
- Stop หลังสปรินต์นี้ตาม dispatch — controller เป็นผู้ dispatch งานถัดไป
