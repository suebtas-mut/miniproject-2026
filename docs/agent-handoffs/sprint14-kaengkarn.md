# Sprint 14 Handoff — เก่งกาญ (kaengkarn) · Cybersecurity baseline audit (SEC14-01..08)

> วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (ยังไม่ commit — coordinator เป็นคน commit) · Model: opencode/mimo-v2.6-flash-free (free tier, ไม่มี subagents) · **จบ batch นี้แล้ว — หยุดตามคำสั่ง (ไม่มี sprint ต่อไปใน stream)**

## ⚠️ ยัง open จาก sprint ก่อน (อ้างอิง ไม่ได้แก้/ไม่ได้ merge)

- **CONTRACT-DRIFT-01**: kaengkarn `1818593` snake_case vs sukhsorn `b107da0` camelCase — ห้ามอ้าง live interoperability · ไม่ merge อัตโนมัติ
- Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 · CONTRACT-DRIFT-01 · Q-REPORT-4 · Q10 · R1 week-boundary ข้ามปี (รายการเต็มใน sprint12 handoff §Unresolved ข้อ 1–9) — **ไม่ใช่ permission ให้ invent** · รอบนี้ไม่ได้แก้อะไรที่ต้องใช้คำตอบเหล่านี้
- 413 deviation (sprint13) · errorHandler fix ของ sprint13 (คงไว้ ไม่แตะเพิ่ม)
- รอบนี้ **ไม่ได้แตะ `docs/api/openapi.yaml`** (ห้ามเสมอ) — deviation ใหม่ที่เจอ (`ACCOUNT_DISABLED` ไม่มีใน contract) บันทึกเป็น finding SEC14-F008

## ขอบเขตที่ทำ

| Task | ผลลัพธ์ตาม Sprint 14 DoD | สถานะ |
|---|---|---|
| **SEC14-01** inventory | route walk จริง = **61 ops** (59 `/api/v1` + `/health` + `/echo`) · ล็อกด้วย test | ✅ |
| **SEC14-02** auth | attack ชุด JWT (alg=none/secret/issuer/claims) · timing · disabled-oracle · multi-session revoke — **เจอ defect 3 ตัว แก้หมด** (F001–F003) | ✅ |
| **SEC14-03** authz | identity override · permission revocation behavioral — ผ่านโดยไม่ต้องแก้โค้ด | ✅ |
| **SEC14-04** input/SQL | path injection · type confusion · prototype pollution · bind defense-in-depth — ผ่านโดยไม่ต้องแก้โค้ด | ✅ |
| **SEC14-05** output | error sweep 5 classes ไม่มี leak · logger ไม่บันทึกของลับ · headers | ✅ |
| **SEC14-06** business state | cancel TX fail → rollback + สถานะไม่เปลี่ยน + 500 sanitize | ✅ |
| **SEC14-07** supply chain | `npm audit` (35 dev-only, 0 prod) · lockfile pins · SQL script DCL scan | ✅ (audit = ข้อมูลวันนี้) |
| **SEC14-08** automation | read-only review `scripts/autopilot.mjs` + `permission-workflow.mjs` → findings (ไม่ได้แก้) | ✅ |
| Full regression | **14 suites / 380 tests ผ่าน** (เดิม 364 + ใหม่ 16) | ✅ |
| Docs | baseline audit + next-sprint plan + handoff นี้ | ✅ |

## ไฟล์ที่สร้าง/แก้

### ใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/tests/sprint14.test.js` | **16 tests / 7 blocks**: inventory ล็อก 61 ops · JWT attack + timing + disabled-oracle + multi-session revoke (stateful blacklist) · identity override · permission revocation · injection/type-confusion/prototype-pollution · repo binds · error sweep · logger spy · headers · TX rollback · lockfile pins |
| `docs/security/sprint14-baseline-audit.md` | SEC14-01..08 ผลครบ + findings register SEC14-F001..F012 + ข้อจำกัด (คำเตือน no-certified หัวเรื่อง) |
| `docs/security/next-security-sprint-plan.md` | ข้อเสนอ round ถัดไป 9 ข้อ — ทุกข้อโยงกลับ finding + ระบุ blocker |
| `docs/agent-handoffs/sprint14-kaengkarn.md` | ไฟล์นี้ |

### แก้ไฟล์เดิม (รอบนี้ — defect fix ตาม plan "may be fixed with before/after evidence")

| ไฟล์ | สิ่งที่เปลี่ยน | Before → After |
|---|---|---|
| `backend/src/services/auth.service.js` | **F001+F002 (login)**: (1) unknown user → `safeCompare(password, DUMMY_HASH)` ก่อนตอบ 401 (2) ย้าย `IS_ACTIVE` check **หลัง** `safeCompare` | Before: ไม่เจอ user → ตอบ 401 ทันทีไม่ผ่าน bcrypt (timing oracle) · บัญชีปิด → `ACCOUNT_DISABLED` ก่อนเทียบรหัสผ่าน (เดาได้โดยไม่รู้รหัสผ่าน) · After: bcrypt เรียก 1 ครั้งทุกทาง · บัญชีปิด+รหัสผ่านผิด → `INVALID_CREDENTIALS` · บัญชีปิด+รหัสผ่านถูก → `ACCOUNT_DISABLED` (ตรง sprint04 test เดิม) |
| `backend/src/utils/token.js` | **F003 (verifyToken)**: เพิ่ม `algorithms: ['HS256']` | Before: `jwt.verify` ไม่จำกัด algorithm (รับตาม header ของ token) · After: `alg=none` / ผิดชนิด → 401 ทันที |

> ⚠️ **ประกาศเปิดเผย (disclosure)**: ทั้ง 2 ไฟล์อยู่ใน uncommitted workspace (ยังไม่เคย commit) และ plan Sprint 14 (SEC14-02) อนุญาตให้แก้ defect ที่ยืนยันได้พร้อมหลักฐาน before/after · ทุกพฤติกรรมที่ sprint04 approve ไว้ยังผ่าน (full suite 380 = 0 regression) · ถ้า reviewer ไม่เห็นด้วย: revert 2 จุดนี้แล้วลบ test block "timing เท่ากัน" + "alg=none" ใน sprint14 (ที่เหลือ 14 tests จะยังเขียว)

`database/*` · `docs/api/openapi.yaml` · `docs/agile/*` · `config/*` · `validate/audit/index.js` · `scripts/*.mjs` (รีวิวอย่างเดียว) · `app/` (Flutter) · `backend/.env`: **ไม่ได้แตะ** · dirty files เดิมทั้งหมดคงสภาพ

## Contract decisions (สำคัญ — ใช้ต่อใน review)

1. **Attack surface = 61 ops** (59 contract + `/health` + `/echo`) — test ล็อกตัวเลขนี้ · route ใหม่ต้องผ่านทั้ง sprint13 conformance และ sprint14 inventory
2. **Timing fix = call-count equality ไม่ใช่ statistical timing** — test ยืนยันว่า unknown user เรียก `bcrypt.compare` 1 ครั้งเหมือน wrong-password (DUMMY_HASH cost 10 ตรง cost ของรหัสผ่านจริง) — ระบุไว้ใน audit ว่าไม่ใช่ timing measurement
3. **`ACCOUNT_DISABLED` ยังคงค่าเดิม** (401 + code นี้) — แค่ย้ายมาตอบหลังตรวจรหัสผ่านถูกแล้ว · openapi ไม่มี code นี้ → เป็น finding F008 ให้ coordinator ตัดสิน ไม่ใช่ให้ stream นี้แก้โค้ด/แก้ contract
4. **Multi-session revoke พิสูจน์ด้วย stateful blacklist fake** — แถว `REVOKE_ALL:{empId}` + `iat < REVOKED_AT` ตาม `auth.js:74-77` จริง · tokenB เก่ากว่า marker (iat ย้อน 2 นาที) → 401 · ไม่มี sleep ไม่มี timing flake
5. **Findings ที่แก้ไม่ได้ในรอบนี้ = open ทั้งหมด** (F004–F012) — เหตุผลรายข้ออยู่ใน audit register · `/echo` ถูกบล็อกโดย `middleware.test.js:134` (T-012) ห้ามแก้เอง
6. **SEC14-08 = read-only** — automation scripts รีวิวผ่าน source เท่านั้น · findings (evidence redaction) เสนอให้ owner ไม่ได้แก้
7. **ไม่มีการ invent requirement** — missing controls (helmet/CORS/distributed limiter) เขียนเป็นข้อเสนอใน next-sprint plan พร้อม blocker ที่ต้องปลด

## Verification (รันจริงทั้งหมด)

1. **`npm.cmd test -- --runInBand tests/sprint14.test.js`** (workdir `D:\data\shuttle-kaengkarn\backend`, bash call แยก) → `Tests: 16 passed, 16 total` · exit=0 (รอบแรก fail 2 — แก้ fake harness: stateful `updatePassword` + commit/rollback semantics ใน `withTransaction` fake → เขียว)
2. **`npm.cmd test -- --runInBand`**:

```
Test Suites: 14 passed, 14 total
Tests:       380 passed, 380 total
```

   (sprint13 = 364 → +16 sprint14 = **380** · ไม่มี test เดิมถูกแก้/ลบ/assertion ลด)

3. **`npm.cmd audit --json`** (รันแล้ว): `critical 0 · high 30 · moderate 5 · total 35` — ชื่อ prod deps ที่มี vuln = **0** (ทั้งหมด dev tree)
4. **`git status --porcelain`**: ใหม่รอบนี้ = `backend/tests/sprint14.test.js` · `docs/security/sprint14-baseline-audit.md` · `docs/security/next-security-sprint-plan.md` · `docs/agent-handoffs/sprint14-kaengkarn.md` · แก้ = `backend/src/services/auth.service.js` + `backend/src/utils/token.js` (ประกาศเปิดเผยข้างบน — ทั้งคู่เป็นไฟล์ untracked อยู่แล้ว) — **ไม่ได้ commit** · dirty files อื่นไม่ถูกแตะเพิ่ม
5. **Flutter**: ไม่มีไฟล์ `app/` เปลี่ยน → ไม่ได้รัน flutter test/analyze
6. **ไม่ได้อ่าน `backend/.env`** · ไม่ได้รัน external scan · ไม่ได้ติดตั้ง/อัปเดต package ใด ๆ

## ⛔ ข้อจำกัดที่ต้องพูดตรง ๆ (ห้ามอ้างเกิน)

- **local pass ≠ certified security** — ไม่มี pen test จริง ไม่มี live Oracle ไม่มี human review · audit doc หัวเรื่องมีคำเตือนนี้
- **timing test = จำนวนครั้ง ไม่ใช่เวลา** — ไม่ได้วัด distribution
- **SQL/rollback บน mock** — Oracle `FOR UPDATE`/MERGE rollback จริงยังไม่เคยรัน (แบบ sprint12/13 เดิม)
- **`npm audit` = registry ณ 2026-10-08** — ไม่ใช่ statement ถาวร
- **SEC14-08 = อ่าน source** — ไม่ได้ fuzz/attack automation · ไม่ได้แก้ script
- XSS แบบ browser/CSRF ไม่ได้ทดสอบ (API ไม่มี cookie — surface ต่ำ แต่ไม่ใช่ "ผ่านการทดสอบ")
- ไม่ได้ commit/push/tag · openapi validator ยังไม่ได้รัน (ของเดิม)

## Unresolved checks (ต้อง coordinator/reviewer ตัดสิน)

| # | เรื่อง | สถานะ |
|---|---|---|
| 1 | รายการ open ข้อ 1–9 ใน sprint12 handoff ทั้งหมด (CONTRACT-DRIFT-01 · Q-list · Q-REPORT-4 · Q10 · week-boundary · T-060 Part B · AR-02) | open/blocked เหมือนเดิม — รอบนี้ไม่ได้แตะ |
| 2 | 413 deviation (sprint13) + errorHandler fix ของ sprint13 | open (ของเดิม) |
| 3 | **SEC14-F006 `/echo`** — gate ด้วย env หรือย้ายเข้า harness? (ถูกบล็อกโดย middleware.test) | open (ใหม่) |
| 4 | **SEC14-F008 `ACCOUNT_DISABLED`** — เพิ่มใน openapi หรือรวมเป็น `INVALID_CREDENTIALS`? | open (ใหม่) |
| 5 | **SEC14-F004/F005/F007** — อนุมัติติดตั้ง helmet? แก้ rate-limit key? plan major-upgrade dev deps? | open (ใหม่ — รอ permission ปลด constraint) |
| 6 | **SEC14-F010** — เสนอ owner scripts เพิ่ม redaction ใน `.agent-runtime` records | open (ใหม่ — stream อื่น) |
| 7 | Candidate index 2 ตัว / T-057 measurement | blocked (ต้อง Oracle — ของเดิม) |

**DoD ที่ยังถูกบล็อก**: ไม่มี live-Oracle · ไม่มี human review · openapi validator ไม่ได้รัน · T-057 ผลวัดว่าง · T-060 Part B ไม่ได้รัน · ไม่ได้ commit/push/tag · external pen test ไม่มี (นอกขอบเขต)

## Standing constraints (ถ้ามีรอบถัดไป)

- Windows absolute paths เท่านั้น · PowerShell 5 (ไม่มี `&&`) · tests = bash call แยก workdir `D:\data\shuttle-kaengkarn\backend` (`npm.cmd test -- --runInBand`) · ไม่ commit/push · **ไม่อ่าน `.env`** · preserve dirty files ตาม list ใน sprint12 handoff (+ ไฟล์ 2 ตัวที่เปิดเผยไว้รอบนี้ ถ้า revert ต้องแก้ test ตามที่เขียนไว้)
- Unresolved ทั้งหมด **ไม่ใช่ permission ให้ invent**
- API prefix `/api/v1` · contract = `docs/api/openapi.yaml` (ห้ามแก้) · Backend stream = API/SQL · Flutter stream = client/docs · ห้ามแก้ peer workspace
- local pass ≠ human review / live integration / ครบทุก requirement / certified security
