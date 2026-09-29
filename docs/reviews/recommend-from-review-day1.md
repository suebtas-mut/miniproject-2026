# 📋 รีวิวและการประเมินผลการดำเนินงาน — วันที่ 1 (Sprint 0)

> **วันดำเนินการ:** เจอวันแรก (Sprint 0 — Foundation)  
> **ทีมงาน:** นายเก่งกาญ เชี่ยวชาญ + นางสาวสุขสรร มาณีศรี  
> **คะแนน Agile:** เริ่มที่ 0 (ปิดคะแนนจาก T-001...T-004)  
> **เอกสารอ้างอิง:** บทที่ 17, 18 / Requirement Review Checklist

---

## ✅ ส่วนที่ 1: ผลการดำเนินงาน Sprint 0

### 🎯 Sprint 0 Goal (จันทร์ที่ 1)
**"ทั้ง 2 คนมีเครื่องมือพร้อม และมีโครงสร้างเก็บงานเรียบร้อย"**

### 📊 ตารางสถานะงาน Sprint 0

| Task ID | ชื่องาน | Owner | สถานะ | หมายเหตุ | เวลาที่ใช้จริง |
|---|---|---|---|---|---|
| **T-001** | Git Repo + โครงสร้าง + `.gitignore` + ติดตั้ง Oracle XE 19c | นายเก่งกาญ | ✅ ทำเสร็จ | Branch `kaengkarn` มี commit ครบ | 3.5 ชม. |
| **T-002** | ติดตั้ง Android Studio + Flutter SDK + ทดสอบ Emulator | นางสาวสุขสรร | ◐ ทำเกือบเสร็จ | `flutter doctor` ผ่าน · Emulator boot ได้ · **ยังไม่ได้ `flutter run`** (ยังไม่มี `pubspec.yaml`) | 3 ชม. |
| **T-003** | ตั้ง ClickUp: Workspace/Project/List/Sprint | นางสาวสุขสรร | ✅ ทำเสร็จ | Task 62 รายการเข้า ClickUp แล้ว | 1.5 ชม. |
| **T-004** | Requirement → Use Case Diagram + Use Case Spec | ทั้งคู่ | ✅ ทำเสร็จ | `docs/diagrams/usecase/` 7 ไฟล์ · UC-01…UC-30 ครบ · นับ link ได้ Admin 21 / Staff 14 / Driver 8 / Customer 8 | 5 ชม. |
| **T-005** | ER Diagram 3 ระดับ + Mapping | นางสาวสุขสรร | ✅ ทำเสร็จ *(ทำล่วงหน้า ย้ายจาก Sprint 1)* | `docs/diagrams/er/` · Conceptual 13 entity · Logical/Physical 20 ตาราง / 102 คอลัมน์ · 18 UK / 12 CHECK | 4 ชม. |
| **T-006** | Data Dictionary | นางสาวสุขสรร | ✅ ทำเสร็จ *(ทำล่วงหน้า ย้ายจาก Sprint 1)* | `docs/report/chapter-08-data-dictionary.md` · `COMMENT ON` 122 รายการ (20 TABLE + 102 COLUMN) | 2 ชม. |

> ⚠️ **ฉบับนี้ปรับปรุงเมื่อ 2026-09-29** หลังตรวจสถานะจริงใน Git
> รอบแรกของเอกสารนี้เขียนว่า T-004 อยู่ระหว่าง และ T-005/T-006 ยังไม่เริ่ม (รอวันอังคารเย็น)
> แต่เมื่อตรวจ `git diff main..sukhsorn` จริง พบว่า **ทั้งสามงานอยู่ใน branch `sukhsorn` เสร็จเรียบร้อยแล้ว** จึงแก้สถานะให้ตรงกับความจริง
> ผลกระทบ: **Sprint 1 เหลืองานเดียวคือ T-007 ของนายเก่งกาญ** (ดูส่วนที่ 7)

#### ✅ Definition of Done (Sprint 0)

| เกณฑ์ | ผลลัพธ์ |
|---|---|
| `git log` มี ≥ 1 commit ที่ clean | ✅ 12 commits · merge `kaengkarn` + `sukhsorn` เข้า `main` แล้ว · สร้าง `develop` แล้ว |
| Oracle XE 19c เชื่อมต่อได้ | ✅ `sqlplus shuttle_app/password@localhost:1521/XEPDB1` สำเร็จ |
| ⚠️ `flutter run` ได้บน Emulator | ◐ **ยังไม่ผ่าน** — `flutter doctor` ผ่าน และ Emulator boot ได้ แต่ยังไม่ได้สั่ง `flutter run` เพราะยังไม่มี `pubspec.yaml` → ยังพิสูจน์ไม่ได้ว่าแอปรันบน Android จริง |
| ClickUp มี Backlog ครบ 62 Task | ✅ ป้อน Task ทั้งหมด พร้อมกำหนดการ Sprint |
| ไม่มี Secret ใน Git | ✅ `.gitignore` รวม 2 ฝั่งเป็น union แล้ว · นายเก่งกาญ purge รหัสผ่าน Oracle ออกจาก history (`48af4a2`) |

---

## 📋 ส่วนที่ 2: จุดที่ดี + ที่ต้องปรับปรุง

### 👍 จุดที่ทำได้ดี

| # | จุด | เหตุผล |
|---|---|---|
| 1 | **เครื่องมือติดตั้งถูกต้อง** | Oracle 19c เชื่อมต่อได้, Emulator ทำงาน, Git branch แยกชัดเจน |
| 2 | **ทีมใช้ Branch ชื่อตามคน** | `kaengkarn` (Backend) + `sukhsorn` (Flutter) ทำให้ track ได้ชัดเจน |
| 3 | **Task บน ClickUp ครบครัน** | Sprint 0–13 มี Task 62 รายการ พร้อมลำดับความสำคัญ |
| 4 | **เตรียมเอกสารให้ครบ** | บทที่ 17–18 เป็นแบบ + ER/Mockup Checklist ไว้แล้ว |

### ⚠️ จุดที่ต้องปรับปรุง / ความเสี่ยง

| # | ประเด็น | ผลกระทบ | สถาน | แนวทางแก้ไข |
|---|---|---|---|---|
| 1 | ~~**T-004 ยังไม่เสร็จ (Use Case Diagram)**~~ | ~~ท่าทางจะ delay เข้า Sprint 1~~ | ✅ **แก้แล้ว** | ปิด 2026-09-29 — UC-01…UC-30 ครบใน `docs/diagrams/usecase/` และ merge เข้า `develop` แล้ว ไม่กระทบ Sprint 1 |
| 2 | **Daily Stand-up Log** | ไม่มีหลักฐาน Agile + ไม่คิด Story Point | 🟡 Medium | ✅ มีวันที่ 1 แล้ว (`2026-09-28-*.md`) · ตั้งแต่วันที่ 2 **บังคับต้องมี** `docs/agile/standup/YYYY-MM-DD.md` ทุกวัน · **ต้องครบ 14 ไฟล์** ก่อนส่งงาน |
| 3 | **Sprint Retrospective** | ไม่มี "บันทึกการเรียนรู้" + ไม่ปรับปรุง Prompt | 🟡 Medium | ✅ Sprint 0 มีแล้ว (`retro-sprint-0-doc.md` + `sprint-00.md`) · ต้องมี `sprint-01.md`…`sprint-13.md` รวม **14 ไฟล์** ก่อนส่งงาน |
| 4 | **ไม่ครบ Prompt Library** | ตอนใช้ AI ต้องกลับหา Prompt เดิม (AR-06) | 🟡 Medium | มีแล้ว 2 ไฟล์ (`docs/ai-prompts/2026-09-28-sprint-00-P-01-*.md` + `docs/agile/ai-prompts/prompt-log.md`) แต่ยังไม่ครบ P-01…P-12 → ให้สร้างต่อก่อน Sprint 2 |
| 5 | ~~**ยังไม่มี AI Usage Credit / Prompt Log**~~ | ~~เสียคะแนนเอกสารการใช้ AI (AR-04)~~ | ✅ **แก้แล้ว** | ปิด 2026-09-29 — `docs/ai-credit-log.md` (7 รายการ Sprint 0 + บันทึกกรณี AI ตอบผิดตาม AR-07) · ต้องบันทึกต่อทุก Sprint และรวมเป็นภาคผนวก ค ตอน T-061 |
| 6 | **ชื่อผู้ commit ไม่แยกกัน** | หลักฐาน AR-02 (peer review) ดูเหมือนคนคนเดียวทำงานทั้งหมด | 🔴 High | ⚠️ **พบตอนตรวจ 2026-09-29** — commit ทั้ง 2 branch เดิมใช้ author เดียวกัน `suebtas-mut` · แก้แล้วสำหรับ commit ใหม่ของสุขสรร (`Sukhsorn Maneesri`) · **นายเก่งกาญต้องตั้ง `git config user.name/email` ของตัวเองด้วย** · commit เก่าที่แก้ย้อนหลังไม่ได้ ต้องรับทราบ |

---

## ✅ ส่วนที่ 3: แนวทางการ Merge Branch เข้า main *(ปิดแล้ว 2026-09-29)*

### 📌 Strategy: Git Flow แบบปรับตัว

**Branches ปัจจุบัน (หลังปิด Sprint 0):**
```
main (db0a513)      ← release branch · มี merge ครบทั้ง 2 ฝั่ง
└─ develop (db0a513) ← integration branch · base สำหรับ Sprint 1
   ├─ kaengkarn (afc144b)  [Backend + Oracle]
   └─ sukhsorn (66d434a)   [Flutter + Docs + AI Credit]
```

**สิ่งที่ทำไปแล้ว (ตรวจจาก `git log --graph` เมื่อ 2026-09-29):**

| ขั้นตอน | ผลลัพธ์จริง | สถานะ |
|---|---|---|
| 1 · Merge `kaengkarn` → `main` | commit `7beb27b` | ✅ |
| 2 · Merge `sukhsorn` → `main` | commit `7b8da7c` | ✅ |
| 3 · แก้ conflict `.gitignore` | ได้ **union ของทั้งสองฝั่ง** — เก็บ `!.vscode/settings.json` + `!.vscode/settings.json.example` + กฎ secret ครบ (AR-03) | ✅ |
| 4 · สร้าง `develop` | commit `db0a513` · push แล้ว | ✅ |
| 5 · Merge `sukhsorn` (รอบที่ 2) | commit `db0a513` — นำ `docs/ai-credit-log.md` + `session-*.md` เข้า `main` | ✅ |
| 6 · เริ่มงานบน `develop` | สร้าง feature branch `docs/day2-sukhsorn` จาก `develop` | ✅ |

> ⚠️ **หมายเหตุสำคัญเรื่อง worktree**
> มี 3 worktree ในเครื่องนี้ และ `develop` ถูก checkout อยู่ที่ `D:/data/miniproject`
> → **checkout `develop` ใน worktree นี้ไม่ได้** ต้องสร้าง feature branch จาก `origin/develop` แทน
> รายชื่อ worktree: `D:/data/shuttle-sukhsorn` (สุขสรร) · `D:/data/shuttle-kaengkarn` (เก่งกาญ) · `D:/data/miniproject` (เก่งกาญ · `develop`)

### 📖 ขั้นตอนการ Merge (บันทึกไว้เผื่อต้องทำซ้ำ)

#### ขั้นที่ 1: Merge Branch `kaengkarn` เข้า `main`

```bash
# 1️⃣ ตรวจสอบ commit ใน branch kaengkarn
git checkout kaengkarn
git log --oneline | head -10
# ต้องเห็น commit เกี่ยวกับ T-001 (Git + Oracle Setup)

# 2️⃣ ตรวจสอบว่าไม่มี Conflict
git checkout main
git merge --no-ff kaengkarn --no-edit

# 3️⃣ ถ้าไม่มี error → push
git push origin main
```

**Acceptance Criteria:**
- ✅ ไม่มี Conflict
- ✅ Oracle XE Directory ยังอยู่ (Oracle ติดตั้งเสร็จแล้ว)
- ✅ Git history เรียบร้อย (มี merge commit)

---

#### ขั้นที่ 2: Merge Branch `sukhsorn` เข้า `main`

```bash
# 1️⃣ ตรวจสอบ commit ใน branch sukhsorn
git checkout sukhsorn
git log --oneline | head -10
# ต้องเห็น commit เกี่ยวกับ T-002, T-003 (Flutter + ClickUp)

# 2️⃣ Pull latest main ก่อน
git checkout main
git pull origin main

# 3️⃣ Merge
git merge --no-ff sukhsorn --no-edit

# 4️⃣ ถ้า Conflict → แก้ไข (ควรไม่มี conflict)
# กรณี conflict: ให้ sukhsorn + kaengkarn นั่งแก้ด้วยกัน

# 5️⃣ Push
git push origin main
```

**Acceptance Criteria:**
- ✅ ไม่มี Conflict (หรือแก้ไขแล้ว)
- ✅ `docs/` มี ClickUp planning ครบ
- ✅ `.gitignore` ครอบคลุม Flutter + Backend

---

#### ขั้นที่ 3: สร้าง Branch `develop` เพื่อทำงานรวม

```bash
# 1️⃣ ตรวจสอบ main ที่ merge แล้ว
git checkout main
git log --oneline | head -5
# ต้องเห็น merge commits

# 2️⃣ สร้าง branch develop (ใช้ต่อไปเป็น base)
git checkout -b develop
git push -u origin develop

# 3️⃣ ทั้ง kaengkarn + sukhsorn ใช้ develop เป็น base ต่อไป
# (ไม่ใช้ main โดยตรง)

git config --global checkout.defaultRemote origin
git checkout develop
```

**ทำไมต้อง develop?**
- `main` = release branch (ต้อง stable)
- `develop` = integration branch (รวมงานทั้ง 2 คน)
- feature branch = `feature/T-005`, `feature/T-006`, etc.

---

### 🎯 สรุปแนวทาง Merge

| ขั้นตอน | คำสั่ง | ผลลัพธ์ที่คาดหวัง |
|---|---|---|
| 1 | `git merge --no-ff kaengkarn` | ✅ Backend ปกติ + Oracle Ready |
| 2 | `git merge --no-ff sukhsorn` | ✅ Flutter Ready + ClickUp Done |
| 3 | `git checkout -b develop` | ✅ Branch develop ทำหน้าที่ Integration |

**หลังจากนั้น:**
- ✅ `main` มี commit จาก Sprint 0 พร้อมแล้ว
- ✅ `develop` พร้อมเป็น base สำหรับ Sprint 1 (T-005, T-006, T-007)
- ✅ ทั้ง kaengkarn + sukhsorn ใช้ `feature/*` branches สำหรับงาน ต่อไป

---

## 🚀 ส่วนที่ 4: Checklist ก่อนปิด Sprint 0 + เริ่ม Sprint 1

### ✅ ก่อนใช้ git merge

- [ ] ทั้งคู่ commit งานสรุปใน branch ของตัวเอง
- [ ] ไม่มี uncommitted changes (`git status` ต้อง clean)
- [ ] ตรวจสอบ `.gitignore` ครอบคลุม (Node modules, Flutter build, Oracle password)
- [ ] ไม่มี API Key / DB Password ใน commit

### ✅ หลังจาก merge เข้า main

- [ ] Merge ตัวแรก → ทดสอบ Oracle เชื่อมต่อได้
- [ ] Merge ตัวที่สอง → ทดสอบ Flutter Emulator เปิดได้
- [ ] ไม่มี Breaking Changes
- [ ] `git log --oneline` เห็น merge commits ชัดเจน

### ✅ สร้าง branch develop

- [ ] `develop` branch มาจาก main ที่ merge แล้ว
- [ ] ทั้ง kaengkarn + sukhsorn อ่าน branch develop สำเร็จ
- [ ] ลบ kaengkarn/sukhsorn branches เก่า (ทำความสะอาด)

```bash
# ลบ local branches
git branch -d kaengkarn sukhsorn

# ลบ remote branches (ทั้ง 2 คนต้อง sync)
git push origin --delete kaengkarn sukhsorn
```

---

## 📝 ส่วนที่ 5: งานที่ต้องทำก่อน Sprint 2

### ✅ High Priority — **ปิดครบทั้งหมดแล้ว 2026-09-29**

| # | งาน | Owner | เวลาจริง | ผลลัพธ์จริง |
|---|---|---|---|---|
| 1 | **สรุป T-004 (Use Case Diagram)** | ทั้งคู่ | ~5 ชม. | ✅ `docs/diagrams/usecase/` 7 ไฟล์ · UC-01…UC-30 ครบ |
| 2 | **Merge branch เข้า main** | ทั้งคู่ | ~0.5 ชม. | ✅ `7beb27b` + `7b8da7c` + `db0a513` |
| 3 | **สร้าง develop branch** | kaengkarn | ~0.5 ชม. | ✅ `develop` @ `db0a513` push แล้ว |
| 4 | **Daily Stand-up Log วันที่ 1** | ทั้งคู่ | ~0.5 ชม. | ✅ `2026-09-28.md` (เก่งกาญ) + `2026-09-28-sukhsorn.md` |
| 5 | **Sprint 0 Retrospective** | ทั้งคู่ | ~1 ชม. | ✅ `retro-sprint-0-doc.md` + `sprint-00.md` |
| 6 | **ตั้ง git identity แยกคน** *(เพิ่มที่พบตอนตรวจ)* | ทั้งคู่ | 0.2 ชม. | ◐ สุขสรรตั้งแล้ว · **รอนายเก่งกาญตั้งของตัวเอง** |

### 🟡 Medium Priority

| # | งาน | Owner | เวลา | Sprint ที่ใช้ | สถานะ |
|---|---|---|---|---|---|
| 1 | **สร้าง Prompt Library** (P-01…P-12) | kaengkarn | 2 ชม. | Sprint 1 | ◐ มี P-01 แล้ว · ขาด P-02…P-12 |
| 2 | **เตรียม AI Credit Log** | sukhsorn | 1 ชม. | บันทึกตั้งแต่ Sprint 0 | ✅ `docs/ai-credit-log.md` |
| 3 | **ตรวจสอบ Requirement Checklist** | ทั้งคู่ | 1 ชม. | Sprint 1 | ◐ ปิด A4 / A7 / A11 แล้ว · เหลือ 8 ข้อ |
| 4 | **แก้ชื่อผู้ commit ใน history เก่า** | ทั้งคู่ | — | — | ⛔ **ทำไม่ได้** — repo สาธารณะ + commit push แล้ว · ต้องรับทราบว่า AR-02 จะเห็น author เดียวในส่วนของ Sprint 0 |

---

## 📊 ส่วนที่ 6: ข้อสังเกตุและคำแนะนำ

### 🎯 Performance Sprint 0

| สมาชิก | Task | เวลาประมาณ | เวลาจริง | ผลต่าง | หมายเหตุ |
|---|---|---|---|---|---|
| นายเก่งกาญ | T-001 | 3 ชม. | 3.5 ชม. | +0.5 | Oracle ติดตั้ง delay 30 นาที |
| นางสาวสุขสรร | T-002, T-003 | 4 ชม. | 4.5 ชม. | +0.5 | Emulator setup นานกว่าคิด |
| ทั้งคู่ | T-004 | 5 ชม. | 2/5 | -3 ต่อวัน | ต้องดำเนินการต่อ Sprint 1/2 |

**ผลสรุป:** ⚠️ **แผนค่อนข้างตึง** เนื่องจาก Sprint 0 ใช้เวลาจริง 12.5 ชม. เกินแผน 0.5 ชม.  
→ ต้องติดตามให้ Sprint 1 ไม่ทำให้ delay ต่อไป

### ✅ Positive Observations

1. **ทีมทำงานจริงและมี Output**  
   → ไม่แค่ติดตั้งเครื่องมือ แต่ branch/commit ก็ทำแล้ว

2. **AI ยังไม่ใช้มาก**  
   → Sprint 0 ส่วนใหญ่เป็นการตั้งค่า ซึ่งถูกต้อง

3. **Document ครบตั้งแต่ผ่านแล้ว**  
   → บทที่ 17-18 มีรายละเอียด เอกสาร 62 Task ครบ

### ⚠️ Risk Alerts

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| T-004 delay → T-005 block | 🟡 Medium | 🔴 High | ต่างคนต่างทำตาม: sukhsorn ร่าง ER, kaengkarn ร่าง Use Case แยก |
| Branch `kaengkarn`/`sukhsorn` merge มี conflict | 🟡 Low | 🟡 Medium | ทดสอบ merge ด้วย `git merge --no-ff --dry-run` ก่อน |
| Oracle XE วันที่ 2 มีปัญหา | 🟡 Low | 🔴 High | เตรียม Oracle restore script ไว้ |
| ClickUp Task ไม่ sync กับ code | 🟡 Medium | 🟡 Medium | วันทำงาน 2 ต้อง update ClickUp ตามจริง every standup |

---

## 🎯 ส่วนที่ 7: Sprint 1 — ความพร้อม

### ✅ เงื่อนไขการเข้า Sprint 1 — **ผ่านครบทุกข้อแล้ว**

| เงื่อนไข | สถานะ | หมายเหตุ |
|---|---|---|
| T-004 (Use Case) สิ้นสุด | ✅ **ผ่าน** | UC-01…UC-30 ครบ · merge เข้า `develop` แล้ว |
| Branch merge เข้า main | ✅ **ผ่าน** | `db0a513` · มี merge commit ครบ 3 จุด |
| Develop branch สร้างเสร็จ | ✅ **ผ่าน** | `develop` @ `db0a513` |
| Daily Stand-up วันที่ 1 บันทึกไว้ | ✅ **ผ่าน** | `2026-09-28.md` + `2026-09-28-sukhsorn.md` |
| Sprint 0 Retrospective | ✅ **ผ่าน** | `retro-sprint-0-doc.md` + `sprint-00.md` |
| ⚠️ `flutter run` บน Emulator | ◐ **ยังไม่ผ่าน** | ยังไม่มี `pubspec.yaml` — ต้องทำให้เสร็จก่อน Sprint 3 (เริ่มเขียนแอป) |

### 🚀 Sprint 1 เป้าหมาย — **ปรับแล้ว 2026-09-29**

| Task | Owner | คะแนน | เดิม | สถานะจริง |
|---|---|---|---|---|
| **T-005** ER Diagram 3 ระดับ + Mapping | sukhsorn | 10 คะแนน | Sprint 1 วันอังคารเย็น | ✅ **ทำเสร็จแล้วใน Sprint 0** — ย้ายเข้า Sprint 0 |
| **T-006** Data Dictionary | sukhsorn | (รองรับ 10 คะแนน) | Sprint 1 วันอังคารเย็น | ✅ **ทำเสร็จแล้วใน Sprint 0** — ย้ายเข้า Sprint 0 |
| **T-007** `01_schema.sql` | kaengkarn | (รองรับ 10 คะแนน) | Sprint 1 วันอังคารเย็น | ⏳ **งานเดียวที่เหลือใน Sprint 1** — รันบน Oracle 19c ผ่าน 0 error |

**คะแนนที่ปิดแล้ว:** ✅ **10 คะแนน (ER + Mapping)** — ปิดล่วงหน้าใน Sprint 0
**คะแนนที่จะปิดใน Sprint 1:** T-007 รองรับคะแนนเดียวกัน แต่ต้องรอให้ ER เป็นข้อมูลอ้างอิง → **คะแนน ER ปิดได้เลยตอนนี้**

> 🔎 **ข้อสังเกตสำคัญ:** เอกสารรีวิวรอบแรกวาง T-005/T-006 ไว้ใน Sprint 1 แต่สุขสรรทำเสร็จไปแล้วใน Sprint 0
> → การวางแผนล่วงหน้าได้ผลดี แต่ **ตารางนี้ต้องอัปเดตทุกครั้งที่ตรวจสถานะจริงใน Git** ไม่ใช่อิงแผนที่ตั้งใจไว้
> **Sprint 1 ที่เหลือ: T-007 ฝั่งนายเก่งกาญ 1 งาน** ส่วนสุขสรรควรเริ่มเตรียม Prompt Library เพื่อรองรับ Sprint 2

---

## 📄 ส่วนที่ 8: สรุปการประเมิน

### ✅ Overall Assessment: **PASS (ยังอยู่ตามแผน)**

| ประเมิน | ผล | ระดับ |
|---|---|---|
| **Infrastructure Ready** | Git + Oracle + Flutter ทำงาน | ✅ A |
| **Planning** | Task 62 รายการ ลง ClickUp | ✅ A |
| **Documentation** | บทที่ 1-18 พร้อม ER/Mockup Checklist | ✅ A |
| **Team Collaboration** | Branch แยกชัดเจน + Review ready | ✅ A |
| **Agile Practice** | Stand-up + Retro มีแล้ว · ต้องทำต่อเนื่อง 14 วัน | 🟡 B |
| **AI Integration** | เริ่มใช้จริงแล้ว · มี Prompt Log + AI Credit Log | ✅ A |

**Overall:** ✅ **ปิด Sprint 0 ได้สำเร็จ** — และ**ทำได้มากกว่าแผน** เพราะ T-005/T-006 เสร็จล่วงหน้า

---

## 🎯 Action Items — **อัปเดตสถานะ 2026-09-29**

### ✅ Urgent (เดิม: วันนี้ก่อนเลิก) — **ปิดครบ**

- [x] ทั้งคู่ commit T-004 Use Case Diagram สรุปให้เสร็จ
- [x] git merge branch เข้า main (ตามขั้นตอน 18.9)
- [x] สร้าง branch develop
- [x] บันทึก Stand-up Log วันที่ 1
- [x] สรุป Sprint 0 Retrospective
- [x] **เพิ่ม:** ตั้ง `git config user.name/email` แยกคน (สุขสรรเสร็จ · รอนายเก่งกาญ)
- [x] **เพิ่ม:** สร้าง `docs/ai-credit-log.md` (A11)
- [x] **เพิ่ม:** อัปเดตเอกสารรีวิวนี้ให้ตรงกับสถานะจริงใน Git

### 🟡 Recommended (ก่อน Sprint 1)

- [ ] kaengkarn เตรียม Prompt P-02 ~ P-12 ไว้ใน `docs/ai-prompts/` (มี P-01 แล้ว)
- [x] sukhsorn เตรียม `docs/ai-credit-log.md` สำหรับบันทึก AI ที่ใช้
- [ ] **นายเก่งกาญ:** ตั้ง `git config user.name` / `user.email` ของตัวเอง — **สำคัญมากต่อ AR-02**
- [ ] ทั้งคู่ตรวจสอบ Requirement Checklist ที่เหลือ A1, A2, A3, A5, A6, A8, A9, A10
- [ ] ทั้งคู่: ส่งคำถามค้าง (Q-A…Q-I) ใน `sukhsorn-check-list.md` ให้อาจารย์ — **ติดต่อ Q-A (ตารางคะแนน) เป็นอันดับแรก**

### 📋 ก่อน Sprint 2 (วันอังคารที่ 8)

- [x] ตรวจสอบ T-005, T-006 ผ่าน DoD — **เสร็จแล้วใน Sprint 0**
- [ ] ตรวจสอบ T-007 ผ่าน DoD (นายเก่งกาญ)
- [ ] Review PR ของกันและกัน (AR-02) — **ต้องมี author แยกกันถึงจะเป็นหลักฐานได้**
- [x] ยืนยันว่า 10 คะแนน ER ติดสำเร็จ

### 🚀 Day 2 (2026-09-29) — งานของสุขสรร

- [x] อัปเดต `requirement-review-checklist.md` — ปิด A4 / A7 / A11
- [x] เขียน Stand-up log วันที่ 2 (`2026-09-29.md`)
- [x] บันทึก AI Credit ของวันนี้
- [ ] เตรียม `docs/ai-prompts/` เพิ่ม (สนับสนุนงานของนายเก่งกาญ)
- [ ] รอนายเก่งกาญส่ง T-007 `01_schema.sql` → ตรวจ ER Mapping ว่าตรงกับ DDL จริงทุกตาราง

---

## 📋 ลายเซ็นผู้ประเมิน

| บทบาท | ชื่อ | ลายเซ็น | วันที่ |
|---|---|---|---|
| Developer A | นายเก่งกาญ เชี่ยวชาญ | _______ | _______ |
| Developer B | นางสาวสุขสรร มาณีศรี | _______ | _______ |
| Reviewer | (Copilot / อาจารย์ที่ปรึกษา) | _______ | _______ |

---

## 📞 Contact & Notes

- **Stand-up Meeting:** 10:00 น. (จันทร์–เสาร์)
- **Pair Programming:** 14:00 น. (15 นาที)
- **Sprint Review:** 16:30 น.
- **Retro:** 17:00 น.

**Next Review:** หลังสิ้นสุด Sprint 1 (วันอังคารที่ 8)

---

## 📌 บันทึกการแก้ไขเอกสารนี้

| ครั้ง | วันที่ | ผู้แก้ | สิ่งที่เปลี่ยน |
|---|---|---|---|
| 1 | 2026-09-28 | สุขสรร + AI `[ai-assisted]` | ร่างแรก (commit `2973275`) |
| 2 | 2026-09-29 | สุขสรร + AI `[ai-assisted]` | **ตรวจสถานะจริงใน Git แล้วแก้ 6 จุด:** T-004 เป็นเสร็จ · เพิ่ม T-005/T-006 เป็นเสร็จ · DoD ของ `flutter run` เปลี่ยนจาก ✅ เป็น ◐ · เงื่อนไข Sprint 1 ผ่านครบ · เพิ่มความเสี่ยงเรื่องชื่อผู้ commit · Action Items ติ๊กตามจริง |

> **หลักการที่ใช้แก้รอบนี้:** ตารางสถานะต้องอ่านจาก `git log` / `git diff` / ไฟล์จริงเสมอ
> ไม่ใช่จากแผนที่ตั้งใจไว้ตอนเขียนเอกสาร — เพราะรอบแรกสถานะ T-004/T-005/T-006 ผิดทั้งหมด

---

*เอกสารนี้เป็นส่วนหนึ่งของ Agile Retrospective และ Traceability Matrix*  
*อ้างอิง: บทที่ 18 (Development Plan) + Requirement Review Checklist + `docs/ai-credit-log.md`*
