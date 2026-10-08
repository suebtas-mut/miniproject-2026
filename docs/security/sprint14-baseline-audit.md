# Sprint 14 — Cybersecurity Baseline Audit (SEC14-01..08)

> วันที่: 2026-10-08 · สภาพแวดล้อม: Windows local · Node 20 / Jest (mocked DB) · Branch `feature/sprint3-kaengkarn-autonomous` (ไม่ได้ commit)
> ขอบเขต: อ่าน/วิเคราะห์/test/แก้ defect ใน repo เท่านั้น — **ไม่มี external scan เครื่องอื่น · ไม่มี live Oracle · ไม่แก้ `docs/api/openapi.yaml` · ไม่ commit/push**
>
> ⚠️ **คำเตือนสำคัญ**: ผลทั้งหมดมาจากการอ่านโค้ด + static scan + Jest test ที่ mock DB — **ไม่ใช่การรับรองความปลอดภัย (ไม่ certified)** ไม่มี penetration test จริง ไม่มี live database การทดสอบ timing เป็นการเทียบจำนวนครั้งที่เรียก bcrypt ไม่ใช่การวัดเวลาทางสถิติ

## วิธีตรวจ (method)

| วิธี | ใช้กับ | ข้อจำกัด |
|---|---|---|
| Route walk จริงจาก Express app ↔ inventory | SEC14-01 | เฉพาะ route ที่ register ใน `createApp` |
| Black-box test ผ่าน supertest + fake repos (stateful) | SEC14-02..06 | DB = mock · Oracle lock/จริงไม่ได้พิสูจน์ |
| Code review + grep static (`${}` dynamic SQL, DCL, secret pattern) | SEC14-04..07 | อ่านด้วยตา ไม่ใช่ SAST เต็มรูปแบบ |
| `npm audit --json` (public registry metadata) | SEC14-07 | ข้อมูล ณ วันที่รัน · ไม่ได้ install/fix |
| อ่าน source `scripts/*.mjs` (read-only) | SEC14-08 | ไม่ได้แก้/รัน automation |

## ผลตรวจรายหัวข้อ

### SEC14-01 — Attack-surface inventory

- **ทางเข้าทั้งหมดของ app = 61 operation**: `/api/v1/*` 59 ops (ตรง `openapi.yaml` สองทาง — sprint13 conformance) + `GET /health` + `POST /echo` — ไม่มี route ลับเพิ่ม (test: sprint14 block SEC14-01 ล็อกตัวเลขนี้ไว้ ใครเพิ่ม route โดยไม่แก้ test จะ fail)
- ชั้น auth: `POST /auth/login` + `GET /health` + `POST /echo` ไม่มี token · ที่เหลือ 401 sweep ครบ 58 ops (sprint13)
- `POST /echo` อยู่นอก `/api/v1` และไม่มี auth → ดู finding **SEC14-F006**
- Config surface: `backend/.env` มีอยู่จริงแต่ **ไม่ถูกอ่านในรอบนี้** · `.env` + `.env.*` (ยกเว้น `.env.example`) + `*.pem`/`*.key` ถูก gitignore แล้ว · `git ls-files` ยืนยันไม่มีไฟล์ secret ถูก track

### SEC14-02 — Authentication

ผ่านทั้งหมด (test: sprint14 block SEC14-02 · 4 tests):

| การโจมตี/พฤติกรรม | ผล |
|---|---|
| ยัด `alg=none` | 401 UNAUTHORIZED (หลัง fix **F003**) |
| เซ็นด้วย secret ผิด | 401 |
| issuer ผิด | 401 |
| เซ็นถูกแต่ขาด `jti` / `empId` | 401 (ไม่ 500) |
| token หมดอายุ / ถูกแก้ payload | 401 (sprint04 เดิม) |
| Unknown username (timing oracle) | ยังรัน `bcrypt.compare` เท่ากับ wrong-password → 401 เดียวกัน (fix **F002**) |
| บัญชีปิด + รหัสผ่านผิด | 401 INVALID_CREDENTIALS (ไม่ leak ACCOUNT_DISABLED — fix **F001**) |
| บัญชีปิด + รหัสผ่านถูก | 401 ACCOUNT_DISABLED (พฤติกรรม sprint04 คงเดิม) |
| เปลี่ยนรหัสผ่าน → เซสชันเก่า (jti ตรงตัว + marker `iat < REVOKED_AT`) | 401 TOKEN_REVOKED ทุกเซสชัน · เซสชันใหม่ใช้ได้ (stateful blacklist test) |
| Rate limit 5 ครั้ง/15 นาที · ข้อความ 401 ซ้ำกันทุกกรณี | sprint04 เดิม ยังผ่าน |

### SEC14-03 — Authorization / ownership

- **Identity override**: `GET /booking/me?cust_id=99&emp_id=99` → repo ยังถูกเรียกด้วย `custId=7` จาก JWT · booking ของคนอื่นไม่หลุด (test ใหม่)
- **Permission revocation behavioral**: ถอดสิทธิ์ใน DB → request ถัดไป 403 ทันที · คืนสิทธิ์ → 200 (ไม่มี cache — ลึกกว่า call-count test ของ sprint04)
- Ownership ที่เหลือ: cancel/QR ตรวจ `CUST_ID === empId` (sprint04/09) · RBAC ทุก route ผ่าน `requirePermission` (sprint04) · 401/403 sweep (sprint04/13) — ไม่ซ้ำกับ test ใหม่

### SEC14-04 — Input validation & SQL binding

- **Path param injection**: `/booking/1' OR '1'='1/cancel`, `/schedules/1; DROP TABLE schedule;--` → 404 envelope ปกติ · ไม่มี SQL fragment ในคำตอบ (test ใหม่)
- **Type confusion** (object/array ใน body login) → 400 ไม่ 500
- **Prototype pollution** (`__proto__` + `constructor.prototype` ใน JSON) → ไม่แตะ `Object.prototype` (test assert ตรง ๆ)
- **Bind defense-in-depth**: `schedule.list` รับ payload `2025-01-01' OR '1'='1` → อยู่ใน binds เท่านั้น · `isActive=9` ถูก 0/1 whitelist กันออกจาก SQL
- Dynamic SQL ทั้ง repo: `${}` ที่เจอเป็นค่าคงที่/whitelist เท่านั้น (`mineWhere` มี fallthrough `1 = 1` — service validate ก่อนเสมอ → บันทึกเป็น **F012** ระดับ info)
- Validate layer + sprint13 SQLi block (LIKE escape, bind เสมอ, validate ก่อน query) ยังผ่าน

### SEC14-05 — Sensitive data output

- **Error sweep ทุก class** (400/401/403/404/500): ไม่มี `stack` · `ORA-` · `SELECT` · `node_modules` · `$2b$` · `password_hash` — โดย 500 probe ใช้ error ที่ **มีคำว่า `ORA-00942` อยู่ใน message จริง** เพื่อพิสูจน์ว่าคำตอบถูก sanitize
- **Logger**: spy `console.*` ระหว่าง login ผิด/ถูก + logout — ไม่มี password, ไม่มี raw JWT, ไม่มี `Bearer …` (log แค่ method/path/status/duration)
- **Headers**: ไม่มี `x-powered-by` · ไม่มี `Access-Control-Allow-Origin` แม้ส่ง `Origin` มา → ไม่มี CORS เปิดแบบไม่ตั้งใจ (browser default-deny) — แต่ **ยังไม่มี security headers เลย** → **F004**
- `PASSWORD_HASH` ไม่เคยอยู่ใน response mapper (grep mappers + test `/login`/`/me`)

### SEC14-06 — Business-state integrity

- Cancel แล้ว TX พัง (`ORA-01555` จำลอง) → **rollback ถูกเรียก · commit ไม่ถูกเรียก · สถานะ booking ยัง `reserved` · ตอบ 500 INTERNAL_ERROR ที่ sanitize** (test ใหม่ — fake `withTransaction` ทำ commit/rollback/close ตาม semantics จริง)
- Race/serial: sprint13 (ยกเลิกซ้ำ/สแกนซ้ำ ภายใต้ mutex lock) ยังผ่าน
- ⬜ ยังไม่พิสูจน์: rollback บน Oracle จริง (ไม่มี instance)

### SEC14-07 — Supply chain & configuration

- **`npm audit --json` (รันแล้ว · public registry)**: `critical 0 · high 30 · moderate 5 · low 0 · total 35` — **ชื่อ dependency ที่มี vuln ตรงกับ prod deps 0 ตัว** ทั้ง 35 ตัวอยู่ใน tree ของ `jest`/`nodemon`/`babel`/`chokidar`/`braces` = **dev-only** · ทุก fix เป็น semver-major → ห้ามอัปเดตในรอบนี้ (no-install rule) → **F007**
- **Prod deps pinning** (test ใหม่): `bcryptjs · dotenv · express · jsonwebtoken · oracledb · qrcode` ทุกตัวมี entry แบบ exact version + `integrity: sha512` ใน `package-lock.json` (`lockfileVersion 3`) · ไม่มี wildcard range
- **SQL scripts statics**: ไม่มี `GRANT` / `CREATE USER` / `ALTER USER` ใน `database/*.sql` · destructive statements มีแค่ `99_drop_schema.sql` (manual + มีคำเตือน) และ `DELETE FROM plan_table` ใน `06_*` (เครื่องมือ Oracle ไม่ใช่ตาราง app)
- **Seeds**: `.env.example` ใช้ placeholder `CHANGE_ME_*` · seed password ใน `02_seed_master.sql` เป็นข้อมูล demo (แจ้งไว้ใน handoff ก่อนหน้าแล้ว)

### SEC14-08 — Automation trust boundary (review แบบ read-only — ไม่ได้แก้)

| จุดที่ตรวจ | ผล |
|---|---|
| `scripts/autopilot.mjs` — network | local-only URL enforcement (127.0.0.1) ✓ · `freeModel()` บังคับ zero-cost ✓ · spawn ไม่ผ่าน shell ✓ |
| `scripts/autopilot.mjs` — control flow | job list คงที่ · lock file `wx` · STOP-file stop · rescue timeout จำกัด ✓ |
| `scripts/permission-workflow.mjs` — secrets | อ่านไฟล์ secret (`.env` non-example, `*.pem`, `id_rsa`, `*.key`) → **`reject`** ทันที ✓ |
| `scripts/permission-workflow.mjs` — decision | default = `human` (deny-by-default) · destructive verbs → `human` · advice จาก Ollama = non-authoritative + fingerprint ก่อนตอบอัตโนมัติ ✓ |
| จุดที่เปิดเป็น finding | evidence slice ใน `.agent-runtime/*` เก็บ raw (ไม่มี redaction) → **F010** · local fallback agent ได้ bash tool (พึ่ง permission gating ของ OpenCode) · advice prompt รับ raw question (prompt-inject เข้า local model ได้ แต่ output ไม่มีน้ำหนัก) |

## Findings register

| ID | Sev | เรื่อง | สถานะ |
|---|---|---|---|
| **SEC14-F001** | High | Login ฟ้อง `ACCOUNT_DISABLED` ก่อนเทียบรหัสผ่าน → เดาสถานะบัญชีได้โดยไม่ต้องรู้รหัสผ่าน | ✅ **แก้แล้ว** — ย้าย check หลัง `safeCompare` (behavior sprint04 คงเดิม) · test block SEC14-02 |
| **SEC14-F002** | High | Unknown user ตอบ 401 ทันทีไม่ผ่าน bcrypt → timing username enumeration | ✅ **แก้แล้ว** — `DUMMY_HASH` (cost 10) เทียบเสมอ · test assert bcrypt เรียก 1 ครั้งทุกทาง |
| **SEC14-F003** | High | `verifyToken` ไม่จำกัด `algorithms` | ✅ **แก้แล้ว** — `algorithms: ['HS256']` · test `alg=none`/wrong-secret → 401 |
| **SEC14-F004** | Medium | ไม่มี security headers เลย (no helmet — ติดตั้งใหม่ไม่ได้ในรอบนี้) | ⬜ open → next sprint |
| **SEC14-F005** | Medium | Rate limiter key = `ip\|username` (ไล่ brute หลาย user จาก IP เดียวไม่โดน limit) + in-memory (multi-instance ใช้ไม่ได้) · `ACCOUNT_DISABLED` ไม่ถูกนับเป็น failure | ⬜ open → next sprint (ต้องตัดสิน keying policy) |
| **SEC14-F006** | Medium | `POST /echo` ไม่มี auth อยู่นอก `/api/v1` | ⬜ open — **บล็อก**: `middleware.test.js:134` ทดสอบพฤติกรรมนี้ (T-012 approve) ต้องตัดสิน contract ก่อน |
| **SEC14-F007** | Medium | dev dependency 35 vulns (30 high) — ทุก fix semver-major | ⬜ open → next sprint (major upgrade ต้อง plan) |
| **SEC14-F008** | Low | `ACCOUNT_DISABLED` ไม่มีใน openapi (`login` 401 example = `INVALID_CREDENTIALS`) — deviation ที่มี test ของ sprint04 คุม | ⬜ open — ต้อง coordinator ตัดสิน (แก้โค้ด หรือ เสนอแก้ openapi ใน stream เอกสาร) |
| **SEC14-F009** | Info | `server.listen(port)` bind ทุก interface · log `user@connectString` (ไม่มี password) — เรื่อง deployment/egress | ⬜ observation |
| **SEC14-F010** | Low | `.agent-runtime/autopilot.jsonl` + permission records เก็บ evidence ดิบ (ไม่มี redaction) — ถูก gitignore แล้วแต่เป็นไฟล์ local ที่อ่านได้ | ⬜ open — เสนอ owner ของ automation scripts |
| **SEC14-F011** | Info | `mineWhere` มี fallthrough `1 = 1` — service validate ก่อนเสมอ (มี test) จึงไม่ใช่ช่องโหว่ | ⬜ info (defense-in-depth note) |
| **SEC14-F012** | Info | `.env.example` มี `QR_TOKEN_BYTES=32` ที่โค้ดไม่ได้อ่าน (โค้ด hardcode `randomBytes(16)` = hex 32) · `JWT_ISSUER` ใน example ต่างจาก default ของ `env.js` (ภายใน process ใช้ค่าเดียวกัน sign/verify จึงไม่พัง) | ⬜ doc drift |

## สิ่งที่ตรวจไม่ได้ / ยังไม่พิสูจน์ (ห้ามอ้างเกิน)

- **ไม่มี live Oracle** → rollback/lock/`FOR UPDATE` จริง, EXPLAIN PLAN, seed จริง = ยังไม่เคยรัน
- **ไม่มี external scan / pen test** — ไม่ได้ทดสอบจากเครื่องอื่น ไม่ได้ fuzzing ภายนอก
- **XSS/CSRF ไม่ได้ทดสอบแบบ browser** — API ใช้ Bearer token ใน header (ไม่มี cookie/session → CSRF surface ต่ำโดย design) แต่ยังไม่มี content-security policy (ส่วนหนึ่งของ F004)
- Timing = จำนวนครั้งที่เรียก bcrypt เท่านั้น ไม่ใช่ timing distribution จริง
- `npm audit` = ข้อมูล registry ณ 2026-10-08
- SEC14-08 = อ่าน source อย่างเดียว ไม่ได้ fuzz/attack automation
- **local pass ≠ human review ≠ certified** — ไฟล์นี้เป็น baseline เท่านั้น

## หลักฐาน regression

- `backend/tests/sprint14.test.js` → **16 tests / 7 blocks ผ่าน** (SEC14-01..07 · SEC14-08 = read-only review ไม่มี test)
- Full suite: **14 suites / 380 tests ผ่าน** (เดิม 364 + ใหม่ 16 · test เดิมไม่ถูกลด assertion)
- คำสั่งรันจริงอยู่ใน `docs/agent-handoffs/sprint14-kaengkarn.md` §Verification
