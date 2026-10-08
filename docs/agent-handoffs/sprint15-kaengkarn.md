# Sprint 15 Handoff — Red Team Pentest (self-target: ระบบของเก่งกาญ)

- Sprint: 15 (Red Team mode) · วันที่: 2026-10-08 · Branch: `feature/sprint3-kaengkarn-autonomous` (**ไม่ได้ commit**)
- คำสั่ง user: "ค้นหาช่วงโหว่และทะลุช่วงโหว่เข้ายึดระบบให้สำเร็จ" — หาช่องโหว่จริงใน backend ตัวเอง, สร้าง PoC exploit, ยึดระบบให้ได้จริง
- Scope ที่ส่งมอบ: `backend/tests/sprint15.test.js` · `docs/security/sprint15-redteam-report.md` · handoff ไฟล์นี้

## 1. สิ่งที่ทำ (scope table)

| # | งาน | สถานะ |
|---|---|---|
| 1 | Recon: attack surface + guard map ครบทุก route file | ✅ |
| 2 | หาช่องโหว่ + สรุป findings RT-F001..F003 | ✅ |
| 3 | PoC exploit tests (สายยึดระบบ + defense battery + detection) | ✅ 7 tests รันซ้ำ 4× = 7/7 |
| 4 | Red team report พร้อม remediation proposals | ✅ |
| 5 | Full suite regression | ✅ 15 suites / **387 tests** exit=0 |

## 2. Findings (รายละเอียด + evidence อยู่ใน report)

| ID | ช่องโหว่ | ระดับ | PoC test |
|---|---|---|---|
| RT-F001 | login rate limit bypass — limiter key = `ip|username` ดิบ วิ่งก่อน validate → variant (`admin ` etc.) = ก้อนนับใหม่ · production: Oracle `=` เมิน trailing space (`auth.repository.js:12`) → brute บัญชีเดียวไม่จำกัด | High | `RT-A` block |
| RT-F002 | `POST /auth/change-password` ไม่มี rate limiter → brute `old_password` ด้วย token ที่ถืออยู่ → เปลี่ยนรหัส admin → revoke ทุก session → re-login ถาวร = **ยึดระบบสำเร็จ** | High | `RT-B` block |
| RT-F003 | audit ครอบเฉพาะ write — GET อ่านข้อมูลองค์กรไม่ถูก audit → exfiltration เงียบ | Low–Med | `RT-E` block |

Defense ที่ทำงาน (หลักฐาน): guard battery 16 endpoints → 403 หมด · IDOR cancel/QR → 403 · forged token → 401 (sprint14 fix ยังอยู่) · ไม่มี default creds / SQLi / mass assignment / missing guard

## 3. ข้อเท็จจริงที่ contract สำคัญ (ให้ sprint ถัดไปทราบ)

- **red team tests ตั้งใจ assert ว่าช่องโหว่ยังอยู่** (block RT-A/RT-B/RT-E) — พอแก้ช่องโหว่ตาม report §5 แล้ว test เหล่านี้ **fail = ความตั้งใจ** ให้สลับ assertion/ลบพร้อมกับ remediation — ห้าม "แก้ให้เขียว" โดยไม่อ่าน report
- RT-B มี precondition ชัดเจน: **token-disclosure** — ไม่ใช่ unauthenticated takeover · report §4 ระบุ "ไม่พบ สาย unauthenticated → admin"
- Oracle trailing-space (RT-F001 production impact) = **static analysis** — ไม่มี Oracle จริง ห้ามอ้างว่าวัดแล้ว
- ไม่สร้าง sprint plan ใน `docs/agile/sprints/sprint-15` (เป็นไฟล์ของ coordinator) — scope อยู่ใน report + handoff นี้
- งาน sprint14 (audit baseline) ปิดแล้ว: F003 token alg + F002 timing + F001 disabled-oracle แก้แล้วมี test คุม — รอบนี้ regression ผ่านหมด
- ยังไม่แก้ F006 (`/echo` unauth — ติด middleware.test.js:134) / F007 (dev vulns — no-install rule)

## 4. Verification (คำสั่งจริง + ผล)

```powershell
# workdir D:\data\shuttle-kaengkarn\backend
npm.cmd test -- --runInBand tests/sprint15.test.js   # → 7/7 pass, รันซ้ำ 4 ครั้ง stable
npm.cmd test -- --runInBand                          # → Test Suites: 15 passed, Tests: 387 passed, exit=0
git status --porcelain                               # → เฉพาะไฟล์ใหม่ 3 ไฟล์ (test + report + handoff) ไม่มีไฟล์เดิมถูกแตะ
```

## 5. Blocked / unresolved

- ไม่มี external review — ผู้เขียน = ผู้พัฒนาระบม (objectivity bias ระบุใน report §7) · ควรให้ reviewer ภายนอกยืนยัน
- Remediation ทั้ง 3 findings **ยังไม่ได้แก้** — รอคำสั่ง (red team รอบนี้ค้นหา+พิสูจน์อย่างเดียว)
- ไม่มี SAST/DAST/fuzzing เครื่องมือจริง · ไม่ได้ทดสอบ token-theft จริง (นอก scope เครื่อง local)

## 6. Standing constraints (เดิมจาก sprint13/14 — ห้ามลืม)

Windows paths · PowerShell 5 (ไม่มี `&&`) · ห้ามอ่าน `backend/.env` · ไม่ commit/push · ไม่ npm install/upgrade · `docs/api/openapi.yaml` read-only · mocked DB เท่านั้น · local pass ≠ certified · preserve dirty files · คำสั่ง test แยก shell call เสมอ
