# Implementation / Requirements Traceability Matrix (Flutter stream)

- **วันที่**: 2026-10-09 · **ผู้จัดทำ**: Sukhsorn agent (Flutter stream, Sprint 13)
- **ฐานอ้างอิง**: `docs/chapter-18-development-plan.md` (req R-01..R-14, tasks
  T-001..T-062) · `docs/chapter-17-fullstack.md` (BR-01..BR-12) ·
  `docs/api/openapi.yaml` (สัญญา API) · `docs/diagrams/usecase/usecase-spec.md`
  (UC-01..UC-30) · `docs/testing/test-plan-br01-br12.md` (TC-BR01..BR12)
- **วิธีอ่าน**: หลักฐาน = ผลรันจริงในเครื่องนี้ (`flutter analyze --no-pub` →
  No issues · `flutter test --no-pub` → **193/193 ผ่าน** ณ 2026-10-09) ·
  ช่อง "ยังไม่พิสูจน์" ระบุสิ่งที่**ห้ามถือว่าผ่าน**

## 1. รายงาน R1 / R4 / R6 (ขอบเขตรายงานตาม PDF)

| รายงาน | Use case | สัญญา API (OpenAPI) | หน้าจอ (Flutter) | Task | หลักฐานเทสต์ (รันแล้ว ผ่าน) | ยังไม่พิสูจน์ |
|---|---|---|---|---|---|---|
| R1 คนขึ้น/ลงรายวัน | UC-27, UC-30 | `GET /reports/r1` (from/to/routeId, rows: serviceDate..attendanceRate) | `report_r1_view.dart` + `report_shell.dart` (tab R1) | T-053, T-054*, T-058 | sprint12_test 14 tests: contract GET+Bearer, KPI, กราฟ fl_chart, ตาราง, สถานะโหลด/ว่าง/500+retry, 403, ตัวกรองปี/ช่วงวันที่/เส้นทาง, client gate RPT.R1 | backend T-054 (endpoint จริง) · live integration · human review |
| R4 ผู้โดยสารแยกช่วงเวลา | UC-28, UC-30 | `GET /reports/r4` (from/to, rows: period/morning..evening, totalPassengers, avgPerTrip) | `report_r4_view.dart` (tab R4) | T-053, T-055*, T-059 | sprint13_test: contract GET+Bearer, KPI, กราฟ 3 ช่วง (เช้า/บ่าย/เย็น), ตาราง, โหลด/ว่าง/500+retry, client gate RPT.R4 | backend T-055* · **หมายเหตุสิทธิ์**: ตาราง permission จริงไม่มี `RPT.R4` (OpenAPI ระบุ) — ถ้า backend ไม่เพิ่ม ผู้ใช้จริงจะเห็นเฉพาะข้อความไม่มีสิทธิ์ · live integration |
| R6 สถิติการใช้งานรถ | UC-29, UC-30 | `GET /reports/r6` (from/to, rows: vehId/plateNo/totalTrips/totalPassengers/totalMinutes) | `report_r6_view.dart` (tab R6) | T-053, T-056*, T-059 | sprint13_test: contract GET+Bearer, KPI 4 การ์ด, กราฟรายคัน, ตาราง, โหลด/ว่าง/500+retry, client gate RPT.R6 | backend T-056* · live integration |
| ส่งออก (UC-30) | UC-30 | `GET /reports/{reportId}/export?format=csv\|xlsx` (สิทธิ์รายงานเดียวกัน, Content-Disposition) | `report_export.dart` ปุ่ม "ส่งออก" ทุกแท็บ (r1/r4/r6) | T-059 | sprint13_test 4 tests: CSV R1 (ชื่อไฟล์จาก header + ตัวอย่างเนื้อหา), XLSX R4 (นับไบต์), CSV R6 (fallback filename), 503 → snackbar ข้อความเซิร์ฟเวอร์ | **ไม่มีการบันทึกไฟล์ลงอุปกรณ์จริง** (ไม่เพิ่ม dep path_provider/share) — แสดง preview ในแอปเท่านั้น · xlsx จริง (binary จาก backend) · live integration |

> `T-053/T-054/T-055/T-056*` = เป็นงานสาย backend (API/SQL) — agent สายนี้**ไม่ได้ทำและไม่ได้รัน** · ฝั่ง client ทดสอบด้วย FakeBackend ที่จำลองสัญญา OpenAPI เท่านั้น

## 2. รายงานอื่น (นอกขอบเขตกลุ่ม — R2/R3/R5/R7)

| รายงาน | Task (แผน) | สถานะฝั่ง Flutter | เหตุผล |
|---|---|---|---|
| R2/R3/R5/R7 | T-052..T-056 (backend) | **ไม่มีหน้าจอในแอป** — OpenAPI มี endpoint ครบ (schema `ReportGeneric`) แต่กลุ่มไม่รับผิดชอบ (mockup ระบุ "ไม่อยู่ในขอบเขตของกลุ่ม · ยังไม่ยืนยัน Q-E") · ไม่มี tab ใน ReportShell | ตามขอบเขต PDF/mockup — ถ้าจะเพิ่มต้องมียืนยัน requirements ก่อน |

## 3. Business Rules BR-01..BR-12

ดูฉบับเต็ม: `docs/testing/test-plan-br01-br12.md` (TC-BR01..BR12 + matrix) · สรุปหลักฐาน client ที่รันแล้ว:

| BR | หลักฐาน client (รันแล้ว ผ่าน) | หลักฐาน backend |
|---|---|---|
| BR-01 | sprint06: total คำนวณสด BR-01 | ยังไม่ได้รัน |
| BR-02 | — | ยังไม่ได้รัน |
| BR-03 | — | ยังไม่ได้รัน |
| BR-04 | sprint10: conflict BR-04 | ยังไม่ได้รัน |
| BR-05 | sprint08: BR-05 cutoff ข้อความ verbatim | ยังไม่ได้รัน |
| BR-06 | sprint08: BR-06 1–4 + 422 BR06_SEATS_RANGE | ยังไม่ได้รัน |
| BR-07 | sprint08: 409 SEATS_FULL | ยังไม่ได้รัน (concurrency ต้อง test แยก) |
| BR-08 | sprint09: ยกเลิก → 204 + reload | ยังไม่ได้รัน |
| BR-09 | sprint11: 409 ซ้ำ/ผิดรอบ | ยังไม่ได้รัน |
| BR-10 | sprint11: ปิดรอบ 409 + KPI No Show | ยังไม่ได้รัน |
| BR-11 | sprint08: BR-11 ห้ามจุดขึ้น=จุดลง | ยังไม่ได้รัน |
| BR-12 | — | ยังไม่ได้รัน |

## 4. หน้าจอหลัก (Flutter feature inventory) → Task → เทสต์

| หน้าจอ/โมดูล | Task | เทสต์ไฟล์ (ผ่านทั้งหมด) |
|---|---|---|
| Adaptive shell + dynamic menu | T-013 | adaptive_shell_test, sprint05_test |
| Login + account + เปลี่ยนรหัสผ่าน | T-023, T-028 | widget_test, sprint05_test |
| Master: แผนก/ตำแหน่ง/พนักงาน/矩阵สิทธิ์ | T-017, T-018, T-033 | sprint04_test, sprint05_test |
| Front: เส้นทาง/จุดจอด/รอบเวลา/รถ | T-023, T-028, T-040 | sprint06_test, sprint07_test |
| Booking + QR + My Booking + ยกเลิก | T-041 | sprint08_test, sprint09_test |
| Driver: ตารางวันนี้/Manifest/ปิดรอบ | T-048, T-051 | sprint10_test, sprint11_test |
| Scan QR (debounce 2s, BR-09/BR-10) | T-050 | sprint11_test |
| Report R1 | T-058 | sprint12_test |
| Report R4/R6 + export | T-059 | sprint13_test |

## 5. สรุปสิ่งที่**ยังไม่ได้พิสูจน์** (ห้ามอ้างว่าผ่าน)

1. **Backend จริงทุก endpoint** — client ทั้งหมดทดสอบกับ FakeBackend จำลอง OpenAPI · ยังไม่มี integration test กับ Node/Oracle จริง · T-054/T-055/T-056 (รายงาน API) และ T-029/T-039/T-053 เป็นงานสาย backend ที่ agent สายนี้ไม่ได้รัน
2. **Real device / E2E** — ไม่ได้ติดตั้ง APK บนเครื่องจริง · ไม่ได้ทดสอบกล้อง QR บนอุปกรณ์ · ไม่ได้ทดสอบ network latency จริง · ไม่ได้ human usability review
3. **APK release** — สร้างได้เฉพาะ `app-debug.apk` (170.13 MB, 2026-10-09) — ยังไม่มี release signing · ยังไม่ได้ทดสอบติดตั้งจริง
4. **NFR** — เวลาตอบ < 3 วินาที ที่ 50,000 แถว (T-057 index tuning) ยังไม่วัดกับข้อมูลจริง (backend stream)
5. **สิทธิ์ RPT.R4 ในตาราง permission จริง** — OpenAPI ระบุว่าไม่มีใน DB → ถ้า backend ไม่เพิ่ม ฟีเจอร์ R4 จะเห็นเฉพาะข้อความไม่มีสิทธิ์สำหรับผู้ใช้จริง (client gate ทำงานถูกต้องแล้วตามสเปก)
6. **Human review / instructor sign-off** — ไม่มี
