# Sprint 3 Handoff — เก่งกาญ (kaengkarn) · T-011 + T-012

> วันที่: 2026-10-07 · Branch ส่งมอบ: `feature/sprint3-kaengkarn-autonomous` · Model: opencode/mimo-v2.6-flash-free (free tier, no subagents)

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 3 DoD | สถานะ |
|---|---|---|
| **T-011** Backend setup + node-oracledb Pool | `GET /health` ตอบ OK + เชื่อม Oracle สำเร็จ | ✅ |
| **T-012** Middleware error/validate/logger/audit | ทุก route ผ่าน errorHandler | ✅ |

## ไฟล์ที่สร้าง/แก้ (ทั้งหมดอยู่ใน `backend/`)

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/src/config/env.js` | อ่าน `.env` (dotenv) → config รวม (PORT, DB pool ตาม .env.example) |
| `backend/src/config/db.js` | **node-oracledb pool** ตาม 17.5.3: `initPool/closePool/query/checkDbHealth` · `autoCommit=false` · poolMin/poolMax จาก env · connectString `host:port/SERVICE` (ไม่ใช่ SID) |
| `backend/src/middleware/logger.js` | request log (method, path, status, duration) + level จาก `LOG_LEVEL` |
| `backend/src/middleware/validate.js` | validate(req.body) — required/type/maxLength/minLength/enum → 400 `VALIDATION_ERROR` |
| `backend/src/middleware/errorHandler.js` | central errorHandler + notFoundHandler + `HttpError` · production ไม่ leak stack |
| `backend/src/middleware/audit.js` | audit sink สำหรับ POST/PUT/PATCH/DELETE (empId จะเติมจาก JWT Sprint 4 / T-042) |
| `backend/src/middleware/index.js` | export กลาง |
| `backend/src/app.js` | `createApp({ healthCheck, auditSink })` — factory แยกจาก server เพื่อให้ supertest ใช้ได้ · `GET /health` · **notFound → errorHandler ท้ายสุด** |
| `backend/src/server.js` | entry: `initPool()` → listen → graceful shutdown (SIGINT/SIGTERM) |
| `backend/tests/health.test.js` | `/health` 200 เมื่อ connected · **503 เมื่อ Oracle unavailable (แยกจาก test ผ่าน)** · 404 JSON |
| `backend/tests/db.test.js` | mock `oracledb`: ตรวจ createPool config, ไม่สร้าง pool ซ้ำ, query ใช้ getConnection+execute+close |
| `backend/tests/middleware.test.js` | validate/errorHandler/audit/notFound + DoD "ทุก route ผ่าน errorHandler" |

สร้าง `backend/.env` บนเครื่องนี้ (gitignored, ค่าลอกจาก root `.env` — ไม่ commit, ไม่แสดงค่า secret)

## Verification (ทั้งหมดรันจริง)

1. **`npm.cmd test` (jest 29 + supertest)** → `Test Suites: 3 passed · Tests: 22 passed / 22` ✅
2. **Integration กับ Oracle จริง** (`gvenzl/oracle-xe` localhost:1521):
   - `GET /health` → **HTTP 200** `{"status":"ok","database":"connected","latencyMs":7}` ✅
   - `GET /nope` → **HTTP 404** + log `WARN GET /nope 404` ✅
   - ข้อความ log: `Oracle pool ready (SHUTTLE_APP@localhost:1521/XEPDB1, min=2 max=10)`
3. ตอนที่ `DB_PASS` ผิด (credential mismatch) `/health` ตอบ **503 ไม่ใช่ 200** → แยก "Oracle unavailable" ออกจาก "test ผ่าน" ชัดเจน ✅
4. **เจอ Bug ระหว่างทำ**: password ใน `.env` มีอักขระ `#` → dotenv ตัด inline comment ทิ้ง (โหลดได้ 19/21 ตัวอักษร → ORA-01017) → แก้โดยใส่ `DB_PASS="..."` เครื่องหมายคำพูด ไม่ใช่แก้โค้ด

## Code review fix (รอบ 2 — AI code review, ไม่ใช่ human peer review / AR-02 ยังต้องทำโดยสุขสรร)

ข้อสังเกตจาก Codex review หลัง test ผ่าน — แก้ครบ 3 ข้อ:

| # | ปัญหา | ที่แก้ | Test ใหม่ |
|---|---|---|---|
| 1 | `db.query()` force `autoCommit:true` ทับค่า `false` ของโปรเจกต์ (17.5.3) กับ SQL ทั่วไป | `src/config/db.js` — คง `autoCommit:false` เป็นค่าเริ่มต้น, caller override เองได้, comment อธิบาย SELECT helper semantics + งานแก้ข้อมูลต้องใช้ withTransaction | `query คง non-autocommit`, `override autoCommit ได้`, **`execute ล้มเหลว → close() ถูกเรียก (regression)`** |
| 2 | `/health` leak ข้อความ exception จริง (เช่น ORA-…) และคืน **200 เมื่อ `connected:false`** | `src/app.js` — ทั้ง `connected:false` และ exception → **503 sanitized** `message: "Database unavailable"`; raw error เขียนลง server log แทน | `503 ไม่ leak ORA-/NJS-`, **`connected:false → 503`** |
| 3 | audit sink คืน Promise แล้ว reject → unhandledRejection (try/catch จับไม่ได้) | `src/middleware/audit.js` — ตรวจ `result.then` แล้ว `.catch()` log แทน | **`async sink reject → ไม่มี unhandledRejection`** |

ผล: **22/22 tests pass** (เดิม 18) · re-run `/health` กับ Oracle จริงยัง 200 `connected` ✅

## Blocker / สิ่งที่ต้องรู้

- **Stray files จาก attempt ก่อนหน้า** (เขียนผิด path `/d/...` → ลง `D:\d\`) — **ไม่ได้แตะ/ไม่ได้ลบ** ตามคำสั่ง:
  `D:\d\data\shuttle-kaengkarn\backend\{index.js, middleware.js, test-health.js, package.json}`
  → layout จริงที่ repo ไม่มีไฟล์เหล่านี้ (ไม่มี `backend/index.js`)
- **ยังไม่ได้ commit/push** — working tree มี dirty files เดิมของ sprint อยู่ (ด้านล่าง) ห้าม push ปน
- **Node v24.21.0** ตาม environment (spec บอก v20) — รันผ่าน ไม่ blocker แต่ instructor อาจถาม
- ยังไม่มี RBAC/auth middleware (Sprint 4/T-015/T-022) · audit ยังไม่ลงตาราง (T-042)

## git status (สิ่งที่เปลี่ยนรอบนี้)

```
M  (ใหม่ทั้งหมด) backend/src/config/env.js
M  (ใหม่ทั้งหมด) backend/src/config/db.js
M  (ใหม่ทั้งหมด) backend/src/middleware/{logger,validate,errorHandler,audit,index}.js
M  (ใหม่ทั้งหมด) backend/src/app.js, backend/src/server.js
M  (ใหม่ทั้งหมด) backend/tests/{health,db,middleware}.test.js
M  (ใหม่ทั้งหมด) docs/agent-handoffs/sprint3-kaengkarn.md
```

ไฟล์ dirty เดิมที่ **ไม่ได้แตะ** (ต้อง preserve, ห้าม push ปน):
`.gitignore` · `database/02_seed_master.sql` · `docs/agile/sprints/sprint-02-plan.md` ·
`docs/agile/standup/2026-09-30.md` · `docs/agile/sukhsorn-check-list.md` ·
`docs/ai-credit-log.md` · `docs/kaengkarn-check-list.md` ·
untracked: `.playwright-mcp/`, `agent-bridge.example.json`, `convert_svg.py`,
`docs/agent-automation.md`, `docs/agile/q-items-for-instructor.md`, `scripts/`

## งานต่อไป (Sprint 3 ยังเหลือ)

- **T-013** Flutter setup + Adaptive Shell (สุขสรร) · **T-010** DFD/Sequence (สุขสรร)
- AR-02: Code Review โดยสุขสรร ก่อนถือว่า DoD ปิดจริง
- ถ้าจะปิดงาน: commit เฉพาะไฟล์ backend/ + handoff เท่านั้น (ไม่รวม dirty เดิม)
