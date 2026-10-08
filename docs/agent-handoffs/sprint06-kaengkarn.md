# Sprint 6 Handoff — เก่งกาญ (kaengkarn) · T-024 / T-025 / T-026 / T-027

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 6 DoD | สถานะ |
|---|---|---|
| **T-024** Stop CRUD API (`/stops`) | GET (q/is_active) · POST 409 `uq_stop_name` · PUT 404/409 · DELETE 404/422 เมื่อยังถูกใช้ใน `route_stop` (BR-03) | ✅ (local tests) |
| **T-025** Route API (`/routes`) | GET (มี `stop_count` จาก subquery) · POST — **เฉพาะที่ 17.5.2/openapi ประกาศ** | ✅ (local tests) |
| **T-026** Route_Stop API (`GET/PUT /routes/{id}/stops`) | GET เรียง `stop_seq` + join `stop_name` · PUT **รายการเต็ม**: validate ลำดับ 1..n / จุดซ้ำ / นาที ≥ 0 / FK มีจริง แล้ว DELETE เดิม + INSERT ใหม่ + UPDATE `total_minutes` **ใน transaction เดียว** (ล้ม → rollback ทั้งชุด) | ✅ (local tests) |
| **T-027** Auto-calc `total_minutes` (BR-01) | PUT stops คำนวณใหม่ทุกครั้งใน tx · `POST /routes/{id}/recalculate` = 1 statement `SUM(travel_minutes)` · ผู้ใช้พิมพ์ `total_minutes` เองไม่ได้ | ✅ (local tests) |
| ไม่สร้าง: `PUT/DELETE /routes/{id}` | 17.5.2 / openapi ไม่ประกาศ (มี test ยืนยันตอบ 404) | ⛔ ตามสเปก (ดู Blocked) |

## ไฟล์ที่สร้าง/แก้ (ทั้งหมดอยู่ใน `backend/`)

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `src/repositories/stop.repository.js` | `stop` list/count/find/insert/update/remove + `findByName` (409) + `countRoutesUsingStop` (ตรวจก่อนลบ → 422) + `findExistingIds` (IN bind p0,p1 ตรวจ FK ก่อนเข้า tx) |
| `src/repositories/route.repository.js` | `route` list (stop_count subquery)/count/find/insert (**ไม่ใส่ `total_minutes` ใน column list — BR-01**) · `listStops` (JOIN `stop`, `ORDER BY stop_seq`) · `deleteAllStops`/`insertStop`/`updateTotalMinutes` (ขา tx) · `recalculateTotal` (`SUM` correlated + `RETURNING`, `autoCommit:true`) |
| `src/services/front.service.js` | UC-11/UC-12 logic · `normalizeStops` (400/409 ก่อนแตะ DB) · saveRouteStops tx · BR-01 recalc |
| `src/routes/front.routes.js` | 9 operations (เท่า 17.5.2) + `validate` + `ROUTE.VIEW`/`ROUTE.EDIT` |
| `tests/sprint06.test.js` | **38 tests / 8 suites** (รายละเอียดด้านล่าง) |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `src/app.js` | mount `/stops`, `/routes` หลัง `authenticate` |
| `src/repositories/index.js` | export `stop`, `route` |
| `src/services/index.js` | เพิ่ม `front: createFrontService(...)` |
| `src/utils/mappers.js` | เพิ่ม `toStop`, `toRoute`, `toRouteStop` |

`database/*`, `middleware/*`, script/config: **ไม่ได้แตะ**

## Verification (รันจริงทั้งหมด)

1. **Smoke โหลดแอปจริง**: `node -e "require('./src/app')"` → `app loaded OK`

2. **`npx.cmd jest --runInBand tests/sprint06.test.js`** (ใน `backend/`):

```
Test Suites: 1 passed, 1 total
Tests:       38 passed, 38 total
Time:        2.371 s
```

3. **`npm.cmd test -- --runInBand`** (คำสั่งเดียวกับ pipeline):

```
PASS tests/sprint04.test.js
PASS tests/sprint06.test.js
PASS tests/sprint05.test.js
PASS tests/middleware.test.js
PASS tests/health.test.js
PASS tests/db.test.js

Test Suites: 6 passed, 6 total
Tests:       150 passed, 150 total
Snapshots:   0 total
Time:        5.736 s
Ran all test suites.
```

   → เดิม 112 tests (sprint04/05/health/middleware/db) **ไม่แก้ไฟล์ test เดิมเลย** + sprint06 ใหม่ 38 = **150/150**

4. **นับ endpoint เท่าต้นทาง (P-04 ข้อ 9)**: 17.5.2 = `GET/POST/PUT/DELETE /stops` (4) + `GET/POST /routes` (2) + `GET/PUT /routes/:id/stops` (2) + `POST /routes/:id/recalculate` (1) = **9 operations = 9 route registrations** (test `wiring` อ่าน source จริงนับ `router.get/post/put/delete(` = 9 และนับ `viewGuard/editGuard` = 3+6 ทุกอันมี guard)

### สิ่งที่ test คุม (8 suites / 38 tests)

| Suite | ครอบคลุม |
|---|---|
| T-024 GET/POST `/stops` | รูป Stop ครบ (lat/lng/address nullable, จุดที่ปิดใช้ยังอยู่ใน list) + meta · กรอง `q`/`is_active`/ค่าผิดถูกละลอง/clamp · POST 201 **insert รันบน conn ของ withTransaction + commit จริง** · 409 `uq_stop_name` ไม่ insert · 400 details (`stop_name` required, `latitude` ชนิด, `is_active` enum) |
| T-024 PUT/DELETE `/stops/{id}` | PUT 200 เปลี่ยนจริง + commit · **PUT ไม่ส่ง `is_active` → คงค่าเดิม** · 404/409 (ชื่อชนจุดอื่น) + ชื่อเดิมของตัวเองไม่ซ้ำ · DELETE 200 ลบจริง · **DELETE 422** `HAS_DEPENDENT_DATA` เมื่อยังถูกใช้ (ของเดิมไม่ถูกแตะ) · 404 |
| T-025 GET/POST `/routes` | รูป Route (`total_minutes` ค่าเก่า 99 + `stop_count` นับจาก `route_stop` จริง) + meta · กรอง/clamp · **POST ส่ง `total_minutes:999` มาถูกเมิน → ได้ 0/0 (BR-01)** · 400 `route_name` · **ชื่อซ้ำสร้างได้ 201** (schema ไม่มี uq — สเปกไม่ประกาศ 409) |
| T-026 GET `/routes/{id}/stops` | เรียง `stop_seq` + `stop_name` join + `total_minutes` จากแถว route · 404 |
| T-026 PUT `/routes/{id}/stops` | 200: message `เวลารวมทั้งเส้นทาง: 10 นาที` + **DELETE→INSERT×3→UPDATE บน conn เดียว เรียงลำดับ_calls ถูก + commit ครั้งเดียว + total 99→10 (BR-01)** · เปลี่ยนลำดับ/สลับจุด/เปลี่ยนนาที → รายการใหม่ทั้งหมด + total 12 · 400 `stop_seq` ไม่ต่อเนื่อง/ซ้ำ (ข้อความไทยตรงสเปก) · 400 นาทีติดลบ/stop_id ≤ 0/ว่าง/ผิดชนิด · **409 `DUPLICATED_STOP` (BR-03)** · 404 route · 422 stop อ้างไม่มีจริง — ทั้งหมด **ไม่เข้า transaction** · INSERT ล้ม → **rollback + 500 sanitized ไม่ leak + total เดิมไม่ถูกอัปเดตครึ่งกลาง** |
| T-027 POST `/routes/{id}/recalculate` | 200: 99 → **9 = SUM จริง** + `stop_count` 3 + **`withTransaction` ไม่ถูกเรียก** (1 statement ตามสเปก) · เส้นทางว่าง → 0/0 (NVL) · 404 |
| Guards (9 endpoints) | ไม่มี token → 401 ทั้ง 9 · `ROUTE.VIEW` อย่างเดียว → อ่าน 3 × 200 / เขียน 6 × 403 · ไม่มีสิทธิ์ ROUTE → 403 · **ถอดสิทธิ์ระหว่าง session → 403 ทันที** (โหลดจาก DB ทุก request) · wiring source: 9 ops + guard ครบ + `PUT/DELETE /routes/{id}` ตอบ 404 จริง |
| repository SQL static | bind ทุก statement · ไม่มี `SELECT *` · LIKE มี `ESCAPE` · injection payload อยู่ใน bind · `IN (:p0,:p1)` build binds · **`route.insert` ไม่มี `total_minutes` ใน SQL** · `route.list` นับ `stop_count` จาก subquery · `listStops` `ORDER BY stop_seq` + JOIN · `recalculateTotal` = correlated `SUM` + `NVL` + `RETURNING` + `{autoCommit:true}` |

## Contract decisions ที่ reviewer ต้องรู้

| # | เรื่อง | ที่เลือก | เหตุผล/ที่มา |
|---|---|---|---|
| 1 | สิทธิ์คุม 9 endpoints | GET ×3 → **`ROUTE.VIEW`** · writes ×6 → **`ROUTE.EDIT`** ('จัดการเส้นทาง/จุดจอด' ตาม seed — ชื่อครอบคลุมจุดจอดอยู่แล้ว) | UC-12 เขียน `ROUTE.EDIT` ✓ แต่ **UC-11 เขียน `STOP.EDIT` ซึ่งไม่มีใน seed** (`database/02_seed_master.sql`) — บังคับ STOP.EDIT = เพิ่ม/แก้/ลบจุดจอดไม่ได้เลย → ใช้ `ROUTE.EDIT` ชั่วคราว · **บันทึกเป็น unresolved check** (รูปแบบเดียวกับ PERMISSION.EDIT ใน Sprint 5) |
| 2 | ไม่สร้าง endpoint ที่สเปกไม่ประกาศ | **ไม่มี `PUT/DELETE /routes/{id}`** — 17.5.2 (บรรทัด 663–670) และ openapi มีแค่ `GET/POST /routes` + `/routes/{id}/stops` + `/routes/{id}/recalculate` | P-04 ข้อ 9 (นับ operation เท่าต้นทาง) · ชื่อ task T-025 เขียน "CRUD" แต่สเปกประกาศแค่ 2 ops → ไม่เดา · มี test ยืนยัน 404 |
| 3 | ไม่มี 409 ตอนสร้างเส้นทางชื่อซ้ำ | อนุญาต (schema ไม่มี `uq_route_name`) | ตรวจจาก `01_schema.sql` + openapi `POST /routes` ไม่ประกาศ 409 — test ล็อกพฤติกรรมนี้ไว้ |
| 4 | ลำดับตรวจของ `PUT /routes/{id}/stops` | รูปค่า (400 details `stops`) → `stop_seq` 1..n ต่อเนื่องไม่ซ้ำ (400 ข้อความไทยตามสเปก) → `stop_id` ซ้ำใน payload (409 `DUPLICATED_STOP`) → route 404 → stop อ้างไม่มีจริง (422 `FK_VIOLATION`) → **tx: DELETE เดิม + INSERT ทุกแถว + UPDATE total** | openapi 400/409/422 descriptions + `RouteStopListRequest` ("ลบเดิมทั้งหมดแล้ว INSERT ใหม่ใน Transaction เดียว") |
| 5 | `travel_minutes` | **≥ 0** (0 ใช้กับจุดแรกได้) · `stop_seq` ≥ 1 | `ck_rs_min CHECK (travel_minutes >= 0)` + openapi `minimum: 0` + ตัวอย่างจุดแรก = 0 — "positive travel times" ในโจทย์แปลตาม schema เป็น non-negative |
| 6 | `POST /routes/{id}/recalculate` | 1 statement + **`autoCommit: true`** · ไม่เปิด `withTransaction` | openapi: "1 statement จึงไม่ต้องเปิด Transaction แยก" —  project default คือ `autoCommit:false` (config/db.js) ถ้าไม่ระบุ UPDATE จะถูก rollback ตอน `conn.close()` → ต้องระบุชัดเจน (มี test ตรวจ opts) |
| 7 | PUT `/stops/{id}` ไม่ส่ง `is_active` | **คงค่าเดิม** (POST default 1 ตาม schema) | convention เดียวกับ PUT `/roles` ใน Sprint 5 — กันเปิดใช้/ปิดใช้เงียบ ๆ ตอนแก้ชื่อ |
| 8 | ข้อความ (ทดสอบแล้วตรง) | `เพิ่มจุดจอดสำเร็จ ใช้งานได้ทุกเส้นทาง` · `แก้ไขจุดจอดสำเร็จ` · `ลบจุดจอดสำเร็จ` · `เพิ่มเส้นทางสำเร็จ กรุณาเรียงจุดจอดต่อไป` · `เวลารวมทั้งเส้นทาง: {n} นาที` · `คำนวณเวลารวมใหม่แล้ว` · 409 `ชื่อจุดจอดนี้มีอยู่แล้ว` · 422 `ยังมีเส้นทางที่ใช้จุดจอดนี้อยู่ กรุณาปิดใช้งานแทน` · 400 `ลำดับจุดจอดต้องเรียง 1 ถึง n โดยไม่ซ้ำและไม่ข้าม` · 409 `จุดจอดนี้อยู่ในเส้นทางนี้แล้ว ห้ามเพิ่มซ้ำ` · 422 `ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบจุดจอดที่ระบุ)` · 404 `ไม่พบข้อมูลที่ต้องการ` · 403 `ไม่มีสิทธิ์เข้าถึงส่วนนี้` | ตัวอย่าง openapi + แนวเดิม sprint04/05 |
| 9 | GET list | clamp `page≥1, limit 1..100` · filter ผิดถูกละเลยไม่ 400 · เรียง stops = `stop_id`, routes = `route_id`, route_stops = `stop_seq` | แนวเดิม sprint04/05 + openapi ไม่ declare 400 สำหรับ GET |
| 10 | BR-01 จุดที่บังคับ | (ก) `route.insert` ไม่รับ `total_minutes` จาก body (ค่าที่ส่งมาถูกเมิน) (ข) PUT stops UPDATE ใน tx เดียวกัน (ค) recalculate = `SUM` correlated | ตาม `usecase-spec` UC-12 + openapi `readOnly` + 17.4.5 BR-01 |

## ⚠️ สิ่งที่ reviewer/คนถัดไปต้องทำ (นอกเหนือจาก code)

1. **ตั้ง `JWT_SECRET` ใน `backend/.env`** (ตาม `backend/.env.example`) — worker ห้ามแตะไฟล์ credential
2. **Seed password เป็น placeholder** → login กับ DB จริงได้ 401 จนกว่าจะ seed bcrypt hash ใหม่
3. **ยังไม่ได้ integration test กับ Oracle จริง** — รอบนี้ test ใช้ fake repos + transaction runner/SQL โค้ดจริง (assert ผ่าน spy) · ต้องรัน schema+seed แล้วยิง API จริง โดยเฉพาะ correlated `SUM` + `RETURNING INTO` + `OFFSET/FETCH` + `LIKE ESCAPE`
4. **AR-02 Human code review ยังไม่ได้ทำ** — local tests ผ่าน **ไม่เท่ากับ** human review ผ่าน / integration จริงผ่าน / ครบทุก requirement แล้ว

## Unresolved checks / Blocked acceptance criteria

| ข้อ | เกี่ยวกับ Sprint 6 อย่างไร | สถานะ |
|---|---|---|
| **UC-11 precondition `STOP.EDIT`** | `usecase-spec.md` ระบุ `STOP.EDIT` แต่ seed ไม่มีแถวนี้ → stop writes ถูกคุมด้วย `ROUTE.EDIT` ชั่วคราว (contract decision #1) | ⏳ ต้องอาจารย์ยืนยัน: เพิ่มแถว permission หรือยอม `ROUTE.EDIT` คุมทั้ง UC-11/UC-12 |
| **T-025 "CRUD" แต่สเปกมีแค่ GET/POST** | ไม่มี `PUT/DELETE /routes/{id}` → แก้ชื่อ/ปิดใช้/ลบเส้นทางทาง API ไม่ได้ | ⛔ ต้องอาจารย์ยืนยันว่าต้องการ endpoint เพิ่มหรือไม่ (ไม่เดาตาม P-04) |
| **Q-B** (เส้นทาง 3 = 12 หรือ 15 นาที) · **Q20** (เส้นทาง 1 จุดซ้ำ) | กระทบ **ข้อมูล seed** (`03_seed_front.sql`) ไม่กระทบ API — BR-01 ใน test ใช้ข้อมูลสังเคราะห์เอง (เส้นทาง 2 เก่า 99 → แก้เป็น 9/10/12) | ⏳ ค้างอาจารย์ (เดิม) |
| **Q14** (Oracle 19c vs 21c) | Integration จริงของ batch นี้ยังไม่รัน + target version ยังไม่ระบุ | ⏳ ค้างอาจารย์ (เดิม) |
| Q-A / Q-F / Q22 / Q23 / Q24 | ไม่กระทบ Sprint 6 — ไม่ได้แตะ · **ไม่ได้ถามคำถามซ้ำ** ที่ค้างอยู่แล้ว | ⛔ ตามเดิม |

## git status (สิ่งที่เปลี่ยนรอบนี้)

```
M  backend/src/app.js               (เพิ่ม mount /stops, /routes)
M  backend/src/repositories/index.js (+stop, +route)
M  backend/src/services/index.js     (+front)
M  backend/src/utils/mappers.js      (+toStop, +toRoute, +toRouteStop)
?? backend/src/repositories/{stop,route}.repository.js
?? backend/src/services/front.service.js
?? backend/src/routes/front.routes.js
?? backend/tests/sprint06.test.js
?? docs/agent-handoffs/sprint06-kaengkarn.md  (ไฟล์นี้)
```

ไฟล์ dirty เดิมที่ **ไม่ได้แตะ** (preserve, ห้าม push ปน):
`database/02_seed_master.sql` · `docs/agile/sprints/sprint-02-plan.md` · `docs/agile/standup/2026-09-30.md` · `docs/agile/sukhsorn-check-list.md` · `docs/ai-credit-log.md` · `docs/kaengkarn-check-list.md` · `docs/agile/q-items-for-instructor.md` · `scripts/autopilot.mjs` · `.playwright-mcp/` · `convert_svg.py`

## งานต่อไป

- **ยังไม่ commit/push** — เป็นหน้าที่ coordinator (ถ้าจะ commit: เฉพาะไฟล์ sprint 6 + handoff เท่านั้น)
- Integration test กับ Oracle จริง (ข้อ 1–3 ด้านบน)
- AR-02: Code Review โดยสุขสรร ก่อนถือว่า DoD ปิดจริง
- Sprint 6 ยังมี T-028 (Flutter ฝั่งสุขสรร) — coordinator dispatch ต่อ

---
*จัดทำโดย: เก่งกาญ `[ai-assisted]` · คำสั่ง verification ทั้งหมดรันจริงบน Windows/Node v24.21.0*
