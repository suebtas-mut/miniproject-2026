# Sprint 4 Handoff — เก่งกาญ (kaengkarn) · T-015 + T-016

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 4 DoD | สถานะ |
|---|---|---|
| **T-015** JWT login/logout/me/change-password + token blacklist | Auth ครบ UC-01/02/03 · RBAC `requirePermission` จากสิทธิ์จริงใน DB · disabled account ถูกปฏิเสธ · rate limit ตาม A2 | ✅ (local tests) |
| **T-016** Employee / Department / Position CRUD (`/api/v1`) | ตรง `docs/api/openapi.yaml` · validation · ไม่ leak password/hash · transaction rollback · duplicate/dependency/FK checks | ✅ (local tests) |

## ไฟล์ที่สร้าง/แก้ (ทั้งหมดอยู่ใน `backend/`)

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `src/config/env.js` | เพิ่ม `env.jwt {secret, expiresIn, issuer}` + `parseDurationSeconds()` → `expiresInSeconds` (ค่าเริ่ม `2h`/7200s) · **ไม่ hardcode secret (P-12)** |
| `src/config/db.js` | เพิ่ม `createTransactionRunner(getPoolFn)` (commit/rollback/close) + export `withTransaction` |
| `src/middleware/errorHandler.js` | `HttpError` · `errorBody()` — ตอบ **ทั้ง envelope ตาม OpenAPI** `{success:false,error:{code,message,details}}` **และ legacy** `{status:'error',code,message,errors?}` · 500 คงที่ `INTERNAL_ERROR` / `'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง'` **ไม่ leak `err.code`/stack (ORA guard)** |
| `src/middleware/validate.js` | เพิ่ม `pattern`/`patternMessage` + `details` (`[{field,message}]`) คง legacy `errors` |
| `src/middleware/index.js` | export `authenticate`/`requirePermission`/`loginRateLimiter`/`resetLoginAttempts`/`errorBody` |
| `src/app.js` | `createApp({healthCheck, auditSink, db, repos})` — DI ให้ test inject fake · mount `/api/v1` → `/auth` (+`loginRateLimiter`+validate) → global `authenticate` → `/departments` `/positions` `/employees` (`requirePermission`) |

### ไฟล์ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `src/utils/token.js` | `signToken/verifyToken` (iss ตรวจเสมอ) · `newJti` · `markerJti(empId)` สำหรับ revoke-all (UC-03) · `getJwtSecret()` โยน error ชัดเจนถ้า `JWT_SECRET` ไม่ถูกตั้ง |
| `src/utils/pagination.js` | clamp `page≥1`, `limit 1..100` · `total_pages = Math.ceil(total/limit)` (0 เมื่อ total=0) |
| `src/utils/oracle.js` | `translateOracleError` → ORA-00001→409, ORA-02291/02292→422 |
| `src/utils/mappers.js` | `toEmployeeProfile/toDepartment/toPosition/toMenuItem` · **ไม่มี password/hash ใน response** · `MenuItem = {screen_key,label,sort_no,icon:null}` |
| `src/middleware/auth.js` | `createAuthMiddleware({repos})` → `authenticate` (Bearer parse → verify → blacklist ทั้ง jti ตรงและ marker → หาพนักงาน → disabled → 403) + `requirePermission(permCode)` (โหลดสิทธิ์ต่อ request จาก DB ไม่ hardcode บทบาท) · rate limiter: **5 ครั้ง/`ip|username`/15 นาที → 429** reset เมื่อ login สำเร็จ |
| `src/repositories/{auth,employee,department,position,index}.repository.js` | SQL ทั้งหมด — bind เสมอ, ไม่มี `SELECT *`, ไม่ต่อค่าจาก user เข้า SQL, LIKE มี `ESCAPE`, UPDATE สร้างจาก whitelist เท่านั้น, LISTAGG roles, `RETURNING id` |
| `src/services/auth.service.js` | `login/logout/me/changePassword` · bcrypt rounds 10 · `safeCompare` กัน hash placeholder ของ seed ทำให้ 500 (คืน 401) · เปลี่ยนรหัสผ่านใน tx เดียว: `UPDATE password_hash` + `MERGE jti` + `MERGE marker` + `DELETE expired` |
| `src/services/master.service.js` | CRUD 3 ชุด + filter + duplicate/dependency/booking checks + transaction + map เป็น response shape ทุกจุด |
| `src/routes/auth.routes.js` | `POST /login` (rate limit+validate) · `POST /logout` · `GET /me` · `POST /change-password` |
| `src/routes/master.routes.js` | 3 routers + `requirePermission('EMP.VIEW'/'EMP.EDIT'/'DEPT.EDIT'/'POS.EDIT')` + `EMAIL_RULE` |
| `tests/sprint04.test.js` | **58 tests / 9 suites** (รายละเอียดด้านล่าง) — ไฟล์ tests เดิม 3 ไฟล์ **ไม่ได้แตะ** |

## Verification (รันจริงทั้งหมด)

1. **`npm.cmd test -- --runInBand`** (ใน `backend/` — คำสั่งเดียวกับที่ใช้ใน pipeline):

```
PASS tests/sprint04.test.js
PASS tests/middleware.test.js
PASS tests/health.test.js
PASS tests/db.test.js

Test Suites: 4 passed, 4 total
Tests:       80 passed, 80 total
Snapshots:   0 total
Time:        4.629 s
Ran all test suites.
```

   → เดิม 22 tests (health/middleware/db) **ผ่านโดยไม่แก้ไฟล์ test เดิมเลย** + sprint04 ใหม่ 58 = **80/80**

2. **`npx.cmd jest --runInBand tests/sprint04.test.js`** → `Tests: 58 passed, 58 total`
3. **Smoke โหลดแอปจริง**: `node -e "require('./src/app')"` → `app loaded OK`
4. Test env ตั้ง `JWT_SECRET/JWT_EXPIRES_IN/JWT_ISSUER` เองก่อนโหลด module — **ไม่ได้อ่าน `backend/.env`** (ห้ามแตะไฟล์ credential)

### สิ่งที่ test คุม (9 suites)

| Suite | ครอบคลุม |
|---|---|
| POST /auth/login (UC-01) | 200 รูปตาม schema + ไม่มี password/hash ใน response · 401 ข้อความ**เดียวกัน**ทั้ง user ผิด/รหัสผ่านผิด · disabled → 401 `ACCOUNT_DISABLED` · seed hash เสีย → 401 ไม่ใช่ 500 · password < 8 → 400 `details` · rate limit 429 → reset ได้ · ไม่มีสิทธิ์ (A3) → `permissions:[]` |
| /me /logout blacklist (UC-02) | token ใช้ได้/ออกแล้วใช้ไม่ได้ · isolate ต่อ jti · expired/tampered/garbage/ghost → 401 · disabled หลังออก → 403 · audit ได้ empId จริง |
| auth + permission enforcement (R-03) | 7 endpoints ไม่มี token → 401 · viewer ไม่มีสิทธิ์ → 403 · สิทธิ์โหลดจาก DB ต่อ request · 404 envelope ถูก |
| POST /change-password (UC-03) | mismatch/สั้นเกิน → 400 `details` · รหัสเดิมผิด → 401 · สำเร็จ → bcrypt ใหม่ + blacklist jti เดิม **และ marker revoke-all** + `deleteExpiredBlacklist` ใน tx เดียว + commit · token เก่า/garbage หลังเปลี่ยน → 401 · **tx throw → rollback ไม่ commit, 500 sanitized** |
| departments (UC-05) | list filter/paginate clamp (page=0,limit=9999 → 100/0) · POST ซ้ำ → 409 · PUT 404/409/200 · DELETE มีคน → 422 · ไม่พบ → 404 |
| positions (UC-06) | เช่นเดียวกัน + `total_pages` เมื่อ total=0 |
| employees (UC-04) | list + filter + roles · POST 201 (hash อยู่ใน bind เท่านั้น) · 422 FK/booking · duplicate emp_code/username → 409 · PUT ** whitelist — field แปลกถูกเมิน** · DELETE มี booking → 422 ไม่ลบ |
| createTransactionRunner (โค้ดจริง) | commit+close · throw → rollback ไม่ commit · pool ไม่พร้อม → error ชัดเจนไม่แตะ conn |
| repository SQL | bind ทุก statement · ไม่มี `SELECT *`/ไม่ hardcode ชื่อบทบาทใน SQL · MERGE+autoCommit / conn.execute เมื่ออยู่ใน tx · ESCAPE · whitelist UPDATE กัน injection payload |

## Contract decisions ที่ reviewer ต้องรู้

| # | เรื่อง | ที่เลือก | เหตุผล/ที่มา |
|---|---|---|---|
| 1 | Layout | `src/routes/` + Router→Service→Repository | ตาม `docs/requirement-review-checklist.md` (บรรทัด 256–262) — **เบี่ยงจาก `src/modules/`** และ **เบี่ยงจาก P-04 ที่กำหนด Router+**Controller**+Service+Repository** — handler ใน router ทำหน้าที่ controller (documented deviation ตามสัญญา) |
| 2 | Permission codes | `EMP.VIEW/EMP.EDIT/DEPT.EDIT/POS.EDIT` (จาก `database/02_seed_master.sql`) | ตัวอย่างใน OpenAPI (`EMPLOYEE.VIEW` ฯลฯ) เป็น illustrative — **seed คือ authoritative** · ไม่มี hardcoded บทบาทในโค้ด |
| 3 | JWT payload | `{empId, jti, iss}` · `expires_in: 7200` · iss ตรวจทุกครั้ง | jti ใช้ revoke · marker `REVOKE_ALL:<empId>` สำหรับ UC-03 (reject เมื่อ `iat < floor(revoked_at)`) |
| 4 | Error envelope | **ตอบ 2 ชั้น** — OpenAPI `{success:false,error:{...}}` + legacy `{status:'error',...}` | คง test เดิม (middleware/health) ผ่านโดยไม่แก้ test เดิม |
| 5 | 500 | คงที่ `INTERNAL_ERROR` + ข้อความกลางภาษาไทยเสมอ | กัน leak `err.code`/stack (ORA-…) |
| 6 | GET validation | clamp นิ่ง ๆ ไม่ตอบ 400 (invalid filter ถูกเมิน) | OpenAPI GET ไม่ declare 400 |
| 7 | POST /employees | `dept_id`/`position_id` **ไม่ใส่ `required` ใน schema** | ให้ service ตอบตามตัวอย่าง OpenAPI 422 `ข้อมูลอ้างอิงไม่ถูกต้อง...` + `details` |
| 8 | ข้อความ error/status | ตาราง matrix ด้านล่าง | ตรง usecase A1/A2/A3 + OpenAPI examples |

### Status/message matrix (ทดสอบแล้ว)

| เหตุการณ์ | HTTP | code | message |
|---|---|---|---|
| user ไม่มี / รหัสผ่านผิด (ตอบเหมือนกันเป๊ะ) | 401 | `INVALID_CREDENTIALS` | `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง` |
| login แล้วบัญชีถูกปิด (A1) | 401 | `ACCOUNT_DISABLED` | `บัญชีถูกปิดใช้งาน` |
| token ถูกต้องแต่บัญชีถูกปิด | 403 | `FORBIDDEN` | `บัญชีถูกปิดใช้งาน` |
| ไม่มี/invalid/expired/tampered token | 401 | `UNAUTHORIZED` | `กรุณาเข้าสู่ระบบใหม่` |
| token ติด blacklist | 401 | `TOKEN_REVOKED` | `กรุณาเข้าสู่ระบบใหม่` |
| ไม่มีสิทธิ์ | 403 | `FORBIDDEN` | `ไม่มีสิทธิ์เข้าถึงส่วนนี้` |
| ไม่พบข้อมูล | 404 | `NOT_FOUND` | `ไม่พบข้อมูลที่ต้องการ` |
| rate limit (A2) | 429 | `RATE_LIMITED` | `พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่` |
| รหัสเดิมผิด (change-password) | 401 | `INVALID_CREDENTIALS` | `รหัสผ่านเดิมไม่ถูกต้อง` |
| เปลี่ยนรหัสสำเร็จ | 200 | — | `เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่` |
| duplicate | 409 | `DUPLICATE` | `ชื่อแผนกนี้มีอยู่แล้ว` / `ชื่อตำแหน่งนี้มีอยู่แล้ว` / `ชื่อผู้ใช้หรือรหัสพนักงานนี้ถูกใช้แล้ว` |
| ยังมีคนสังกัด | 422 | `HAS_DEPENDENT_DATA` | `ยังมีพนักงานสังกัดใน... กรุณาย้ายพนักงานออกก่อน` |
| มี booking ผูก | 422 | `HAS_DEPENDENT_DATA` | `พนักงานคนนี้มีข้อมูลการจองผูกอยู่ กรุณาใช้การปิดใช้งานแทนการลบ` |
| FK อ้างไม่พบ | 422 | `FK_VIOLATION` | `ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบแผนก/ตำแหน่งที่ระบุ)` |

## ⚠️ สิ่งที่ reviewer/คนถัดไปต้องทำ (นอกเหนือจาก code)

1. **ตั้ง `JWT_SECRET` ใน `backend/.env`** (ตาม `backend/.env.example` — คืนค่า command สุ่มในไฟล์นั้น) — worker **ห้ามอ่าน/แก้ไฟล์ credential** จึงตั้งให้ไม่ได้ · ถ้าไม่ตั้ง `getJwtSecret()` จะโยน `JWT_SECRET is not configured` ตอนใช้
2. **Seed password เป็น placeholder hash ที่ไม่ใช่ bcrypt จริง** → login กับ DB จริงจะได้ 401 เสมอจนกว่าจะ seed hash ใหม่ (เช่น `bcrypt.hashSync('...', 10)`)
3. **ยังไม่ได้ integration test กับ Oracle จริง** — รอบนี้ test ทั้งหมดใช้ fake repos + transaction runner โค้ดจริง (SQL static-assert แยก) · ต้องรัน `01_schema + 02_seed + 03_seed` แล้วยิง API จริงอีกรอบ
4. **AR-02 Human code review ยังไม่ได้ทำ** — local tests ผ่าน **ไม่เท่ากับ** human review ผ่าน / integration จริงผ่าน / ครบทุก requirement แล้ว

## Blocked acceptance criteria (ผูกกับ Q-Items ที่ยังไม่ได้คำตอบ)

| Q | เกี่ยวกับ Sprint 4 อย่างไร | ยังปิดไม่ได้เพราะ |
|---|---|---|
| **Q22** (UC-10 กำหนดบทบาทให้พนักงาน) | Employee CRUD **ไม่รับ/ไม่เขียน roles** (มีแค่ read ผ่าน LISTAGG) — ไม่สร้าง endpoint เองตาม P-04/AR-08 | ต้องรออาจารย์กำหนด path+method (เช่น `PUT /master/employees/{empId}/roles`) |
| **Q24** (UC-08 แก้/ลบสิทธิ์) | สิทธิ์ในระบบอ่านจาก DB อย่างเดียว — **ไม่มี endpoint แก้/ลบสิทธิ์** | ต้องรออาจารย์เพิ่ม `PUT/DELETE /master/permissions/{permId}` |
| **Q14** (Oracle 19c vs 21c) | Integration จริงกับ Oracle ยังไม่รันใน batch นี้ และ target version ยังไม่ระบุ | ต้องรอคำตอบ + รันชุด integration ซ้ำบนเวอร์ชันที่ยืนยัน |

Q-A / Q-B / Q-F / Q20 / Q23 ไม่กระทบ Sprint 4 (เป็นเรื่อง seed/คะแนน/ตารางรอบเดินทาง) — ไม่ได้แตะ

## git status (สิ่งที่เปลี่ยนรอบนี้)

```
M  backend/src/app.js
M  backend/src/config/db.js
M  backend/src/config/env.js
M  backend/src/middleware/errorHandler.js
M  backend/src/middleware/index.js
M  backend/src/middleware/validate.js
?? backend/src/middleware/auth.js
?? backend/src/repositories/{auth,department,employee,position,index}.repository.js
?? backend/src/routes/{auth.routes.js,master.routes.js}
?? backend/src/services/{auth.service.js,master.service.js,index.js}
?? backend/src/utils/{mappers.js,oracle.js,pagination.js,token.js}
?? backend/tests/sprint04.test.js
?? docs/agent-handoffs/sprint04-kaengkarn.md  (ไฟล์นี้)
```

ไฟล์ dirty เดิมที่ **ไม่ได้แตะ** (preserve, ห้าม push ปน):
`database/02_seed_master.sql` · `docs/agile/sprints/sprint-02-plan.md` · `docs/agile/standup/2026-09-30.md` · `docs/agile/sukhsorn-check-list.md` · `docs/ai-credit-log.md` · `docs/kaengkarn-check-list.md` · `docs/agile/q-items-for-instructor.md` · `scripts/autopilot.mjs` · `.playwright-mcp/` · `convert_svg.py`

## งานต่อไป

- **ยังไม่ commit/push** — เป็นหน้าที่ coordinator (ถ้าจะ commit: เฉพาะไฟล์ sprint 4 + handoff เท่านั้น)
- Integration test กับ Oracle จริง + seed bcrypt ใหม่ (ข้อ 1–3 ด้านบน)
- AR-02: Code Review โดยสุขสรร ก่อนถือว่า DoD ปิดจริง
- Sprint 4 ยังมี task อื่นนอก batch นี้ (T-022 ฯลฯ) — coordinator dispatch ต่อ

---
*จัดทำโดย: เก่งกาญ `[ai-assisted]` · คำสั่ง verification ทั้งหมดรันจริงบน Windows/Node v24.21.0*
