# Sprint 10 Handoff — T-048/T-049 (Sukhsorn / Flutter stream)

- **วันที่**: 2026-10-08
- **Branch**: `feature/sprint3-sukhsorn-autonomous` (HEAD `b107da0`, ไม่มี commit จาก worker)
- **ขอบเขตงาน**: Flutter client + เอกสารเท่านั้น — backend เป็นเจ้าของ API/SQL ทั้งหมด
  (T-043/T-044/T-045/T-046 ของสาย backend ไม่ได้แตะ)
- **สถานะ**: ทำงานในเครื่องเสร็จ + เทสต์ผ่านครบ — **ยังไม่มี human review, ยังไม่ได้ test กับ server จริง**

## 1. งานที่ทำ

### T-048 — ตารางงานรายวันของคนขับ + เริ่มรอบ (UC-22/UC-23 · จอ D1)
- `GET /api/v1/driver/today?serviceDate=yyyy-MM-dd` (ตาม OpenAPI, ส่งวันที่ปัจจุบันจากเครื่อง)
  แสดงเฉพาะรอบของตัวเอง (เซิร์ฟเวอร์กรองด้วย empId ของ token): การ์ดสถิติ (รอบวันนี้/ผู้โดยสาร),
  ชิปกรองตามเส้นทาง, การ์ดรอบ (เวลา·เส้นทาง, สถานะ ถัดไป/รอ/กำลังเดิน/เสร็จแล้ว, นาที·จุดจอด·รถ,
  จำนวนผู้โดยสาร, คำใบ้สถานะ), ปุ่ม `เริ่มเดินทางรอบ HH:mm` (auto-select รอบ upcoming แรก,
  แตะการ์ดเพื่อเปลี่ยนรอบ), แบนเนอร์เตือนเมื่อมีรอบกำลังเดิน, หมายเหตุ BR-04
- เริ่มรอบ (UC-23): `GET /schedules/{schedId}` หา `vehicle.vehId` →
  `POST /driver/trips` body `{schedId, vehId}` (x-permission `TRIP.START`) → 201 เก็บ `tripId`
  แล้วเปิด Manifest ทันที · 409 แสดง `message` ของเซิร์ฟเวอร์ผ่าน snackbar + โหลดตารางวันใหม่
- Conflict BR-04 (ตรวจฝั่งไคลเอนต์ก่อน POST): ถ้ามีรอบ `running` อื่นของคนขับคนเดียวกันค้างอยู่
  → แสดง `drv-conflict-banner` + dialog (`barrierDismissible:false`, `PopScope` กันปิดระหว่างส่ง)
  พร้อมรายละเอียด `รอบ HH:mm · เส้นทาง · รถ plate` และทางเลือก
  **"ปิดรอบเก่าก่อน"** (ต้องมีสิทธิ์ `TRIP.END` และทราบรอบ trip จาก cache — end 204 แล้วเริ่มรอบใหม่ต่อ)
  หรือ **"ออก"** (ไม่ส่ง POST ใด ๆ) — ปุ่มปิดรอบไม่แสดงเมื่อไม่มีสิทธิ์/ไม่ทราบรอบ trip
- ไม่มี `TRIP.START` → ปุ่มเริ่มเดินทางปิดใช้งาน (`onPressed: null`) ไม่ใช่ซ่อน — เทสต์ยืนยันไม่มี POST

### T-049 — Manifest ผู้โดยสาร ขึ้น/ลง รายจุดจอด (UC-24 · จอ D2)
- `GET /api/v1/driver/trips/{tripId}/manifest` → `DriverManifest` (ไม่มี x-permission)
- หัวข้อ `ผู้โดยสารขึ้นรถ n / m` (เช็คอินแล้ว/ทั้งหมด) + `LinearProgressIndicator` (guard หาร 0)
  + บรรทัด `ถัดไป: <จุดจอดถัดไป>` (จุดที่ยังไม่ถึงเวลา) หรือ `ถึงปลายทางแล้ว`
- จัดกลุ่มผู้โดยสารตาม `boardSeq`/`alightSeq` == `stopSeq` เรียง `stopSeq` —
  แสดง `ขึ้น n คน`/`ลง m คน` (รวม n=0) รายจุดจอด + ตารางรายชื่อ (ชื่อ | ที่นั่ง | สถานะ:
  ขึ้น = `เช็คอินแล้ว`/`รอเช็คอิน`, ลง = `รอลง`)
- จุดจอดที่ถึงเวลาแล้ว (arriveAt ≤ เวลาปัจจุบัน) → ✓ `(ผ่านแล้ว)` · จุดสุดท้าย → `(ปลายทาง)`
- แสดงฝั่งขึ้นก่อนฝั่งลงในจุดจอดเดียวกัน · จัดกลุ่ม/เรียง/รายชื่อ/นับ มีเทสต์ยืนยันทั้งหมด

## 2. ไฟล์ที่เปลี่ยน/สร้าง

| ไฟล์ | สถานะ |
|---|---|
| `app/lib/features/driver/driver_models.dart` | ใหม่ — DriverTripBrief/DriverDay/Trip/ManifestPassenger/DriverManifest + parse เข้ม (ผิดรูปแบบ → ApiException) |
| `app/lib/features/driver/driver_repository.dart` | ใหม่ — fetchDriverToday/startTrip/fetchDriverManifest/endTrip |
| `app/lib/features/driver/driver_providers.dart` | ใหม่ — driverTodayProvider (family by date), driverManifestProvider (family by tripId), startedTripsProvider (cache schedId→tripId) |
| `app/lib/features/driver/driver_schedule_screen.dart` | ใหม่ — จอ D1 |
| `app/lib/features/driver/manifest_screen.dart` | ใหม่ — จอ D2 |
| `app/lib/features/driver/driver_page.dart` | แก้ — placeholder → ห่อ DriverScheduleScreen (เส้นทาง /driver เดิม) |
| `app/lib/features/front/schedule_repository.dart` | แก้ — + `fetchSchedule(schedId)` (GET /schedules/{schedId}) |
| `app/lib/features/front/schedule_models.dart` | แก้ — `_hhmm` → `hhmm` (public ใช้ร่วมกับหน้าคนขับ) |
| `app/test/sprint10_test.dart` | ใหม่ — 15 เทสต์ |
| `docs/agent-handoffs/sprint10-sukhsorn.md` | ใหม่ — เอกสารนี้ |

ไม่ได้แตะ: `backend/`, `database/`, `docs/api/openapi.yaml`, ไฟล์ dirty เดิม
(`database/02_seed_master.sql`, `docs/agile/sukhsorn-check-list.md` คงสภาพเดิม), automation scripts

## 3. ข้อตัดสินใจเรื่องสัญญา (Contract decisions)

1. **`DriverTripBrief` ไม่มี `tripId`** (ข้อจำกัดของ OpenAPI จริง — ดู schema `DriverTripBrief`):
   ระบบจำ `tripId` ได้เฉพาะรอบที่เริ่มจากเครื่องนี้ในรอบใช้งานนี้ (`startedTripsProvider` จากผล 201)
   → **เปิด Manifest ซ้ำ/ปิดรอบข้ามเครื่องหรือหลังเปิดแอปใหม่ไม่ได้** — dialog จะขึ้นหมายเหตุ
   `drv-conflict-gap` และไม่แสดงปุ่มปิดรอบ (บันทึกเป็น blocked acceptance criterion ข้างล่าง)
2. **`vehId` มาจาก `GET /schedules/{schedId}`** (`schedule.vehicle.vehId`) เพราะ `POST /driver/trips`
  ต้องการ `{schedId, vehId}` แต่ `/driver/today` ไม่ส่ง vehId — เทสต์ยืนยัน body ตรงเป๊ะ
3. **Conflict ตรวจฝั่งไคลเอนต์ก่อน POST** — ไม่มี endpoint ตรวจ conflict ใน OpenAPI
  (`BR04_DRIVER_CONFLICT` มีแค่บน `PUT /schedules/{schedId}/assignments`); 409 ตอนเริ่มรอบ
  (เริ่มซ้ำ/รถไม่ตรง) แสดง `message` ของเซิร์ฟเวอร์ตามตัวอักษร
4. **`serviceDate`** ส่งเป็นวันปัจจุบันรูปแบบ `yyyy-MM-dd` (เทสต์ assert ด้วย regex) —
   หัวข้อ AppBar ใช้ `serviceDate` ที่เซิร์ฟเวอร์ตอบกลับ
5. **จุดจอด "ผ่านแล้ว"** คำนวณจาก `arriveAt ≤ DateTime.now()` (เทสต์ใช้เวลาสัมพัทธ์ ±นาที — ไม่พังเมื่อวันเปลี่ยน)
6. UC-22 ใน usecase-spec ระบุ `GET /driver/schedule?date=` แต่ **OpenAPI คือ `/driver/today`** — ใช้ OpenAPI (ตามกติกาสัญญา)
7. `hhmm` ใน `schedule_models.dart` เปลี่ยนจาก private → public (ใช้ร่วมกับ driver screens, impl. เดิม)

## 4. คำสั่ง + ผลลัพธ์จริง

```
# workdir: D:\data\shuttle-sukhsorn\app
dart format lib test
  → Formatted 62 files (0 changed)          [รอบสุดท้าย; ครั้งแรกฟอร์แมตไฟล์ driver 4 ไฟล์]
flutter analyze --no-pub
  → Analyzing app... No issues found! (ran in 5.7s)
flutter test --no-pub test/sprint10_test.dart
  → 00:06 +15: All tests passed!            [รันแรก 13/15 — 2 รายการเป็น assertion/fixture ไม่ตรงกัน
                                             (meta การ์ดซ้ำ, คีย์แถวผู้โดยสารผิดจุด) — แก้เทสต์/fixture แล้ว 15/15]
flutter test --no-pub
  → 00:35 +139: All tests passed!           [124 เดิม + 15 ใหม่ — เทสต์เดิมไม่มีการอ่อนข้อ]

# workdir: D:\data\shuttle-sukhsorn
git status --porcelain
  → ไฟล์ dirty เดิมคงสภาพ (M database/02_seed_master.sql, M docs/agile/sukhsorn-check-list.md …)
    ไฟล์ใหม่เป็น untracked, ไม่มีอะไรถูก stage, HEAD ยังเป็น b107da0
git diff --check
  → เฉพาะ warning CRLF (ไม่มี whitespace error)

# Codex consult (advisory)
node scripts\codex-consult.cjs --question-file <sprint10-question>
  → decision: human_required — Codex usage limit (ลอง again ได้ 11:12 PM)
  → **ไม่มีการกล่าวอ้างว่า Codex อนุมัติงานชุดนี้**
```

## 5. เทสต์ที่เพิ่ม (`app/test/sprint10_test.dart` — 15 รายการ)

1. parse รับสัญญา OpenAPI ของ DriverDay/Trip/DriverManifest + reject รูปแบบผิด
2. D1 contract: GET /driver/today (serviceDate regex + Bearer) + การ์ด/ชิป/สถิติครบ + auto-select + เลือกเปลี่ยนตามแตะ
3. D1 วันว่าง → EmptyState ไม่มีปุ่มเริ่ม
4. D1 403 → ข้อความเซิร์ฟเวอร์ + ลองอีกครั้ง (GET 2 ครั้ง) แล้วได้ข้อมูล
5. ไม่มี TRIP.START → ปุ่มปิดใช้งาน + ไม่มี POST (ทั้ง /driver/trips และ /schedules/1)
6. กรองตามเส้นทาง (ชิป) → การ์ดกรอง/คืน回
7. conflict BR-04: แบนเนอร์ + dialog + รายละเอียด + หมายเหตุ tripId gap + "ออก" ไม่ส่ง POST ใด ๆ
8. เริ่มรอบสำเร็จ: GET schedule → POST {schedId, vehId} เป๊ะ → เปิด Manifest + โหลดวันใหม่
9. 409 เริ่มซ้ำ → ข้อความเซิร์ฟเวอร์, ไม่เปิด Manifest, ปุ่มกลับมาใช้ได้
10. conflict → "ปิดรอบเก่าก่อน" → end 204 → เริ่มรอบใหม่ → เปิด Manifest (วงจรครบ, POST 2 รอบ + end 1)
11. ไม่มี TRIP.END → ไม่มีปุ่มปิดรอบ + ไม่มีหมายเหตุ gap + ไม่มี POST
12. รอบ running ในเครื่องนี้ → แตะการ์ดเปิด Manifest ซ้ำ (GET manifest 2 ครั้ง)
13. Manifest: จัดกลุ่ม/เรียง stop_seq + นับขึ้น-ลง (รวม 0) + ผ่านแล้ว ✓ + ปลายทาง + ถัดไป + รายชื่อ+สถานะครบทุกจุด + ลำดับขึ้นก่อนลง
14. Manifest 404 → ข้อความเซิร์ฟเวอร์ + ลองอีกครั้งสำเร็จ
15. Manifest ไม่มีผู้โดยสาร → 0/0 ไม่หารศูนย์ + นับเป็น 0

## 6. Blocked acceptance criteria (ยังพิสูจน์ไม่ได้ — ห้ามถือว่าผ่าน)

- **tripId gap (T-048/T-049)**: `DriverTripBrief` ไม่มี `tripId` →
  "เปิด Manifest ซ้ำ/ปิดรอบเก่าได้ทุกเครื่อง" ทำได้เฉพาะรอบที่เริ่มจากเครื่องนี้ในรอบใช้งานนี้
  — ต้องแก้สัญญา OpenAPI (เพิ่ม tripId ใน DriverTripBrief หรือ endpoint ค้น trip ที่ running)
- **ข้อจำกัดเดิมที่ยังค้าง** (ไม่ถามซ้ำ): Q6 (cutoff ยกเลิก), Q7 (QR ใช้ซ้ำ/หมดอายุ),
  Q-C/Q19, mapping tab checked_in/no_show, Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24, CONTRACT-DRIFT-01
- **T-050/T-051 ยังไม่ได้ทำ** (คนละ sprint): สแกน QR, ปิดรอบ UI + สรุป (UC-26),
  แท็บล่าง "สแกน/ปิดรอบ" ของ D1 — ยังเป็นขอบเขต Sprint 11 ไม่แอบอ้างทำแล้ว
- **ยังไม่มี**: human review, การรันกับ backend จริง/ฐานข้อมูลจริง, การยืนยัน DoD กับผู้สอน —
  เทสต์ทั้งหมดรันบน FakeBackend ที่จำลองตาม OpenAPI เท่านั้น
- Backend ต้องทำ `GET /driver/today`, `POST /driver/trips` (409 ข้อความ "รอบนี้ถูกเริ่มเดินทางแล้ว
  หรือรถไม่ตรงกับที่จัดไว้"), `GET /driver/trips/{tripId}/manifest`, `POST /driver/trips/{tripId}/end`
  (T-043/T-044/T-045/T-046) ก่อนจะ integration test ได้จริง

## 7. หมายเหตุให้ reviewer

- จุดที่ควรตรวจ: `driver_schedule_screen.dart` `_showConflictDialog` (flow end→start ต่อเนื่อง),
  `startedTripsProvider` (cache ไม่ข้าม session โดยเจตนา), `_buildDay`/`_stopSection` (key ต่อจุดจอด)
- เทสต์ manifest แบบ direct-mount (`pumpManifest`) ใช้ container/backend ชุดเดียวกับแอปแต่ไม่ผ่าน shell —
  เพราะ UC-24 ไม่มี x-permission และไม่ต้องพึ่ง auth/me
- หลังจากนี้: stop ตามคำสั่ง — coordinator เป็นผู้ review และส่งมอบต่อ
