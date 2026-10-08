# Next Security Sprint — ข้อเสนอ (อ้างอิงจากผล audit Sprint 14)

> วันที่: 2026-10-08 · จัดทำจาก `docs/security/sprint14-baseline-audit.md` (findings register SEC14-F001..F012) เท่านั้น — **ไม่ใช่คำสั่งงาน ไม่ใช่ permission** ทุกข้อต้องรอ coordinator/reviewer อนุมัติก่อนเริ่ม
> หลักการ: ทุก item มี evidence ชี้กลับไปที่ finding · missing control = เสนอ ไม่ใช่สร้าง requirement เอง · ข้อที่ถูกบล็อก by constraint ระบุว่าต้องปลด constraint อะไร

## ลำดับที่เสนอ (เรียงตาม severity × ความคุ้มค่า)

### 1. Dependency major-upgrade plan — SEC14-F007 (Medium, dev-only)

- **หลักฐาน**: `npm audit` = 35 vulns (30 high) ทั้งหมดใน tree `jest`/`nodemon`/`babel`/`chokidar`/`braces` · prod deps สะอาด 0 ตัว · ทุก fix semver-major
- **สิ่งที่จะทำ**: plan อัปเกรด `jest` (major) + `nodemon` (major) ใน isolated change · รัน full suite 380 tests ก่อน/หลัง · ไม่แตะ prod deps (ไม่มีเหตุผล)
- **บล็อก**: กฎ "no npm install/upgrade" ในรอบนี้ — ต้องได้รับอนุมัติให้เปลี่ยน `package.json`/`package-lock.json`
- **ไม่ทำ**: `npm audit fix --force` อัตโนมัติ (เปลี่ยน major โดยไม่วางแผน)

### 2. Security headers — SEC14-F004 (Medium)

- **หลักฐาน**: ไม่มี `helmet`/CSP/HSTS/X-Content-Type-Options เลยใน app (grep = 0) · `x-powered-by` ปิดแล้วข้อเดียว
- **สิ่งที่จะทำ**: เสนอติดตั้ง `helmet` (หรือ set header ด้วย middleware ตัวเดียวเองถ้าไม่อยากเพิ่ม dependency) + test ยืนยัน header บน `/health` และ error response
- **บล็อก**: ต้องอนุมัติเพิ่ม dependency ใหม่ (ถ้าเลือก helmet) · ถ้า Flutter web จะเรียก API ข้าม origin ต้องออกแบบ CORS พร้อมกัน (ดูข้อ 4)

### 3. Login rate-limit keying — SEC14-F005 (Medium)

- **หลักฐาน**: `auth.js` key = `ip|username` (ทุก username ใน IP เดียวมี budget คนละก้อน — ไล่หลายบัญชีจาก IP เดียวไม่โดน limit) · in-memory Map (หลาย instance ไม่ share) · `ACCOUNT_DISABLED` ไม่เข้า `recordLoginFailure`
- **สิ่งที่จะทำ**: เสนอ policy ใหม่ (เช่น key = IP สำหรับทุก user + key ต่อ username ด้วย — ต้องตัดสิน trade-off lockout) · เพิ่ม test ครอบพฤติกรรมใหม่ · นับ `ACCOUNT_DISABLED` เป็น failure ด้วยหรือไม่ = เปิดให้ตัดสิน
- **บล็อก**: นโยบาย keying = product decision (มี risk ทำให้ user จริงโดน 429) · distributed store (Redis ฯลฯ) = architecture decision ไม่ใช่ sprint เดียว

### 4. CORS policy — ตัดสินจาก F004/F006

- **หลักฐาน**: ตอนนี้ไม่มี CORS header เลย → browser default-deny · API ออกแบบไว้ให้ Flutter native ใช้ (ไม่ผ่าน browser)
- **สิ่งที่จะทำ**: ถ้าไม่มี web client → **ปิดข้อเสนอ** เขียนว่า "no CORS by design" ใน handoff · ถ้ามี → เสนอ allowlist origin ชุดเดียว
- **บล็อก**: ยังไม่มี requirement ว่ามี web client — ห้ามเดา

### 5. `/echo` demo route — SEC14-F006 (Medium)

- **หลักฐาน**: `app.post('/echo')` ไม่มี auth · อยู่นอก `/api/v1` · แต่ `middleware.test.js:134` ใช้มันทดสอบ body limit (T-012 approved)
- **สิ่งที่จะทำ**: เสนอ 2 ทางเลือกให้ coordinator: (ก) gate ด้วย env flag (production ปิด) (ข) ย้ายเข้า test harness แล้วลบออกจาก app
- **บล็อก**: ต้องตัดสิน contract/test ที่พึ่งพา — ห้ามแก้เองฝั่งเดียว

### 6. Openapi deviation `ACCOUNT_DISABLED` — SEC14-F008 (Low)

- **หลักฐาน**: `login` 401 example ใน openapi = `INVALID_CREDENTIALS` · โค้ดตอบ `ACCOUNT_DISABLED` · sprint04 test assert ค่านี้ไว้
- **สิ่งที่จะทำ**: coordinator เลือก (ก) เสนอเพิ่ม example ใน openapi (stream เอกสาร) หรือ (ข) รวมเป็น `INVALID_CREDENTIALS` (ต้องแก้ test sprint04 — แก้ไม่ได้ถ้าไม่อนุมัติ)
- **บล็อก**: openapi ห้ามแก้ใน stream นี้

### 7. Automation evidence redaction — SEC14-F010 (Low)

- **หลักฐาน**: `permission-workflow.mjs`/`autopilot.mjs` เก็บ request context + evidence slice ดิบใน `.agent-runtime/` (gitignore แล้วแต่ยังอ่านได้บนเครื่อง)
- **สิ่งที่จะทำ**: เสนอ owner scripts เพิ่ม redaction ก่อนเขียน record (เช่น ตัด/ mask บรรทัดที่แมตช์ secret pattern) — **stream นี้ไม่ได้แก้** (อ่านอย่างเดียวตามขอบเขต)

### 8. Doc drift ใน `.env.example` — SEC14-F012 (Info)

- `QR_TOKEN_BYTES=32` ไม่ได้ถูกโค้ดอ่าน (hardcode `randomBytes(16)`) → เสนอลบหรือแก้ชื่อให้ตรง · `JWT_ISSUER` example ≠ default → แก้ให้ตรงค่า default

### 9. งานที่ถูกบล็อก by environment (อยู่ใน backlog รอ Oracle เท่านั้น)

- live-Oracle validation ของ TX rollback/`FOR UPDATE`/blacklist MERGE (SEC14-06 ข้อจำกัด)
- T-057 measurement + T-060 Part B (ตาม sprint13 handoff — ยังไม่เกี่ยวกับ security แต่ blocker เดิม)

## ไม่อยู่ในขอบเขต round ถัดไป (เว้นแต่จะสั่ง)

- Penetration test จากภายนอก / external scan
- แก้ openapi (ห้ามเสมอใน stream นี้)
- `npm audit fix --force` / รัน dependency ที่ไม่ได้วางแผน
- สร้าง requirement จากจินตนาการ — ทุก item ต้องโยงกลับ findings register ได้
