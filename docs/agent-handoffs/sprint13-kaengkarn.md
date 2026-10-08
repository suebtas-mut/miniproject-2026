# Sprint 13 Handoff — เก่งกาญ (kaengkarn) · T-057 / T-061 (ส่วน backend) / T-062

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents) · **จบ batch นี้แล้ว — หยุดตามคำสั่ง (ไม่มี sprint ต่อไปใน stream)**

## ⚠️ ยัง open จาก sprint ก่อน (อ้างอิง ไม่ได้แก้/ไม่ได้ merge)

- **CONTRACT-DRIFT-01**: kaengkarn `1818593` snake_case vs sukhsorn `b107da0` camelCase — ห้ามอ้าง live interoperability · ไม่ merge อัตโนมัติ
- Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 · CONTRACT-DRIFT-01 · Q-REPORT-4 · Q-REPORT-4 · Q10 · R1 week-boundary ข้ามปี (รายการเต็มใน sprint12 handoff §Unresolved ข้อ 1–9) — **ไม่ใช่ permission ให้ invent** · รอบนี้ไม่ได้แก้อะไรที่ต้องใช้คำตอบเหล่านี้
- รอบนี้ **ไม่ได้แตะ `docs/api/openapi.yaml`** (ห้ามเสมอ) — deviation ที่เจอเขียนไว้ใน endpoint review แทน

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 13 DoD | สถานะ |
|---|---|---|
| **T-057** Index Tuning + EXPLAIN PLAN | `database/06_perf_indexes.sql` — PART A: candidate index 2 ตัว idempotent (`ix_sched_service_date` · `ix_token_blacklist_emp_exp` พร้อมเหตุผลเชิง access path) · PART B: `EXPLAIN PLAN` ของ R1/R4/R6 **ด้วย SQL จริงจาก `report.repository.js`** · PART C: คำสั่งวัด (row count ≥50,000 + TIMING + curl ผ่าน API) + `docs/test-plan/perf-procedure-t057.md` ขั้นตอนทำซ้ำครบ | ✅ script/procedure ครบ · ⬜ **ยังไม่ได้รัน/ยังไม่ได้วัด** (ไม่มี Oracle ในเครื่อง — ห้ามอ้างว่า <3 วิ) |
| **T-061 ส่วน backend** | `docs/test-plan/endpoint-review-t061-kaengkarn.md` — endpoint inventory ↔ openapi + auth sweep + integration status ทุกช่องมีหลักฐานจาก test จริง + deviations เปิดเผย + รายการงาน T-061 ที่เหลือ (stream เอกสาร) | ✅ ส่วน backend · ⬜ ส่วนเอกสาร = stream อื่น |
| **T-062** Regression/Security/Concurrency + แก้ Defect | `backend/tests/sprint13.test.js` — **10 tests / 5 blocks** + defect fix ใน `errorHandler.js` (ดู Contract decisions ข้อ 3) | ✅ |
| Full regression | **13 suites / 364 tests ผ่าน** (เดิม 354 + ใหม่ 10 · test เดิมไม่ถูกลด assertion) | ✅ |

## ไฟล์ที่สร้าง/แก้

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/tests/sprint13.test.js` | 10 tests / 5 blocks: (1) endpoint inventory 2-way ↔ openapi 59 ops (2) auth sweep 58 endpoints → 401 envelope (3) defect fix: JSON พัง/oversize/wrong-method (4) SQLi bind + validate-before-query (5) race ยกเลิก/สแกน |
| `database/06_perf_indexes.sql` | T-057: idempotent index ×2 + EXPLAIN R1/R4/R6 (SQL จริง) + measurement block — non-destructive ล้วน (CREATE INDEX guarded / EXPLAIN / SELECT) |
| `docs/test-plan/perf-procedure-t057.md` | T-057: ขั้นตอนทำซ้ำ + ตารางผลวัด (ทุกช่อง "ยังไม่ได้วัด") + เกณฑ์ <3 วิ@50,000 (อ้าง chapter-18) |
| `docs/test-plan/endpoint-review-t061-kaengkarn.md` | T-061 ส่วน backend: ผลตรวจจริง + 3 deviations + สิ่งที่ยังไม่ตรวจ + T-061 ที่เหลือ |
| `docs/agent-handoffs/sprint13-kaengkarn.md` | ไฟล์นี้ |

### แก้ไฟล์เดิม (รอบนี้)

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `backend/src/middleware/errorHandler.js` | **+ normalizeBodyParserError()**: `entity.parse.failed` → 400 `VALIDATION_ERROR` ข้อความไทย openapi · `entity.too.large` → 413 `PAYLOAD_TOO_LARGE` ข้อความไทย · เรียกบรรทัดแรกของ `errorHandler()` — **ไม่ลบ logic เดิม** (HttpError/500-no-leak/envelope เดิมคงไว้ · test เดิม 354 ผ่านครบ) |

> ⚠️ **ประกาศเปิดเผย (disclosure)**: `middleware/errorHandler.js` อยู่ในรายการ "preserve dirty files" — แต่แผน Sprint 13 (T-062: แก้ Defect ที่เจอ) อนุญาตให้แก้จุดนี้โดยเฉพาะ · เปลี่ยนเฉพาะการ normalize body-parser error (2 branch ด้านบน) — ถ้า reviewer ไม่เห็นด้วย ให้ revert เฉพาะ function `normalizeBodyParserError` + บรรทัดเรียก 1 บรรทัด (test sprint13 block "defect fix" 3 ตัวจะ fail → ลบ block นั้นตาม)

`database/01_schema.sql` · `02_seed_master.sql` · `config/*` · `validate/audit/index.js` · `docs/api/openapi.yaml` · `docs/agile/*` · `docs/ai-credit-log.md` · check-lists · `.playwright-mcp/` · `convert_svg.py` · `app/` (Flutter): **ไม่ได้แตะ**

## Contract decisions (สำคัญ — ใช้ต่อใน review)

1. **Endpoint contract = parity สองทาง** ระหว่าง Express route map กับ openapi paths (normalize `:param` ↔ `{param}`, trailing slash) — ตอนนี้ **59 = 59 · ต่าง 0** · test จะ fail ถ้ามีใครเพิ่ม/ลบ endpoint ฝั่งเดียว
2. **401 sweep ทุก endpoint** (ไม่ hardcode รายชื่อเหมือน sprint04) — รายการมาจาก route walk จริง → endpoint ใหม่ถูกคุมอัตโนมัติ
3. **Defect fix 2 ตัวใน errorHandler** (T-062 "แก้ Defect ที่เจอ"):
   - JSON พัง: เดิม message = อังกฤษ raw ของ body-parser (openapi 400 example = ไทย) → normalize เป็น `VALIDATION_ERROR` / `"ข้อมูลที่ส่งมาไม่ถูกต้อง"`
   - body >1mb: เดิม `INTERNAL_ERROR` + อังกฤษ → `PAYLOAD_TOO_LARGE` + ไทย · **คง status 413** (deviation — openapi ไม่มี 413 · เหตุผล + คำแนะนำเพิ่ม 413 อยู่ใน endpoint review §3)
4. **Race test = service logic ภายใต้ row-lock semantics** — fake `withTransaction` serialize ด้วย mutex เพื่อจำลอง `SELECT … FOR UPDATE` ของ Oracle · พิสูจน์แล้ว: ยกเลิกซ้ำ → 200+409/UPDATE เดียว · สแกนซ้ำ → checked_in+already_checked_in/trip_passenger เดียว · **ยังไม่พิสูจน์**: ตัว Oracle lock จริง (ไม่มี instance) — ดู endpoint review §5
5. **SQLi test ใช้ real repos + mocked `db.query`** — payload ต้องอยู่ใน binds เท่านั้น + ทุก LIKE มี ESCAPE + endpoint validate ผิดรูป → 400 ก่อนเรียก query (0 calls)
6. **T-057 ไม่วัดอะไรทั้งนั้น** — ให้ script + procedure ตารางผลเป็น "ยังไม่ได้วัด" ทุกช่อง (กันเอกสารอ้างผลไร้หลักฐาน) · เกณฑ์ <3 วิ@50,000 อ้างจาก chapter-18 DoD ไม่ได้ตั้งเอง
7. **Candidate index 2 ตัวมีเหตุผล access path ระบุ**: `schedule(service_date)` = ช่องว่างของ `ix_sched_route_date` (leading route_id) กระทบทุก query รายงาน + `findAvailable` · `token_blacklist(emp_id, expires_at)` = `DELETE_EXPIRED` ทุกครั้งที่ login (ปัจจุบันมีแค่ PK jti)

## Verification (รันจริงทั้งหมด)

1. **`npm.cmd test -- --runInBand tests/sprint13.test.js`** → `Tests: 10 passed, 10 total` · exit=0
2. **`npm.cmd test -- --runInBand`** (workdir `D:\data\shuttle-kaengkarn\backend`, bash call แยก):

```
Test Suites: 13 passed, 13 total
Tests:       364 passed, 364 total
exit=0
```

   (sprint12 = 354 → +10 sprint13 = **364** · ไม่มี test เดิมถูกแก้/ลบ)

3. **Inventory cross-check นอก test**: script แยก (`diff-openapi.js`) ยืนยัน 59=59 ก่อนเขียน test
4. **`git status --porcelain`**: ไฟล์ใหม่รอบนี้ = `backend/tests/sprint13.test.js` · `database/06_perf_indexes.sql` · `docs/test-plan/perf-procedure-t057.md` · `docs/test-plan/endpoint-review-t061-kaengkarn.md` · `docs/agent-handoffs/sprint13-kaengkarn.md` · แก้ = `backend/src/middleware/errorHandler.js` (ประกาศเปิดเผยไว้ข้างบน) — **ไม่ได้ commit** · dirty files อื่นไม่ถูกแตะเพิ่ม
5. **Flutter**: ไม่มีไฟล์ `app/` เปลี่ยน → ไม่ได้รัน flutter test/analyze

## T-057 — สรุปสถานะจริง

- ✅ script `06_perf_indexes.sql` เขียนครบ รันซ้ำได้ ไม่มี DML ทำลายข้อมูล
- ✅ procedure `perf-procedure-t057.md` ครบตั้งแต่ seed ยัน curl
- ⬜ **รันจริง = ยังไม่เคย** — ไม่มี Oracle ใน environment นี้ → ผล EXPLAIN/เวลาวัด = ว่างทุกช่อง
- ⬜ ตาราง §5 ต้องเติมจากรันจริงเท่านั้น · Scalability 100,000 rows (chapter-17) ยังไม่ได้ทดสอบ
- ⬜ เมื่อได้วัดจริง → ประชาสัมพันธ์ Stand-up/Retro (AR-06)

## ⛔ ข้อจำกัดที่ต้องพูดตรง ๆ (ห้ามอ้างเกิน)

- **local pass ≠ human review / live integration / ครบทุก requirement** — ไม่มี reviewer ตรวจรอบนี้ · ไม่ได้ commit/push · ไม่มี Tag v1.0.0
- **ไม่มี Oracle instance** — race tests จำลอง lock ด้วย mutex · SQLi/static = mocked query · T-060 Part B + T-057 measurement + view/seed ทั้งหมดยังไม่เคยรันจริง
- **ยังไม่ได้ verify ด้วย openapi validator จริง** (Redocly/swagger-cli)
- endpoint review = เทียบ **method+path** — ยังไม่ได้ diff schema/response ราย endpoint ทีละตัว (response shape ถูกคุมโดย test ราย endpoint ของ sprint ต่าง ๆ แทน)
- ไม่ได้แตะ `app/` · ไม่ได้แตะเอกสาร stream อื่น (T-061 ส่วนที่เหลือ list ไว้ใน endpoint review §6)

## Unresolved checks (ต้อง coordinator/reviewer ตัดสิน)

| # | เรื่อง | สถานะ |
|---|---|---|
| 1 | รายการ open ข้อ 1–9 ใน sprint12 handoff ทั้งหมด (CONTRACT-DRIFT-01 · Q-list · Q-REPORT-4 · Q10 · week-boundary · T-060 Part B · AR-02) | open/blocked เหมือนเดิม — รอบนี้ไม่ได้แตะ |
| 2 | **413 deviation** (endpoint review §3 ข้อ 1) — คง 413 หรือจะให้ map เป็น 400? + ควรเพิ่ม 413 ใน openapi ไหม | open (ใหม่) |
| 3 | **errorHandler defect fix** อยู่ใน preserve list — ยืนยันว่าให้คงไว้ (รายละเอียด + revert path อยู่ในหัวข้อ ไฟล์ที่แก้) | open (ใหม่ — ให้ reviewer ตัดสิน) |
| 4 | Candidate index 2 ตัว — รันบน Oracle จริงแล้ว cost อาจไม่ลด (ข้อมูลน้อย/plan เปลี่ยน) → อาจต้องเพิ่ม/ไม่เพิ่ม | blocked (ต้อง Oracle) |
| 5 | T-057 เกณฑ์ <3 วิ — ยังไม่มีผลวัด → DoD T-057 ยังไม่ปิด | blocked (ต้อง Oracle + 04 seed) |

**DoD ที่ยังถูกบล็อก**: ไม่มี live-Oracle · ไม่มี human review · openapi validator ไม่ได้รัน · T-057 ผลวัดว่าง · T-060 Part B ไม่ได้รัน · ไม่ได้ commit/push/tag

## Standing constraints (ถ้ามีรอบถัดไป)

- Windows absolute paths เท่านั้น · PowerShell 5 (ไม่มี `&&`) · tests = bash call แยก workdir `D:\data\shuttle-kaengkarn\backend` (`npm.cmd test -- --runInBand`) · ไม่ commit/push · ไม่อ่าน `.env` · preserve dirty files ตาม list ใน sprint12 handoff (ยกเว้น errorHandler ที่ plan อนุญาตเฉพาะหน้าที่แก้รอบนี้)
- Unresolved ทั้งหมด **ไม่ใช่ permission ให้ invent**
- API prefix `/api/v1` · contract = `docs/api/openapi.yaml` (ห้ามแก้) · Backend stream = API/SQL · Flutter stream = client/docs · ห้ามแก้ peer workspace
- local pass ≠ human review / live integration / ครบทุก requirement
