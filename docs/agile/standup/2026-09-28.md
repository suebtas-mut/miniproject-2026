# Stand-up — วันที่ 2026-09-28 (Sprint 0)

| สมาชิก | เมื่อวานทำอะไร | วันนี้จะทำอะไร | ติดอะไร |
|---|---|---|---|
| **นายเก่งกาญ เชี่ยวชาญ** | *(วันแรก — ไม่มีงานวานนี้)* · เตรียมเครื่องมือ | **T-001** Git Repo + โครงสร้างโปรเจกต์ + `.gitignore` + ติดตั้ง Oracle XE (3 ชม.) · **T-004** Use Case Diagram + Spec ร่วมกับสุขสรร (5 ชม. คนละครึ่ง) | ⛔ **Q14**: Requirement ระบุ Oracle 19c แต่ image ที่ติดตั้งได้คือ **21c XE** — ต้องรออาจารย์ยืนยัน |
| **นางสาวสุขสรร มาณีศรี** | *(วันแรก)* · ติดตั้งเครื่องมือฝั่ง Client | **T-002** Android Studio + Flutter SDK + ทดสอบ Emulator (3 ชม.) · **T-003** ตั้ง ClickUp Workspace/Project/List (1 ชม.) · **T-004** ร่วมกับเก่งกาญ (2.5 ชม.) | — |
| `@agent-coder` | — | ช่วยสร้าง `.gitignore` + โครงสร้างโปรเจกต์ + Docker Compose Oracle | — |
| `@agent-architect` | — | แปลง Requirement → 30 Use Case + 12 Business Rules + Traceability | — |

---

**Blocker**
- ⛔ **Q14 (Oracle 19c vs 21c XE)** — ติดตั้งเป็น **21c XE** เพราะ image `oracle-xe:19-slim` ใช้ไม่ได้กับสภาพแวดล้อมนี้
  → ต้องถามอาจารย์ก่อนเขียน `01_schema.sql` ใน Sprint 1 (T-007) · **เตรียม DDL ให้รันได้ทั้งสองเวอร์ชันไว้เป็นทางเลือก**
- 🔐 **Security**: `.env.example` มีรหัสผ่าน DEV ที่ตรงกับ `.env` จริง 100% และถูก commit แล้ว
  → ต้องเปลี่ยนรหัสผ่าน + อัปเดตไฟล์ตัวอย่าง **ก่อน Push** (ตารางศัพท์ข้อ 5.9 ระบุว่า ⛔ ห้ามใส่ DB Password ใน Git)
  → ฐานข้อมูลยังว่าง (0 ตาราง) จึงรีเซ็ตด้วย `docker compose down -v` ได้อย่างปลอดภัย
- ⬜ **Q11**: ไม่มี Web แล้ว หน้าจอ Admin/Staff เป็น Flutter ทั้งหมด — ยืนยันกับอาจารย์ (กระทบขนาดงาน UI)

**AI Sync 14:00**
- หัวข้อที่ถ่ายทอดความรู้ = **ทำไม Oracle ต้องใช้ PDB (XEPDB1) แทน SID** และ **ทำไมต้องใช้ `FOR UPDATE NOWAIT` ในระบบจอง**
  → เก่งกาญอธิบายฝั่ง Oracle/Transaction · สุขสรรถามเรื่องการแสดงผลฝั่ง Flutter (15 นาที, AR-10)

**Sprint Goal วันนี้**: *เครื่องมือพร้อม (Oracle + Flutter) + Requirement เป็นรูปธรรม* · **ต้องเสร็จภายในวันนี้** เพราะ Sprint 1 (อังคาร) ต้องเริ่มเขียน Schema และ ER Diagram ต่อทันที

---

## เวลาที่ใช้จริง (Time Log)

| Task | งาน | Owner | ประมาณการ | ใช้จริง | AI ช่วย | สถานะ |
|---|---|---|---|---|---|---|
| T-001 | Git Repo + โครงสร้าง + `.gitignore` + Oracle XE | เก่งกาญ | 3.0 | 3.0 | `@agent-coder` | ✅ Done |
| T-002 | Android Studio + Flutter SDK + Emulator | สุขสรร | 3.0 | — | — | 🔄 ตามรอบตัวเอง |
| T-003 | ClickUp Workspace/Project/List | สุขสรร | 1.0 | — | — | 🔄 ตามรอบตัวเอง |
| T-004 | Use Case Diagram + Use Case Spec | ทั้งคู่ | 5.0 | — | `@agent-architect` | 🔄 In Progress |
| | | | **12.0** | | | |

---

## Definition of Done ของ Sprint 0 (เช็กตอน 18:00)

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | `git log` มี ≥ 1 commit | ✅ `7e0bd05` (T-001) |
| 2 | Oracle เชื่อมต่อได้ | ✅ `SHUTTLE_APP@//localhost/XEPDB1` · `user_tables = 0` |
| 3 | Emulator เปิดแอปว่างได้ | ⏳ รอสุขสรรยืนยัน |
| 4 | ClickUp มี Backlog ครบ | ⏳ รอสุขสรรยืนยัน |
| 5 | Stand-up ไฟล์แรกถูกสร้าง | ✅ ไฟล์นี้ |
| 6 | Use Case Diagram เป็นรูปธรรม (T-004) | ✅ `.puml` + `.md` · รอ Code Review |
| 7 | Prompt ถูกบันทึก (AR-06) | ✅ `docs/ai-prompts/2026-09-28-sprint-00-P-01-...md` |

---

## ผลลัพธ์ที่ได้วันนี้

| รายการ | ผลลัพธ์ | สถานะ |
|---|---|---|
| โครงสร้างโปรเจกต์ | โฟลเดอร์ครบตามข้อ 17.0 (`backend/`, `app/`, `docs/`, `sql/`, `tests/`, `design/`, `mockups/`) | ✅ |
| Oracle XE | Container `shuttle-oracle-xe` สถานะ `healthy` · port 1521 · version 21.3.0.0.0 | ✅ |
| Use Case | **30 Use Case** · 4 Actors · 12 Business Rules (BR-01…BR-12) | ✅ รอรีวิว |
| เอกสาร Agile | Stand-up (ไฟล์นี้) · Retro Sprint 0 · Prompt Log | ✅ |
