
**โครงการ:** ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
**ผู้ดูแลบันทึก:** นางสาวสุขสรร มาณีศรี (สาขา `sukhsorn`) + นายเก่งกาญ เชี่ยวชาญ (สาขา `kaengkarn`) — บันทึกร่วมกัน
**เริ่มบันทึก:** 2026-09-28 (Sprint 0 · Day 1) · ต่อเนื่อง 2026-09-29 (Sprint 1 · Day 2) · 2026-09-30 (Sprint 2 · Day 3)
**ข้อกำหนดที่เกี่ยวข้อง:** AR-04 (ต้องระบุ Credit) · AR-06 (เก็บ Prompt) · AR-07 (บันทึกเมื่อ AI ตอบผิด) · AR-08 (ห้ามสร้างข้อมูลตัวอย่างปลอม)
**Checklist:** ข้อ A11 — *AI Usage Credit + Prompt Log*
**Task ปิดงาน:** T-061 (Sprint 13 · 5.5 ชม. · ทั้งคู่ · `@agent-doc`) — ไฟล์นี้เป็นบันทึกสะสมระหว่างทาง จะถูกรวมเป็นภาคผนวก ค ในรายงานเมื่อถึง Sprint 13

---

## วิธีอ่านไฟล์นี้

- หนึ่งแถว = หนึ่ง "การใช้ AI หนึ่งครั้ง" ที่ตรวจสอบย้อนได้จาก Git
- ทุกแถวต้องระบุ **ไฟล์ที่เปลี่ยน** และ **commit** ที่เกี่ยวข้อง เพื่อให้ตรวจสอบย้อนหลังได้ (AR-04)
- **สัดส่วน AI** = ประมาณการว่างานส่วนไหนทำด้วย AI / ทำด้วยคน ใช้ประกอบรายงานเวลาที่ใช้จริง
- เอกสารที่สร้างด้วย AI ต้องมีเครื่องหมาย `[ai-assisted]` ใน commit message

---

## Sprint 0 — Day 1 (2026-09-28)

### แถวที่ 1 · ตรวจสภาพแวดล้อมการพัฒนา (T-002)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-002 |
| Agent | `@agent-orchestrator` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตรวจสอบเครื่องมือที่ต้องใช้: Android Studio, Flutter SDK, Android SDK, AVD, Node.js และ Java พร้อมรายงานผลและสิ่งที่ขาด" |
| ไฟล์ที่เปลี่ยน | ไม่มี (ตรวจสอบอย่างเดียว) |
| ผลลัพธ์ | ✅ พบ Flutter SDK · Dart 3.13.4 · Android SDK · AVD 4 ตัว<br>⚠️ พบข้อบกพร่อง 2 จุด: WDAC Application Control บล็อก `flutter_tools.snapshot` · Node.js เป็น v24 แต่สเปกกำหนด v20 |
| การตัดสินใจของคน | ⛔ **ไม่ bypass security policy** — รอผู้ดูแลระบบแก้ WDAC และติดตั้ง Node.js 20 ก่อน |
| Commit | `8b749eb` |
| สัดส่วน AI | 90% AI / 10% คน (คนตัดสินใจเรื่องไม่ bypass) |

---

### แถวที่ 2 · ตั้งค่า ClickUp (T-003)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-003 |
| Agent | `@agent-orchestrator` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตั้งโครงสร้าง ClickUp ให้ตรงกับ 62 Task ในแผนพัฒนาบทที่ 18" |
| ไฟล์ที่เปลี่ยน | ไม่มี (งานบน ClickUp ภายนอก Git) |
| ผลลัพธ์ | ✅ สร้าง Workspace / Project / List / Sprint · นำเข้า Task ครบ 62 รายการ |
| การตรวจสอบ | ตรวจนับจำนวน Task ใน ClickUp เทียบกับตารางใน `docs/chapter-18-development-plan.md` แล้วตรงกัน |
| Commit | `8b749eb` |
| สัดส่วน AI | 70% AI / 30% คน (คนกำหนดลำดับความสำคัญและกำหนด Sprint) |

---

### แถวที่ 3 · Use Case Diagram + Specification (T-004)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-004 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | แยกเป็น 8 รอบ ตาม `docs/ai-prompts/` และ `prompt-log.md` (ดูรายละเอียดในไฟล์ Prompt Log) |
| ไฟล์ที่เปลี่ยน | `docs/diagrams/usecase/usecase-00..06.puml` (7 ไฟล์) · `usecase-spec.md` · `README.md` |
| ผลลัพธ์ | ✅ UC-01…UC-30 ครบ · Actor 4 บทบาท · นับ link ได้ Admin 21 / Staff 14 / Driver 8 / Customer 8 (รวม UC-01..03) |
| การตรวจสอบของคน | 🔍 เทียบกับ PDF ต้นฉบับทีละ UC · พบช่องว่าง 7 จุดและแก้เองทั้งหมด (ดู Retro) |
| Commit | `8b749eb` · แก้ alias trace ใน `a4c1410` |
| สัดส่วน AI | 70% AI / 30% คน (คนตรวจรับรองความถูกต้องกับเอกสารต้นฉบับ) |

---

### แถวที่ 4 · ER Diagram 3 ระดับ + Mapping (T-005)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-005 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สร้าง ER Diagram 3 ระดับ (Conceptual / Logical / Physical) + Mapping จาก Use Case ที่ทำเสร็จแล้ว" |
| ไฟล์ที่เปลี่ยน | `docs/diagrams/er/er-01..05.puml` · `er-mapping.md` · `README.md` |
| ผลลัพธ์ | ✅ Conceptual 13 entity · Logical/Physical 20 ตาราง / 102 คอลัมน์ · 18 UK / 12 CHECK |
| การตรวจสอบของคน | 🔍 พบยอด UK/CHECK ในร่างแรกผิด (17 UK / 13 CHECK) → แก้เป็น 18 UK / 12 CHECK โดยนับจาก DDL ข้อ 17.4.3 |
| Commit | `8b749eb` |
| สัดส่วน AI | 75% AI / 25% คน (คนแก้ตัวเลขสรุปที่ AI คำนวณผิด) |

---

### แถวที่ 5 · Data Dictionary (T-006)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-006 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สร้าง Data Dictionary ให้ครบทุกคอลัมน์ พร้อม Trace กลับไป Use Case และ Requirement" |
| ไฟล์ที่เปลี่ยน | `docs/report/chapter-08-data-dictionary.md` |
| ผลลัพธ์ | ✅ `COMMENT ON` 122 รายการ (20 `TABLE` + 102 `COLUMN`) · Trace Requirement ↔ Use Case ครบ |
| การตรวจสอบของคน | 🔍 นับ `COMMENT ON` จริงจากไฟล์ = 20 + 102 = 122 ตรงกับที่ประกาศ |
| Commit | `8b749eb` |
| สัดส่วน AI | 80% AI / 20% คน |

---

### แถวที่ 6 · รีวิวงานวันแรก + ข้อเสนอแนวทาง Merge

| คอลัมน์ | ค่า |
|---|---|
| Task | ปิด Sprint 0 (Review Day 1) |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สรุปการดำเนินการ Review Day 1 พร้อมจุดที่ดี ความเสี่ยง และแนวทาง merge branch" |
| ไฟล์ที่เปลี่ยน | `docs/reviews/recommend-from-review-day1.md` |
| ผลลัพธ์ | ✅ 339 บรรทัด · 8 ส่วน |
| Commit | `2973275` |
| สัดส่วน AI | 60% AI / 40% คน (คนตรวจสถานะจริงของ repo แล้วแก้ตัวเลข) |
| หมายเหตุ | รีวิวรอบแรกระบุว่า T-005/T-006 ยังไม่เสร็จ — **แก้แล้วในรอบตรวจจริง** เพราะของทั้งสอง task อยู่ใน branch นี้แล้ว |

---

### แถวที่ 7 · งานฝั่ง Backend / Oracle (นายเก่งกาญ)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-001 (Sprint 0) · P-01 Requirement→Use Case |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| ไฟล์ที่เปลี่ยน | `docs/ai-prompts/2026-09-28-sprint-00-P-01-requirement-to-usecase.md` · `docs/diagrams/use-case.puml` · `use-case-spec.md` |
| ผลลัพธ์ | ✅ โครงสร้างโปรเจกต์ · Oracle XE 19c · `.gitignore` ฝั่ง Backend |
| Commit | `b0096cc` → `afc144b` |
| สัดส่วน AI | 60% AI / 40% คน |
| หมายเหตุ | 🔐 พบรหัสผ่าน Oracle ใน Git history → นายเก่งกาญ purge เรียบร้อยแล้ว (`48af4a2`) |

---

## 📌 บันทึกกรณี AI ตอบผิด (AR-07)

> AR-07: *"ถ้า AI ตอบผิด ต้องบันทึกลง Retro Log เพื่อปรับปรุงวิธีเขียน Prompt"*
> บันทึกนี้เป็นการปฏิบัติตาม AR-07 ในตัวเอง

| # | AI ตอบผิดอะไร | คนตรวจพบอย่างไร | แก้อย่างไร | กฎ Prompt ที่เพิ่ม |
|---|---|---|---|---|
| 1 | รายงานว่า `COMMENT ON COLUMN` = 122 รายการ | คนรัน `Select-String` นับจริง พบว่า 122 เป็น **ยอดรวม** ไม่ใช่เฉพาะ COLUMN | แจ้งแก้ใน Prompt Log → แยกเป็น 20 `TABLE` + 102 `COLUMN` | ห้ามอ้างตัวเลขจากเอกสารต้นฉบับโดยไม่นับซ้ำในไฟล์จริง |
| 2 | สรุปยอด UK/CHECK ผิด (17/13 แทนที่จะเป็น 18/12) | คนเทียบกับ DDL ข้อ 17.4.3 | แก้ `er-mapping.md` | ตัวเลขสรุปต้องอ้างอิงตำแหน่งที่นับ ไม่ใช่การประมาณ |
| 3 | สร้าง `usecase-06-actor-relation.puml` ใช้ alias `U1`–`U8` ที่ trace กลับ UC ไม่ได้ + ตกลิงก์ `Admin → UC-19` | คนเทียบกับ `usecase-03` และ `usecase-00` | เปลี่ยน alias เป็นช่วง UC จริง + เติมลิงก์ที่หาย | diagram ที่ย่อจากไฟล์อื่น ต้องมี note ระบุที่มาและจำนวนที่นับได้ |

---

## ⚠️ สิ่งที่ AI ช่วยไม่ได้ (ข้อจำกัด)

| หัวข้อ | เหตุผล |
|---|---|
| **ตัดสินใจเรื่องความปลอดภัย** | WDAC policy, การห้าม bypass — คนเป็นผู้ตัดสินเท่านั้น |
| **ยืนยันความถูกต้องกับ PDF ต้นฉบับ** | AI ไม่ได้อ่านไฟล์ต้นฉบับที่ตกลงกันไว้ — คนต้องเทียบเองทุก UC |
| **แก้ความขัดแย้งในเอกสารข้อกำหนด** | เช่น Q-A (ตารางคะแนนหน้า 11), Q-B (เส้นทาง 3 = 12 หรือ 15 นาที) — ต้องรออาจารย์ตอบ ห้าม AI เดา |
| **รันระบบจริง / ทดสอบ** | AR-05: ต้องทดสอบด้วยตนเองทุกครั้ง ห้าม merge โค้ดที่ยังไม่รัน |

---

## Sprint 0 — Day 2 (2026-09-29)

### แถวที่ 8 · ตรวจสถานะจริงใน Git เทียบเอกสารรีวิว

| คอลัมน์ | ค่า |
|---|---|
| Task | ปิด Sprint 0 (Review Day 2) |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตรวจสถานะจริงใน repo เทียบกับเอกสารรีวิว แล้วบอกว่าผมต้องทำอะไรต่อในชื่อใคร" |
| ไฟล์ที่เปลี่ยน | ไม่มี (ตรวจสอบอย่างเดียว) |
| ผลลัพธ์ | ✅ พบว่า **สถานะ T-004 / T-005 / T-006 ในเอกสารรีวิวผิดทั้ง 3 ข้อ** (เอกสารบอกว่ายังไม่เสร็จ แต่ Git พิสูจน์ว่าอยู่ใน branch `sukhsorn` ครบแล้ว)<br>✅ พบปัญหาใหม่: **commit ทั้ง 2 branch ใช้ author เดียวกัน** → หลักฐาน AR-02 เสีย<br>✅ พบ 3 worktree และ `.gitignore` เป็น add/add conflict |
| Commit | — (ตรวจสอบเท่านั้น) |
| สัดส่วน AI | 60% AI / 40% คน (คนตัดสินใจว่าจะเชื่อ Git มากกว่าเอกสาร) |

---

### แถวที่ 9 · ตั้ง Git identity + สร้าง AI Credit Log

| คอลัมน์ | ค่า |
|---|---|
| Task | ปิด A11 |
| Agent | `@agent-orchestrator` + `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "สุขสรรไม่มีอีเมล น่าจะอัพโค้ดได้ไหม และทำต่อได้เลย ให้จบ" |
| ไฟล์ที่เปลี่ยน | `.gitignore` (เพิ่ม `session-*.md`, เก็บ `!.vscode/settings.json.example`) · `docs/ai-credit-log.md` (ไฟล์นี้) |
| ผลลัพธ์ | ✅ ตั้ง `user.name = Sukhsorn Maneesri` + `user.email = 296676037+suebtas-mut@users.noreply.github.com` (repo-local ไม่แตะ global)<br>✅ เก็บไฟล์ session ของ agent ไม่ให้ขึ้น Git แต่ไม่ลบทิ้ง<br>✅ บันทึก AI Credit 7 รายการของ Sprint 0 + กรณี AI ตอบผิด 3 ครั้ง (AR-07) |
| Commit | `66d434a` |
| สัดส่วน AI | 50% AI / 50% คน (คนตัดสินใจเรื่องเลือกใช้ GitHub noreply แทนอีเมลจริง) |

> ⚠️ **หมายเหตุสำคัญ:** commit เก่าทั้งหมดยังเป็น `suebtas-mut` และ **แก้ย้อนหลังไม่ได้** เพราะ repo สาธารณะและ push แล้ว
> การแก้จะต้อง force-push ซึ่งเสี่ยงทำให้ทีมพัง → **ตัดสินใจไม่แก้** แต่บันทึกไว้เป็นข้อจำกัดที่ต้องแจ้งอาจารย์

---

### แถวที่ 10 · อัปเดตเอกสารให้ตรงความจริง

| คอลัมน์ | ค่า |
|---|---|
| Task | ปิด Sprint 0 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตามที่รีวิวการดำเนินการ Review Day1 แล้ว ผมต้องทำอะไรต่อ" → "ตามข้อกำหดรีวิวนั้นทำต่อให้เสร็จเลย" |
| ไฟล์ที่เปลี่ยน | `docs/requirement-review-checklist.md` (ปิด A4 / A7 / A11) · `docs/reviews/recommend-from-review-day1.md` (แก้ 6 จุด) · `docs/agile/standup/2026-09-29.md` (ใหม่) |
| ผลลัพธ์ | ✅ เอกสารรีวิวตรงกับ Git ทุกจุด · เพิ่มความเสี่ยงเรื่อง author ไม่แยกคน · เพิ่มตารางบันทึกการแก้ไขเอกสาร (ใครแก้อะไรเมื่อไหร่) |
| สัดส่วน AI | 65% AI / 35% คน |

---

## Sprint 1 — Day 2 (2026-09-29) · ฝั่งนายเก่งกาญ เชี่ยวชาญ

### แถวที่ 11 · เขียน Oracle DDL ทั้งสคีมา (T-007) — ใช้ Prompt P-02

| คอลัมน์ | ค่า |
|---|---|
| Task | T-007 |
| Agent | `@agent-oracle` |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| Prompt | **P-02 `oracle-ddl`** (ดูฉบับเต็มที่ `docs/ai-prompts/P-02_oracle-ddl.md`) |
| ไฟล์ที่เปลี่ยน | `database/01_schema.sql` (ใหม่) · `database/99_drop_schema.sql` (ใหม่) |
| ผลลัพธ์ | ✅ 20 ตาราง / 102 คอลัมน์ / 1 sequence / 8 index / 20 PK / 18 UK / 12 CHECK / 27 FK / 122 COMMENT<br>✅ รันบน Oracle จริง **0 error** · ตรวจสอบ **13/13 PASS** · ไม่มี object `INVALID`<br>✅ ทดสอบ function: identity, sequence, CHECK, UNIQUE, FK, ภาษาไทย UTF-8 |
| การตัดสินใจของคน | ⛔ **ตัดดัชนี `ix_schedstop_sched_seq` ทิ้ง แม้ Requirement บอกให้มี 9 ดัชนี** — เพราะซ้ำกับ backing index ของ `uq_sched_seq` และรันไม่ผ่าน (`ORA-01408`) → คง **8 custom index** ซึ่งหมายถึง 9 ดัชนีตามเจตนาเดิม<br>⛔ **ไม่แก้เงื่อนไข Requirement เพื่อให้รันผ่าน** — บันทึกข้อผิดพลาดให้อาจารย์ตัดสินใจ |
| Commit | `5fffd27` (บน `develop` ผ่าน merge `339cf47`) |
| สัดส่วน AI | 75% AI / 25% คน (คนเลือกวิธีจัดการดัชนีซ้ำ + ตรวจทุกจำนวนเทียบ DoD) |

> **บันทึกข้อผิดพลาด (AR-07)** — AI ทำผิด 6 จุดระหว่างเขียน DDL:
> 1. เขียน `FOREIGN KEY` ซ้ำในบรรทัดเดียวกัน → ตรวจ syntax ทีละ constraint
> 2. นับ CHECK ได้ 95 (ลืมว่า `NOT NULL` เป็น constraint ชนิด `C`) → กรอง `CK_%`
> 3. นับ sequence ได้ 17 (รวม identity `ISEQ$`) → ตัด `ISEQ$` ออก
> 4. คอมเมนต์ต่อท้าย `;` ทำให้ SQL\*Plus ขึ้น `ORA-00933` → ย้ายคอมเมนต์ขึ้นบรรทัดก่อน
> 5. แนะนำ `DROP TABLE ... CASCADE CONSTRAINTS` ทำให้ identity sequence ค้างลบไม่ได้ (`ORA-32794`) → ต้อง DROP เรียงลูกก่อนพ่อ
> 6. ไม่ตรวจดัชนีซ้ำกับ UNIQUE/PK จนเจอ `ORA-01408` → ต้องเทียบคอลัมน์ก่อน `CREATE INDEX`
>
> → ทั้ง 6 ข้อถูกยกเป็นข้อห้าม 7–10 ใน Prompt P-02 รุ่นปรับปรุง

---

### แถวที่ 12 · จัดทำ Prompt Library ครบ P-01…P-12

| คอลัมน์ | ค่า |
|---|---|
| Task | ปิดช่องว่าง AR-06 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| Prompt | "สร้าง Prompt P-02…P-12 ให้ครบตามข้อ 18.1.3 โดยแต่ละอันต้องมีบริบทที่ใช้ ข้อห้ามเฉพาะงาน และตารางตรวจสอบ" |
| ไฟล์ที่เปลี่ยน | `docs/ai-prompts/P-02…P-12` (11 ไฟล์ใหม่) · `docs/ai-prompts/README.md` (ใหม่) · ลบ `.gitkeep` |
| ผลลัพธ์ | ✅ ครบ 12/12 ตามชื่อ template ในข้อ 18.1.3 · แต่ละไฟล์มี 5 หัวข้อมาตรฐาน<br>✅ P-04 ปรับปรุงแล้วตาม Action Item บรรทัด 210/214 (ห้ามต่อสตริงใน SQL) → **ปิดงานที่เคยผัดผ่อน**<br>✅ แก้ความเข้าใจผิดเรื่อง BR-06: เดิมเขียนว่านั่งได้ 1–9 → ที่ถูกคือ **1–4 ต่อการจอง** (9 คือ capacity ของรถ) |
| การตรวจสอบ | ตรวจทุกไฟล์ว่าไม่มีอักขระเสีย (U+FFFD) จากการเขียนภาษาไทย · ตรวจชื่อ template ตรงกับข้อ 18.1.3 ทุกตัว |
| สัดส่วน AI | 80% AI / 20% คน (คนตรวจว่าเนื้อหาตรง Requirement จริง) |

---

### แถวที่ 13 · ปิดงานเอกสารวันที่ 2 (T-007 ในเอกสารรีวิว)

| คอลัมน์ | ค่า |
|---|---|
| Task | ปิดเอกสาร Day 2 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| Prompt | "ปิดงาน review วันที่ 1 ให้เสร็จ" → "ตรวจงานที่เหลือแล้วทำต่อให้ครบ" |
| ไฟล์ที่เปลี่ยน | `docs/reviews/recommend-from-review-day1.md` · `docs/requirement-review-checklist.md` · `docs/kaengkarn-check-list.md` · `docs/agile/standup/2026-09-29.md` |
| ผลลัพธ์ | ✅ T-007 เป็น ✅ + เพิ่มหัวข้อ 7.1 (ผลรันจริง) · ใส่ชื่อ Reviewer · เพิ่มบันทึกการแก้ไข<br>✅ **แก้ลิงก์เสีย 3 จุด** — `retro-sprint-0-doc.md` ถูก rename เป็น `sprint-00-sukhsorn.md` แล้ว แต่เอกสารรีวิวยังชี้ไปไฟล์เก่า<br>✅ แก้ลิงก์ใน checklist ของตัวเอง 3 จุดที่ชี้ไป `use-case-spec.md` (ถูกลบแล้ว) ให้ชี้ `usecase/usecase-spec.md` หัวข้อที่มีจริง<br>✅ ติ๊ก Oracle + ไม่มี MySQL syntax ใน requirement checklist (ยืนยันด้วย grep จริง ไม่พบ) |
| การตรวจสอบ | grep ทั้ง repo หา path ที่ชี้ไฟล์ซ้ำ/ถูกลบแล้ว · แยก "ประวัติ" (retro/standup เก่า) ออกจาก "ลิงก์ที่ยังใช้งาน" |
| สัดส่วน AI | 60% AI / 40% คน |

> ℹ️ **ยังไม่แก้:** `docs/report/chapter-08-data-dictionary.md` ข้อ 8.8 (ดัชนีซ้ำ) และ
> `docs/chapter-17-fullstack.md` ข้อ 17.4.3 — เป็นเอกสารของสุขสรร จึงบันทึกเป็น Action Item แทนที่จะแก้ทับ
>
> ✅ **แก้แล้ว 2026-09-30** ดูแถวที่ 18–20

---

## Sprint 2 — Day 2 (2026-09-30) · ฝั่งนายเก่งกาญ เชี่ยวชาญ

> **Sprint Goal:** ให้มี `02_seed_master.sql` + `03_seed_front.sql` ที่รันบน Oracle จริงแล้วข้อมูลถูกต้อง เพื่อให้ Sprint 3 เริ่มเขียน Backend ได้ทันที

### แถวที่ 14 · เขียน Seed ข้อมูล Master (T-008 ก) — ใช้ Prompt P-03

| คอลัมน์ | ค่า |
|---|---|
| Task | T-008 (ก) `02_seed_master.sql` |
| Agent | `@agent-oracle` |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| Prompt | **P-03 `plsql-bulk-seed`** (ดูฉบับเต็มที่ `docs/ai-prompts/P-03_plsql-bulk-seed.md`) |
| ไฟล์ที่เปลี่ยน | `database/02_seed_master.sql` (ใหม่) |
| ผลลัพธ์ | ✅ 7 ตาราง master: 3 department · 4 position · 4 role · 15 employee · **21 permission** · role_permission<br>✅ รันบน Oracle จริง **0 error** · ตรวจสอบ **12/12 PASS** (รวม `PLAIN_PWD = 0`)<br>✅ Password เป็น placeholder ที่ login ไม่ได้โดยตั้งใจ — T-011 ต้อง generate bcrypt จริง |
| การตรวจสอบของคน | 🔍 รันจริงบน `shuttle-oracle-xe` แล้วเจอ **ตัวเลขคาดหวังใน verification query ผิด 3 จุด** (ดู AR-07 ข้อ 4) → แก้ตัวเลขในไฟล์ ไม่แก้ข้อมูลจริง |
| Commit | `32911c8` (เอกสารประกอบรอบนี้รวมอยู่ใน commit เดียวกัน) |
| สัดส่วน AI | 75% AI / 25% คน (คนรันจริงและตรวจตัวเลข) |

---

### แถวที่ 15 · เขียน Seed ข้อมูล Front (T-008 ข) — ใช้ Prompt P-03

| คอลัมน์ | ค่า |
|---|---|
| Task | T-008 (ข) `03_seed_front.sql` |
| Agent | `@agent-oracle` |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| Prompt | "ข้ามเส้นทาง 1 ไว้ก่อน ทำเส้นทาง 2 และ 3 ก่อน" (Scrum Master ตัดสินใจเอง) |
| ไฟล์ที่เปลี่ยน | `database/03_seed_front.sql` (ใหม่) |
| ผลลัพธ์ | ✅ 9 ตาราง front: 6 stop · 3 vehicle_type · 7 vehicle · 2 route · 9 route_stop · 8 schedule · 36 schedule_stop · 8 driver_assign · 8 vehicle_assign<br>✅ รันบน Oracle จริง **0 error** · ตรวจสอบ **9/9 PASS**<br>✅ **BR-01** `total_minutes` = SUM(travel_minutes) → 13 / 15<br>✅ **BR-02** จุดสุดท้ายถึงเวลา 15:13 / 15:15 ตรงกับ depart 15:00<br>✅ **BR-04** คนขับชน 0 · รถชน 0<br>✅ ทดสอบเส้นทาง 2 และ 3 จากสคีมาว่าง: `99_drop` → `01_schema` → `02` → `03` |
| การตัดสินใจของคน | ⛔ **ข้ามเส้นทาง 1** — PDF ให้ 7 จุดแต่มีชื่อจุดจอดซ้ำ 3 จุด ชน `uq_route_stop_uk` → เสีย DoD "เส้นทาง 1 = 7 จุด" ไว้ก่อน แล้วแก้ DoD ทีหลัง<br>⛔ **เส้นทาง 3 ใช้ 15 นาที ไม่ใช่ 12** ตามแผนสำรองหัวข้อ 7 — PDF ระบุ 12 แต่ผลบวกจริง = 15 (เส้นทาง 1 และ 2 ตรงตาม PDF) พร้อม `TODO(Q-B)` ในไฟล์ |
| Commit | `32911c8` (ไฟล์เดียวกับแถวที่ 14) |
| ผล Peer Review | ⭐ **ผ่าน 21/22** โดยสุขสรร `1d3bae9` — ตัวเลขทุกตัวตรงกับที่อ้างจริงบนฐานข้อมูล · ข้อที่ไม่ผ่านคือ `password_hash` เป็น bcrypt ยาว 52–54 ตัว (ต้องครบ 60) ตั้งใจให้ login ไม่ได้ แต่เพิ่มความเสี่ยง API ตอบ 500 แทน 401 → ต้อง try/catch ตอน verify ใน T-011 |
| สัดส่วน AI | 80% AI / 20% คน (คนตัดสินใจข้ามเส้นทาง 1 และเลือกค่า 15 แทน 12) |

> **บันทึกข้อผิดพลาด (AR-07)** — AI ทำผิด 6 จุดระหว่างเขียน Seed:
> 1. ตั้ง expected count เป็น 24 สิทธิ์ ทั้งที่ insert จริง 21 (นับผิดเอง) → **คนตรวจจาก output จริง ไม่เชื่อตัวเลขที่ AI สรุป**
> 2. `RP_ADMIN` คาด 24 และ `RP_STAFF` คาด 21 — ทั้งคู่ผิด → คนแก้เป็น 21 และ 18 ตามผลรันจริง
> 3. ไม่ได้เตือนเรื่อง **เส้นทาง 1 มีจุดจอดซ้ำ** จนกว่าคนจะเทียบ PDF เอง → เป็นข้อผิดพลาดสำคัญที่สุด เพราะจะทำให้ `03` รันไม่ผ่านทั้งไฟล์
> 4. เสนอให้ hardcode `total_minutes` = 15 → ผิด BR-01 ที่ระบุให้ระบบคำนวณเอง · **คนสั่งให้ใช้ correlated subquery แทน**
> 5. ตั้งชื่อคำถามใหม่ว่า **Q19** ทั้งที่ Q19 ถูกใช้ไปแล้ว (เรื่อง BR-06 ที่นั่ง) → **ทำผิดซ้ำกับข้อ 3 ในตาราง AR-07 ของ Sprint 0 พอดี** · คนตรวจจากตารางข้อ 4 ใน `kaengkarn-check-list.md` ก่อน commit → เปลี่ยนเป็น **Q20** และเพิ่ม **Q21** (ความเสี่ยง BR-04 เมื่อเพิ่มเส้นทาง 1)
> 6. **verification query ตรวจ bcrypt ไม่เข้มพอ** — ใช้เงื่อนไข `LENGTH < 40 OR NOT LIKE '$2%'` ซึ่งผ่านทั้งที่ bcrypt ต้องยาว **60 ตัวเป๊ะ** ค่าจริงในไฟล์ยาว 52–54 → **ผู้รีวิว (สุขสรร) ตรวจจับได้ ไม่ใช่ AI** · ข้อผิดพลาดนี้ถ้าไม่มี peer review จะหลุดไปถึง T-011
>
> → เพิ่มเป็นข้อห้ามใน Prompt P-03 รุ่นถัดไป: *verification query ต้องเขียนหลัง insert เสร็จแล้วโดยนับจาก `VALUES` จริง และต้องเทียบชื่อจุดจอดกับ PDF ทุกชื่อก่อน insert*
> → **กฎที่ตกไปในรอบนี้ 1:** ก่อนตั้งเลข Q ใหม่ ต้องเปิดตารางข้อ 4 ใน `kaengkarn-check-list.md` แล้วเช็กเลขที่ใช้ไปแล้วเสมอ
> → **กฎที่ตกไปในรอบนี้ 2:** verification query ที่ใช้ "ผ่าน" ต้องตรวจ **ค่าที่ถูกต้องตามสเปก** ไม่ใช่แค่ "ไม่ใช่ plaintext" — ถ้าสเปกกำหนดความยาวหรือรูปแบบไว้ ต้องเทียบให้ตรง
> → **บันทึกลง T-011:** เพิ่ม `select count(*) vs count(distinct password_hash)` และต้องได้ 15 = 15

---

### แถวที่ 16 · ปิดเอกสาร Sprint 2 (Stand-up + DoD)

| คอลัมน์ | ค่า |
|---|---|
| Task | ปิดงานเอกสารวันที่ 3 |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| ไฟล์ที่เปลี่ยน | `docs/agile/standup/2026-09-30.md` (ใหม่) · `docs/ai-credit-log.md` (เติมแถว 14–16) · `docs/agile/sprints/sprint-02-plan.md` (อัปเดต Entry Criteria + DoD) · `docs/kaengkarn-check-list.md` |
| ผลลัพธ์ | ✅ เติม commit `5fffd27` ในแถวที่ 11 ที่เคยเป็น `(เติมหลัง commit)`<br>✅ อัปเดต Entry Criteria ข้อ 1 / 6 / 7 เป็นผ่าน พร้อมหลักฐาน<br>✅ บันทึกการเปลี่ยน DoD เส้นทาง 3 จาก 12 → 15 เป็นร่างของทีม (รออาจารย์ยืนยัน Q-B)<br>✅ บันทึกการข้ามเส้นทาง 1 และผลกระทบต่อ DoD |
| สัดส่วน AI | 60% AI / 40% คน |

---

---

## Sprint 2 - Day 3 (2026-09-30) · ฝั่งนางสาวสุขสรร มาณีศรี

### แถวที่ 17 · Mockup ระบบ SHUTTLE BUS (T-009)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-009 |
| Agent | `@agent-mockup` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ทำ Mockup 4 บทบาทตาม UC-01…UC-30 ตามข้อ 16 ต้องเป็นหน้าจอ Flutter ห้ามเป็น Web/React" → "ทำ mockup ของหน้าจอตาม role ที่ได้รับ" |
| ไฟล์ที่เปลี่ยน | `docs/mockup/mockup.html` · `docs/mockup/README.md` |
| ผลลัพธ์ | ✅ 15 หน้าจอ / 4 บทบาท (ลูกค้า 6 · คนขับ 4 · พนักงาน 3 · ผู้ดูแล 2)<br>✅ ครอบคลุม UC-01…UC-30 ครบ 30/30<br>✅ 2 breakpoint ตาม R-07 (360px / 760px) · แสดง Dynamic RBAC ตาม R-06<br>✅ ออกแบบเป็น Flutter component (Scaffold / AppBar / BottomNavigationBar) — ไม่มี logic หรือ route จริง จึงไม่ขัดข้อ 17.0 |
| การตรวจสอบ | 🔍 เทียบทีละ UC กับ `usecase-spec.md` · ตรวจ BR ที่แสดงตรงกับ CHECK constraint ใน `01_schema.sql` ทุกตัว |
| ⚠️ ข้อจำกัด | **ทำส่วน Figma / ClickUp / export PNG ไม่ได้** เพราะไม่มีสิทธิ์เข้าถึงทั้งสองบริการ → ส่งมอบเป็น wireframe ใน repo และระบุชัดใน `docs/mockup/README.md` ข้อ 6 |
| กรณี AI ตอบผิด | 🐛 รอบแรก AI สร้างหน้าจอให้ "พนักงาน" เหมือนผู้ดูแลทุกเมนู — คนแก้เองให้ Staff เห็นเฉพาะเมนูตาม `permission.screen_key` ตาม R-06 |
| สัดส่วน AI | 65% AI / 35% คน |

---

### แถวที่ 18 · Peer Review DDL (AR-02)

| คอลัมน์ | ค่า |
|---|---|
| Task | AR-02 (review งาน T-007 ของเก่งกาญ) |
| Agent | `@agent-oracle` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตรวจ DDL เทียบเอกสาร ER mapping ที่เสร็จแล้ว และรัน query จริงบนฐานข้อมูล Docker" |
| ไฟล์ที่เปลี่ยน | `docs/reviews/t-007-schema-peer-review-sukhsorn.md` |
| ผลลัพธ์ | ✅ query `user_tables`/`user_tab_columns`/`user_constraints`/`user_indexes`/`user_col_comments` บน `shuttle-oracle-xe`<br>✅ ตรงเอกสาร: 20 ตาราง · 102 คอลัมน์ · PK 20 · UK 18 · FK 27 · business CHECK 12 · custom index 8 · comment 122<br>✅ ผ่าน 13/13 ข้อ · ไม่พบข้อบกพร่องใน DDL |
| การตรวจสอบ | 🔍 **คนรัน query เองทั้ง 6 ชุด** และเทียบกับไฟล์ DDL ทีละ constraint · เจอเงื่อนไขว่า `user_constraints` นับ `NOT NULL` รวมเป็น `C` ทำให้ได้ 95 ต้องกรองออกเหลือ 12 |
| ⚠️ ข้อค้นพบ | เอกสาร 3 ไฟล์ยังบอก "ดัชนี 9 ตัว" + "FRONT 10 ตาราง" ขณะที่ DDL จริงมี 8 และ 9 → แก้ในแถวที่ 16 |
| สัดส่วน AI | 70% AI / 30% คน |

---

### แถวที่ 19 · แก้เอกสารให้ตรงกับ DDL จริง (doc drift)

| คอลัมน์ | ค่า |
|---|---|
| Task | Action Item จาก standup 2026-09-29 (บรรทัด 81) |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตรวจ er-mapping.md เทียบ DDL จริงที่เสร็จแล้ว" → "แก้เอกสารที่ยังไม่ตรงกับ DDL" |
| ไฟล์ที่เปลี่ยน | `docs/diagrams/er/er-mapping.md` · `docs/report/chapter-08-data-dictionary.md` (3 จุด) · `docs/chapter-17-fullstack.md` |
| ผลลัพธ์ | ✅ ดัชนี 9 → 8 (ลบ `ix_schedstop_sched_seq` ที่ซ้ำกับ `uq_sched_seq`) ทั้ง 3 ไฟล์<br>✅ FRONT 10 → 9 ตาราง<br>✅ แต่ละจุดใส่หมายเหตุวันที่ + ลิงก์ไปหลักฐาน peer review เพื่อให้ตรวจย้อนได้ |
| การตรวจสอบ | 🔍 นับ `CREATE TABLE` ใน DDL แล้วจัดกลุ่มใหม่ (MASTER 8 / FRONT 9 / BOOKING 1 / TRIP 2) แล้วเทียบกับ query `user_tables` จริง |
| สัดส่วน AI | 75% AI / 25% คน |

---

### แถวที่ 20 · ถอด session files ออกจาก Git

| คอลัมน์ | ค่า |
|---|---|
| Task | สุขาภิบาล repo (AR-03) |
| Agent | `@agent-orchestrator` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "ตรวจว่ามีไฟล์ที่ขัดกับ .gitignore ที่ถูก track อยู่ไหม" |
| ไฟล์ที่เปลี่ยน | `session-OpenCode-Design-mini-project.md` · `session-OpenCode-Oracle+Flutter+2Member.md` (ถอดออกจาก Git ไฟล์ยังอยู่บนเครื่อง) |
| ผลลัพธ์ | ✅ `.gitignore` มี `session-*.md` แต่ 2 ไฟล่ถูก track ตั้งแต่ commit แรก `e1343e3` → `git rm --cached` เพื่อให้บังคับใช้ตั้งแต่ commit ต่อไป |
| การตรวจสอบ | 🔍 `git check-ignore -v` ยืนยันว่า ignore rule มีจริงและตรงกับชื่อไฟล์ |
| ⚠️ หมายเหตุ | ไฟล์ยังอยู่ในประวัติ Git ถาวร — การถอดออกครั้งนี้ไม่ได้ลบ history ตามนโยบาย "ไม่เขียน history ใหม่" |
| สัดส่วน AI | 50% AI / 50% คน |

---

### แถวที่ 21 · Peer Review Seed Data T-008 (AR-02)

| คอลัมน์ | ค่า |
|---|---|
| Task | AR-02 (รีวิว `02_seed_master.sql` + `03_seed_front.sql` ของเก่งกาญ) |
| Agent | `@agent-oracle` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "รีวิว 01/02/03 seed ตาม DoD" → "ตรวจ seed บนฐานข้อมูลจริง read-only" |
| ไฟล์ที่เปลี่ยน | `docs/reviews/t-007-schema-peer-review-sukhsorn.md` (เพิ่มส่วนที่ 4) · `docs/agile/standup/2026-09-30.md` (ส่วนที่ 2) |
| ผลลัพธ์ | ✅ **ผ่าน 21/22 ข้อ** — ตัวเลขทุกตัวที่อ้างใน commit message ตรงกับที่วัดจริง<br>✅ BR-01 (13/15) · BR-02 (ครบ 8 รอบ) · BR-04 (0 ชน) ผ่านจาก query จริง<br>✅ RBAC สอดคล้อง: 0 พนักงานไม่มี role · 0 คนขับผิด role · permission ครบ 5 โมดูล · `role_permission` 21+4+5+18 = 48 ตรง<br>❌ **`password_hash` เป็น bcrypt ที่ยาวผิด** — 15 คน ยาว 52–54 ตัว (ถูกต้องต้อง 60) และมีแค่ **4 ค่า unique** |
| การตรวจสอบ | 🔍 **คนรัน query เองทั้งหมด 20 ชุด** แบบ read-only เพื่อไม่ลบข้อมูล seed ของเก่งกาญในฐานข้อมูลร่วม · เพิ่ม query ที่ผู้เขียนยังไม่ได้ตรวจ 5 ชุด (INVALID object · employee ไร้ role · driver_assign ผิด role · is_active · dead stop) |
| 🐛 กรณีที่ AI ไม่ได้เจอเอง | การตรวจ `password_hash` เพียง "ขึ้นต้น `$2b$` = ปลอดภัย" ให้ผ่าน · **คนตรวจความยาวจริง** จึงพบว่าไม่มีตัวไหนครบ 60 ตัว และมีแค่ 4 ค่า unique → เป็นข้อบกพร่องที่ AI ตรวจไม่พบเอง |
| สัดส่วน AI | 65% AI / 35% คน |

---

<<<<<<< HEAD
### แถวที่ 22 · T-014 OpenAPI Spec (ช่วยงานของนายเก่งกาญ)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-014 (OpenAPI / Swagger spec ของทุก Endpoint) |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี *(Task นี้เดิมเป็นของนายเก่งกาญ ได้รับอนุญาตให้ช่วยทำต่อ)* |
| Prompt | "ทำงานวันนี้ให้เสร็จ" → เขียน T-014 ต่อจาก schema ที่เพิ่ง review ผ่าน |
| ไฟล์ที่เปลี่ยน | `docs/api/openapi.yaml` (ใหม่ · OpenAPI 3.0.3) · `scripts/validate-openapi.py` (ใหม่) · `docs/reviews/t-007-schema-peer-review-sukhsorn.md` (เพิ่มข้อ 4b) · `docs/agile/standup/2026-09-30.md` (แก้สถานะ `.env`) |
| ผลลัพธ์ | ✅ **65 endpoint / 42 path · ครอบคลุม UC-01…UC-30 ครบ 30/30**<br>✅ มี request + response + error code + ตัวอย่าง payload ทุกตัว<br>✅ ระบุ `x-uc` · `x-permission` · `x-br` ทุก operation<br>✅ `$ref` ทั้ง 42 จุด resolve ได้ครบ<br>✅ เขียนตัวตรวจ `scripts/validate-openapi.py` เพื่อให้รันซ้ำได้ → **PASS**<br>❌ **พบช่องว่างสิทธิ์ `RPT.R4`** — โมดูล report มีแต่ R1,R2,R3,R5,R6,R7 = 6 ตัว แต่ PDF กำหนดให้มี R4 (UC-28) |
| การตรวจสอบ | 🔍 ตัวตรวจยืนยัน: 65 endpoint · 42 path · UC 30/30 · perm 19/21 · BR 7 ตัว · `$ref` 42/42<br>🔍 **ยืนยันช่องว่าง R4 ด้วยการรัน query จริงบน `shuttle-oracle-xe`** — `select perm_code from permission where module='report'` คืน 6 แถว ไม่มี R4 · ยืนยันซ้ำด้วย `sort_no` (50,51,52,**53=R5**,54,55) ว่าข้ามเลข 53 จริง |
| การตัดสินใจไม่แก้เอง | 🚫 **ไม่เพิ่ม `RPT.R4` เอง** เพราะกระทบทั้ง Use Case (ปิดแล้ว) และตารางสิทธิ์ (ปิดแล้ว) จึงอ้างไว้ใน `x-permission` พร้อมคำอธิบายช่องว่างในตัวสเปก และตั้งตัวตรวจให้เตือนทุกครั้ง |
| 🐛 กรณีที่ AI ไม่ได้เจอเอง | ช่องว่าง `RPT.R4` จะ **ไม่มีใครเจอ** ถ้าไม่ได้เขียน OpenAPI วันนี้ เพราะต้อง map ทุก endpoint เข้ากับสิทธิ์จริงในตาราง → **งานเอกสารช่วยจับข้อบกพร่องของงาน seed** ได้ |
| ⚠️ ข้อผิดพลาดของ AI รอบนี้ | รอบแรกใช้ plain scalar ที่มี `: ` ใน description 4 จุด → YAML parse ไม่ผ่าน · ต้อง quote ให้ครบ · และตัวตรวจรอบแรกตรวจ `passwordHash` แบบ substring → **จับทั้งที่อยู่ใน description ที่ถูกต้องและ plaintext `password` ใน request body ที่ถูกต้อง** → ต้องแก้ให้ตรวจเฉพาะ response ผ่าน `$ref` |
| สัดส่วน AI | 80% AI / 20% คน |

---

### แถวที่ 23 · Sprint 1 Close-out Report + Retro + Sprint 2 Report Update

| คอลัมน์ | ค่า |
|---|---|
| Task | Sprint 1 Close-out (ย้อนหลัง) + Sprint 2 Report Patch |
| Agent | `@agent-doc` |
| ผู้ใช้ควบคุม | นางสาวสุขสรร มาณีศรี |
| Prompt | "เขียน Sprint 1 report + retro จาก standup 2026-09-29 + ai-credit-log row 11-13 + commit จริง + แก้ Sprint 2 report ให้มี Sprint 1 reference" |
| ไฟล์ที่เปลี่ยน | `docs/agile/sprints/sprint-01-report.md` (ใหม่) · `docs/agile/retro/sprint-01.md` (ใหม่) · `docs/agile/sprints/sprint-02-plan.md` (แก้) · `docs/agile/sprints/sprint-02-report.md` (แก้) |
| ผลลัพธ์ | ✅ **2 ไฟล์ใหม่** (sprint-01-report.md + sprint-01.md) + 2 ไฟล์แก้ (sprint-02-plan.md + sprint-02-report.md)<br>✅ Sprint 1: 20 tables / 102 cols / 13/13 PASS / 8 index / 27 FK / 122 COMMENT<br>✅ Sprint 2 report: เพิ่ม Sprint 1 reference + ใส่ note "ปิดย้อนหลัง 2026-09-30"<br>✅ Sprint 2 plan: เพิ่ม note "Sprint 1 ปิดแล้ว" + ลบข้อความ "Sprint 1 ยังไม่ปิด" |
| การตรวจสอบ | 🔍 Validator ผ่าน (PASS) · ไม่มี BOM / ไม่มี conflict marker / ไม่มี `\u` escape ที่เหลือ |
| 💡 ข้อสังเกตที่สำคัญ | **Sprint 1 ไม่มี report/retro จริง = ช่องว่างกระบวนการใหญ่ที่สุด** (Retro Sprint 1 ข้อ ❌1)<br>Requirement ผิด 1 จุด (ดัชนี 9→8) จับได้เพราะรันจริงบน Oracle — **หลักฐานว่าต้องรันจริงไม่ใช่เพียงอ่านเอกสาร**<br>AI ผิด 6 จุด DDL → ย้ายเข้า Prompt P-02 → ไม่เกิดซ้ำใน Sprint 2<br>SP นับสองเกณฑ์ (`chapter-18` = 10 SP vs Stand-up = 16 SP) → ต้องชัดเจนใน Sprint 3 |
| 🐛 กรณีที่ AI ไม่ได้เจอเอง | 1. การสร้าง "plan" ย้อนหลังใน row 23 — Sprint 1 จริงๆ ไม่มี plan แยก ตัวแผนอยู่ใน `chapter-18` แล้ว<br>2. SP discrepancy ระหว่าง `chapter-18` กับ Stand-up = คนละสิ่งที่นับ → ต้องกำหนดนิยามก่อน Sprint 3 |
| ⚠️ ข้อผิดพลาดของ AI รอบนี้ | 1. พยายามแก้ Requirement ให้ตรงโค้ด (ดัชนี 9→8) แทนที่จะระบุว่า Requirement ผิด — ต้องแก้ Requirement ไม่ใช่โค้ด<br>2. ช่องว่าง `RPT.R4` ใน permission seed ต้องการตัดสินใจของอาจารย์ ไม่ใช่เรื่องที่ AI ควรตัดสินเอง |
| สัดส่วน AI | 85% AI / 15% คน |

---

## 📊 สรุปยอด Sprint 0 – 2 (ทั้งสองฝั่งรวมกัน)

| สมาชิก | จำนวนครั้งที่ใช้ AI | ไฟล์ที่ AI สร้าง/แก้ | สัดส่วน AI เฉลี่ย |
|---|---|---|---|
| นางสาวสุขสรร มาณีศรี | 17 | 34 | ~71% |
| นายเก่งกาญ เชี่ยวชาญ | 7 | 23+ | 74% |
| **รวมทั้งโปรเจกต์** | **24** | **57+** | **~72%** |
=======
### แถวที่ 22 · เขียน OpenAPI Spec ครบทุก Endpoint (T-014)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-014 — `docs/api/openapi.yaml` |
| Agent | `@agent-doc` (ร่างสเปก) + `@agent-coder` (ตรวจเงื่อนไข P-04 ข้อ 1–9) |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ |
| Prompt | P-04 `rest-endpoint` (ดู `docs/ai-prompts/P-04_rest-endpoint.md`) — "สร้างสเปก OpenAPI ให้ครบทุก endpoint จาก Use Case Spec + chapter 17 + DDL" |
| ไฟล์ที่เปลี่ยน | `docs/api/openapi.yaml` (ใหม่ · 5,600+ บรรทัด) · `docs/agile/sprints/sprint-02-plan.md` · `docs/ai-prompts/P-04_rest-endpoint.md` · `docs/ai-credit-log.md` · `docs/agile/standup/2026-09-30.md` |
| ผลลัพธ์ | ✅ **41 paths / 59 operations / 47 schemas** · ตรงกับ 17.5.2 **ครบทุกตัว**<br>✅ ครอบคลุม UC-01…UC-30 = **29/30** · BR-01…BR-12 ครบ 12 ตัว · `operationId` ไม่ซ้ำ · ทุก operation มี 401<br>✅ Redocly lint **valid · 0 error** (4 warning = 501 ของ R2/R3/R5/R7 ตาม 17.5.2 โดยตั้งใจ)<br>✅ ยกเป็นคำถาม **Q22 / Q23 / Q24** ใน `info.description` แทนที่จะเดา endpoint (P-04 ข้อ 9) |
| การตรวจสอบ | 🔍 สคริปต์นับเอง — operation/operationId ซ้ำ · `x-use-case` ครบทุก operation · BR ครบ · response code ครบ<br>🔍 `npx @redocly/cli lint` แก้จนเหลือ warning ที่ตั้งใจ · grep ยืนยันไม่มี `SELECT *` และไม่มี `password_hash` ใน response |
| 🐛 ที่ AI ทำผิดและคนตรวจเจอ | 1) **เพิ่ม `GET /permission-matrix` เอง** ทั้งที่ 17.5.2 ไม่มี → นับ operation เทียบแล้วเหลือ 59 จึงตัดออก ย้าย `granted_perm_ids` ไปไว้ใน `GET /roles` แทน<br>2) **ห่อ response ซ้อนสองชั้น** ที่ `/auth/login` → Redocly เตือน example ไม่ตรง schema<br>3) **base64 ตัวอย่างไม่ตรง `format: byte`** → แก้เป็น base64 เปล่า |
| ⚠️ ยังไม่ปิด | ⛔ **Q22 (UC-10)** — Use Case ไม่ระบุ API path และ 17.5.2 ไม่มี endpoint นี้ → คนต้องถามอาจารย์ (ห้าม AI ตัดสินเอง)<br>⛔ **Q23 / Q24** — เหมือนกัน · ⏳ รอ peer review จากสุขสรร (AR-02) |
| สัดส่วน AI | 80% AI / 20% คน (คนต้องตรวจชื่อคอลัมน์เทียบ `01_schema.sql` จริง และตัดสินใจเรื่อง Q22–Q24) |

---

### แถวที่ 23 · สร้าง Figma Mockup + SVG Export (T-009 เสริม)

| คอลัมน์ | ค่า |
|---|---|
| Task | T-009 (Figma integration + SVG assets) |
| Agent | `@agent-mockup` + `@agent-coder` (Playwright) |
| ผู้ใช้ควบคุม | นายเก่งกาญ เชี่ยวชาญ (ดำเนินการ Figma ผ่าน Playwright) |
| Prompt | "เปิด Figma ด้วย PlayWright ทำ GUI ได้เลย" → สร้าง 15 SVG 390×844 → paste ลง Figma canvas → จัด layout grid + rename frames → export Figma file |
| ไฟล์ที่เปลี่ยน | `docs/mockup/*.svg` (15 ไฟล์) · `docs/mockup/README.md` (อัปเดต Figma URL) · `docs/agile/sprints/sprint-02-plan.md` (อัปเดต DoD T-009) · `docs/agile/standup/2026-09-30.md` |
| ผลลัพธ์ | ✅ **Figma file ครบ 15 frames** — https://www.figma.com/design/piYhTrNy60bi7IjRkgaBZN/Shuttle-Bus-System---Mockup<br>✅ SVG source ทั้ง 15 ไฟล์ commit ใน `docs/mockup/`<br>✅ Layout grid 4 บทบาท: C1–C6 (0,0) / D1–D4 (0,904) / S1–S3 (0,1808) / A1–A2 (0,2712)<br>✅ Frames ชื่อครบ: C1–C6, D1–D4, S1–S3, A1–A2<br>⚠️ PNG export ยังไม่ commit — export จาก Figma File → Export → PNG ได้ทันที |
| การตรวจสอบ | 🔍 ตรวจผ่าน a11y tree: 15 frames visible · ชื่อ frame ตรง · X/Y position ตรง |
| สัดส่วน AI | 85% AI / 15% คน (คนตัดสินใจ layout + verify ผลลัพธ์) |

---

| สมาชิก | จำนวนครั้งที่ใช้ AI | ไฟล์ที่ AI สร้าง/แก้ | สัดส่วน AI เฉลี่ย |
|---|---|---|---|
| นางสาวสุขสรร มาณีศรี | 15 | 26 | ~70% |
| นายเก่งกาญ เชี่ยวชาญ | 9 | 28+ | ~75% |
| **รวมทั้งโปรเจกต์** | **24** | **54+** | **~72%** |
>>>>>>> origin/develop

> ตัวเลขนี้เป็น **ค่าประมาณ** (ประมาณจากจำนวนไฟล์ที่แก้และจำนวนจุดที่คนต้องตรวจแก้ไขเอง) ไม่ใช่การจับเวลาจริง
> **ผู้รับผิดชอบเอกสารทุกชิ้นคือคน ไม่ใช่ AI** (AR-04)

> ⚠️ **ข้อจำกัดที่ต้องแจ้งอาจารย์:** ณ 2026-09-30 `user.name` **และ** `user.email` ของทั้งสองคนแยกกันแล้ว
> (เก่งกาญ = `296676037+kaengkarn@…` · สุขสรร = `296676037+suebtas-mut@…`)
> → commit ใหม่จึงมี author ที่ต่างกันจริงใน Git metadata และใช้เป็นหลักฐาน AR-02 ได้
> 🔻 **แต่ทั้งสอง email ใช้ numeric user ID เดียวกัน (296676037)** → บน GitHub หน้า commit
> ผู้ดูโปรไฟล์อาจถูก redirect ไปที่ account เดียวกัน
> commit ก่อนหน้านี้ (รวมถึง merge commit `10928dc`) ยังเป็น `Sukhsorn Maneesri` — ไม่ rewrite

---

*ไฟล์นี้จะถูกอ้างอิงเป็นภาคผนวก ค (AI Usage Credit) ในรายงานปลาย Sprint 13 · Task T-061*
*อ้างอิง: บทที่ 18 (ข้อ 18.7 AR-04…AR-09) + `docs/agile/ai-prompts/prompt-log.md` + `docs/requirement-review-checklist.md` ข้อ A11*
