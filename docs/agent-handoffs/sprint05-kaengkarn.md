# Sprint 5 Handoff — เก่งกาญ (kaengkarn) · T-019 / T-020 / T-021 / T-022

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents)

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 5 DoD | สถานะ |
|---|---|---|
| **T-019** Role CRUD API (`/roles`) | GET (มี `granted_perm_ids`)/POST/PUT/DELETE · 409 ชื่อซ้ำ · 422 เมื่อยังมีพนักงานใช้บทบาท · 404 | ✅ (local tests) |
| **T-020** Permission API (`/permissions`) | GET (เรียง `module, sort_no, perm_id` + กรอง module)/POST · 409 `uq_perm_code` · **เฉพาะ endpoint ที่สเปกประกาศ** | ✅ (local tests) |
| **T-021** Permission Matrix (`PUT /permission-matrix`) | `MERGE` สิทธิ์ใหม่ + `DELETE` ที่ถอดออก **ใน transaction เดียว** (ล้ม → rollback ทั้งชุด) · `perm_ids: []` = ถอดทั้งหมด | ✅ (local tests) |
| **T-022** Dynamic RBAC ทุก protected API | ทั้ง 7 endpoint ใหม่คุมด้วย `requirePermission('ROLE.EDIT')` (โหลดจาก DB ทุก request) · **ไม่มี role-name bypass** · P-12 scan ผ่าน | ✅ (local tests) |
| Q22 (UC-10 employee_role write) · Q24 (PUT/DELETE `/permissions/{id}`) | ไม่มี endpoint ใน `openapi.yaml`/17.5.2 → **ไม่สร้าง** (มี test ยืนยันตอบ 404) | ⛔ Blocked (ตามเดิม) |

## ไฟล์ที่สร้าง/แก้ (ทั้งหมดอยู่ใน `backend/`)

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `src/repositories/role.repository.js` | `app_role` CRUD + `LISTAGG granted_ids` + `countEmployeesWithRole` + **`deleteGrantsExcept` (DELETE ที่ถอด) + `mergeGrant` (MERGE ใหม่)** — bind เสมอ, ไม่ `SELECT *` |
| `src/repositories/permission.repository.js` | `permission` list/count/find/insert · `ORDER BY module, sort_no, perm_id` · `findByIds` ตรวจ perm_ids ก่อนเข้า tx |
| `src/services/rbac.service.js` | UC-07/08/09 logic · 404/409/422/400 details · dedupe `perm_ids` · normalize ค่าบวกจำนวนเต็ม · matrix ทั้งชุดใน `withTransaction` เดียว |
| `src/routes/rbac.routes.js` | 7 operations (เท่า 17.5.2 เป๊ะ) + `validate` + `requirePermission('ROLE.EDIT')` |
| `tests/sprint05.test.js` | **32 tests / 6 suites** (รายละเอียดด้านล่าง) |

### แก้ไฟล์เดิม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `src/app.js` | mount `createRbacRouter` หลัง `authenticate` (T-019…T-022) |
| `src/repositories/index.js` | export `role`, `permission` |
| `src/services/index.js` | เพิ่ม `rbac: createRbacService(...)` |
| `src/utils/mappers.js` | เพิ่ม `toAppRole`, `toPermission`, `parseGrantedIds` |

`middleware/auth.js` **ไม่ได้แก้** — `requirePermission` (T-015) โหลดสิทธิ์จาก DB ทุก request อยู่แล้ว รอบนี้นำมาใช้กับ endpoint ใหม่ + เพิ่ม test คุม

## Verification (รันจริงทั้งหมด)

1. **`npm.cmd test -- --runInBand`** (ใน `backend/` — คำสั่งเดียวกับ pipeline):

```
PASS tests/sprint04.test.js
PASS tests/sprint05.test.js
PASS tests/health.test.js
PASS tests/middleware.test.js
PASS tests/db.test.js

Test Suites: 5 passed, 5 total
Tests:       112 passed, 112 total
Snapshots:   0 total
Time:        4.671 s
Ran all test suites.
```

   → เดิม 80 tests (sprint04/health/middleware/db) **ไม่แก้ไฟล์ test เดิมเลย** + sprint05 ใหม่ 32 = **112/112**

2. **Smoke โหลดแอปจริง**: `node -e "require('./src/app')"` → `app loaded OK`

3. **P-12 no-hardcode scan** (ตาม `docs/ai-prompts/P-12_no-hardcode-check.md` — บังคับทุก Sprint 5), รันจริงบน Windows PowerShell:

```
# grep "role\s*===?\s*['\"]|isAdmin|isStaff"  ใน backend/src
NO MATCHES — P-12 scan clean (backend/src, n=28 files)

# grep "role_name\s*===|===\s*['\"](ADMIN|STAFF|DRIVER|CUSTOMER)['\"]"
NO MATCHES — no literal role-name comparisons
```

   → test ใน `sprint05.test.js` สแกนซ้ำทุกครั้งที่รัน jest (fail ทันทีถ้ามีคน reintroduce hardcode)

4. **นับ endpoint เท่าต้นทาง (P-04 ข้อ 9)**: 17.5.2 `GET/POST/PUT/DELETE /roles` + `GET/POST /permissions` + `PUT /permission-matrix` = **7 operations = 7 route registrations** ใน `rbac.routes.js` (test `T-022 wiring` คุม) · ไม่มี `GET /permission-matrix` (บทเรียน P-04 — ใช้ `granted_perm_ids` ใน `GET /roles` แทน)

### สิ่งที่ test คุม (6 suites / 32 tests)

| Suite | ครอบคลุม |
|---|---|
| T-019 GET/POST `/roles` | รูป OpenAPI ครบ (snake_case + `granted_perm_ids` + `meta`) · ไม่มี password/hash · `is_active` filter + clamp + ค่าผิดถูกละเลย · POST 201 **insert ได้ conn จาก withTransaction + commit จริง** · 409 (ชื่อมีช่องว่างก็ trim ก่อนตรวจ) · 400 details |
| T-019 PUT/DELETE `/roles/{id}` | 404/409/200 เปลี่ยนจริง + message ตามสเปก · PUT ไม่ส่ง `is_active` → คงค่าเดิม · DELETE 422 (ยังมีคนใช้) → ไม่ลบ · 200 ลบจริง |
| T-020 GET/POST `/permissions` | `ORDER BY module,sort_no,perm_id` (test จับ [booking, front, master]) · กรอง module · module ผิด enum เมินไม่ 400 · clamp · POST 201+commit · 409 dup · 400 enum/required |
| T-021 `PUT /permission-matrix` | DELETE+MERGE ใน tx เดียว (assert conn เดียวกัน + commit ครั้งเดียว) · dedupe · `[]` ถอดทั้งหมดไม่เรียก MERGE · 404/422 (ไม่แตะ tx) · 400 รูปผิด · **statement ล้ม → rollback + 500 sanitized ไม่ leak + ตารางติ๊กเดิมคงอยู่** |
| T-022 Dynamic RBAC | 7 endpoints × ไม่มี token → 401 · viewer → 403 · **ถอดสิทธิ์ระหว่าง session → 403 ทันทีไม่ต้อง login ใหม่** · ghost (role ไม่ใช่ ADMIN แต่มีสิทธิ์) → 200 พิสูจน์ไม่มี role-name bypass · viewer ยังใช้ `/employees` ได้ · **P-12 static scan ทุกครั้ง** · wiring `loadPermissions` + `ROLE.EDIT` · **Q22/Q24 endpoints ตอบ 404 จริง** |
| repository SQL | bind ทุก statement · ไม่มี `SELECT *` (รวม COUNT(*) ผ่าน regex) · injection payload อยู่ใน bind เท่านั้น · `NOT IN (:p0,:p1)` build binds · `MERGE` ไม่มีค่าจริงใน SQL · `loadPermissions` ไม่ hardcode ชื่อบทบาท |

## Contract decisions ที่ reviewer ต้องรู้

| # | เรื่อง | ที่เลือก | เหตุผล/ที่มา |
|---|---|---|---|
| 1 | สิทธิ์คุม RBAC endpoints ทั้ง 7 | **`ROLE.EDIT`** | UC-07/UC-09 ระบุ `ROLE.EDIT` ✓ แต่ **UC-08 เขียน `PERMISSION.EDIT` ซึ่งไม่มีใน seed** (`database/02_seed_master.sql`) — บังคับ `PERMISSION.EDIT` = ไม่มีใครเข้าถึงได้แม้แต่ ADMIN (CROSS JOIN ให้เฉพาะ perm ที่มีแถวจริง) → ใช้ `ROLE.EDIT` ('จัดการบทบาทและสิทธิ์') ชั่วคราว · **บันทึกเป็น unresolved check ด้านล่าง** |
| 2 | ไม่สร้าง endpoint ที่สเปกไม่ประกาศ | ไม่มี `GET /permission-matrix` (ใช้ `granted_perm_ids` ใน `GET /roles`) · ไม่มี `PUT/DELETE /permissions/{id}` (**Q24**) · ไม่มี employee_role write (**Q22**) | P-04 ข้อ 9 (นับ operation เท่า 17.5.2) + AR-08 ห้ามเดา requirement ที่ยังค้าง |
| 3 | `PUT /roles/{id}` ไม่ส่ง `is_active` | **คงค่าเดิม** ไม่ใช้ default 1 ของ schema | ถ้าใช้ default 1 การแก้ชื่ออย่างเดียวจะพลิกบทบาทที่ปิดอยู่ให้เปิดใช้ — unsafe · re-activate ต้องส่ง `is_active: 1` ชัดเจน |
| 4 | Matrix ความหมาย | dedupe `perm_ids` · `[]` = ถอดทั้งหมด (ไม่ยิง MERGE) · role ไม่พบ → 404 · perm_id ไม่มีจริง → 422 `FK_VIOLATION` · รูปผิด → 400 `details` · tx = `DELETE ... NOT IN (ที่ติ๊ก)` + `MERGE` ทุกแถว | ตาม OpenAPI `x-transaction` + schema อธิบาย "ส่งเฉพาะช่องที่ติ๊กอยู่" |
| 5 | ข้อความ (ทดสอบแล้วตรง) | `เพิ่มบทบาทสำเร็จ` · `แก้ไขบทบาทสำเร็จ มีผลกับการเข้าสู่ระบบครั้งถัดไป` · `ลบบทบาทสำเร็จ` · `เพิ่มสิทธิ์สำเร็จ` · `บันทึกแล้ว มีผลกับการ Login ครั้งถัดไป` · 409 `ชื่อบทบาทนี้มีอยู่แล้ว`/`รหัสสิทธิ์นี้มีอยู่แล้ว` · 422 `ยังมีพนักงานที่ใช้บทบาทนี้อยู่ กรุณาปลดบทบาทออกก่อน`/`ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบสิทธิ์ที่ระบุ)` · 404 `ไม่พบข้อมูลที่ต้องการ` · 403 `ไม่มีสิทธิ์เข้าถึงส่วนนี้` | ตัวอย่าง OpenAPI + แนวเดิม sprint04 |
| 6 | GET list | clamp `page≥1, limit 1..100` · ค่า filter ผิดถูกละเลยไม่ 400 · เรียง roles = `role_id`, permissions = `module, sort_no, perm_id` | แนวเดิม sprint04 + OpenAPI ไม่ declare 400 สำหรับ GET |
| 7 | Layout/สถาปัตยกรรม | `src/routes/` + Router→Service→Repository (handler = controller) | คง convention จาก sprint04 (documented deviation ของ P-04) |

## ⚠️ สิ่งที่ reviewer/คนถัดไปต้องทำ (นอกเหนือจาก code)

1. **ตั้ง `JWT_SECRET` ใน `backend/.env`** (ตาม `backend/.env.example`) — worker ห้ามแตะไฟล์ credential
2. **Seed password เป็น placeholder** → login กับ DB จริงได้ 401 จนกว่าจะ seed bcrypt hash ใหม่
3. **ยังไม่ได้ integration test กับ Oracle จริง** — รอบนี้ test ใช้ fake repos + transaction runner/SQL โค้ดจริง (assert ผ่าน spy) · ต้องรัน schema+seed แล้วยิง API จริงอีกรอบ โดยเฉพา SQL `LISTAGG`/`MERGE role_permission`
4. **AR-02 Human code review ยังไม่ได้ทำ** — local tests ผ่าน **ไม่เท่ากับ** human review ผ่าน / integration จริงผ่าน / ครบทุก requirement แล้ว

## Unresolved checks / Blocked acceptance criteria

| ข้อ | เกี่ยวกับ Sprint 5 อย่างไร | สถานะ |
|---|---|---|
| **UC-08 precondition `PERMISSION.EDIT`** | `usecase-spec.md` บอกว่าต้องมีสิทธิ์นี้ แต่ seed ไม่มีแถว `PERMISSION.EDIT` → endpoint ถูกคุมด้วย `ROLE.EDIT` ชั่วคราว (contract decision #1) | ⏳ ต้องอาจารย์ยืนยัน: เพิ่มแถว permission ใหม่ใน seed หรือยอมให้ `ROLE.EDIT` คุมทั้งสอง UC |
| **Q22** (UC-10 กำหนดบทบาทให้พนักงาน) | `employee_role` มีตารางแต่ **ไม่มี write endpoint** ในสเปก → ไม่สร้าง (มี test ยืนยัน 404) | ⛔ ค้างอาจารย์ (เดิม) |
| **Q24** (UC-08 แก้/ลบสิทธิ์) | มีแค่ `GET/POST /permissions` ตามสเปก → ไม่สร้าง `PUT/DELETE /permissions/{id}` (มี test ยืนยัน 404) | ⛔ ค้างอาจารย์ (เดิม) |
| **Q14** (Oracle 19c vs 21c) | Integration จริงของ batch นี้ยังไม่รัน + target version ยังไม่ระบุ | ⏳ ค้างอาจารย์ (เดิม) |

Q-A / Q-B / Q-F / Q20 / Q23 ไม่กระทบ Sprint 5 — ไม่ได้แตะ · **ไม่ได้ถามคำถามซ้ำ** ที่ค้างอยู่แล้ว

## git status (สิ่งที่เปลี่ยนรอบนี้)

```
M  backend/src/app.js              (เพิ่ม mount rbac router)
M  backend/src/repositories/index.js (+role, +permission)
M  backend/src/services/index.js    (+rbac)
M  backend/src/utils/mappers.js     (+toAppRole, +toPermission, +parseGrantedIds)
?? backend/src/repositories/{role,permission}.repository.js
?? backend/src/services/rbac.service.js
?? backend/src/routes/rbac.routes.js
?? backend/tests/sprint05.test.js
?? docs/agent-handoffs/sprint05-kaengkarn.md  (ไฟล์นี้)
```

ไฟล์ dirty เดิมที่ **ไม่ได้แตะ** (preserve, ห้าม push ปน):
`database/02_seed_master.sql` · `docs/agile/sprints/sprint-02-plan.md` · `docs/agile/standup/2026-09-30.md` · `docs/agile/sukhsorn-check-list.md` · `docs/ai-credit-log.md` · `docs/kaengkarn-check-list.md` · `docs/agile/q-items-for-instructor.md` · `scripts/autopilot.mjs` · `.playwright-mcp/` · `convert_svg.py`

## งานต่อไป

- **ยังไม่ commit/push** — เป็นหน้าที่ coordinator (ถ้าจะ commit: เฉพาะไฟล์ sprint 5 + handoff เท่านั้น)
- Integration test กับ Oracle จริง (ข้อ 1–3 ด้านบน) + รัน P-12 ซ้ำบนฝั่ง Flutter (เป็นงานสุขสรร)
- AR-02: Code Review โดยสุขสรร ก่อนถือว่า DoD ปิดจริง
- Sprint 5 เหลืองานนอก batch นี้ (T-023 Flutter Permission Matrix ฝั่งสุขสรร) — coordinator dispatch ต่อ

---
*จัดทำโดย: เก่งกาญ `[ai-assisted]` · คำสั่ง verification ทั้งหมดรันจริงบน Windows/Node v24.21.0*
