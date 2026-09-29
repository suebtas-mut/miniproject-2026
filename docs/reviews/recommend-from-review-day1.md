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
| **T-002** | ติดตั้ง Android Studio + Flutter SDK + ทดสอบ Emulator | นางสาวสุขสรร | ✅ ทำเสร็จ | Branch `sukhsorn` มี Emulator ทำงาน | 3 ชม. |
| **T-003** | ตั้ง ClickUp: Workspace/Project/List/Sprint | นางสาวสุขสรร | ✅ ทำเสร็จ | Task 62 รายการเข้า ClickUp แล้ว | 1.5 ชม. |
| **T-004** | Requirement → Use Case Diagram + Use Case Spec | ทั้งคู่ | 🔄 อยู่ระหว่าง | PlantUML Use Case sketch ร่างแล้ว | 2/5 ชม. |

#### ✅ Definition of Done (Sprint 0)

| เกณฑ์ | ผลลัพธ์ |
|---|---|
| `git log` มี ≥ 1 commit ที่ clean | ✅ มี 5 commits ใน main + branch kaengkarn/sukhsorn |
| Oracle XE 19c เชื่อมต่อได้ | ✅ `sqlplus shuttle_app/password@localhost:1521/XEPDB1` สำเร็จ |
| `flutter run` ได้บน Emulator | ✅ Emulator เปิดแอปว่างเปล่า ✓ |
| ClickUp มี Backlog ครบ 62 Task | ✅ ป้อน Task ทั้งหมด พร้อมกำหนดการ Sprint |

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
| 1 | **T-004 ยังไม่เสร็จ (Use Case Diagram)** | ท่าทางจะ delay เข้า Sprint 1 | 🔴 High | ให้ทั้งคู่ commit Use Case เสร็จภายใน 2 ชั่วโมงก่อนไปเที่ยง ขั้นต่ำ sketch diagram ต้อง merge เข้า develop ก่อน Sprint 2 |
| 2 | **ยังไม่มี Daily Stand-up Log** | ไม่มีหลักฐาน Agile + ไม่คิด Story Point | 🟡 Medium | วันที่ 2 เป็นต้นไป **บังคับต้องมี** `docs/agile/standup/YYYY-MM-DD.md` |
| 3 | **ยังไม่มี Sprint Retrospective** | ไม่มี "บันทึกการเรียนรู้" + ไม่ปรับปรุง Prompt | 🟡 Medium | วันที่ 2 (Sprint 1 เสร็จ) ต้องมี `docs/agile/retro/sprint-00.md` + `sprint-01.md` |
| 4 | **ไม่มี Prompt Library ในโปรเจกต์** | ตอนใช้ AI ต้องกลับหา Prompt เดิม (AR-06) | 🟡 Medium | สร้าง `docs/ai-prompts/P-01.md` ... `P-12.md` ก่อน Sprint 2 |
| 5 | **ยังไม่มี AI Usage Credit / Prompt Log** | เสีย คะแนนเอกสารการใช้ AI (AR-04) | 🟡 Medium | เตรียมไฟล์ `docs/ai-credit-log.md` เพื่อบันทึก AI ที่ใช้ใน Sprint 1 เป็นต้นไป |

---

## 🔄 ส่วนที่ 3: แนวทางการ Merge Branch เข้า main

### 📌 Strategy: Git Flow แบบปรับตัว

**ปัจจุบัน Branches ที่มี:**
```
main (e1343e36...)
├─ kaengkarn (afc144b7...)  [Backend + Oracle]
└─ sukhsorn (a4c14105...)   [Flutter + Docs]
```

### ✅ ขั้นตอนการ Merge ก่อน Sprint 2

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

### 🔴 High Priority (ต้องทำวันนี้)

| # | งาน | Owner | ระยะเวลา | ผลลัพธ์ |
|---|---|---|---|---|
| 1 | **สรุป T-004 (Use Case Diagram)** | ทั้งคู่ | 2 ชม. | PlantUML diagram + spec ลง Git |
| 2 | **Merge branch เข้า main** | ทั้งคู่ | 1 ชม. | main มี commit ครบทั้ง 2 ฝั่ง |
| 3 | **สร้าง develop branch** | kaengkarn | 0.5 ชม. | develop branch พร้อม |
| 4 | **Daily Stand-up Log วันที่ 1** | ทั้งคู่ | 0.5 ชม. | `docs/agile/standup/2026-XX-XX.md` |
| 5 | **Sprint 0 Retrospective** | ทั้งคู่ | 1 ชม. | `docs/agile/retro/sprint-00.md` |

### 🟡 Medium Priority (ต้องทำประเทศกรรมวาร)

| # | งาน | Owner | ระยะเวลา | Sprint ที่ใช้ |
|---|---|---|---|---|
| 1 | **สร้าง Prompt Library** (P-01…P-12) | kaengkarn | 2 ชม. | Sprint 1 ใช้ได้ทันที |
| 2 | **เตรียม AI Credit Log** | sukhsorn | 1 ชม. | บันทึกตั้งแต่ Sprint 1 |
| 3 | **ตรวจสอบ Requirement Checklist** | ทั้งคู่ | 1 ชม. | ยืนยันงาน 62 Task ครบ |

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

### ✅ เงื่อนไขการเข้า Sprint 1 (ต้องผ่านก่อน)

| เงื่อนไข | สถานะ | หมายเหตุ |
|---|---|---|
| T-004 (Use Case) สิ้นสุด | ⏳ In Progress | ต้องสรุปให้เสร็จภายในวันนี้ |
| Branch merge เข้า main | ⏳ Ready | หลังจบที่ประชุม review ให้ทำทันที |
| Develop branch สร้างเสร็จ | ⏳ Ready | ขึ้นอยู่กับ merge |
| Daily Stand-up วันที่ 1 บันทึกไว้ | ⏳ Ready | ต้องมี asap |

### 🚀 Sprint 1 เป้าหมาย

| Task | Owner | คะแนน | Deadline | หมายเหตุ |
|---|---|---|---|---|
| **T-005** ER Diagram 3 ระดับ + Mapping | sukhsorn | 10 คะแนน | วันอังคารเย็น | ER ต้องเสร็จก่อนให้เก่งกาญเขียน DDL |
| **T-006** Data Dictionary | sukhsorn | (รองรับ 10 คะแนน) | วันอังคารเย็น | ควบคู่กับ T-005 |
| **T-007** `01_schema.sql` | kaengkarn | (รองรับ 10 คะแนน) | วันอังคารเย็น | รันบน Oracle 19c ผ่าน 0 error |

**คะแนนที่ปิดใน Sprint 1:** ✅ **ER + Mapping = 10 คะแนน** (แรก)

---

## 📄 ส่วนที่ 8: สรุปการประเมิน

### ✅ Overall Assessment: **PASS (ยังอยู่ตามแผน)**

| ประเมิน | ผล | ระดับ |
|---|---|---|
| **Infrastructure Ready** | Git + Oracle + Flutter ทำงาน | ✅ A |
| **Planning** | Task 62 รายการ ลง ClickUp | ✅ A |
| **Documentation** | บทที่ 1-18 พร้อม ER/Mockup Checklist | ✅ A |
| **Team Collaboration** | Branch แยกชัดเจน + Review ready | ✅ A |
| **Agile Practice** | Daily Stand-up ยังไม่เริ่ม (อยู่ใน Plan) | 🟡 B |
| **AI Integration** | ยังไม่ใช้ (ตั้งแต่ Sprint 1) | 🟡 B |

**Overall:** ✅ **ปิด Sprint 0 ได้สำเร็จ** (slight delay ไม่มีนัยสำคัญ)

---

## 🎯 Action Items (ทำทันที)

### Urgent (วันนี้ก่อนเลิก)

- [ ] ทั้งคู่ commit T-004 Use Case Diagram สรุปให้เสร็จ
- [ ] git merge branch เข้า main (ตามขั้นตอน 18.9)
- [ ] สร้าง branch develop
- [ ] บันทึก Stand-up Log วันที่ 1
- [ ] สรุป Sprint 0 Retrospective

### Recommended (ก่อน Sprint 1)

- [ ] kaengkarn เตรียม Prompt P-01 ~ P-12 ไว้ใน `docs/ai-prompts/`
- [ ] sukhsorn เตรียม `docs/ai-credit-log.md` สำหรับบันทึก AI ที่ใช้
- [ ] ทั้งคู่ตรวจสอบ Requirement Checklist ว่ายังถูกต้อง

### ก่อน Sprint 2 (วันอังคารที่ 8)

- [ ] ตรวจสอบ T-005, T-006, T-007 ผ่าน DoD หมด
- [ ] Review PR ของกันและกัน (AR-02)
- [ ] ยืนยันว่า 10 คะแนน ER ติดสำเร็จ

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

*เอกสารนี้เป็นส่วนหนึ่งของ Agile Retrospective และ Traceability Matrix*  
*อ้างอิง: บทที่ 18 (Development Plan) + Requirement Review Checklist*
