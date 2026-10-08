# Sprint 15 — Red Team Pentest Report (self-target: ระบบของเก่งกาญ)

> วันที่: 2026-10-08 · ผู้ดำเนินการ: red team mode (agent คนเดียวกับที่พัฒนา — มีข้อจำกัดด้าน objectivity ระบุใน §7) · Branch `feature/sprint3-kaengkarn-autonomous` (ไม่ได้ commit)
> เป้าหมาย: หาช่องโหว่จริงใน backend แล้ว "ทะลุเข้ายึดระบบให้สำเร็จ" — ภายในเครื่อง local, mocked DB, ไม่มี external scan, ไม่อ่าน `.env`, ไม่แก้ openapi
>
> ⚠️ นี่คือการทดสอบระบบตัวเอง (authorized self-test) — ไม่ใช่การทดสอบระบบบุคคลที่สาม · ผลลัพธ์ทั้งหมดอ้างอิงโค้ด/พฤติกรรม ณ วันที่รัน · **ไม่ certified** (ดูข้อจำกัด §7)

## 1. Attacker model (จุดเริ่มต้นของผู้โจมตี)

| Foothold | รายละเอียด |
|---|---|
| **A — ไม่มีอะไรเลย (unauthenticated)** | ยิง `/api/v1/*` + `/health` + `/echo` ได้ |
| **B — บัญชีลูกค้า `mai`** | สิทธิ์ `BK.VIEW / BK.CREATE / BK.CANCEL` เท่านั้น (เป็นตัวแทนผู้ใช้จริงที่ least-privilege) |
| **C — token-disclosure (สมมติ)** | ได้ session token ของ admin มา 1–2 ใบ (ขโมยจากเครื่อง/log/ shoulder-surf) — ใช้ในสายยึดระบบ RT-B · ระบุ precondition ชัดเจน ไม่แอบอ้างว่าได้มาจากช่องโหว่ใหม่ |

## 2. Recon: attack surface + แผนที่ guard

- **61 operations** = 59 `/api/v1` (ตรง openapi — sprint13/14) + `GET /health` + `POST /echo`
- `authenticate` ครอบทุก endpoint ยกเว้น `POST /auth/login` (`app.js:76`) — 401 sweep ครบ 58 ops (sprint13)
- guard ต่อ route ตรวจครบทุกไฟล์: master (DEPT.EDIT/POS.EDIT/EMP.VIEW/EMP.EDIT) · rbac (ROLE.EDIT ทั้ง 7 ops) · front (ROUTE.VIEW/ROUTE.EDIT) · scheduling (VEH.EDIT/ROUTE.VIEW/SCHED.EDIT) · booking (BK.*) · driver (TRIP.START/QR.SCAN/TRIP.END) · report (RPT.R1..R7) — **ไม่พบ endpoint ที่ guard หาย**
- ไม่มี `child_process/eval` · ไม่มี static file serving · pagination clamp `MAX_LIMIT=100` (`pagination.js`) · seed ใช้ placeholder hash (`SEEDPLACEHOLDERSUPPLIEDBYT011…`) → **ไม่มี default credential** · `createBooking` เอา `custId` จาก JWT เท่านั้น (`booking.service.js:213,259`) ไม่มี mass assignment

## 3. Findings (ช่องโหว่ที่ "เจอ" และพิสูจน์ด้วย PoC)

### RT-F001 — Login rate limit bypass ด้วย key mutation (High)

- **กลไก**: `loginRateLimiter` วิ่ง **ก่อน** `validate` และ key = `` `${req.ip}|${req.body.username}` `` จากค่าดิบ (`auth.js:12-14, 24-25`) → ทุก string ที่ต่างกัน = ก้อนนับ 5 ครั้ง/15 นาที เป็นคนละก้อน
- **PoC (test `RT-A`)**: ล็อก key `ip|admin` ด้วยความล้มเหลว 5 ครั้ง (control ตอบ 429 ตามออกแบบ) → ยิงต่อ 12 ครั้งด้วย variants (`admin `, `admin  `, ` admin`, `Admin`, `ADMIN`, `admin\t`) → **ไม่มีครั้งไหนโดน 429** (401 ทั้งหมด) → brute force ไม่จำกัด
- **นัยยะ production (static, ไม่ได้วัดบน Oracle จริง)**: `SELECT_LOGIN_USER` = `WHERE e.username = :username` (`auth.repository.js:12`) — ความเทียบ VARCHAR2 ของ Oracle เมิน trailing space → `'admin '` ชี้กลับบัญชี `admin` จริง ในขณะที่ limiter ฝั่ง Node มองเป็นคนละ key → **เดารหัสผ่านบัญชีเดียวได้ไม่จำกัดครั้งในproduction**
- **CWE**: CWE-307 (Improper Restriction of Excessive Auth Attempts) + CWE-178 (Improper Handling of Case/Whitespace)

### RT-F002 — `/auth/change-password` ไม่มี rate limiter → สายยึดระบบสำเร็จ (High)

- **กลไก**: `auth.routes.js:61-67` มีแค่ `authenticate + validate` — **ไม่มี limiter และไม่มี `recordLoginFailure`** → `old_password` เดาได้ไม่จำกัดเท่าที่ยังถือ token อยู่
- **สายยึดระบบ (test `RT-B` — PoC รันจบครบทุก step)**:

| Step | การกระทำ | ผล (พิสูจน์ใน test) |
|---|---|---|
| 0 | ได้ token admin 2 ใบ (precondition C) | `/auth/me` 200 ทั้งคู่ |
| 1 | control: brute `/login` | ล้มเหลว 5 → ครั้งที่ 6 = **429** (control มีที่นี่) |
| 2 | brute `old_password` ผ่าน `/change-password` ×10 | **401 ทุกครั้ง ไม่มี 429** (เกินเพดาน 5 ที่ `/login` มี) |
| 3 | เดาถูก → เปลี่ยนรหัสผ่าน | 200 — bcrypt hash ใหม่ + `REVOKE_ALL` marker |
| 4 | session ของเหยื่อ (2 ใบ) | **401 TOKEN_REVOKED ทั้งคู่** — เจ้าของถูกเตะออกจากระบบ |
| 5 | ผู้โจมตี login รหัสใหม่ | 200 + `permissions` มี `EMP.VIEW/EMP.EDIT/ROLE.EDIT` + `GET /employees` 200 → **ข้อมูลบุคลากร organization อยู่ในมือ** |
| 6 | เหยื่อ login รหัสเดิม | 401 — เข้าไม่ได้อีกเลย |

- **สถานะ: ยึดระบบสำเร็จ** — ผู้โจมตีถือ credential ถาวร, เจ้าของถูกล็อก, ทุก session เดิมตาย
- **Precondition ที่ต้องพูดตรง ๆ**: ต้องมี token ก่อน (ข้อ 0) — ไม่ใช่ unauthenticated chain · โจมตีซ้ำได้เพราะไม่มี throttle (ข้อ 2 คือหัวใจ finding)
- **CWE**: CWE-307 (ต่อ) + CWE-613 (Insufficient Session Expiration ฝั่ง step-up auth)

### RT-F003 — Audit ไม่ครอบการอ่านข้อมูล (GET) → exfiltration เงียบ (Low–Medium)

- **กลไก**: `audit.js` = `WRITE_METHODS` เฉพาะ POST/PUT/PATCH/DELETE (บรรทัด 8, 20) — `GET /employees`, `GET /report/*` ไม่สร้าง audit entry
- **PoC (test `RT-E`)**: login 401 + change-password 401 → audit มีครบทั้ง `empId`/`ip` (หลักฐานการยึดระบบมีจริง) — แต่หลัง take over, `GET /employees` (อ่านข้อมูลองค์กร) **ไม่เพิ่ม entry เลย**
- **ผลกระทบ**: audit_log บอกได้ว่า "ใครเปลี่ยนรหัสผ่าน" แต่บอกไม่ได้ว่า "อ่านอะไรไปบ้าง" — ต้องพึ่ง request logger (console) ซึ่งไม่ใช่ tamper-resistant storage
- **หมายเหตุ**: design นี้สอดคล้าน comment ในไฟล์ ("GET ไม่ถูก audit") = เจตนาดั้งเดิม — red team ยกเป็น finding เพราะหลังมี chain RT-B ช่อง exfiltration เงียบมีความหมาย

### จุดที่โจมตีแล้ว "ไม่ผ่าน" (defense ทำงาน — หลักฐานใน `RT-C` / `RT-D`)

| การโจมตี | ผล |
|---|---|
| 16 privileged endpoints ด้วย token ลูกค้า (roles/matrix/permissions/employees/schedules/vehicles/stops/report/driver) | **403 FORBIDDEN ทุกตัว** ไม่มี escalation หลุด |
| IDOR: ยกเลิกจองของคนอื่น (`POST /booking/2/cancel`) | 403 + สถานะไม่ถูกแตะ |
| IDOR: อ่าน QR ของคนอื่น (`GET /booking/2/qr`) | 403 + qr_token ไม่หลุดใน response |
| forged token (`alg=none` / ลายเซ็นผิด) | 401 — **ช่อง sprint14 ที่เคยปิด ยังปิดอยู่** (regression ข้าม sprint) |
| identity override query (`?cust_id=`) | 403/กรองฝั่ง service (sprint14 คุม — ไม่ซ้ำ test) |
| default credentials จาก seed | placeholder hash ทั้งหมด → login ไม่ได้ |
| SQLi / mass assignment / missing guard / static+exec | ไม่พบในรอบนี้ (งาน sprint04/13/14 คุมไว้) |

## 4. สรุปสถานะ: "ยึดระบบ" ได้ไหม?

- ✅ **ยึดได้ 1 สาย** (RT-B): token-disclosure → brute `change-password` (ไม่มี limiter) → รหัสผ่าน admin ใหม่ + ทุก session เดิมตาย → re-login ถาวร + เข้าถึงข้อมูลองค์กร — ทำซ้ำได้ 100% (PoC ผ่านทุกครั้งที่รัน)
- ✅ ** bypass control 1 จุด** (RT-F001): เพดาน 5 ครั้ง/15 นาที ที่ `/login` ถูกเลี่ยงด้วย key mutation → brute ไม่จำกัด (นัยยะ production = เดารหัสผ่านบัญชีเดียวได้ต่อเนื่อง)
- ❌ **ไม่พบ** สาย unauthenticated → admin (ไม่มี guard หาย, JWT  forged ถูกบล็อก, seed ไม่มีรหัส default)
- ❌ **ไม่พบ** SQLi/IDOR-to-write/mass assignment ในรอบนี้

## 5. การเยียวยาที่เสนอ (ไม่ได้แก้ในรอบนี้ — red team = ค้นหา+พิสูจน์, แก้ต้องรอคำสั่ง)

| Finding | ข้อเสนอ |
|---|---|
| RT-F001 | (1) ย้าย limiter ไป **หลัง** `validate` + key = `ip` + username ที่ normalize (trim+lowercase) หรือ key = ip อย่างเดียว (2) พิจารณา account-lock server-side ที่แยกจาก IP (3) ตรวจ double-key `ip|username` กับการ deploy หลาย instance (ยังเป็น in-memory — ข้อเสนอเดิม sprint14 F005) |
| RT-F002 | (1) ใส่ limiter กับ `/auth/change-password` (key = `ip|empId`, นับ 401 `INVALID_CREDENTIALS` เท่านั้น) (2) พิจารณา step-up (ยืนยันตัวตนซ้ำ) ก่อน password change (3) ลด token TTL / เพิ่มการเพิกถอนเมื่อสงสัย |
| RT-F003 | เพิ่ม audit สำหรับ endpoint อ่านข้อมูลอ่อนไหว (`/employees`, `/report/*`) หรือยอมรับโดยเขียนในเอกสารว่า audit = writes only |

## 6. หลักฐาน regression

- `backend/tests/sprint15.test.js` → **7 tests / 5 blocks**: RT-A (2: baseline + exploit) · RT-B (1: full chain) · RT-C (1: 16-endpoint battery) · RT-D (2: IDOR + forged token) · RT-E (1: detection)
- รันซ้ำ 4 ครั้ง — **7/7 ทุกครั้ง** (ไม่มี flake)
- Full suite: ดู handoff §Verification
- ⚠️ **test block RT-A/RT-B/RT-E ตั้งใจ assert ว่าช่องโหว่ยังอยู่** — ถ้ามีการแก้ตาม §5 แล้ว test เหล่านี้ fail = ความตั้งใจ (สัญญาณว่า remediation สำเร็จ ให้ลบ/สลับ assertion ตาม)

## 7. ข้อจำกัดที่ต้องพูดตรง ๆ (ห้ามอ้างเกิน)

- **ไม่มี Oracle จริง** — พฤติกรรม trailing-space ของ `WHERE username = :username` เป็น **static analysis** ตาม semantics มาตรฐานของ Oracle VARCHAR2 ไม่ได้วัดจริง · TX/rollback เป็น fake
- **precondition token-disclosure สำหรับ RT-B** — ไม่ใช่ unauthenticated takeover · ไม่ได้หาทางขโมย token ในรอบนี้ (นอก scope เครื่อง local)
- **wordlist ใน PoC = fixture** — ของจริงคือ dictionary อะไรก็ได้ (ไม่มี throttle จึงไม่จำกัดความยาว)
- **ผู้เขียน test = ผู้พัฒนาระบบ** — มีความลำเอียงโดยโครงสร้าง (รู้โค้ดล่วงหน้า) · ควรให้ external reviewer ยืนยัน · ไม่มี SAST/DAST เครื่องมือจริง ไม่มี fuzzing
- **red team tests ยืนยันช่องโหว่ = โดย design จะ fail เมื่อแก้** — อย่าตีความว่า regression พัง
- ไม่มี human review · ไม่ได้ commit/push · local pass ≠ certified
