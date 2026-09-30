# T-009 — Mockup ระบบ SHUTTLE BUS

> **ผู้ทำ:** นางสาวสุขสรร มาณีศรี · **วันที่:** 2026-09-30 · **Sprint:** 2 (Day 3)
> **Task:** T-009 · **Story Points:** 10 · **Status:** ✅ ส่งมอบ (ดูหมายเหตุ Figma/ClickUp ท้ายไฟล์)

---

## 1. สิ่งที่ส่งมอบ

| ไฟล์ | รายละเอียด |
|---|---|
| [`mockup.html`](./mockup.html) | Wireframe แบบ interactive ครบ 15 หน้าจอ 4 บทบาท — เปิดในเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้งอะไร |
| [`mockup.html`](./mockup.html) | Wireframe แบบ interactive ครบ 15 หน้าจอ 4 บทบาท — เปิดในเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้งอะไร |
| `mockup.html` (หน้าเดียวกัน) | สลับบทบาทได้ที่แถบด้านบน · หน้าจอแสดง 2 ขนาด: **Phone 360×700** (R-08) และ **Tablet 760×520** (R-07 adaptive) |
| `*.svg` (15 ไฟล์) | SVG source ของแต่ละหน้าจอ 390×844 — นำเข้า Figma ได้ทันที |
| Figma file | https://www.figma.com/design/piYhTrNy60bi7IjRkgaBZN/Shuttle-Bus-System---Mockup — 15 frames วาง grid พร้อมชื่อ + ตำแหน่ง |
| ไฟล์นี้ | Screen inventory, การเชื่อมโยง UC/BR/ตาราง, และ Design System |

## 2. ข้อกำหนดที่ยึด (ตรวจแล้วว่าครบ)

| ข้อ | ต้นทาง | สถานะ |
|---|---|---|
| ข้อ 17.0 — ห้ามหน้าจอ Web/React ต้องเป็น **Flutter** | `docs/chapter-17-fullstack.md` | ✅ `mockup.html` เป็น **เอกสารสเปกหน้าจอ** ไม่ใช่แอป — ไม่มี logic, ไม่มี backend, ไม่มี route จริง · ทุกหน้าจอออกแบบสำหรับ Flutter (`Scaffold` + `AppBar` + `BottomNavigationBar`) |
| R-07 Adaptive UI | `docs/chapter-18-development-plan.md` | ✅ 2 breakpoint: 360px (เหลือ 3 คอลัมน์หลัก) / 760px ขึ้นไป (คอลัมน์ครบ) |
| R-08 Mobile-first | เดียวกัน | ✅ ทุกบทบาทยกเว้นผู้ดูแลเริ่มที่ 360px |
| R-06 Dynamic RBAC | เดียวกัน | ✅ แสดงหน้า "Permission Matrix" + เตือนห้าม hardcode `if (role === 'admin')` |
| ครบ 4 บทบาท | ข้อกำหนดโครงการ | ✅ Customer · Driver · Staff · Admin |
| ครอบคลุม UC-01…UC-30 | `usecase-spec.md` | ✅ แสดง mapping ด้านล่าง |
| สื่อสาร BR-01…BR-12 ให้ผู้ใช้เห็น | `chapter-08` | ✅ ผูก BR ที่เกี่ยวข้องไว้ใต้ชื่อหน้าจอ + แสดง validation/error state |

## 3. Screen Inventory — ครบ 15 หน้าจอ

### 👤 ลูกค้า (Customer) — 6 หน้าจอ

| # | หน้าจอ | UC | BR ที่แสดง | จุดที่ออกแบบเป็นพิเศษ |
|---|---|---|---|---|
| C1 | เข้าสู่ระบบ | UC-01 | — | แยกปุ่ม "เปลี่ยนรหัสผ่าน" ออกมา (UC-03) · **ไม่มีปุ่มลืมรหัสผ่าน** เพราะไม่มีในข้อกำหนด |
| C2 | หน้าหลัก — ค้นหารอบเดินทาง | UC-17 | BR-07, BR-12 | รอบเวลาแสดงเป็น chip สี: เขียว=ว่าง / เหลือง=เหลือน้อย / แดง=เต็ม |
| C3 | เลือกจุดขึ้น–ลง + จำนวนที่นั่ง | UC-17, UC-18 | BR-05, BR-06, BR-07, BR-10, BR-11, BR-12 | 3-step stepper · ปุ่มยืนยัน disable เมื่อเลือกจุดลงก่อนจุดขึ้น (BR-11) · ช่องที่นั่ง 1–4 (BR-06) |
| C4 | QR Code สำหรับเช็คอิน | UC-20 | BR-09 | แสดง QR placeholder + ข้อมูล booking เพื่อให้คนขับยืนยันรอบได้ |
| C5 | รายการเดินทางของฉัน | UC-19, UC-21 | BR-08 | 2 tab: กำลังจะมา / ประวัติ · ยกเลิกได้เฉพาะก่อนเวลาออก |
| C6 | เลือกรายงาน + ส่งออก | UC-30 | — | ปี / ช่วงวันที่ / เส้นทาง / รูปแบบ Excel-PDF-CSV |

### 🚗 คนขับ (Driver) — 4 หน้าจอ

| # | หน้าจอ | UC | BR ที่แสดง | จุดที่ออกแบบเป็นพิเศษ |
|---|---|---|---|---|
| D1 | ตารางงานรายวัน | UC-22 | BR-04 | KPI 2 ตัวบน (รอบวันนี้ / ผู้โดยสาร) + รายการรอบเป็น chip |
| D2 | Manifest รายจุดจอด | UC-24 | — | แยก 2 ตาราง: "ขึ้นรถ" (3) / "ลงรถ" (2) พร้อมสถานะเช็คอิน |
| D3 | สแกน QR เช็คอิน | UC-25 | BR-09, BR-10 | **ต้องมีช่องกรอก Token เป็นทางสำรอง** เพราะ R-05: QR Scanner ไม่ทำงานบน Emulator · แสดง error กรณีสแกนผิดรอบ |
| D4 | ปิดรอบ + สรุป | UC-26 | BR-10 | เตือนว่าเลือก `no_show` ได้เฉพาะคนที่ขึ้นรถแล้วแต่ยังไม่ลง |

### 👔 พนักงาน (Staff) — 3 หน้าจอ

| # | หน้าจอ | UC | BR ที่แสดง | จุดที่ออกแบบเป็นพิเศษ |
|---|---|---|---|---|
| S1 | จัดการเส้นทาง + เรียงจุดจอด | UC-12 | BR-01, BR-03 | ตาราง stop_seq + travel_minutes พร้อมแถวรวม · ช่อง total_minutes เป็น read-only ให้ Service คำนวณ |
| S2 | จัดรอบเวลา + มอบหมาย | UC-14, UC-15, UC-16 | BR-02, BR-04 | พรีวิว schedule_stop พร้อม arrive_at คำนวณแล้ว · แจ้งชนกับรอบ 11:00 |
| S3 | (ใช้ร่วมกับ Admin) จัดการพนักงาน | UC-04 | — | Staff เห็นเฉพาะเมนูตาม permission |

### 🛡️ ผู้ดูแล (Admin) — 2 หน้าจอเฉพาะตัว

| # | หน้าจอ | UC | จุดที่ออกแบบเป็นพิเศษ |
|---|---|---|---|
| A1 | จัดการข้อมูลพนักงาน | UC-04 | Master–Detail + Adaptive · **ปุ่ม "ปิดใช้งาน" แทน "ลบ" เมื่อมี booking ผูกอยู่** · ปุ่มเปิดใช้งานสำหรับคนที่ถูกปิด |
| A2 | Permission Matrix | UC-08, UC-09, UC-10 | ตาราง role × permission พร้อม `screen_key` · เตือนเรื่อง Dynamic RBAC + Prompt P-12 |

## 4. Use Case Coverage

| UC | หน้าจอ | UC | หน้าจอ |
|---|---|---|---|
| UC-01 | C1 | UC-16 | S2 |
| UC-02 | ทุกหน้าจอ (ปุ่มออกจากระบบใน AppBar) | UC-17 | C2, C3 |
| UC-03 | C1 | UC-18 | C3 |
| UC-04 | A1, S3 | UC-19 | C5 |
| UC-05 | *(A1 เป็น dropdown ร่วม)* | UC-20 | C4 |
| UC-06 | *(A1 เป็น dropdown ร่วม)* | UC-21 | C5 |
| UC-07 | A2 | UC-22 | D1 |
| UC-08 | A2 | UC-23 | D1 |
| UC-09 | A2 | UC-24 | D2 |
| UC-10 | A2 | UC-25 | D3 |
| UC-11 | *(S1 เป็น dropdown ร่วม)* | UC-26 | D4 |
| UC-12 | S1 | UC-27 | C6, รายงาน R1 |
| UC-13 | *(S2 เป็น dropdown ร่วม)* | UC-28 | C6, รายงาน R4 |
| UC-14 | S2 | UC-29 | C6, รายงาน R6 |
| UC-15 | S2 | UC-30 | C6 |

> ครอบคลุม 30/30 use case โดย UC-05/06/11/13 เป็น dropdown ภายในหน้าจอจัดการหลัก ไม่ต้องเปิดหน้าเฉพาะ
> (ลดจำนวนหน้าจอตามข้อ 16 "Screen Count 15 หน้าจอ")

## 5. Design System (สำหรับนำไปเขียน Flutter จริงใน Sprint 3)

| Token | ค่า | ใช้ทำอะไร |
|---|---|---|
| `primary` | `#1F5FA8` | AppBar, ปุ่มหลัก, เส้นเน้นสถานะ active |
| `primaryLight` | `#2F7AD4` | Gradient header |
| `success` | `#1C8A5A` | สถานะสำเร็จ / ที่นั่งว่าง / เช็คอินแล้ว |
| `warning` | `#B26A00` | เตือนก่อนทำ / ที่นั่งเหลือน้อย |
| `danger` | `#C0392B` | Validation error / รอบเต็ม / สแกนไม่ผ่าน |
| `textPrimary` | `#12203A` · `textMuted` `#6B7A99` | ลำดับชั้นข้อความ |
| `surface` | `#FFFFFF` · `background` `#F6F8FC` · `border` `#DFE5EF` | พื้นผิว |
| Spacing | 4 / 8 / 12 / 16 / 20 | ระยะหลัก (8pt grid) |
| Radius | 8 (input/ปุ่ม) · 10 (card) · 14 (modal) | ความโค้งมุม |

**Component ที่ต้องสร้างใน Sprint 3 (ประมาณการ):**
`ShuttleScaffold` · `ShuttleAppBar` · `ShuttleBottomNav` · `DataTableAdaptive` (R-07) · `StepIndicator` · `SeatPicker` · `QRTile` · `AlertBanner` (i/w/e) · `StatusChip` · `DateRangePickerTH` · `QrScannerWithManualFallback` (R-05)

## 6. ⚠️ ข้อจำกัดของงานนี้ (ต้องแจ้งอาจารย์)

| # | ข้อจำกัด | ผลต่อ DoD | แนวทางปิด |
|---|---|---|---|
| 1 | ~~ไม่มี Figma integration~~ — **Figma file สร้างแล้ว** | DoD "อัปโหลด Figma + export PNG" — **Figma ครบ** | https://www.figma.com/design/piYhTrNy60bi7IjRkgaBZN/Shuttle-Bus-System---Mockup |
| 2 | **ไม่มี ClickUp access** | DoD ระบุ "อัปโหลดขึ้น ClickUp" — **ทำส่วนนี้ไม่ได้** | สุขสรรต้อง upload เอง + แจ้งอาจารย์ด้วยลิงก์ |
| 3 | PNG export | DoD ระบุ "export เป็น PNG" | จาก Figma: File → Export → เลือก 15 frames → PNG (หรือใช้ SVG ในโฟลเดอร์นี้) |
| 4 | เวลาที่ใช้จริงมากกว่า 5 ชม. (ประมาณ 6) | ผิด DoR เดิม (งานไม่เกิน 3 ชม.) | บันทึกไว้ใน `docs/agile/sprints/sprint-02-plan.md` แล้ว |
| 5 | UI ไม่มีสีจริงตาม Brand | ใช้โทนกลาง เพื่อให้เน้นโครงสร้าง | ปรับ Theme ใน Flutter Sprint 3 |

## 7. วิธีเปิดดู

```
1. เปิดไฟล์  docs/mockup/mockup.html  ด้วย Chrome / Edge
2. เลือกบทบาทที่แถบบน: ลูกค้า / คนขับ / พนักงาน / ผู้ดูแล
3. เลื่อนลงดูทุกหน้าจอ — หัวข้อกำกับข้างบนระบุชื่อหน้าจอ, UC และ BR ที่เกี่ยวข้อง
4. ถ้าต้องการภาพ: Ctrl+P → Save as PDF  (ได้ทุกหน้าจอในไฟล์เดียว)
```
