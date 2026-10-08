# Test Plan + Test Case — BR-01 … BR-12 (T-060)

- **งาน**: T-060 — เขียน Test Plan และ Test Case สำหรับ Business Rule ทั้ง 12 ข้อ
  (ตาม `docs/chapter-17-fullstack.md` §17.4.5 · checklist A9)
- **วันที่**: 2026-10-09
- **ผู้เขียน**: Sukhsorn agent (Flutter stream — รับงานต่อจาก controller Sprint 12)
- **ขอบเขต**: ออกแบบ Test Case 12 รายการ + ตารางโยง BR → ตำแหน่งบังคับใช้ →
  หลักฐานเทสต์ที่มีจริง · **ไม่รวมการรัน backend test** (สาย backend เป็นเจ้าของ
  service/SQL ทั้งหมด — เอกสารนี้บันทึกเฉพาะสิ่งที่ตรวจสอบได้จริงในเครื่องนี้)
- **สถานะ**: เอกสาร plan/case พร้อมตรวจ · **ยังไม่มี human review, ยังไม่ได้
  integration test กับ backend จริง/ฐานข้อมูลจริง**

## 1. วิธีทดสอบและสิ่งแวดล้อม

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับการทดสอบ | (1) Flutter widget/unit test บน FakeBackend (รันได้จริงในเครื่องนี้) · (2) Backend service test (สาย backend รันเอง: `npm.cmd test -- --runInBand`) · (3) Integration กับ Oracle จริง (ยังไม่ถึงขั้นนี้) |
| สิ่งแวดล้อมไคลเอน | Flutter 3.47.5 / Dart 3.13.4 · FakeBackend จำลอง OpenAPI (`app/test/support/fake_backend.dart`) |
| สิ่งแวดล้อม backend | Node.js + node-oracledb + Oracle XE 19c (ตาม `docs/api/openapi.yaml` servers) — **agent สายนี้ไม่ได้รัน** |
| เกณฑ์ผ่าน (ไคลเอน) | เทสต์ `flutter test --no-pub` ผ่านทั้งหมด · ข้อความแสดงตรงตามที่กำหนด (verbatim เมื่อเซิร์ฟเวอร์ส่ง message) |
| เกณฑ์ผ่าน (backend) | Service ปฎิเสธ/ยอมรับตาม BR · คืน `code`/`message` ตามสัญญา — **ต้องรันโดยสาย backend** |

## 2. Test Case (12 รายการ)

### TC-BR01 — `route.total_minutes` = ผลรวมนาทีทุกจุดจอด

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-01 · Service คำนวณใหม่ทุกครั้งที่แก้ `route_stop` |
| Preconditions | เส้นทางมีจุดจอด ≥ 2 จุด (travel_minutes ต่างกัน) |
| Steps | 1 แก้เส้นทาง (เพิ่ม/ลบ/เปลี่ยน travel_minutes จุดใดจุดหนึ่ง) → 2 บันทึก → 3 ดู `route.totalMinutes` ที่ส่งกลับ |
| Expected | `totalMinutes` = `SUM(travel_minutes)` ทุกจุดของเส้นทางนั้น · ถ้าผลรวมเปลี่ยน ค่าที่ส่ง/แสดงต้องเปลี่ยนตาม |
| หลักฐานไคลเอน (รันแล้ว) | `sprint06_test.dart`: "แก้เส้นทาง: แก้นาที เรียงลำดับ เพิ่มจุดจอด total คำนวณสด BR-01 และ PUT ส่งตามลำดับอาร์เรย์" — **ผ่าน** (ยืนยันฝั่งไคลเอนส่ง PUT พร้อม total คำนวณสด) |
| หลักฐาน backend | ยังไม่ได้รัน (T-0xx สาย backend) — ตำแหน่งบังคับใช้: Service ตาม §17.4.5 |

### TC-BR02 — `schedule_stop.arrive_at` = เวลาออก + ผลรวมนาทีถึงจุดนั้น

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-02 · Service auto-generate เมื่อสร้าง Schedule |
| Preconditions | มีเส้นทางที่ทราบ travel_minutes รายจุด |
| Steps | 1 สร้างรอบเวลา (POST /schedules) → 2 ดู `stops[].arriveAt` ของรอบที่สร้าง |
| Expected | จุดแรก `arrive_at = depart_at` · จุดถัดไป = `depart_at + SUM(travel_minutes ถึงจุดนั้น)` (สูตร `NUMTODSINTERVAL`) |
| หลักฐานไคลเอน | ไม่มีเทสต์ไคลเอนที่ยืนยันสูตรโดยตรง (ไคลเอนแสดง `arriveAt` ที่เซิร์ฟเวอร์คืนมา — sprint10 manifest "ผ่านแล้ว/ถัดไป" ใช้ค่านี้คำนวณ UI) |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยันสูตร Oracle |

### TC-BR03 — จุดจอด 1 จุด อยู่ได้หลายเส้นทาง (ไม่ UNIQUE stop_id)

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-03 · `UNIQUE(route_id, stop_id)` แต่ไม่ UNIQUE `stop_id` |
| Preconditions | มีจุดจอด A อยู่ในเส้นทาง 1 แล้ว |
| Steps | 1 เพิ่มจุดจอด A เข้าเส้นทาง 2 → 2 บันทึก → 3 (ทางกลับ) เพิ่มจุดจอด A ซ้ำในเส้นทาง 1 อีกครั้ง |
| Expected | (1+2) สำเร็จ — จุดเดียวกันใช้ซ้ำข้ามเส้นทางได้ · (3) ถูกปฏิเสธด้วย constraint/Service (ซ้ำในเส้นทางเดียวกัน) |
| หลักฐานไคลเอน | ไม่มีเทสต์ไคลเอนยืนยันโดยตรง (เป็น DB constraint + service) |
| หลักฐาน backend | ยังไม่ได้รัน — ตำแหน่งบังคับใช้: `UNIQUE(route_id, stop_id)` |

### TC-BR04 — คนขับ/รถ 1 คัน 1 ช่วงเวลา ห้ามชนกับตัวเอง

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-04 · Service `checkConflict()` + Transaction |
| Preconditions | คนขับ X มีรอบเวลาช่วง 09:00–10:00 อยู่แล้ว |
| Steps | 1 มอบหมายคนขับ X ให้รอบเวลาซ้อนทับ (09:30–10:30) → 2 ส่ง PUT /schedules/{id}/assignments |
| Expected | 409 `BR04_DRIVER_CONFLICT` + message แสดงชื่อรอบที่ชน |
| หลักฐานไคลเอน (รันแล้ว) | `sprint10_test.dart`: "conflict BR-04: แบนเนอร์ + dialog + รายละเอียด + หมายเหตุ tripId gap + ออก ไม่ส่ง POST ใด ๆ" — **ผ่าน** (ตรวจ conflict ฝั่งไคลเอนก่อน POST เริ่มรอบ: ถ้ามีรอบ running ค้าง → แสดงทางเลือก "ปิดรอบเก่าก่อน"/"ออก") |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน checkConflict + Transaction |

### TC-BR05 — จองต้องเกิดก่อนเวลารถถึงจุดขึ้นอย่างน้อย 20 นาที

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-05 · Service `checkLeadTime()` |
| Preconditions | มีรอบที่รถถึงจุดขึ้นในอีก 10 นาที |
| Steps | 1 จองที่นั่งในรอบนั้น (POST /bookings) → 2 สังเกตผลลัพธ์ |
| Expected | 400/422 พร้อม message "กรุณาจองล่วงหน้าอย่างน้อย 20 นาที" (หรือข้อความเซิร์ฟเวอร์) |
| หลักฐานไคลเอน (รันแล้ว) | `sprint08_test.dart`: "ยืนยัน: BR-05 (cutoff) ที่เซิร์ฟเวอร์ตรวจตอน POST → แสดงข้อความ 'กรุณาจองล่วงหน้าอย่างน้อย 20 นาที…'" — **ผ่าน** (ยืนยันข้อความแสดง verbatim) |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน checkLeadTime |

### TC-BR06 — ผู้ใช้ 1 คนจองได้ไม่เกิน 4 ที่นั่ง

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-06 · `CHECK (seats BETWEEN 1 AND 4)` + Service |
| Preconditions | อยู่ในหน้าจอง มีรอบว่าง |
| Steps | 1 เปลี่ยนจำนวนที่นั่งเป็น 5 → 2 สังเกตปุ่มยืนยัน · 3 (ทางกลับ) เลือก 4 ที่นั่งแล้วยืนยัน |
| Expected | (1–2) ฝั่ง UI บล็อกไม่ให้เกิน 4 (ปุ่มเพิ่มปิดใช้งาน) และ/หรือเซิร์ฟเวอร์ 422 `BR06_SEATS_RANGE` · (3) สำเร็จ |
| หลักฐานไคลเอน (รันแล้ว) | `sprint08_test.dart`: "จำนวนที่นั่ง: BR-06 เลือกได้ 1–4 (เกิน 4 เพิ่มไม่ได้ · ต่ำสุด 1)" — **ผ่าน** · "ยืนยัน: 422 BR06_SEATS_RANGE (เซิร์ฟเวอร์ตรวจซ้ำ) แสดงข้อความตามที่มา" — **ผ่าน** |
| หลักฐาน backend | ยังไม่ได้รัน — CHECK constraint + service |

### TC-BR07 — ที่นั่งว่าง = capacity − ผลรวมที่นั่งที่ reserved

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-07 · Service + `SELECT ... FOR UPDATE NOWAIT` |
| Preconditions | รอบมี capacity 15 · มี reserved รวม 13 ที่นั่ง |
| Steps | 1 จองเพิ่ม 3 ที่นั่ง (เกิน capacity) → 2 สังเกตผล |
| Expected | 409 `SEATS_FULL` + ข้อความที่นั่งเต็ม (ไม่มีผลสำเร็จปลอม) |
| หลักฐานไคลเอน (รันแล้ว) | `sprint08_test.dart`: "ยืนยัน: 409 SEATS_FULL แสดงข้อความที่นั่งเต็มตามที่มา · ไม่มีผลสำเร็จปลอม" — **ผ่าน** |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน FOR UPDATE NOWAIT กัน oversell แบบ concurrent |

### TC-BR08 — ยกเลิกแล้วที่นั่งถูกคืนทันที

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-08 · Transaction → `status='cancelled'` · SUM เฉพาะ `reserved` |
| Preconditions | การจอง code X สถานะ reserved อยู่ในรอบที่นั่งใกล้เต็ม |
| Steps | 1 ยกเลิกการจอง X (POST /bookings/{code}/cancel) → 2 ผลเป็น 204 → 3 จองที่นั่งใหม่ในรอบเดิม |
| Expected | ยกเลิกสำเร็จ · ที่นั่งถูกคืน (นับรวมเฉพาะ reserved → cancelled ไม่ถูกนับ) · จองใหม่ได้ตามที่นั่งว่างจริง |
| หลักฐานไคลเอน (รันแล้ว) | `sprint09_test.dart`: "ยกเลิก: ยืนยัน dialog → POST /bookings/{code}/cancel (Bearer, ไม่มี body) → 204 + snackbar + โหลดรายการใหม่" — **ผ่าน** |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน SUM เฉพาะ reserved + คืนที่นั่งทันทีใน transaction เดียว |

### TC-BR09 — สแกน QR ผิดรอบ → ไม่อนุญาตให้ขึ้นรถ

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-09 · Service `validateQr()` — เทียบ `booking.sched_id` กับ `trip.sched_id` |
| Preconditions | token ของ booking ในรอบ A · คนขับเปิดหน้าสแกนของรอบ B |
| Steps | 1 สแกน/กรอก token ของรอบ A บนหน้าสแกนรอบ B → 2 สังเกตผล |
| Expected | 409 + message "QR นี้ไม่ใช่รอบที่กำลังเดินรถ" (ผิดรอบ) หรือ "สแกนซ้ำแล้ว" (BR09_ALREADY_CHECKED_IN) แสดง verbatim · ยิงต่อได้หลังล้มเหลว |
| หลักฐานไคลเอน (รันแล้ว) | `sprint11_test.dart`: "409 ซ้ำ (BR-09): ข้อความเซิร์ฟเวอร์ verbatim · สแกนต่อได้หลังล้มเหลว" — **ผ่าน** · "409 ผิดรอบ (TC-25-01): แสดง 'QR นี้ไม่ใช่รอบที่กำลังเดินรถ' สีแดง" — **ผ่าน** |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน validateQr เทียบ sched_id |

### TC-BR10 — ปิดรอบงาน → ที่ยัง `reserved` กลายเป็น `no_show`

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-10 · Service `completeTrip()` — `UPDATE booking SET status='no_show' WHERE ...` |
| Preconditions | รอบ running มี booking สถานะ reserved (ยังไม่ check-in) และ checked_in อย่างละ ≥ 1 |
| Steps | 1 ปิดรอบ (POST /driver/trips/{tripId}/end) → 2 ผล 204 → 3 ดูหน้าสรุปรอบ (D4) |
| Expected | reserved → `no_show` (แสดงในรายชื่อ No Show + KPI) · checked_in → `completed` · 409 เมื่อปิดซ้ำ/ยังปิดไม่ได้แสดง message ใน dialog |
| หลักฐานไคลเอน (รันแล้ว) | `sprint11_test.dart`: "ปิดรอบ 409 (BR-10 ยังปิดไม่ได้): ข้อความใน dialog · dialog ค้าง" — **ผ่าน** · "KPI + รายชื่อ No Show + ยกเลิก: นับจากสถานะหลังปิดรอบ" — **ผ่าน** (นับ no_show ที่เซิร์ฟเวอร์คืน) |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน UPDATE reserved→no_show + checked_in→completed ใน completeTrip |

### TC-BR11 — จุดขึ้นรถต้องอยู่ก่อนจุดลงรถ

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-11 · Service `checkStopOrder()` — `board_seq < alight_seq` |
| Preconditions | อยู่ในหน้าจอง รอบมีจุดจอด ≥ 2 |
| Steps | 1 เลือกจุดขึ้น = จุดสุดท้าย และจุดลง = จุดแรก (ย้อนกลับ) → 2 สังเกตการยืนยัน |
| Expected | ถูกบล็อกฝั่ง UI หรือเซิร์ฟเวอร์ 4xx พร้อมข้อความ — ต้องเลือกจุดขึ้นก่อนจุดลง |
| หลักฐานไคลเอน (รันแล้ว) | `sprint08_test.dart`: "เลือกจุดขึ้น–ลง: GET /stops ตามสเปก + บังคับเลือกทั้งสองจุด + BR-11 ห้ามจุดขึ้น = จุดลง" — **ผ่าน** |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน checkStopOrder |

### TC-BR12 — จุดขึ้นและจุดลงต้องอยู่ในเส้นทางของรอบที่เลือก

| หัวข้อ | รายละเอียด |
|---|---|
| BR | BR-12 · Service `checkStopInRoute()` — JOIN `schedule_stop` |
| Preconditions | รอบ A มีจุดจอด {1,2,3} · จุดจอด 9 อยู่นอกเส้นทางนี้ |
| Steps | 1 จองรอบ A โดยเลือกจุดขึ้น/ลง = จุด 9 (นอกเส้นทาง) → 2 ส่ง POST /bookings |
| Expected | 4xx + ข้อความว่าจุดไม่อยู่ในเส้นทางของรอบ |
| หลักฐานไคลเอน | ไม่มีเทสต์ไคลเอนที่ยืนยันโดยตรง (UI มีเฉพาะจุดที่โหลดจากรอบนั้น — ไม่เสนอจุดนอกเส้นทาง; การบังคับจริงอยู่ที่ service) |
| หลักฐาน backend | ยังไม่ได้รัน — ต้อง service test ยืนยัน checkStopInRoute |

## 3. Traceability Matrix (BR → บังคับใช้ที่ → Test Case → หลักฐาน)

| BR | ตำแหน่งบังคับใช้ (§17.4.5) | Test Case | หลักฐานไคลเอนที่รันแล้ว (ผ่าน) | หลักฐาน backend |
|---|---|---|---|---|
| BR-01 | Service คำนวณ SUM นาที | TC-BR01 | sprint06 "total คำนวณสด BR-01" | ยังไม่ได้รัน |
| BR-02 | Service auto-generate arrive_at | TC-BR02 | — (แสดงค่าที่เซิร์ฟเวอร์คืน) | ยังไม่ได้รัน |
| BR-03 | `UNIQUE(route_id, stop_id)` | TC-BR03 | — | ยังไม่ได้รัน |
| BR-04 | Service checkConflict + Transaction | TC-BR04 | sprint10 "conflict BR-04" | ยังไม่ได้รัน |
| BR-05 | Service checkLeadTime (≥20 นาที) | TC-BR05 | sprint08 "BR-05 cutoff" | ยังไม่ได้รัน |
| BR-06 | CHECK seats 1–4 + Service | TC-BR06 | sprint08 "BR-06 1–4" + "422 BR06_SEATS_RANGE" | ยังไม่ได้รัน |
| BR-07 | Service + FOR UPDATE NOWAIT | TC-BR07 | sprint08 "409 SEATS_FULL" | ยังไม่ได้รัน |
| BR-08 | Transaction cancelled → คืนที่นั่ง | TC-BR08 | sprint09 "ยกเลิก → 204 + reload" | ยังไม่ได้รัน |
| BR-09 | Service validateQr (เทียบ sched_id) | TC-BR09 | sprint11 "409 ซ้ำ/ผิดรอบ BR-09" | ยังไม่ได้รัน |
| BR-10 | Service completeTrip (reserved→no_show) | TC-BR10 | sprint11 "ปิดรอบ 409 BR-10" + "KPI No Show" | ยังไม่ได้รัน |
| BR-11 | Service checkStopOrder (board<alight) | TC-BR11 | sprint08 "BR-11 ห้ามจุดขึ้น = จุดลง" | ยังไม่ได้รัน |
| BR-12 | Service checkStopInRoute (JOIN) | TC-BR12 | — | ยังไม่ได้รัน |

> หลักฐานไคลเอนทั้งหมดข้างต้นมาจาก `flutter test --no-pub` (ชุด sprint12 รันล่าสุด
> **173/173 ผ่าน** รวม sprint04–12) — ชื่อเทสต์อ้างอิงไฟล์ `app/test/sprintNN_test.dart`
> · หลักฐาน backend = **ยังไม่ได้รันในเครื่องนี้** (สาย backend รันเอง — ห้ามถือว่าผ่าน)

## 4. ข้อจำกัดและสิ่งที่ยังไม่พิสูจน์

- **ยังไม่มี**: human review · integration test กับ backend จริง/Oracle จริง ·
  ผลรัน backend service test (agent สายนี้ไม่ได้รัน `npm.cmd test` และไม่ได้แตะ `backend/`)
- **Concurrency (BR-07)**: ต้องมี test แบบ concurrent (2 transactions แข่งกันจอง) จึงจะพิสูจน์
  FOR UPDATE NOWAIT ได้จริง — ยังไม่มีในเครื่องนี้
- **ขอบเขต Test Case**: ออกแบบตาม BR ใน §17.4.5 — ไม่รวม NFR (performance < 3 วินาที
  ที่ 50,000 แถว) ซึ่งอยู่ในขอบเขต T-057 (Index Tuning) และต้องรันกับ seed จริง
- Test Case นี้ **ไม่ได้แทนการอ่านโค้ด service** — ตำแหน่งบังคับใช้อ้างอิงตามเอกสาร
  §17.4.5 (ต้องตรวจสอบซ้ำเมื่อสาย backend ส่งมอบโค้ดจริง)
